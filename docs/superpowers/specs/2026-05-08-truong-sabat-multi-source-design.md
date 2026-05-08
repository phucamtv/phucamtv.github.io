---
title: Trường Sa-bát — multi-source quarterlies
date: 2026-05-08
status: approved
---

# Trường Sa-bát: hosting multiple quarterly sources

## Background

`/truong-sabat/` currently hosts one series — the standard Adventist adult quarterly from Adventech (`vi/`). Only `2026/q2` is populated. We plan to host more quarterlies, possibly from other sources (e.g., other publishers or independent authors), but **no two sources will ever cover the same year+quarter**. Each `year/q{n}` slot is owned by exactly one source.

## Goals

- Add 2026/Q1 from Adventech as the next content drop.
- Capture the source/publisher of each quarter so attribution is honest and forward-compatible when a non-Adventech quarterly arrives.
- Keep the URL shape and existing layouts essentially unchanged.

## Non-goals

- No URL changes (stay at `/truong-sabat/{year}/q{n}/bai-{n}/`).
- No multi-source overlap handling for the same quarter.
- No Hugo taxonomy or per-source landing pages.
- No new layouts; only a small attribution addition to `quarter.html`.

## Design

### Quarter frontmatter — add source fields

Quarter `_index.md` gains two optional fields:

```yaml
---
title: "Quý 1, 2026 – <theme>"
layout: quarter
source: "Adventech"
sourceUrl: "https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-01"
---
```

- `source` — short publisher/author name displayed to readers.
- `sourceUrl` — canonical upstream URL for that specific quarter.

Both fields are optional. When absent, no attribution is rendered.

### Layout — `layouts/truong-sabat/quarter.html`

Render attribution at the bottom of the quarter page, after the lesson list, only when `source` is set. Keep it understated (one line), Vietnamese-labeled. Use `sourceUrl` as the link target if present; otherwise render `source` as plain text.

Example output: `Nguồn: Adventech` (link) — single line, small text, below the lesson grid.

### Content — populate 2026/Q1 from Adventech

Fetch `https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-01` using the existing `fetch-sabat-school-lesson` skill. Create:

```
content/truong-sabat/2026/q1/
  _index.md            (with source/sourceUrl set)
  bai-1/ ... bai-13/   (each a page bundle following sabat-school skill conventions)
```

Apply the project's content guidelines (Đức Chúa Giê-su, Sa-bát, Cơ-đốc, ban phước vs chúc phước, divine name capitalization).

### Backfill — 2026/Q2

Add `source: "Adventech"` and `sourceUrl: "https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-02"` to `content/truong-sabat/2026/q2/_index.md`.

### List page — no change

`layouts/truong-sabat/list.html` already iterates years → quarters → lessons via `range .Sections.ByWeight`. Adding Q1 to 2026 will Just Work; quarters order by their `weight` (which equals the quarter number when set, otherwise by title). Verify Q1 appears before Q2 after content is added; if ordering is wrong, set `weight: 1` and `weight: 2` on the respective quarter `_index.md` files.

## Verification

- `hugo` build succeeds with no errors after Q1 is added.
- `/truong-sabat/` lists 2026 with Q1 then Q2.
- `/truong-sabat/2026/q1/` renders all 13 lessons and shows the Adventech attribution line.
- `/truong-sabat/2026/q2/` renders the existing 13 lessons and shows the Adventech attribution line.
- Each lesson page bundle (`bai-1` through `bai-13` for Q1) has all 7 daily files (sa-bat, thu-nhat … thu-sau) with correct `weight` values.

## Risks / open questions

- **Quarter ordering**: confirm Hugo's `.Sections.ByWeight` falls back to title-sort for sections without an explicit `weight`. Current Q2 has no `weight`. Mitigation: set `weight` on both Q1 and Q2 if ordering misbehaves.
- **Q1 theme title**: not yet known until the upstream content is fetched. The fetch step will determine `title:` for Q1's `_index.md`.
