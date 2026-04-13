"""Scrape egwwritings book 132 TOC and emit data/gc-translation/chapters.yaml.

Output format:
  - number: 1
    en_title: The Destruction of Jerusalem
    url: https://m.egwwritings.org/en/book/132.17
"""
from __future__ import annotations

import sys

import yaml
from bs4 import BeautifulSoup

from scripts.gc_translation.scrape_chapter import fetch_url
from scripts.gc_translation.paths import REPO_ROOT

TOC_URL = "https://m.egwwritings.org/en/book/132/toc"
OUT_PATH = REPO_ROOT / "data" / "gc-translation" / "chapters.yaml"


def parse_toc(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    chapters: list[dict] = []
    seen_urls = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/book/132." not in href and "/book/132/" not in href:
            continue
        text = a.get_text(" ", strip=True)
        if not text or text.lower() in {"contents", "back", "next"}:
            continue
        if text in {"Read", "Details"}:
            continue
        url = href if href.startswith("http") else f"https://m.egwwritings.org{href}"
        if url.endswith("/info") or url.endswith(".0"):
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)
        chapters.append({"en_title": text, "url": url})
    skip_prefixes = ("Preface", "Introduction", "Contents", "Appendix", "Index")
    chapters = [c for c in chapters if not c["en_title"].startswith(skip_prefixes)]
    for i, c in enumerate(chapters, start=1):
        c["number"] = i
    return chapters


def main() -> int:
    html = fetch_url(TOC_URL)
    chapters = parse_toc(html)
    if len(chapters) != 42:
        print(
            f"WARNING: found {len(chapters)} chapters, expected 42. "
            "Review and edit data/gc-translation/chapters.yaml before proceeding.",
            file=sys.stderr,
        )
    OUT_PATH.write_text(yaml.safe_dump(chapters, allow_unicode=True, sort_keys=False))
    print(f"Wrote {len(chapters)} chapters to {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
