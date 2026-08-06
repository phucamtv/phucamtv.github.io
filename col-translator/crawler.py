"""Phase 1: Crawl Christ's Object Lessons chapters from egwwritings.org.

egwwritings.org's mobile site paginates chapter content: each URL
`/en/book/15.<para_id>` returns a window of paragraphs centered on that para_id
(typically 20-50 paragraphs). To get a full chapter we derive each chapter's
start paragraph id from the TOC, then iterate requests stepping forward until
we reach the next chapter's start id. Paragraphs are deduped by their
`data-para-id` attribute.
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

BASE_DIR = Path(__file__).parent
CHAPTERS_DIR = BASE_DIR / "chapters"
MANIFEST_PATH = CHAPTERS_DIR / "manifest.json"

# Christ's Object Lessons is book id 15 on egwwritings.org.
BOOK_ID = 15
TOC_URLS = [
    f"https://m.egwwritings.org/en/book/{BOOK_ID}/toc",
    f"https://egwwritings.org/book/b{BOOK_ID}",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

RATE_LIMIT_SECONDS = 1.0
MAX_RETRIES = 3
PARA_STEP = 20  # how far to advance para-id between page fetches


async def fetch(client: httpx.AsyncClient, url: str) -> str:
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = await client.get(url, headers=HEADERS, follow_redirects=True, timeout=30.0)
            if resp.status_code >= 400:
                raise httpx.HTTPStatusError(
                    f"HTTP {resp.status_code}", request=resp.request, response=resp
                )
            return resp.text
        except (httpx.HTTPError, httpx.RequestError) as e:
            last_err = e
            wait = 2 ** attempt
            print(f"  ! fetch attempt {attempt+1} failed ({e}); retrying in {wait}s")
            await asyncio.sleep(wait)
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def _abs_url(href: str, base: str) -> str:
    if href.startswith("http"):
        return href
    if href.startswith("//"):
        return "https:" + href
    if href.startswith("/"):
        m = re.match(r"^(https?://[^/]+)", base)
        if m:
            return m.group(1) + href
    return base.rstrip("/") + "/" + href.lstrip("/")


CHAPTER_HREF_RE = re.compile(rf"/book/{BOOK_ID}\.(\d+)(?:/|$|\?|#)")


def parse_toc(html: str, source_url: str) -> list[dict]:
    """Extract chapter list. Each entry has {title, url, start_para}."""
    soup = BeautifulSoup(html, "lxml")
    items: list[dict] = []
    seen_paras: set[int] = set()

    for a in soup.select("a"):
        href = a.get("href", "").strip()
        title = " ".join(a.get_text(" ", strip=True).split())
        if not href or not title:
            continue
        if href.rstrip("/").endswith("/toc") or href.rstrip("/").endswith("/info"):
            continue
        m = CHAPTER_HREF_RE.search(href)
        if not m:
            continue
        low = title.lower()
        if low in {"toc", "table of contents", "back", "home", "next", "previous", "read", "details"}:
            continue
        para = int(m.group(1))
        if para in seen_paras:
            continue
        seen_paras.add(para)
        items.append(
            {
                "title": title,
                "url": _abs_url(href, source_url),
                "start_para": para,
            }
        )
    items.sort(key=lambda x: x["start_para"])
    return items


def extract_title(html: str, fallback: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for sel in ["h3.egw_content_wrapper", "h2.egw_content_wrapper", "h1.egw_content_wrapper", "h1", "h2", "h3"]:
        el = soup.select_one(sel)
        if el:
            t = " ".join(el.get_text(" ", strip=True).split())
            if t and len(t) < 200:
                return t
    return fallback


def extract_paragraphs_in_range(
    html: str, start: int, end_exclusive: int
) -> list[tuple[int, str]]:
    """Return list of (para_id_tail, text) for paragraphs within [start, end)."""
    soup = BeautifulSoup(html, "lxml")
    out: list[tuple[int, str]] = []
    seen_ids: set[int] = set()

    # Primary: look for any element with data-para-id="<BOOK_ID>.<N>"
    for el in soup.select("[data-para-id]"):
        pid = el.get("data-para-id", "")
        m = re.match(rf"{BOOK_ID}\.(\d+)$", pid)
        if not m:
            continue
        pnum = int(m.group(1))
        if pnum in seen_ids or pnum < start or pnum >= end_exclusive:
            continue
        # Find the nearest content span (skip heading containers).
        tag_name = getattr(el, "name", "")
        if tag_name and tag_name.startswith("h"):
            # chapter heading — skip for body extraction
            continue
        text_el = el.select_one("span.egw_content") or el
        text = " ".join(text_el.get_text(" ", strip=True).split())
        if text and len(text) > 10:
            seen_ids.add(pnum)
            out.append((pnum, text))
    return out


async def fetch_chapter_body(
    client: httpx.AsyncClient, start_para: int, end_para_exclusive: int, title_hint: str
) -> tuple[str, list[str]]:
    """Fetch all pages needed to cover [start_para, end_para_exclusive) paragraphs."""
    collected: dict[int, str] = {}
    title = title_hint
    cursor = start_para
    pages_fetched = 0
    max_pages = max(8, (end_para_exclusive - start_para) // PARA_STEP + 4)

    while cursor < end_para_exclusive and pages_fetched < max_pages:
        url = f"https://m.egwwritings.org/en/book/{BOOK_ID}.{cursor}"
        try:
            html = await fetch(client, url)
        except Exception as e:
            print(f"    ! page fetch failed at {cursor}: {e}")
            break
        pages_fetched += 1

        if pages_fetched == 1:
            title = extract_title(html, title_hint)

        found = extract_paragraphs_in_range(html, start_para, end_para_exclusive)
        if not found:
            cursor += PARA_STEP
            await asyncio.sleep(RATE_LIMIT_SECONDS)
            continue
        new_added = 0
        max_pnum_in_page = cursor
        for pnum, text in found:
            max_pnum_in_page = max(max_pnum_in_page, pnum)
            if pnum not in collected:
                collected[pnum] = text
                new_added += 1

        # Advance cursor past what we got, with a little step to find the next window
        if new_added == 0:
            # nothing new — break to avoid infinite loop
            break
        cursor = max_pnum_in_page + 1

        await asyncio.sleep(RATE_LIMIT_SECONDS)

    paragraphs = [collected[k] for k in sorted(collected)]
    return title, paragraphs


async def crawl() -> list[dict]:
    CHAPTERS_DIR.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(http2=False) as client:
        toc_items: list[dict] = []
        used_url = ""
        for toc_url in TOC_URLS:
            try:
                print(f"Fetching TOC: {toc_url}")
                html = await fetch(client, toc_url)
                toc_items = parse_toc(html, toc_url)
                if toc_items:
                    used_url = toc_url
                    break
                print("  (no chapter links found; trying next fallback)")
            except Exception as e:
                print(f"  ! TOC fetch failed: {e}")

        if not toc_items:
            print(
                "ERROR: Could not parse chapter list from any TOC URL.\n"
                "Inspect the pages manually:\n  - " + "\n  - ".join(TOC_URLS)
            )
            return []

        print(f"Found {len(toc_items)} chapter links in TOC ({used_url})")
        # Soft upper bound for the LAST chapter's range.
        last_end = toc_items[-1]["start_para"] + 2000

        manifest: list[dict] = []
        intro_count = 0
        body_index = 0

        for idx, item in enumerate(toc_items):
            start_para = item["start_para"]
            end_para = (
                toc_items[idx + 1]["start_para"] if idx + 1 < len(toc_items) else last_end
            )

            low = item["title"].lower()
            is_intro = any(
                kw in low
                for kw in ("preface", "foreword", "introduction", "publishers", "contents")
            )
            if is_intro:
                cid = "ch00" if intro_count == 0 else f"ch00{chr(ord('a') + intro_count)}"
                intro_count += 1
            else:
                body_index += 1
                cid = f"ch{body_index:02d}"

            print(f"[{idx+1}/{len(toc_items)}] Fetching: {item['title']} "
                  f"(paras {start_para}..{end_para - 1})")
            try:
                title, paragraphs = await fetch_chapter_body(
                    client, start_para, end_para, item["title"]
                )
                if not paragraphs:
                    print(f"  ! no paragraphs extracted for {item['title']}")
                    continue
                final_title = title or item["title"]
                filename = f"{cid}.txt"
                out = CHAPTERS_DIR / filename
                body = "\n\n".join(paragraphs)
                out.write_text(f"TITLE: {final_title}\n\n{body}\n", encoding="utf-8")
                manifest.append(
                    {
                        "id": cid,
                        "title": final_title,
                        "url": item["url"],
                        "filename": filename,
                        "paragraphs": len(paragraphs),
                    }
                )
                print(f"  ok — {len(paragraphs)} paragraphs")
            except Exception as e:
                print(f"  ! failed: {e}")

        MANIFEST_PATH.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\nSaved manifest with {len(manifest)} chapters -> {MANIFEST_PATH}")
        return manifest


def already_crawled() -> bool:
    if not MANIFEST_PATH.exists():
        return False
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return False
    if not manifest:
        return False
    for entry in manifest:
        if not (CHAPTERS_DIR / entry["filename"]).exists():
            return False
    return True


def main() -> int:
    if already_crawled():
        print("Phase 1 skip: chapters already crawled.")
        return 0
    manifest = asyncio.run(crawl())
    return 0 if manifest else 1


if __name__ == "__main__":
    sys.exit(main())
