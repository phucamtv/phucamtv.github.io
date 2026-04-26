# LDE translation pipeline (Last Day Events)

## Context

Two EGW books have already shipped on phucam.tv via the TS pipeline at `scripts/egw_scrape/` (scrape) + `scripts/egw_translate/` (chunk → translate → assemble → lint): *Christ's Object Lessons* (`colp` → `nhung-loi-vi-du-cua-dang-christ`) and *The Great Controversy* (`thien-ac-dau-tranh`, translated by the older Python pipeline). The pipeline is parameterized by `BookConfig` / `TranslateBookConfig`, and the design spec at `docs/superpowers/specs/2026-04-23-colp-translation-pipeline-design.md` documents it. Adding a new book is a config-and-content task, not a code task.

Target: Ellen G. White's *Last Day Events* (egwwritings book id 39, 20 chapters + a "To the Reader" foreword). Vietnamese title **"Sự Kiện Ngày Cuối Cùng"**, slug `su-kien-ngay-cuoi-cung`, parable-style frontispiece (matches COLP).

## Goals

- Produce a Vietnamese translation of all 20 LDE chapters under `content/sach/egw/su-kien-ngay-cuoi-cung/chuong-NN.md` with frontmatter authored by hand and bodies translated through the existing pipeline.
- Reuse the existing scrape + translate modules unchanged. Add the book as configuration + content, plus one small generalization to `seed_chapters.ts`.
- Match the GC/COLP quality bar: glossary-enforced terminology, VI1934 verses via Bible sentinels, lint normalization.

## Non-goals

- Pipeline refactors. Parser, chunker, prompt, claude wrapper, lint, assemble all stay as-is.
- Translation of the "To the Reader" foreword. It is dropped via `skipPrefixes`, matching how COLP/GC drop "Preface".
- Any new glossary or Bible-ref data files. Existing `data/egw-translation/` is reused.
- Translation of the English-language UI, navigation, or layouts.

## User decisions (locked)

- **D1 — Title/slug.** `Sự Kiện Ngày Cuối Cùng` / `su-kien-ngay-cuoi-cung`. Subtitle: `Last Day Events`.
- **D2 — Layout.** `parable` (matches COLP) — hero quote, teaser quote, custom `title_display`.
- **D3 — Foreword.** Skip "To the Reader" via `skipPrefixes`. Ship 20 chapters, no `chuong-00.md`.
- **D4 — Hero scripture.** Ma-thi-ơ 24:42 ("Vậy hãy tỉnh thức, vì các ngươi không biết ngày nào Chúa mình sẽ đến.") — used for both `hero_quote` and `teaser_quote`.
- **D5 — Chapter UI.** `chapter_label: "chương"`, no `badge` field.

## Architecture

The pipeline is unchanged. Stage 0 (one-time setup) adds the book to two registries; stage 1 scrapes from egwwritings; stage 2 (new) seeds bodies into hand-authored chuong stubs; stages 3–5 are the existing chunk → translate → assemble flow.

```
[setup]   add lde to BOOKS in scrape.ts and run.ts
[setup]   author content/sach/egw/su-kien-ngay-cuoi-cung/_index.md + 20 chuong-NN.md stubs
[setup]   .gitignore += data/lde-source/, data/lde-translated/
1. scrape    egwwritings → data/lde-source/{chapters.json, chNN.html, chNN.txt}
2. seed      data/lde-source/chNN.txt → body of content/.../chuong-NN.md (frontmatter preserved)
3. chunk     chNN.txt → data/lde-source/chunks/chNN-MM.txt
4. translate chNN-MM.txt → data/lde-translated/chNN-MM.{md,err}   (claude CLI)
5. assemble  chNN-*.md → content/.../chuong-NN.md (body replaced, frontmatter preserved)
```

Resume semantics, retry, and `--force` behavior are inherited unchanged from the COLP pipeline.

## File changes

### New files

```
scripts/egw_scrape/books/lde.ts          BookConfig (bookId 39, chapters 20, skipPrefixes incl. "To the Reader")
scripts/egw_translate/books/lde.ts       TranslateBookConfig (paragraphCitationPrefix "LDE")
content/sach/egw/su-kien-ngay-cuoi-cung/_index.md
content/sach/egw/su-kien-ngay-cuoi-cung/chuong-01.md … chuong-20.md   (frontmatter only initially)
```

### Modified files

```
scripts/egw_scrape/scrape.ts             BOOKS registry: { colp } → { colp, lde }
scripts/egw_translate/run.ts             BOOKS registry: { colp } → { colp, lde }
scripts/egw_scrape/seed_chapters.ts      Generalize: `bun … seed_chapters.ts <slug>` instead of COLP-hardcoded
.gitignore                               + data/lde-source/  + data/lde-translated/
```

### Untouched

- All `lib/` modules under both pipelines.
- `data/egw-translation/glossary.yaml` and `data/egw-translation/bible-refs.yaml`. (Glossary additions discussed under "Risks" but not part of this spec's deliverable.)
- `data/bible/vi1934.json`.
- The COLP and GC content directories.

## Module details

### `scripts/egw_scrape/books/lde.ts`

```ts
import type { BookConfig } from "../lib/types";

export const lde: BookConfig = {
  slug: "lde",
  bookId: 39,
  chapters: 20,
  tocUrl: "https://m.egwwritings.org/en/book/39/toc",
  sourceDir: "data/lde-source",
  skipPrefixes: ["Preface", "Introduction", "Contents", "Appendix", "Index", "To the Reader"],
};
```

### `scripts/egw_translate/books/lde.ts`

```ts
import type { TranslateBookConfig } from "../lib/types";

export const lde: TranslateBookConfig = {
  slug: "lde",
  bookId: 39,
  chapters: 20,
  sourceDir: "data/lde-source",
  chunksDir: "data/lde-source/chunks",
  translatedDir: "data/lde-translated",
  hugoBookDir: "content/sach/egw/su-kien-ngay-cuoi-cung",
  glossaryPath: "data/egw-translation/glossary.yaml",
  bibleRefsPath: "data/egw-translation/bible-refs.yaml",
  bibleVersesPath: "data/bible/vi1934.json",
  chunkTargetWords: 1500,
  paragraphCitationPrefix: "LDE",
};
```

`paragraphCitationPrefix` value to be **verified empirically** against scraped `data/lde-source/ch01.txt` after stage 1 — egwwritings paragraph citations follow the EGW Encyclopedia abbreviation convention and "LDE" is the standard abbrev for *Last Day Events*. If the scraped text uses a different prefix, fix it before stage 4 (translation prompt encodes the prefix verbatim).

### `seed_chapters.ts` generalization

Current state: `scripts/egw_scrape/seed_chapters.ts` hardcodes `nhung-loi-vi-du-cua-dang-christ`, `data/colp-source`, `CHAPTERS = 29`. Convert to a small CLI taking a slug:

```ts
const SLUG = process.argv[2];
if (!SLUG) { console.error("Usage: bun … seed_chapters.ts <slug>"); process.exit(1); }
// Look up the book in the same BOOKS registry used by scrape.ts to get
// hugoBookDir + sourceDir + chapter count, then run the existing copy loop.
```

Implementation choice: import the scrape-side `BOOKS` map (the slug already exists there post-config addition). The existing per-file logic (frontmatter regex, body replacement) is unchanged.

### `content/sach/egw/su-kien-ngay-cuoi-cung/_index.md`

Frontmatter (parable layout, modeled on COLP `_index.md`):

```yaml
---
title: "Sự Kiện Ngày Cuối Cùng"
slug: "su-kien-ngay-cuoi-cung"
author: "ellen-g-white"
book: "su-kien-ngay-cuoi-cung"
layout: "parable"
subtitle: "Last Day Events"
title_display: '<span class="initial">S</span>ự Kiện<br>Ngày Cuối Cùng'
hero_quote: '&ldquo;Vậy hãy tỉnh thức, vì các ngươi không biết ngày nào Chúa mình sẽ đến.&rdquo;'
hero_quote_cite: "Ma-thi-ơ 24:42"
foot_quote: "\"Vậy hãy tỉnh thức…\""
teaser_style: "parable"
teaser_eyebrow: "Tân bản dịch Việt ngữ"
teaser_quote: "&ldquo;Vậy hãy tỉnh thức, vì các ngươi không biết ngày nào Chúa mình sẽ đến.&rdquo;"
teaser_quote_cite: "Ma-thi-ơ 24:42"
chapter_label: "chương"
cascade:
  layout: "chapter"
summary: "Tuyển tập những lời chỉ dẫn của bà Ellen G. White về các sự kiện trong ngày cuối cùng — từ những dấu hiệu Đức Chúa Giê-su tái lâm, hội thánh ngày sau rốt, sự rung chuyển và mưa cuối mùa, cho đến tiếng kêu lớn, ấn của Đức Chúa Trời và sự kết thúc thời kỳ ân điển."
---

*Sự Kiện Ngày Cuối Cùng* (nguyên tác: *Last Day Events*) là tuyển tập những lời chỉ dẫn của bà Ellen G. White về các biến cố cuối cùng của thế giới: dấu hiệu Đức Chúa Giê-su tái lâm, đời sống của hội thánh ngày sau rốt, sự rung chuyển, mưa cuối mùa, tiếng kêu lớn, ấn của Đức Chúa Trời và bảy tai vạ cuối cùng. Bản dịch này được dịch từ ấn bản Anh ngữ công cộng và các trích dẫn Kinh Thánh lấy từ bản Truyền Thống 1934.
```

### `chuong-NN.md` stubs (×20)

Each stub holds frontmatter only at scaffold time; body gets seeded by `seed_chapters.ts` (English source) and replaced by `assemble` (Vietnamese translation). Frontmatter shape — exact field set from existing `nhung-loi-vi-du-cua-dang-christ/chuong-01.md`:

```yaml
---
title: "Chương N: <Vietnamese chapter title>"
slug: "chuong-NN"
author: "ellen-g-white"
book: "su-kien-ngay-cuoi-cung"
chapter: N
weight: N
date: 2026-04-26
summary: ""
draft: true
---
```

`draft: true` keeps chapters out of the rendered site until manually flipped post-review (the COLP files are now `draft: false` because they've already been published; new books start drafted). `summary: ""` matches COLP — empty string, populated only if a per-chapter teaser is desired later.

### Vietnamese chapter titles (locked)

| # | EN | VI |
|---|---|---|
| 1 | Earth's Last Crisis | Cuộc Khủng Hoảng Cuối Cùng Của Trái Đất |
| 2 | Signs of Christ's Soon Return | Những Dấu Hiệu Đức Chúa Giê-su Sắp Tái Lâm |
| 3 | "When Shall These Things Be?" | "Lúc Nào Sẽ Có Mọi Sự Đó?" |
| 4 | God's Last Day Church | Hội Thánh Ngày Sau Rốt Của Đức Chúa Trời |
| 5 | Devotional Life of the Remnant | Đời Sống Thuộc Linh Của Dân Sót |
| 6 | Lifestyle and Activities of the Remnant | Lối Sống Và Sinh Hoạt Của Dân Sót |
| 7 | Country Living | Sống Ở Vùng Quê |
| 8 | The Cities | Các Thành Thị |
| 9 | Sunday Laws | Luật Chúa Nhật |
| 10 | The Little Time of Trouble | Cơn Đại Nạn Nhỏ |
| 11 | Satan's Last Day Deceptions | Những Mưu Chước Cuối Cùng Của Sa-tan |
| 12 | The Shaking | Sự Rung Chuyển |
| 13 | The Latter Rain | Mưa Cuối Mùa |
| 14 | The Loud Cry | Tiếng Kêu Lớn |
| 15 | The Seal of God and the Mark of the Beast | Ấn Của Đức Chúa Trời Và Dấu Của Con Thú |
| 16 | The Close of Probation | Sự Kết Thúc Thời Kỳ Ân Điển |
| 17 | Seven Last Plagues and the Wicked (Pt 1) | Bảy Tai Vạ Cuối Cùng Và Kẻ Ác (Cơn Đại Nạn Lớn, Phần 1) |
| 18 | Seven Last Plagues and the Righteous (Pt 2) | Bảy Tai Vạ Cuối Cùng Và Người Công Chính (Cơn Đại Nạn Lớn, Phần 2) |
| 19 | Christ's Return | Sự Tái Lâm Của Đức Chúa Giê-su |
| 20 | The Inheritance of the Saints | Cơ Nghiệp Của Các Thánh Đồ |

## Execution order

```
1. bun scripts/egw_scrape/scrape.ts lde all          # TOC + 20 chNN.{html,txt}
2. bun scripts/egw_scrape/seed_chapters.ts lde       # English bodies into chuong-NN.md
3. bun scripts/egw_translate/run.ts chunk    --book lde
4. bun scripts/egw_translate/run.ts translate --book lde   # ~60–90 min wall via claude CLI
5. bun scripts/egw_translate/run.ts assemble --book lde
6. Manual chapter review → flip draft:false
```

## Verification

- After step 1: `data/lde-source/chapters.json` has exactly 20 entries; eyeball ch01 + ch20 .txt for sane content (title line, paragraph blocks, no nav cruft).
- After step 1: spot-check one paragraph citation in `ch01.txt` to confirm the `LDE N.M` prefix matches `paragraphCitationPrefix` in the config; if it differs (e.g. `LDE1 N.M` or `LDEv N.M`), update the config before step 4.
- After step 2: each `chuong-NN.md` opens with frontmatter (line 1: `---`), body is English source, no duplicate `# Title` line.
- After step 3: `data/lde-source/chunks/` has ≥20 files; spot-check `ch01-01.txt` and the largest chapter's chunks for sane sizing.
- After step 4: `find data/lde-translated -name '*.err'` empty; spot-check `ch01-01.md` for Vietnamese with `## ` headings preserved and `[[BIBLE:` sentinels resolved.
- After step 5: bash sanity — `grep -l 'Sabát\|Chúa Giê-su[^a-zA-Z-]\|Jesus\|\[\[BIBLE:' content/sach/egw/su-kien-ngay-cuoi-cung/chuong-*.md` should be empty.
- Hugo: `hugo server`, visit `/sach/egw/su-kien-ngay-cuoi-cung/` and one chapter; confirm parable frontispiece, hero quote, chapter list, breadcrumbs render like COLP.

## Risks

- **Glossary drift.** LDE adds vocabulary not exercised in COLP: "remnant" → "dân sót", "Sunday law" → "Luật Chúa Nhật", "latter rain" → "mưa cuối mùa", "loud cry" → "tiếng kêu lớn", "shaking" → "sự rung chuyển", "close of probation" → "sự kết thúc thời kỳ ân điển", "mark of the beast" → "dấu của con thú", "seal of God" → "ấn của Đức Chúa Trời". Add these to `data/egw-translation/glossary.yaml` **before** step 4. Without them, the model may pick inconsistent renderings across chapters.
- **TOC parser.** Current `parseToc` already handles the `/en/book/<id>.<para>` pattern. LDE's chapter 13 ("The Latter Rain") is marked `class="has-children"` with a child-list toggle — verify after step 1 that no nested sub-entries leaked in as duplicate chapters; if they did, the parser's `seen` dedupe should catch them but spot-check anyway.
- **Long chapter timing.** ch20 ("The Inheritance of the Saints") starts at paragraph 1823 and the book ends around 1900+ — chapter sizes vary. Translation runtime estimate: ~3 min/chunk × ~25 chunks = ~75 min for the full book. Run translate in the background or in chunks if iteration is needed.
- **Paragraph citation prefix.** "LDE" is the EGW Encyclopedia abbreviation but the egwwritings page may render `LDE 24.1` or differently (some EGW books use compound prefixes). Verify in step 1; mis-set prefix produces translations that drop or mangle citations.
- **`seed_chapters.ts` generalization.** A small refactor that touches a script the COLP pipeline depends on. Keep the function signature backwards-friendly: the script must still produce the same output for COLP if re-run with `lde` vs `colp`.

## Out of scope (follow-ups)

- Translation of `_index.md` body refinements (the body paragraph above is a first draft).
- Adding any chapter beyond the 20 (e.g. promoting "To the Reader" to a real foreword).
- Glossary validator / coverage checker.
- Anthropic SDK migration with prompt caching.
- A book index page that lists all three EGW books — the existing `content/sach/egw/_index.md` already auto-lists subdirectories.
