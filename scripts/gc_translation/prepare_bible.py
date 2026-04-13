"""One-off: parse local VI1934 Docusaurus markdown → data/bible/vi1934.json."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

from scripts.gc_translation.paths import BIBLE_REFS_PATH, VI1934_PATH

SOURCE_ROOT = Path("/Users/htruong/code/kt-static/VI1934")

SUPERSCRIPT_MAP = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")
VERSE_SPLIT_RE = re.compile(r"([⁰¹²³⁴⁵⁶⁷⁸⁹]+)")
FRONT_MATTER_RE = re.compile(r"^---\n(.*?)\n---\n(.*)$", re.DOTALL)


def parse_front_matter(text: str) -> tuple[dict, str]:
    m = FRONT_MATTER_RE.match(text)
    if not m:
        raise ValueError("No YAML front matter")
    return yaml.safe_load(m.group(1)), m.group(2)


def parse_verses(body: str) -> dict[int, str]:
    body_lines = [ln for ln in body.splitlines() if not ln.lstrip().startswith("#")]
    flat = "\n".join(body_lines)
    matches = list(VERSE_SPLIT_RE.finditer(flat))
    out: dict[int, str] = {}
    for i, m in enumerate(matches):
        verse_num = int(m.group(1).translate(SUPERSCRIPT_MAP))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(flat)
        text = re.sub(r"\s+", " ", flat[start:end]).strip()
        if text:
            out[verse_num] = text
    return out


def build_slug_to_english_map(bible_refs: dict[str, str]) -> dict[str, str]:
    vn_to_candidates: dict[str, list[str]] = {}
    for english, vi in bible_refs.items():
        vn_to_candidates.setdefault(vi.strip(), []).append(english)
    vi_to_en = {vi: max(c, key=len) for vi, c in vn_to_candidates.items()}

    mapping: dict[str, str] = {}
    unresolved: list[tuple[str, str]] = []
    for slug_dir in sorted(SOURCE_ROOT.iterdir()):
        if not slug_dir.is_dir():
            continue
        ch1 = slug_dir / "1.md"
        if not ch1.exists():
            continue
        fm, _ = parse_front_matter(ch1.read_text(encoding="utf-8"))
        vi_book = str(fm.get("book", "")).strip()
        english = vi_to_en.get(vi_book)
        if english is None:
            unresolved.append((slug_dir.name, vi_book))
            continue
        mapping[slug_dir.name] = english

    if unresolved:
        raise RuntimeError(
            "Could not map these slugs to English book names via bible-refs.yaml: "
            + ", ".join(f"{s}={v!r}" for s, v in unresolved)
            + ". Add the Vietnamese name to bible-refs.yaml and retry."
        )
    return mapping


def main() -> int:
    bible_refs = yaml.safe_load(Path(BIBLE_REFS_PATH).read_text(encoding="utf-8"))
    slug_to_en = build_slug_to_english_map(bible_refs)
    print(f"Mapped {len(slug_to_en)} book slugs to English names.", file=sys.stderr)

    out: dict[str, str] = {}
    chapter_count = 0
    for slug, english in slug_to_en.items():
        for ch_file in sorted(
            (SOURCE_ROOT / slug).glob("*.md"),
            key=lambda p: int(p.stem) if p.stem.isdigit() else -1,
        ):
            if not ch_file.stem.isdigit():
                continue
            fm, body = parse_front_matter(ch_file.read_text(encoding="utf-8"))
            chapter = int(fm.get("chapter", ch_file.stem))
            for v, text in parse_verses(body).items():
                out[f"{english} {chapter}:{v}"] = text
            chapter_count += 1

    VI1934_PATH.parent.mkdir(parents=True, exist_ok=True)
    VI1934_PATH.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Wrote {len(out)} verses across {chapter_count} chapters to {VI1934_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
