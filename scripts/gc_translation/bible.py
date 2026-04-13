"""Bible reference parsing, VI1934 lookup, and [[BIBLE:...]] sentinel resolution."""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from scripts.gc_translation.paths import BIBLE_REFS_PATH, VI1934_PATH

SENTINEL_RE = re.compile(
    r"(?P<lp>\()?\[\[BIBLE:(?P<ref>[^\]]+)\]\](?P<rp>\))?[.,;:!?]?"
)
REF_RE = re.compile(
    r"^\s*((?:[1-3]\s+)?[A-Za-z][A-Za-z. ]*?)\s+(\d+):(\d+)(?:-(\d+))?\s*$"
)
MULTI_REF_RE = re.compile(
    r"^\s*((?:[1-3]\s+)?[A-Za-z][A-Za-z. ]*?)\s+(\d+)(?::([\d,\-\s]+?))?\s*$"
)
PART_RE = re.compile(r"^(\d+)(?:-(\d+))?$")

SINGLE_CHAPTER_BOOKS = {"Obadiah", "Philemon", "2 John", "3 John", "Jude"}


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


def parse_ref_multi(ref: str) -> tuple[str, int, list[tuple[int, int]], str]:
    """Parse a bible ref that may include comma-separated verse parts.

    Returns (book, chapter, parts, verse_spec) where parts is a list of
    (start, end) ranges and verse_spec is the normalized original verse string
    (e.g. "9,21-22") for use in the citation.
    """
    bible_refs = load_bible_refs()
    sc_re = re.compile(
        r"^\s*((?:[1-3]\s+)?[A-Za-z][A-Za-z. ]*?)\s+([\d,\-\s]+?)\s*$"
    )
    sc_m = sc_re.match(ref)
    if sc_m:
        book_try = _canonicalize_book(bible_refs, sc_m.group(1))
        if book_try in SINGLE_CHAPTER_BOOKS:
            ref = f"{book_try} 1:{sc_m.group(2)}"
    m = MULTI_REF_RE.match(ref)
    if not m:
        raise ValueError(f"Cannot parse bible reference: {ref!r}")
    book_raw, chapter, verse_part = m.groups()
    book = _canonicalize_book(bible_refs, book_raw)
    if verse_part is None:
        return book, int(chapter), [], ""
    parts: list[tuple[int, int]] = []
    normalized_chunks: list[str] = []
    for chunk in verse_part.split(","):
        chunk = chunk.strip()
        pm = PART_RE.match(chunk)
        if not pm:
            raise ValueError(f"Cannot parse verse part: {chunk!r}")
        a, b = pm.groups()
        start = int(a)
        end = int(b) if b else start
        parts.append((start, end))
        normalized_chunks.append(chunk)
    return book, int(chapter), parts, ",".join(normalized_chunks)


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
        ref_str = m.group("ref").strip()
        lp, rp = m.group("lp"), m.group("rp")
        # If unbalanced parens, restore them around the original on failure.
        unbalanced = bool(lp) ^ bool(rp)
        try:
            book, chapter, parts, verse_spec = parse_ref_multi(ref_str)
        except ValueError:
            unresolved.append(ref_str)
            return m.group(0)
        if not parts:
            verses: list[int] = []
            v = 1
            while bible.get(f"{book} {chapter}:{v}") is not None:
                verses.append(v)
                v += 1
            if not verses:
                unresolved.append(ref_str)
                return m.group(0)
            parts = [(verses[0], verses[-1])]
            verse_spec = f"{verses[0]}-{verses[-1]}"
        segments: list[str] = []
        for vstart, vend in parts:
            verse = lookup_verse(bible, book, chapter, vstart, vend)
            if verse is None:
                unresolved.append(ref_str)
                return m.group(0)
            segments.append(verse)
        vi_book = vietnamese_book_name(bible_refs, book)
        body = " ".join(segments)
        if book in SINGLE_CHAPTER_BOOKS:
            cite = f"{vi_book} {verse_spec}"
        else:
            cite = f"{vi_book} {chapter}:{verse_spec}"
        return f"\n\n> \"{body}\"\n> <cite>({cite})</cite>\n\n"

    return SENTINEL_RE.sub(replace, text), unresolved
