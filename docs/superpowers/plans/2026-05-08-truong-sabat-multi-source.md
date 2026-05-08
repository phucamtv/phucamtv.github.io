# Trường Sa-bát Multi-Source Quarterlies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add support for multi-source quarterlies under `/truong-sabat/` via optional `source`/`sourceUrl` frontmatter and a small attribution line on the quarter page, then populate 2026/Q1 from Adventech.

**Architecture:** No URL or layout-structure changes. Quarter `_index.md` files gain two optional frontmatter fields. The `quarter.html` layout renders a one-line "Nguồn:" attribution when those fields are set. Q2/2026 is backfilled with Adventech attribution; Q1/2026 is freshly populated using the existing `fetch-sabat-school-lesson` skill.

**Tech Stack:** Hugo (static site), YAML frontmatter, Markdown content. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-08-truong-sabat-multi-source-design.md`

---

## File Structure

**Modified:**
- `layouts/truong-sabat/quarter.html` — add attribution block after the lesson list.
- `content/truong-sabat/2026/q2/_index.md` — add `source`, `sourceUrl`, and `weight: 2`.

**Created:**
- `content/truong-sabat/2026/q1/_index.md` — Q1 index with `source`, `sourceUrl`, `weight: 1`.
- `content/truong-sabat/2026/q1/bai-1/` … `content/truong-sabat/2026/q1/bai-13/` — 13 lesson page bundles (each with `_index.md` + 7 daily files).

---

## Task 1: Add attribution rendering to quarter layout

**Files:**
- Modify: `layouts/truong-sabat/quarter.html`

- [ ] **Step 1.1: Read the current layout**

Read `layouts/truong-sabat/quarter.html` to confirm current contents match:

```html
{{ define "main" }}
<section class="ss-list">
  <nav class="breadcrumb">
    <a href="{{ "/truong-sabat/" | relURL }}">Trường Sa-bát</a>
  </nav>

  <h1>{{ .Title }}</h1>
  {{ .Content }}

  <div class="ss-lesson-list">
    {{ range .Sections.ByWeight }}
    <a href="{{ .RelPermalink }}" class="ss-lesson-card">
      {{ with .Params.lesson }}
      <span class="ss-lesson-num">{{ printf "%02d" . }}</span>
      {{ end }}
      <span class="ss-lesson-info">
        <span class="ss-lesson-card-title">{{ .Title }}</span>
        {{ with .Params.dateRange }}<span class="ss-lesson-date">{{ . }}</span>{{ end }}
      </span>
    </a>
    {{ end }}
  </div>
</section>
{{ end }}
```

- [ ] **Step 1.2: Add attribution block after the lesson list**

Insert the following block immediately after the closing `</div>` of `.ss-lesson-list` and before the closing `</section>`:

```html
  {{ with .Params.source }}
  <p class="ss-source-attribution">
    Nguồn:
    {{ with $.Params.sourceUrl }}
      <a href="{{ . }}" rel="noopener" target="_blank">{{ $.Params.source }}</a>
    {{ else }}
      {{ . }}
    {{ end }}
  </p>
  {{ end }}
```

Notes:
- `{{ with .Params.source }}` rebinds `.` to the source string, so we use `$.Params.sourceUrl` and `$.Params.source` to access the page-level params from inside the `with` block.
- `rel="noopener"` is the standard hardening for `target="_blank"` external links.

- [ ] **Step 1.3: Verify Hugo builds without error**

Run: `hugo --minify`
Expected: Build succeeds, no template errors. Note any warnings.

- [ ] **Step 1.4: Commit**

```bash
git add layouts/truong-sabat/quarter.html
git commit -m "feat(truong-sabat): render source attribution on quarter pages"
```

---

## Task 2: Backfill source attribution on Q2/2026 and add quarter weight

**Files:**
- Modify: `content/truong-sabat/2026/q2/_index.md`

- [ ] **Step 2.1: Update the Q2 index frontmatter**

Replace the contents of `content/truong-sabat/2026/q2/_index.md` with:

```yaml
---
title: "Quý 2, 2026 – Lớn Lên Trong Mối Quan Hệ Với Đức Chúa Trời"
layout: quarter
weight: 2
source: "Adventech"
sourceUrl: "https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-02"
---
```

Why `weight: 2`: ensures Q1 (weight 1) sorts before Q2 (weight 2) on the year listing once Q1 is added.

- [ ] **Step 2.2: Build and visually verify Q2 attribution**

Run: `hugo server -D --buildFuture` (in a background process or separate terminal)
Visit: `http://localhost:1313/truong-sabat/2026/q2/`
Expected: page renders the existing 13 lessons; below the lesson grid there is a single line "Nguồn: Adventech" with "Adventech" linking to the GitHub URL.

Stop the dev server after verification.

- [ ] **Step 2.3: Commit**

```bash
git add content/truong-sabat/2026/q2/_index.md
git commit -m "feat(truong-sabat): attribute 2026/Q2 to Adventech"
```

---

## Task 3: Fetch and populate 2026/Q1 from Adventech

This task uses the project's existing `fetch-sabat-school-lesson` skill, which knows how to pull a lesson from `Adventech/sabbath-school-lessons` and produce a Hugo page bundle in `content/truong-sabat/{year}/q{n}/bai-{i}/` that conforms to the `sabat-school` skill's structure.

**Files:**
- Create: `content/truong-sabat/2026/q1/_index.md`
- Create: `content/truong-sabat/2026/q1/bai-1/` through `content/truong-sabat/2026/q1/bai-13/` — each bundle contains `_index.md`, `sa-bat.md`, `thu-nhat.md`, `thu-hai.md`, `thu-ba.md`, `thu-tu.md`, `thu-nam.md`, `thu-sau.md`.

**Source:** `https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-01`

- [ ] **Step 3.1: Create the Q1 quarter index**

The upstream `info.yml` (or equivalent) at `vi/2026-01/info.yml` provides the quarter title. Read it via the Adventech GitHub link to determine the exact Vietnamese theme title. Then write:

```yaml
---
title: "Quý 1, 2026 – <theme from upstream>"
layout: quarter
weight: 1
source: "Adventech"
sourceUrl: "https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-01"
---
```

Save to `content/truong-sabat/2026/q1/_index.md`.

- [ ] **Step 3.2: Fetch and write each of the 13 lessons**

For each lesson `i` in 1..13:

1. Invoke the `fetch-sabat-school-lesson` skill with the lesson number `i` and the source `vi/2026-01`. The skill produces:
   - `content/truong-sabat/2026/q1/bai-{i}/_index.md` with frontmatter `title`, `layout: lesson`, `lesson: i`, `weight: i`, `dateRange`, `scriptures`, `memoryVerse`, `memoryVerseRef`.
   - 7 daily files: `sa-bat.md` (weight 1), `thu-nhat.md` (weight 2), `thu-hai.md` (weight 3), `thu-ba.md` (weight 4), `thu-tu.md` (weight 5), `thu-nam.md` (weight 6), `thu-sau.md` (weight 7) — each with `build: { render: never }`, `title`, `dayLabel`, `weight`.
2. Apply project content guidelines to the produced files (see `CLAUDE.md`):
   - "Đức Chúa Giê-su" (never "Chúa Giê-su"/"Jesus"/"Giê-xu")
   - "Sa-bát" (not "Sabát")
   - "Cơ-đốc" (not "Cơ Đốc")
   - "Do Thái Giáo" (not "Giu-đa-izt")
   - "Chủ Nhật" capitalized
   - Divine names capitalized: "Đức Chúa Trời", "Đức Thánh Linh", "Kinh Thánh", "Hội Thánh"
   - "ban phước" (when subject is God) vs "chúc phước" (when subject is human) — never "chúc phước" with God as subject
3. Verify the `Thứ Sáu` file contains a "NGHIÊN CỨU BỔ TÚC" section with discussion questions (per `sabat-school` skill).
4. Commit each lesson individually so failures are localized:

```bash
git add content/truong-sabat/2026/q1/bai-{i}/
git commit -m "feat(truong-sabat): add 2026/Q1 bài {i}"
```

(Repeat for i = 1..13. The first commit can also include `content/truong-sabat/2026/q1/_index.md` from step 3.1.)

- [ ] **Step 3.3: Verify the page bundle structure**

Run: `find content/truong-sabat/2026/q1 -type f | sort`
Expected: 1 `_index.md` at the quarter level, plus 13 lesson bundles each containing exactly 8 files (`_index.md` + 7 daily files), totaling `1 + 13*8 = 105` files.

If the count is wrong, identify the missing/extra files and fix before continuing.

- [ ] **Step 3.4: Hugo build check**

Run: `hugo --minify`
Expected: build succeeds with no errors. The number of pages built should reflect the new Q1 (1 quarter page + 13 lesson pages — daily files have `build.render: never` so they do not produce standalone pages).

---

## Task 4: End-to-end verification

**Files:** none (read-only verification).

- [ ] **Step 4.1: Start the dev server**

Run: `hugo server -D --buildFuture`
Wait for: "Web Server is available at http://localhost:1313/".

- [ ] **Step 4.2: Verify the year listing shows both quarters in order**

Visit: `http://localhost:1313/truong-sabat/`
Expected:
- "2026" section visible.
- Q1 ("Quý 1, 2026 – …") appears **before** Q2 ("Quý 2, 2026 – …").
- All 13 lessons listed under each quarter.

If Q2 appears before Q1, recheck the `weight:` values on both `_index.md` files (Task 2 step 2.1, Task 3 step 3.1).

- [ ] **Step 4.3: Verify Q1 quarter page**

Visit: `http://localhost:1313/truong-sabat/2026/q1/`
Expected:
- Page title is the Q1 theme.
- 13 lesson cards rendered in order 01..13.
- Below the lesson grid: line "Nguồn: Adventech", with "Adventech" linking to `https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-01` and opening in a new tab.

- [ ] **Step 4.4: Verify Q2 quarter page**

Visit: `http://localhost:1313/truong-sabat/2026/q2/`
Expected:
- Page renders the existing 13 lessons.
- Below the lesson grid: line "Nguồn: Adventech", linking to `https://github.com/Adventech/sabbath-school-lessons/tree/stage/src/vi/2026-02`.

- [ ] **Step 4.5: Spot-check one Q1 lesson**

Visit: `http://localhost:1313/truong-sabat/2026/q1/bai-1/`
Expected:
- Lesson page renders.
- All 7 daily sections present (Sa-bát, Thứ Nhất … Thứ Sáu) with content.
- Memory verse and scripture references present.
- Vietnamese spelling matches project guidelines (no "Chúa Giê-su" without "Đức"; "Sa-bát" not "Sabát"; etc.).

- [ ] **Step 4.6: Stop the dev server**

Stop the `hugo server` process.

- [ ] **Step 4.7: Final production-build check**

Run: `make build` (equivalent to `hugo --minify`)
Expected: clean build, no errors.

- [ ] **Step 4.8: Confirm no orphan changes**

Run: `git status`
Expected: working tree clean (all Q1 lessons and the layout/Q2 backfill changes already committed in earlier tasks).

If anything is uncommitted, stage and commit it now with an appropriate message.

---

## Done criteria

- `/truong-sabat/` lists 2026 with Q1 before Q2.
- `/truong-sabat/2026/q1/` and `/truong-sabat/2026/q2/` each show 13 lessons and a "Nguồn: Adventech" attribution linking to the correct upstream URL.
- Each Q1 lesson bundle has `_index.md` plus 7 daily files conforming to the `sabat-school` skill format.
- `hugo --minify` builds without errors.
- All Vietnamese content guidelines (CLAUDE.md) are respected in Q1 content.
