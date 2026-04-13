"""Bible reference parsing, VI1934 lookup, and [[BIBLE:...]] sentinel resolution."""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from scripts.gc_translation.paths import BIBLE_REFS_PATH, VI1934_PATH

SENTINEL_RE = re.compile(r"\[\[BIBLE:([^\]]+)\]\]")
REF_RE = re.compile(
    r"^\s*((?:[1-3]\s+)?[A-Za-z][A-Za-z. ]*?)\s+(\d+):(\d+)(?:-(\d+))?\s*$"
)


def load_bible() -> dict[str, str]:
    return json.loads(Path(VI1934_PATH).read_text(encoding="utf-8"))


def load_bible_refs() -> dict[str, str]:
    return yaml.safe_load(Path(BIBLE_REFS_PATH).read_text(encoding="utf-8"))


def _canonicalize_book(bible_refs: dict[str, str], name: str) -> str:
    name = name.strip().rstrip(".")
    if name in bible_refs:
        vn = bible_refs[name]
        candidates = [e for e, v in bible_refs.items() if v == vn]
        return max(candidates, key=len)
    return name


def parse_ref(ref: str) -> tuple[str, int, int, int]:
    m = REF_RE.match(ref)
    if not m:
        raise ValueError(f"Cannot parse bible reference: {ref!r}")
    book_raw, chapter, vstart, vend = m.groups()
    bible_refs = load_bible_refs()
    book = _canonicalize_book(bible_refs, book_raw)
    return book, int(chapter), int(vstart), int(vend) if vend else int(vstart)


def lookup_verse(
    bible: dict[str, str], book: str, chapter: int, vstart: int, vend: int
) -> str | None:
    parts: list[str] = []
    for v in range(vstart, vend + 1):
        text = bible.get(f"{book} {chapter}:{v}")
        if text is None:
            return None
        parts.append(text)
    return " ".join(parts)


def vietnamese_book_name(bible_refs: dict[str, str], english: str) -> str:
    english = english.strip().rstrip(".")
    return bible_refs.get(english, english)


def resolve_sentinels(
    text: str,
    bible: dict[str, str] | None = None,
    bible_refs: dict[str, str] | None = None,
) -> tuple[str, list[str]]:
    if bible is None:
        bible = load_bible()
    if bible_refs is None:
        bible_refs = load_bible_refs()

    unresolved: list[str] = []

    def replace(m: re.Match[str]) -> str:
        ref_str = m.group(1).strip()
        try:
            book, chapter, vstart, vend = parse_ref(ref_str)
        except ValueError:
            unresolved.append(ref_str)
            return m.group(0)
        verse = lookup_verse(bible, book, chapter, vstart, vend)
        if verse is None:
            unresolved.append(ref_str)
            return m.group(0)
        vi_book = vietnamese_book_name(bible_refs, book)
        vrange = f"{vstart}" if vstart == vend else f"{vstart}-{vend}"
        return f"> \"{verse}\"\n> <cite>({vi_book} {chapter}:{vrange})</cite>"

    return SENTINEL_RE.sub(replace, text), unresolved
