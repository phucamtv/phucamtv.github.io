"""Phase 2: Build a shared glossary via Claude API."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from anthropic import Anthropic

BASE_DIR = Path(__file__).parent
CHAPTERS_DIR = BASE_DIR / "chapters"
GLOSSARY_DIR = BASE_DIR / "glossary"
MANIFEST_PATH = CHAPTERS_DIR / "manifest.json"
GLOSSARY_PATH = GLOSSARY_DIR / "glossary.json"

MODEL = "claude-opus-4-5"
BATCH_SIZE = 3
MAX_TOKENS = 4096

SEED_TERMS: list[dict] = [
    {"en": "grace", "vi": "ân điển", "category": "theology", "note": "Ân điển cứu rỗi"},
    {"en": "salvation", "vi": "sự cứu rỗi", "category": "theology", "note": ""},
    {"en": "atonement", "vi": "sự chuộc tội", "category": "theology", "note": ""},
    {"en": "righteousness", "vi": "sự công bình", "category": "theology", "note": ""},
    {"en": "sanctification", "vi": "sự thánh hóa", "category": "theology", "note": ""},
    {"en": "justification", "vi": "sự xưng công bình", "category": "theology", "note": ""},
    {"en": "repentance", "vi": "sự ăn năn", "category": "theology", "note": ""},
    {"en": "Holy Spirit", "vi": "Đức Thánh Linh", "category": "proper_noun", "note": "Always capitalize"},
    {"en": "Sabbath", "vi": "Ngày Sa-bát", "category": "proper_noun", "note": ""},
    {"en": "Scripture", "vi": "Kinh Thánh", "category": "proper_noun", "note": ""},
    {"en": "parable", "vi": "ngụ ngôn", "category": "theology", "note": ""},
    {"en": "kingdom of heaven", "vi": "nước thiên đàng", "category": "theology", "note": ""},
    {"en": "kingdom of God", "vi": "nước Đức Chúa Trời", "category": "theology", "note": ""},
    {"en": "Christ", "vi": "Đấng Christ", "category": "proper_noun", "note": ""},
    {"en": "Father", "vi": "Đức Chúa Cha", "category": "proper_noun", "note": "When referring to God"},
    {"en": "Son of God", "vi": "Con Đức Chúa Trời", "category": "proper_noun", "note": ""},
    {"en": "gospel", "vi": "tin lành", "category": "theology", "note": ""},
    {"en": "covenant", "vi": "giao ước", "category": "theology", "note": ""},
    {"en": "faith", "vi": "đức tin", "category": "theology", "note": ""},
    {"en": "sin", "vi": "tội lỗi", "category": "theology", "note": ""},
]

SYSTEM_PROMPT = """You are a senior Seventh-day Adventist theological translator (English -> Vietnamese).
You are helping build a shared glossary for translating Ellen G. White's "Christ's Object Lessons" to Vietnamese.
Your translations must match the Vietnamese Bible (1934 / truyền thống) register and SDA devotional usage.

Content rules (MUST FOLLOW):
- Always use "Đức Chúa Giê-su" (never "Chúa Giê-su", "Jesus", or "Giê-xu").
- "Sa-bát" (not "Sabát").
- "Do Thái Giáo" (not "Giu-đa-izt").
- "Cơ-đốc" (not "Cơ Đốc").
- Divine names capitalized: "Đức Chúa Trời", "Đức Thánh Linh", "Kinh Thánh", "Đức Chúa Giê-su".
- When God/Chúa is the subject, use "ban phước" (never "chúc phước").
"""

USER_TEMPLATE = """Extract theological / thematic terms from the following English chapter(s) that will need
**consistent** Vietnamese translation across the whole book.

Categories (use these exact strings):
- "theology"       : doctrinal words (grace, atonement, sanctification, righteousness, repentance, faith, salvation, covenant, kingdom of heaven, etc.)
- "parable_title"  : named parables (The Sower, Prodigal Son, Talents, Ten Virgins, etc.)
- "proper_noun"    : names / titles (Christ, Father, Holy Ghost, Sabbath, Scripture, Pharisee, etc.)
- "ellen_white_idiom": distinctive phrases Ellen White reuses across the book

Already in our seed glossary (do NOT repeat, but you may refine "note" if helpful):
{seed_list}

Output rules:
- Output **only** a strict JSON array. No prose, no markdown fences.
- Each element: {{"en": "...", "vi": "...", "category": "...", "note": "..."}}
- "note" is optional context (<= 120 chars). Use "" if none.
- Do not invent terms that don't appear in the text.

CHAPTERS:
{chapters_block}
"""


def load_manifest() -> list[dict]:
    if not MANIFEST_PATH.exists():
        raise SystemExit(f"Manifest not found: {MANIFEST_PATH}. Run phase 1 first.")
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def read_chapter(entry: dict) -> str:
    return (CHAPTERS_DIR / entry["filename"]).read_text(encoding="utf-8")


def chunk(seq: list, size: int):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _extract_json_array(text: str) -> list:
    """Best-effort: locate the first JSON array in text and parse it."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise ValueError("No JSON array found in response")
    return json.loads(text[start : end + 1])


def merge(glossary: dict[str, dict], incoming: list[dict]) -> None:
    for item in incoming:
        en = (item.get("en") or "").strip()
        vi = (item.get("vi") or "").strip()
        if not en or not vi:
            continue
        key = en.lower()
        category = (item.get("category") or "theology").strip()
        note = (item.get("note") or "").strip()
        if key in glossary:
            # Prefer longer / more specific note; never overwrite seed vi.
            existing = glossary[key]
            if len(note) > len(existing.get("note", "")):
                existing["note"] = note
        else:
            glossary[key] = {"en": en, "vi": vi, "category": category, "note": note}


def format_seed_list(seed: list[dict]) -> str:
    lines = [f'- {s["en"]} -> {s["vi"]}' for s in seed]
    return "\n".join(lines)


def build() -> list[dict]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY is not set")

    GLOSSARY_DIR.mkdir(parents=True, exist_ok=True)
    client = Anthropic(api_key=api_key)
    manifest = load_manifest()
    if not manifest:
        raise SystemExit("Manifest is empty")

    glossary: dict[str, dict] = {}
    merge(glossary, SEED_TERMS)
    seed_block = format_seed_list(SEED_TERMS)

    total_batches = (len(manifest) + BATCH_SIZE - 1) // BATCH_SIZE

    for bidx, batch in enumerate(chunk(manifest, BATCH_SIZE), start=1):
        chapters_block_parts = []
        for entry in batch:
            body = read_chapter(entry)
            chapters_block_parts.append(
                f"=== {entry['id']} — {entry['title']} ===\n{body}"
            )
        chapters_block = "\n\n".join(chapters_block_parts)

        user_prompt = USER_TEMPLATE.format(
            seed_list=seed_block, chapters_block=chapters_block
        )

        print(f"[glossary batch {bidx}/{total_batches}] {[e['id'] for e in batch]}")
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
        except Exception as e:
            print(f"  ! API error: {e}")
            continue

        text = "".join(
            block.text for block in resp.content if getattr(block, "type", "") == "text"
        )
        try:
            items = _extract_json_array(text)
        except Exception as e:
            print(f"  ! could not parse JSON: {e}")
            print(f"  --- raw response (first 400 chars) ---\n{text[:400]}")
            continue
        merge(glossary, items)
        print(f"  added {len(items)} candidate terms; total now {len(glossary)}")

    final_list = sorted(glossary.values(), key=lambda x: (x["category"], x["en"].lower()))
    GLOSSARY_PATH.write_text(
        json.dumps(final_list, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nGlossary built: {len(final_list)} terms total -> {GLOSSARY_PATH}")
    print_summary(final_list)
    return final_list


def print_summary(terms: list[dict]) -> None:
    by_cat: dict[str, list[dict]] = {}
    for t in terms:
        by_cat.setdefault(t["category"], []).append(t)
    print("\n=== Glossary Summary ===")
    for cat in sorted(by_cat):
        print(f"\n## {cat} ({len(by_cat[cat])})")
        for t in sorted(by_cat[cat], key=lambda x: x["en"].lower())[:20]:
            note = f"  — {t['note']}" if t.get("note") else ""
            print(f"  {t['en']:<32} -> {t['vi']}{note}")


def main() -> int:
    if GLOSSARY_PATH.exists() and "--rebuild-glossary" not in sys.argv:
        print(f"Phase 2 skip: glossary already exists at {GLOSSARY_PATH}.")
        return 0
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
