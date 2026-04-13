"""Split a chapter into section-level chunks for translation."""
from __future__ import annotations

import re

H2_RE = re.compile(r"^## ", re.MULTILINE)


def _split_oversized(section: str, target_words: int) -> list[str]:
    paragraphs = [p for p in section.split("\n\n") if p.strip()]
    heading = None
    if paragraphs and paragraphs[0].startswith("## "):
        heading = paragraphs.pop(0)
    out: list[str] = []
    buf: list[str] = []
    wc = 0
    for p in paragraphs:
        pw = len(p.split())
        if wc + pw > target_words and buf:
            out.append("\n\n".join(buf))
            buf = []
            wc = 0
        buf.append(p)
        wc += pw
    if buf:
        out.append("\n\n".join(buf))
    if heading:
        out[0] = f"{heading}\n\n{out[0]}" if out else heading
    return out


def chunk_text(text: str, target_words: int = 1500) -> list[str]:
    lines = text.splitlines()
    if lines and lines[0].startswith("# "):
        text = "\n".join(lines[1:]).strip()
    parts = re.split(r"(?m)(^## .*$)", text)
    sections: list[str] = []
    if parts[0].strip():
        sections.append(parts[0].strip())
    for i in range(1, len(parts), 2):
        heading = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        sections.append(f"{heading}\n\n{body.strip()}".strip())
    out: list[str] = []
    for sec in sections:
        if len(sec.split()) > target_words:
            out.extend(_split_oversized(sec, target_words))
        else:
            out.append(sec)
    return out


if __name__ == "__main__":
    import argparse, sys
    from scripts.gc_translation.paths import (
        chapter_source_text, chunk_path, CHUNK_DIR,
    )
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    args = ap.parse_args()
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    src = chapter_source_text(args.chapter).read_text(encoding="utf-8")
    chunks = chunk_text(src)
    for i, c in enumerate(chunks, start=1):
        chunk_path(args.chapter, i).write_text(c, encoding="utf-8")
    print(f"ch{args.chapter:02d}: wrote {len(chunks)} chunks", file=sys.stderr)
