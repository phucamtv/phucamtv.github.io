# Migrate `/nghien-cuu/` to the divine-library design

**Date:** 2026-05-31
**Status:** Approved
**Scope:** Layout + CSS only. No content edits, no data changes.

## Goal

Bring the `nghien-cuu` (Nghiên Cứu / in-depth studies) section onto the same
three-column "divine-library" app shell already used by `kt` and `truong-sabat`:
shared left **rail** → **middle** navigation list → **detail** reader.

Navigation model chosen: **truong-sabat-style** (not the kt accordion). The
section root showcases all series as cards in the detail column; entering a
series narrows the middle column to that series' episodes; entering an episode
shows the video + body in the detail column.

## Existing pattern (reference)

- Shell: `layouts/truong-sabat/baseof.html` — `lib-app-body` → `lib-app`
  (adds `detail-open` on reader pages) → backdrop → `lib/rail.html` (dict
  `active`) → section middle partial → `<main class="lib-detail"><div
  class="lib-detail-scroll">{{ block "main" }}`.
- Middle: `layouts/partials/truong-sabat/list.html` — context detection
  (lesson → `.Parent`, quarter → `.`, root → latest), renders `.lib-lesson`
  rows with `.is-current` highlight + a `.lib-mid-back` link.
- Detail templates define `{{ block "main" }}` with `.lib-doc` content.
- CSS: `assets/css/lib-app.css`, all rules scoped under `.lib-app`.
- Conditional load: `layouts/partials/head.html:68` —
  `{{ $libApp := in (slice "kt" "truong-sabat") .Section }}` gates the
  Newsreader/Be-Vietnam fonts, the font-size JS, and the `lib-app.css` link
  (`head.html:86`).

Current `nghien-cuu` (to be replaced): `layouts/nghien-cuu/list.html`,
`nc-series.html`, `nc-episode.html` — all inherit `_default/baseof.html`,
styled by `.nc-*` rules in `assets/css/bible-media.css` (which is concatenated
into the global `style.css` and stays untouched).

## Changes

### 1. `layouts/nghien-cuu/baseof.html` (new)

Copy of the truong-sabat shell, with:
- `partial "lib/rail.html" (dict "active" "nghien-cuu")`
- `partial "nghien-cuu/list.html" .` as the middle column
- `detail-open` toggled when `.Layout` is `nc-series` **or** `nc-episode`
  (both are reader pages on mobile; the bare section list is not):
  `{{ if in (slice "nc-series" "nc-episode") .Layout }} detail-open{{ end }}`

### 2. `layouts/partials/nghien-cuu/list.html` (new)

Middle column, modeled on `partials/truong-sabat/list.html`. Context detection
picks the "current series":
- `.Layout == "nc-episode"` → current series = `.Parent`
- `.Layout == "nc-series"`  → current series = `.`
- otherwise (section root) → no current series

Header (`.lib-mid-head`): `.lib-mtrigger` button (mobile drawer, with the same
book SVG mark used elsewhere) + a `.lib-mid-back` link to `/nghien-cuu/`
labeled `Tất cả loạt bài`.

Body (`.lib-mid-body`):
- **With a current series** — render its episodes (`sort (where
  .Pages "Layout" "nc-episode") "Weight"`) as `.lib-lesson` rows:
  `.lib-lesson-num` = `Bài N` (from `.Params.index`), `.lib-lesson-title` =
  `shortTitle | default Title`, `.lib-lesson-date` = formatted duration from
  `index hugo.Data "nghien-cuu" series.Params.dataKey` (reuse the h:mm:ss
  logic from current `nc-series.html`). Current page gets `.is-current`.
- **Section root** — list all series (`where .Pages "Layout" "nc-series"`) as
  `.lib-lesson` rows linking to each series: title + `N bài` count from data.
  No back link shown at root (or back link points to root harmlessly).

### 3. `layouts/nghien-cuu/list.html` (rewrite)

Keep `{{ define "main" }}`. Wrap in `.lib-doc`:
- `.lib-doc-eyebrow` (e.g. small "Nghiên Cứu" label), `.lib-doc-title`
  (`.Title`), `.lib-doc-sub` for `.Params.verse`.
- Carry over the **series card grid** verbatim (`.nc-series-grid` /
  `.nc-series-card` with thumbnail, title, titleEn, author·count·language,
  description) — data lookups unchanged.

### 4. `layouts/nghien-cuu/nc-series.html` (rewrite)

Keep `{{ define "main" }}` and the `nc-series` layout name. Wrap in `.lib-doc`:
- Header: `.lib-doc-eyebrow` ("Loạt bài"), `.lib-doc-title` (`.Title`),
  `.lib-doc-sub` (`titleEn`), byline (author · `totalVideos` bài · language),
  description, optional `.Content`.
- CTA `▶ Bắt đầu: Bài 1` linking to the first episode by weight.
- Drop the standalone `<ol class="nc-episode-list">` — episodes now live in the
  middle column. (Breadcrumb removed; the rail + middle provide navigation.)

### 5. `layouts/nghien-cuu/nc-episode.html` (rewrite)

Keep `{{ define "main" }}` and the `nc-episode` layout name. Wrap in `.lib-doc`:
- `.lib-doc-eyebrow` = `Bài N / total`, `.lib-doc-title` =
  `shortTitle | default Title`, `.lib-doc-sub` = original English `$video.title`.
- YouTube embed (`.youtube-wrapper nc-episode-video` + iframe) unchanged.
- `.Content` body.
- Prev/next nav (`.nc-prev-next`) unchanged. Sibling lookup
  (`$series := .Parent`, sort by weight) unchanged.
- (Breadcrumb removed.)

### 6. `layouts/partials/head.html` (edit, line 68)

Add `"nghien-cuu"` to the slice:
`{{ $libApp := in (slice "kt" "truong-sabat" "nghien-cuu") .Section }}`
This pulls in the fonts, font-size JS, and `lib-app.css` for the section.

### 7. `assets/css/lib-app.css` (append)

Add a `.lib-app`-scoped block making `nghien-cuu` self-contained on the new
stylesheet (decision: copy, don't depend on `bible-media.css`):
- `.lib-app .nc-series-grid` + `.nc-series-card` (thumbnail 16/9, meta, hover)
  adapted to the detail column width — copied/adapted from the `.nc-*` rules in
  `bible-media.css`.
- `.lib-app .nc-episode-video` / `.youtube-wrapper` (16/9 responsive iframe).
- `.lib-app .nc-prev-next` (two-cell grid, mobile single-column).
Loaded after `style.css` (head.html order), so `.lib-app`-scoped rules win over
the global `.nc-*` base within this section. `bible-media.css` is left untouched.

## Out of scope / non-goals

- No changes to `content/nghien-cuu/**` or `data/yt/nghien-cuu/**`.
- No changes to `bible-media.css`, `rail.html` (entry already present at
  `rail.html:20`), or `lib/app-js.html`.
- No new data fields or front-matter changes; `layout: nc-series` /
  `layout: nc-episode` keys stay as-is.

## Verification

1. `hugo` builds with no template errors.
2. `/nghien-cuu/` renders the three-column shell: rail active = Nghiên Cứu,
   middle lists all series, detail shows the card grid.
3. A series page (e.g. `/nghien-cuu/tuong-giao-lanh-manh/`): middle lists that
   series' episodes, detail shows series header + start CTA, `detail-open` set.
4. An episode page: detail shows eyebrow/title/video/body/prev-next, current
   episode highlighted in middle, prev/next links correct.
5. Mobile (<960px): rail collapses to drawer; series/episode pages open the
   detail overlay; section root does not.
6. Episode durations and counts still pull correctly from `hugo.Data`.
