"""Fetch a chapter's HTML from egwwritings and extract plain text.

The extracted text uses '## ' prefixes for h2 headings so downstream chunking
has an unambiguous section boundary marker.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

from scripts.gc_translation.paths import (
    chapter_source_html,
    chapter_source_text,
    SOURCE_DIR,
)

USER_AGENT = "phucam.tv-gc-scraper/1.0 (contact: site admin)"


def fetch_url(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def extract_chapter(html: str) -> tuple[str, str]:
    """Return (title, plain_text_with_h2_markers)."""
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else ""
    lines: list[str] = []
    article = soup.find("article") or soup.body or soup
    for el in article.find_all(["h1", "h2", "h3", "p"]):
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        if el.name == "h1":
            continue
        if el.name in ("h2", "h3"):
            lines.append(f"## {text}")
        else:
            lines.append(text)
    return title, "\n\n".join(lines)


def scrape_chapter(chapter_num: int, url: str, force: bool = False) -> None:
    html_path = chapter_source_html(chapter_num)
    text_path = chapter_source_text(chapter_num)
    if html_path.exists() and text_path.exists() and not force:
        print(f"ch{chapter_num:02d}: already scraped, skipping", file=sys.stderr)
        return
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"ch{chapter_num:02d}: fetching {url}", file=sys.stderr)
    html = fetch_url(url)
    html_path.write_text(html, encoding="utf-8")
    title, text = extract_chapter(html)
    text_path.write_text(f"# {title}\n\n{text}\n", encoding="utf-8")
    print(f"ch{chapter_num:02d}: wrote {text_path}", file=sys.stderr)
    time.sleep(1.0)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("url")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    scrape_chapter(args.chapter, args.url, force=args.force)
