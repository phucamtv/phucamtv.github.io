"""Concatenate translated chunks, prepend front matter, write Hugo chapter file."""
from __future__ import annotations

import datetime as _dt
import sys
from pathlib import Path

import yaml

from scripts.gc_translation.lint import find_unresolved_sentinels, lint_text
from scripts.gc_translation.paths import (
    HUGO_BOOK_DIR,
    REPO_ROOT,
    TRANSLATED_DIR,
    hugo_chapter_path,
)

CHAPTERS_YAML = REPO_ROOT / "data" / "gc-translation" / "chapters.yaml"


def build_front_matter(
    *, chapter: int, vi_title: str, summary: str, date: str
) -> str:
    def esc(s: str) -> str:
        return s.replace('"', '\\"')
    lines = [
        "---",
        f'title: "Chương {chapter}: {esc(vi_title)}"',
        f'slug: "chuong-{chapter:02d}"',
        'author: "ellen-g-white"',
        'book: "thien-ac-dau-tranh"',
        f"chapter: {chapter}",
        f"weight: {chapter}",
        f"date: {date}",
        f'summary: "{esc(summary)}"',
        "---",
        "",
    ]
    return "\n".join(lines)


def assemble_chapter_text(front_matter: str, translated_chunks: list[str]) -> str:
    body = "\n\n".join(c.strip() for c in translated_chunks if c.strip())
    body = lint_text(body)
    return front_matter + body + "\n"


def _load_chapter_meta(chapter: int) -> dict:
    chapters = yaml.safe_load(CHAPTERS_YAML.read_text(encoding="utf-8"))
    for c in chapters:
        if c["number"] == chapter:
            return c
    raise ValueError(f"Chapter {chapter} not in {CHAPTERS_YAML}")


def _collect_translated_chunks(chapter: int) -> list[str]:
    pattern = f"ch{chapter:02d}-*.md"
    files = sorted(TRANSLATED_DIR.glob(pattern))
    if not files:
        raise FileNotFoundError(f"No translated chunks for chapter {chapter}")
    return [f.read_text(encoding="utf-8") for f in files]


def assemble_chapter_file(chapter: int, vi_title: str, summary: str) -> None:
    date = _dt.date.today().isoformat()
    chunks = _collect_translated_chunks(chapter)
    fm = build_front_matter(
        chapter=chapter, vi_title=vi_title, summary=summary, date=date
    )
    text = assemble_chapter_text(fm, chunks)
    unresolved = find_unresolved_sentinels(text)
    HUGO_BOOK_DIR.mkdir(parents=True, exist_ok=True)
    out_path = hugo_chapter_path(chapter)
    out_path.write_text(text, encoding="utf-8")
    print(f"ch{chapter:02d}: wrote {out_path}", file=sys.stderr)
    if unresolved:
        print(
            f"ch{chapter:02d}: WARNING — {len(unresolved)} unresolved bible refs: {unresolved}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("--vi-title", required=True)
    ap.add_argument("--summary", default="")
    args = ap.parse_args()
    assemble_chapter_file(args.chapter, args.vi_title, args.summary)
