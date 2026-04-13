"""Top-level orchestrator for the GC translation pipeline.

Usage:
  python -m scripts.gc_translation.run scrape [--chapter N]
  python -m scripts.gc_translation.run chunk   [--chapter N]
  python -m scripts.gc_translation.run translate [--chapter N]
  python -m scripts.gc_translation.run assemble  [--chapter N]
  python -m scripts.gc_translation.run all       [--chapter N]
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

from scripts.gc_translation.assemble import assemble_chapter_file
from scripts.gc_translation.chunk import chunk_text
from scripts.gc_translation.paths import (
    CHAPTERS,
    CHUNK_DIR,
    REPO_ROOT,
    chapter_source_text,
    chunk_path,
    translated_path,
)
from scripts.gc_translation.scrape_chapter import scrape_chapter
from scripts.gc_translation.translate import translate_chunk_file

CHAPTERS_YAML = REPO_ROOT / "data" / "gc-translation" / "chapters.yaml"


def load_chapters() -> list[dict]:
    return yaml.safe_load(CHAPTERS_YAML.read_text(encoding="utf-8"))


def _chapters_iter(chapters: list[dict], only: int | None):
    return [c for c in chapters if only is None or c["number"] == only]


def do_scrape(chapters: list[dict], only: int | None) -> None:
    for c in _chapters_iter(chapters, only):
        scrape_chapter(c["number"], c["url"])


def do_chunk(chapters: list[dict], only: int | None) -> None:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    for c in _chapters_iter(chapters, only):
        n = c["number"]
        src = chapter_source_text(n)
        if not src.exists():
            print(f"ch{n:02d}: no source text; run scrape first", file=sys.stderr)
            continue
        chunks = chunk_text(src.read_text(encoding="utf-8"))
        for old in CHUNK_DIR.glob(f"ch{n:02d}-*.txt"):
            old.unlink()
        for i, t in enumerate(chunks, start=1):
            chunk_path(n, i).write_text(t, encoding="utf-8")
        print(f"ch{n:02d}: wrote {len(chunks)} chunks", file=sys.stderr)


def do_translate(chapters: list[dict], only: int | None) -> None:
    for c in _chapters_iter(chapters, only):
        n = c["number"]
        chunk_files = sorted(CHUNK_DIR.glob(f"ch{n:02d}-*.txt"))
        for cf in chunk_files:
            chunk_num = int(cf.stem.split("-")[1])
            translate_chunk_file(n, chunk_num)


def do_assemble(chapters: list[dict], only: int | None) -> None:
    for c in _chapters_iter(chapters, only):
        n = c["number"]
        raw_title = c.get("vi_title") or c["en_title"]
        vi_title = re.sub(r"^Chapter\s+\d+\s*[—–-]\s*", "", raw_title)
        summary = c.get("summary", "")
        chunk_files = sorted(CHUNK_DIR.glob(f"ch{n:02d}-*.txt"))
        missing: list[int] = []
        for cf in chunk_files:
            chunk_num = int(cf.stem.split("-")[1])
            if not translated_path(n, chunk_num).exists():
                missing.append(chunk_num)
        if missing:
            print(
                f"ch{n:02d}: skipping assemble — missing translated chunks: {missing}",
                file=sys.stderr,
            )
            continue
        assemble_chapter_file(n, vi_title=vi_title, summary=summary)


STAGES = {
    "scrape": do_scrape,
    "chunk": do_chunk,
    "translate": do_translate,
    "assemble": do_assemble,
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=list(STAGES) + ["all"])
    ap.add_argument("--chapter", type=int, default=None)
    args = ap.parse_args()

    chapters = load_chapters()
    if args.chapter is not None and not (1 <= args.chapter <= CHAPTERS):
        print(f"--chapter must be in 1..{CHAPTERS}", file=sys.stderr)
        return 2

    if args.stage == "all":
        for stage in ("scrape", "chunk", "translate", "assemble"):
            STAGES[stage](chapters, args.chapter)
    else:
        STAGES[args.stage](chapters, args.chapter)
    return 0


if __name__ == "__main__":
    sys.exit(main())
