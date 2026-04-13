# The Great Controversy — Vietnamese Translation Design

**Date:** 2026-04-13
**Status:** Draft for review

## Goal

Translate Ellen G. White's *The Great Controversy* (egwwritings book 132, 42 chapters, ~700 pages) from English into Vietnamese using Claude, and publish as a new book section of the phucam.tv Hugo site at `content/sach/egw/thien-ac-dau-tranh/`.

## Non-Goals

- Supporting other EGW books (the directory structure allows for future additions under `content/sach/egw/`, but only *Thiện Ác Đấu Tranh* is in scope now).
- Audio, ePub, or PDF export.
- A custom search UI (Hugo's built-in search suffices).
- Translation memory or model fine-tuning.
- Human review workflow — output auto-publishes directly to the live site.

## Architecture

A four-stage local pipeline:

```
scrape → chunk → translate → assemble (+ lint)
```

All stages are idempotent: re-running skips completed work so failures are resumable. Each stage writes to disk under `data/` so intermediate state is inspectable.

### Scripts

All scripts live under `scripts/gc-translation/`.

1. **`scrape.py`** — Fetches the 42 English chapters from `m.egwwritings.org/en/book/132/...`, extracts clean HTML/text, writes `data/gc-source/chXX.html` and `chXX.txt`. Skips chapters already on disk.

2. **`chunk.py`** — Splits each chapter along `<h2>` / section boundaries into units of ~1000–2000 words. Writes `data/gc-source/chunks/chXX-NN.txt`. A chapter with no internal headings becomes a single chunk (acceptable for short chapters; longer orphans get a token-based fallback split at paragraph boundaries).

3. **`translate.py`** — For each chunk:
   - Loads the chunk, the glossary, and CLAUDE.md terminology rules.
   - Calls Claude (claude-opus-4-6) with a system prompt that enforces glossary + terminology and instructs the model to emit `[[BIBLE:<book> <chapter>:<verse>]]` sentinels wherever English quotes scripture.
   - Replaces `[[BIBLE:…]]` sentinels with VI1934 verse text from `data/bible/vi1934.json`.
   - Writes `data/gc-translated/chXX-NN.md`.
   - On failure, writes `chXX-NN.err` and continues. Re-runs retry only errored chunks.

4. **`assemble.py`** — For each chapter:
   - Concatenates its translated chunks in order.
   - Runs the lint pass (regex normalization — see below).
   - Prepends Hugo front matter.
   - Writes `content/sach/egw/thien-ac-dau-tranh/chuong-XX.md`.

5. **`lint.py`** — Standalone module used by `assemble.py` and also runnable on already-written files. Enforces CLAUDE.md rules.

## Hugo Content Layout

```
content/sach/
  _index.md                              # "Sách" section landing
  egw/
    _index.md                            # Ellen G. White author page
    thien-ac-dau-tranh/
      _index.md                          # Book landing: intro + TOC of 42 chapters
      chuong-01.md ... chuong-42.md      # One file per chapter
```

### Front matter per chapter

```yaml
---
title: "Chương 1: <tên chương tiếng Việt>"
slug: "chuong-01"
author: "ellen-g-white"
book: "thien-ac-dau-tranh"
chapter: 1
date: 2026-04-13
summary: "<1-2 câu tóm tắt>"
---
```

### Bible quotations

Rendered as Hugo blockquotes with cite:

```markdown
> "Khi các ngươi sẽ thấy thành Giê-ru-sa-lem bị một đạo binh vây chung quanh..."
> <cite>(Lu-ca 21:20)</cite>
```

## Supporting Data

- **`data/gc-translation/glossary.yaml`** — 50–100 theological terms (sanctuary, remnant, investigative judgment, etc.) plus the CLAUDE.md-mandated renderings. Injected verbatim into every translate prompt as a "MUST use exactly" block.
- **`data/bible/vi1934.json`** — Full VI1934 (Truyền Thống 1934) text keyed by canonical `"<Book> <Chapter>:<Verse>"`. Parsed from the user's local Docusaurus dump at `/Users/htruong/code/kt-static/VI1934/` (one markdown file per chapter, verses marked with Unicode superscript numerals). Vendored into this repo as a single JSON blob.
- **`data/gc-translation/bible-refs.yaml`** — Map of English book names → Vietnamese book names (e.g. `Matthew: Ma-thi-ơ`, `1 Corinthians: 1 Cô-rinh-tô`). Used by the sentinel resolver.

## Translation Prompt

**System prompt (assembled per chunk):**

1. Role: expert Vietnamese translator specializing in Christian theological texts, 1934-era register, for a Seventh-day Adventist audience.
2. Terminology rules (verbatim from CLAUDE.md).
3. Full `glossary.yaml` rendered as an English → Vietnamese table, marked as MUST-USE.
4. Bible-quote instruction: wherever the English text directly quotes a Bible verse with an inline or parenthetical reference, emit `[[BIBLE:<English Book Name> <Chapter>:<Verse>]]` (or `<Chapter>:<VerseStart>-<VerseEnd>` for ranges) in place of the quoted English text. Do not translate the quote.
5. Output format: pure Markdown. No preamble, no explanation. Preserve paragraph breaks and emphasis.

**User message:** the chunk's English text.

## Lint Pass

Regex-based normalization run on assembled chapter text before write:

- `\bChúa Giê-?su\b` (if not preceded by `Đức `) → `Đức Chúa Giê-su`
- `\bJesus\b` / `\bGiê-xu\b` → `Đức Chúa Giê-su`
- `\bSabát\b` → `Sa-bát`
- `\bCơ Đốc\b` → `Cơ-đốc`
- `\bGiu-đa-izt\b` → `Do Thái Giáo`
- Case fix: `đức chúa trời` → `Đức Chúa Trời`; `đức thánh linh` → `Đức Thánh Linh`; `kinh thánh` → `Kinh Thánh`; `đức chúa giê-su` → `Đức Chúa Giê-su`
- Detect unresolved `[[BIBLE:…]]` sentinels — log a warning, leave in place for manual attention.

Each rule is independently testable.

## Testing

All tests use `pytest` under `tests/gc-translation/`.

- `test_chunk.py` — Chunk count matches section count; total word count preserved (within 1%); chapters with no headings produce one chunk.
- `test_bible_ref.py` — `[[BIBLE:Matthew 24:20]]` → correct VI1934 verse; ranges (`1:1-3`) concatenate verses; edge cases: `Ps` vs `Psalms`, `1 Cor` vs `1 Corinthians`, Revelation book-name variants; missing verse → warning.
- `test_lint.py` — Each CLAUDE.md rule: one positive case (rule fires), one negative case (already correct, unchanged).
- `test_assemble.py` — Correct front matter keys/values; chunks concatenated in order; output written to expected path.
- `test_scrape.py` — Scraper given a local HTML fixture yields expected plain text (no live network in tests).
- **No unit test for the translation call itself** (non-deterministic). One end-to-end smoke test translates a 3-paragraph English fixture and asserts: (a) output is non-empty, (b) contains at least one Vietnamese diacritic, (c) glossary term appears verbatim if present in the fixture.

## Error Handling

- All scripts idempotent; checkpoints are the presence of output files on disk.
- Translation failures write `.err` siblings; re-running `translate.py` retries only those.
- Bible-ref resolution failures: keep the sentinel in place, lint warns, scripts continue.
- API rate limits: exponential backoff, max 3 retries per chunk before `.err`.

## Open Risks

- **Quality at scale:** auto-publish with no human gate means a single prompt regression can taint many chapters. Mitigation: lint catches CLAUDE.md violations; the smoke test gates merges of prompt/glossary changes.
- **Bible-ref detection recall:** the model may not emit sentinels for every quotation, especially loose allusions. We accept that edge cases get translated as prose rather than substituted with VI1934.
- **VI1934 source reliability:** if the chosen public-domain dump has transcription errors, they propagate. Mitigation: spot-check a sample after import.
- **Token cost:** ~700 pages × section-level calls could run into the $50–150 range. Acceptable per user.
