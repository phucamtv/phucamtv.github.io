"""Phase 3: Translate all chapters to Vietnamese with shared glossary."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
from pathlib import Path

from anthropic import AsyncAnthropic

BASE_DIR = Path(__file__).parent
CHAPTERS_DIR = BASE_DIR / "chapters"
GLOSSARY_DIR = BASE_DIR / "glossary"
TRANSLATED_DIR = BASE_DIR / "translated"
MANIFEST_PATH = CHAPTERS_DIR / "manifest.json"
GLOSSARY_PATH = GLOSSARY_DIR / "glossary.json"

TRANSLATE_MODEL = "claude-sonnet-4-20250514"
SUMMARY_MODEL = "claude-haiku-3-5-latest"
MAX_TOKENS_TRANSLATE = 8192
MAX_TOKENS_SUMMARY = 512
MAX_CONCURRENCY = 3

# Rough pricing (USD per 1M tokens) for reporting only.
PRICING = {
    TRANSLATE_MODEL: {"input": 3.0, "output": 15.0},
    SUMMARY_MODEL: {"input": 0.80, "output": 4.0},
}


STYLE_RULES = """\
Content rules (MUST FOLLOW):
- Always use "Đức Chúa Giê-su" (never "Chúa Giê-su", "Jesus", or "Giê-xu").
- "Sa-bát" (not "Sabát").
- "Do Thái Giáo" (not "Giu-đa-izt").
- "Cơ-đốc" (not "Cơ Đốc").
- Divine names capitalized: "Đức Chúa Trời", "Đức Thánh Linh", "Kinh Thánh", "Đức Chúa Giê-su".
- When Chúa/God is the subject, use "ban phước" (never "chúc phước").
"""

SYSTEM_PROMPT_TEMPLATE = """You are an expert Vietnamese translator specializing in Seventh-day Adventist theological literature.
Your translation must be faithful, literary, and spiritually resonant — matching the devotional tone of Ellen G. White.

{style_rules}

GLOSSARY (use these translations without deviation for all listed terms):
{glossary_table}

Rules:
1. Every glossary term MUST use the exact Vietnamese translation listed — no synonyms.
2. Preserve all paragraph breaks. Do not merge or split paragraphs.
3. Maintain Ellen White's rhetorical style: declarative, devotional, occasionally sermonic.
4. Proper nouns not in the glossary: transliterate or use standard Vietnamese Bible (1934 translation) equivalents.
5. Bible verse references (e.g. "John 3:16"): keep the reference notation as-is, translate the quoted text if any.
6. Output ONLY the Vietnamese translation. No preamble, no notes, no "Here is the translation:".
7. Start with the chapter title as a level-1 markdown heading."""

USER_PROMPT_TEMPLATE = """PREVIOUS CHAPTER SUMMARY (for narrative continuity):
{prev_summary}

CHAPTER: {title}
---
{chapter_text}"""


def load_manifest() -> list[dict]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_glossary() -> list[dict]:
    return json.loads(GLOSSARY_PATH.read_text(encoding="utf-8"))


def format_glossary_table(glossary: list[dict]) -> str:
    """2-column markdown table, grouped by category, sorted alphabetically."""
    by_cat: dict[str, list[dict]] = {}
    for t in glossary:
        by_cat.setdefault(t["category"], []).append(t)

    parts: list[str] = []
    for cat in sorted(by_cat):
        parts.append(f"\n### {cat}\n")
        parts.append("| English | Vietnamese |")
        parts.append("|---|---|")
        for t in sorted(by_cat[cat], key=lambda x: x["en"].lower()):
            en = t["en"].replace("|", "\\|")
            vi = t["vi"].replace("|", "\\|")
            parts.append(f"| {en} | {vi} |")
    return "\n".join(parts)


def _read_chapter_body(entry: dict) -> tuple[str, str]:
    """Return (title, body) where the TITLE: header is stripped from body."""
    raw = (CHAPTERS_DIR / entry["filename"]).read_text(encoding="utf-8")
    lines = raw.splitlines()
    title = entry["title"]
    body_lines = lines
    if lines and lines[0].startswith("TITLE:"):
        title = lines[0].removeprefix("TITLE:").strip() or title
        body_lines = lines[1:]
    body = "\n".join(body_lines).strip()
    return title, body


def _slugify_title(title: str) -> str:
    t = title.strip().strip('"').strip("'")
    # Strip any leading markdown heading marker
    t = re.sub(r"^#+\s*", "", t)
    return t


def _split_title_from_translation(md: str, fallback: str) -> tuple[str, str]:
    """Pull the leading '# Title' out of the translated markdown body."""
    md = md.strip()
    m = re.match(r"^#\s+(.+?)\s*\n+", md)
    if m:
        title = _slugify_title(m.group(1))
        body = md[m.end():].strip()
        return title, body
    return fallback, md


class CostTracker:
    def __init__(self) -> None:
        self.rows: list[tuple[str, int, int]] = []

    def add(self, model: str, input_tokens: int, output_tokens: int) -> None:
        self.rows.append((model, input_tokens, output_tokens))

    def total(self) -> tuple[float, int, int]:
        usd = 0.0
        tin = tout = 0
        for model, i, o in self.rows:
            tin += i
            tout += o
            rate = PRICING.get(model, {"input": 0.0, "output": 0.0})
            usd += (i / 1_000_000) * rate["input"] + (o / 1_000_000) * rate["output"]
        return usd, tin, tout

    def report(self) -> str:
        usd, tin, tout = self.total()
        return f"Tokens in={tin:,} out={tout:,}  est cost=${usd:.4f}"


async def translate_chapter(
    client: AsyncAnthropic,
    entry: dict,
    glossary_table: str,
    prev_summary: str,
    cost: CostTracker,
) -> str:
    """Call Claude to translate one chapter. Returns raw translated markdown."""
    title, body = _read_chapter_body(entry)
    system = SYSTEM_PROMPT_TEMPLATE.format(
        style_rules=STYLE_RULES, glossary_table=glossary_table
    )
    user = USER_PROMPT_TEMPLATE.format(
        prev_summary=prev_summary or "(This is the first chapter.)",
        title=title,
        chapter_text=body,
    )

    last_err: Exception | None = None
    for attempt in range(2):
        try:
            resp = await client.messages.create(
                model=TRANSLATE_MODEL,
                max_tokens=MAX_TOKENS_TRANSLATE,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", "") == "text"
            )
            cost.add(TRANSLATE_MODEL, resp.usage.input_tokens, resp.usage.output_tokens)
            return text.strip()
        except Exception as e:
            last_err = e
            print(f"  ! translate attempt {attempt+1} for {entry['id']} failed: {e}")
            await asyncio.sleep(2 ** attempt)
    raise RuntimeError(f"translate failed for {entry['id']}: {last_err}")


async def summarize(
    client: AsyncAnthropic, translated_body: str, cost: CostTracker
) -> str:
    """Generate a ~150-word Vietnamese summary of the translated chapter."""
    system = (
        "Bạn tóm tắt chương sách thần học bằng tiếng Việt, khoảng 150 từ, "
        "trang trọng, mạch lạc, giữ đúng các thuật ngữ chính. "
        "Chỉ xuất phần tóm tắt, không thêm tiêu đề hay lời mở đầu."
    )
    # Cap input body to a reasonable size to control cost.
    capped = translated_body[:8000]
    try:
        resp = await client.messages.create(
            model=SUMMARY_MODEL,
            max_tokens=MAX_TOKENS_SUMMARY,
            system=system,
            messages=[{"role": "user", "content": f"Hãy tóm tắt chương sau:\n\n{capped}"}],
        )
        cost.add(SUMMARY_MODEL, resp.usage.input_tokens, resp.usage.output_tokens)
        return "".join(
            b.text for b in resp.content if getattr(b, "type", "") == "text"
        ).strip()
    except Exception as e:
        print(f"  ! summary failed: {e}")
        return ""


def write_translated(entry: dict, translated_md: str, chapter_num: int) -> None:
    title, body = _split_title_from_translation(translated_md, entry["title"])
    front_matter = (
        "---\n"
        f'title: "{title.replace(chr(34), chr(92) + chr(34))}"\n'
        f"chapter: {chapter_num}\n"
        f'original_title: "{entry["title"].replace(chr(34), chr(92) + chr(34))}"\n'
        "draft: false\n"
        "---\n\n"
        f"# {title}\n\n"
        f"{body}\n"
    )
    out = TRANSLATED_DIR / f"{entry['id']}.md"
    out.write_text(front_matter, encoding="utf-8")


def chapter_number(entry: dict) -> int:
    m = re.match(r"ch(\d+)", entry["id"])
    return int(m.group(1)) if m else 0


async def run_sequential(
    entries: list[dict], glossary_table: str, retranslate: bool
) -> CostTracker:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY is not set")
    TRANSLATED_DIR.mkdir(parents=True, exist_ok=True)

    cost = CostTracker()
    prev_summary = ""

    async with AsyncAnthropic(api_key=api_key) as client:
        for idx, entry in enumerate(entries, start=1):
            out = TRANSLATED_DIR / f"{entry['id']}.md"
            if out.exists() and not retranslate:
                print(f"[{idx}/{len(entries)}] skip {entry['id']} (exists)")
                continue
            print(f"[{idx}/{len(entries)}] translating {entry['id']} — {entry['title']}")
            try:
                md = await translate_chapter(
                    client, entry, glossary_table, prev_summary, cost
                )
                write_translated(entry, md, chapter_number(entry))
                _, body_only = _split_title_from_translation(md, entry["title"])
                prev_summary = await summarize(client, body_only, cost)
                print(f"  ok; {cost.report()}")
            except Exception as e:
                print(f"  !! chapter failed: {e}")
                (TRANSLATED_DIR / f"{entry['id']}.error.txt").write_text(
                    str(e), encoding="utf-8"
                )
    return cost


async def run_parallel(
    entries: list[dict], glossary_table: str, retranslate: bool
) -> CostTracker:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY is not set")
    TRANSLATED_DIR.mkdir(parents=True, exist_ok=True)
    cost = CostTracker()
    sem = asyncio.Semaphore(MAX_CONCURRENCY)

    async with AsyncAnthropic(api_key=api_key) as client:
        async def worker(entry: dict, i: int) -> None:
            out = TRANSLATED_DIR / f"{entry['id']}.md"
            if out.exists() and not retranslate:
                print(f"[{i}/{len(entries)}] skip {entry['id']} (exists)")
                return
            async with sem:
                print(f"[{i}/{len(entries)}] translating {entry['id']} — {entry['title']}")
                try:
                    md = await translate_chapter(client, entry, glossary_table, "", cost)
                    write_translated(entry, md, chapter_number(entry))
                    print(f"  ok {entry['id']}; {cost.report()}")
                except Exception as e:
                    print(f"  !! {entry['id']} failed: {e}")
                    (TRANSLATED_DIR / f"{entry['id']}.error.txt").write_text(
                        str(e), encoding="utf-8"
                    )

        await asyncio.gather(
            *[worker(e, i) for i, e in enumerate(entries, start=1)]
        )
    return cost


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Phase 3: translate chapters")
    p.add_argument("--parallel", action="store_true", help="skip summary chaining, run concurrently")
    p.add_argument("--retranslate", action="store_true", help="overwrite existing translations")
    p.add_argument("--chapter", type=int, help="only (re)translate one chapter number")
    p.add_argument("--test", action="store_true", help="only first 2 chapters")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    manifest = load_manifest()
    if not manifest:
        raise SystemExit("Manifest is empty")
    if not GLOSSARY_PATH.exists():
        raise SystemExit("glossary.json missing; run phase 2 first")

    glossary = load_glossary()
    glossary_table = format_glossary_table(glossary)

    entries = manifest
    if args.chapter is not None:
        want = f"ch{args.chapter:02d}"
        entries = [e for e in manifest if e["id"] == want]
        if not entries:
            raise SystemExit(f"chapter {want} not in manifest")
        args.retranslate = True
    elif args.test:
        entries = manifest[:2]

    if args.parallel:
        cost = asyncio.run(run_parallel(entries, glossary_table, args.retranslate))
    else:
        cost = asyncio.run(run_sequential(entries, glossary_table, args.retranslate))

    print(f"\nPhase 3 done. {cost.report()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
