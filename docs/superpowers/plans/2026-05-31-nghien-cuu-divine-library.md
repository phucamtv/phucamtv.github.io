# Nghiên Cứu Divine-Library Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `nghien-cuu` section onto the shared three-column "divine-library" app shell (rail → middle list → detail) already used by `kt` and `truong-sabat`.

**Architecture:** A new section `baseof.html` wraps the page in `.lib-app` (rail + middle partial + detail block). A new middle-column partial lists either the current series' episodes or all series. The three existing detail templates are rewritten to render `.lib-doc` content. One scoped CSS block in `lib-app.css` styles the section's unique pieces (series cards, video embed, prev/next). `head.html` gates the section into the lib-app font/CSS loader.

**Tech Stack:** Hugo (Go templates), scoped CSS. No content or `data/` changes. No JS changes — the shared `lib/app-js.html` already handles the drawer and font picker.

**Verification model:** Hugo has no template unit tests here. Each task builds the site to a temp dir and greps the generated HTML for expected markers. Build command used throughout:

```bash
hugo --quiet --destination /tmp/nc-build
```

Expected: exits 0, no `ERROR`/`WARN` template lines.

---

### Task 1: Middle-column partial (episodes / series list)

**Files:**
- Create: `layouts/partials/nghien-cuu/list.html`

This partial is not referenced by any layout yet, so creating it has no rendered effect until Task 5 — but it must build cleanly.

- [ ] **Step 1: Create the partial**

Mirror `layouts/partials/truong-sabat/list.html`. Current series = episode's `.Parent` (episode page), self (series page), or none (section root → list all series). Duration formatting copied from the current `nc-series.html`.

```go-html-template
{{- /* Middle column for Nghiên Cứu — episodes of the current series.
       Current series = the episode's parent (episode page), self (series page),
       or none (section root → list all series). */ -}}
{{- $logo := `<span class="lib-rail-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg></span>` -}}
{{- $cur := .RelPermalink -}}
{{- $series := "" -}}
{{- if eq .Layout "nc-episode" -}}{{ $series = .Parent }}
{{- else if eq .Layout "nc-series" -}}{{ $series = . }}
{{- end -}}
<nav class="lib-mid">
  <div class="lib-mid-head">
    <button class="lib-mtrigger" type="button" aria-label="Mở thư viện">{{ $logo | safeHTML }}</button>
    <a class="lib-mid-back" href="/nghien-cuu/"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>{{ with $series }}Tất cả loạt bài{{ else }}Nghiên Cứu{{ end }}</a>
  </div>
  <div class="lib-mid-body">
    {{- with $series -}}
      {{- $data := index hugo.Data "nghien-cuu" .Params.dataKey -}}
      {{- range (sort (where .Pages "Layout" "nc-episode") "Weight") -}}
        {{- $idx := .Params.index -}}
        {{- $video := "" -}}
        {{- if $data }}{{ $video = index $data.videos (sub $idx 1) }}{{ end -}}
        <a class="lib-lesson{{ if eq .RelPermalink $cur }} is-current{{ end }}" href="{{ .RelPermalink }}">
          <span class="lib-lesson-num">{{ $idx }}</span>
          <span class="lib-lesson-info">
            <span class="lib-lesson-title">{{ with .Params.shortTitle }}{{ . }}{{ else }}{{ .Title }}{{ end }}</span>
            {{- with $video }}{{ if .duration }}
            <span class="lib-lesson-date">
              {{- $h := math.Floor (div .duration 3600) -}}
              {{- $m := math.Floor (mod (div .duration 60) 60) -}}
              {{- $s := mod .duration 60 -}}
              {{- if gt $h 0 }}{{ $h }}:{{ printf "%02d" (int $m) }}:{{ printf "%02d" (int $s) }}{{ else }}{{ $m }}:{{ printf "%02d" (int $s) }}{{ end -}}
            </span>
            {{ end }}{{ end -}}
          </span>
        </a>
      {{- end -}}
    {{- else -}}
      {{- range (where .Pages "Layout" "nc-series") -}}
        {{- $data := index hugo.Data "nghien-cuu" .Params.dataKey -}}
        <a class="lib-lesson{{ if eq .RelPermalink $cur }} is-current{{ end }}" href="{{ .RelPermalink }}">
          <span class="lib-lesson-info">
            <span class="lib-lesson-title">{{ .Title }}</span>
            {{- if $data }}<span class="lib-lesson-date">{{ $data.totalVideos }} bài</span>{{ end -}}
          </span>
        </a>
      {{- end -}}
    {{- end -}}
  </div>
</nav>
```

- [ ] **Step 2: Build to verify no template error**

Run: `hugo --quiet --destination /tmp/nc-build`
Expected: exits 0, no errors. (The partial is unused, so output is unchanged — this only confirms the template parses.)

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/nghien-cuu/list.html
git commit -m "feat(nghien-cuu): add divine-library middle-column partial"
```

---

### Task 2: Rewrite section list detail (`list.html`)

**Files:**
- Modify (full rewrite): `layouts/nghien-cuu/list.html`

Renders the section root's detail column: eyebrow + title + verse, then the existing series-card grid carried over verbatim. Still renders under `_default/baseof.html` until Task 5 — full-width but valid.

- [ ] **Step 1: Replace the file contents**

```go-html-template
{{ define "main" }}
{{- $series := where .Pages "Layout" "nc-series" -}}
<div class="lib-doc">
  <div class="lib-doc-eyebrow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>
    Nghiên Cứu
  </div>
  <h1 class="lib-doc-title">{{ .Title }}</h1>
  {{ with .Params.verse }}<p class="lib-doc-sub">{{ . }}</p>{{ end }}

  <div class="nc-series-grid">
    {{- range $series -}}
      {{- $data := index hugo.Data "nghien-cuu" .Params.dataKey -}}
      {{- $count := 0 -}}
      {{- $thumb := "" -}}
      {{- if $data -}}
        {{- $count = $data.totalVideos -}}
        {{- with index $data.videos 0 }}{{ $thumb = .thumbnail }}{{ end -}}
      {{- end -}}
      <a class="nc-series-card" href="{{ .RelPermalink }}">
        {{ if $thumb }}
        <div class="nc-series-thumb">
          <img src="{{ $thumb }}" alt="" loading="lazy">
        </div>
        {{ end }}
        <div class="nc-series-meta">
          <h2 class="nc-series-card-title">{{ .Title }}</h2>
          {{ with .Params.titleEn }}<div class="nc-series-card-en">{{ . }}</div>{{ end }}
          <div class="nc-series-card-by">
            {{ with .Params.author }}<span>{{ . }}</span>{{ end }}
            {{ if $count }}<span class="nc-series-card-dot">·</span><span>{{ $count }} bài</span>{{ end }}
            {{ with .Params.language }}<span class="nc-series-card-dot">·</span><span>{{ . }}</span>{{ end }}
          </div>
          {{ with .Description }}<p class="nc-series-card-desc">{{ . }}</p>{{ end }}
        </div>
      </a>
    {{- end -}}
  </div>
</div>
{{ end }}
```

- [ ] **Step 2: Build and verify the detail markup**

Run:
```bash
hugo --quiet --destination /tmp/nc-build && grep -c 'lib-doc' /tmp/nc-build/nghien-cuu/index.html && grep -c 'nc-series-card' /tmp/nc-build/nghien-cuu/index.html
```
Expected: build exits 0; first grep ≥ 1 (lib-doc present); second grep ≥ 13 (one per series).

- [ ] **Step 3: Commit**

```bash
git add layouts/nghien-cuu/list.html
git commit -m "feat(nghien-cuu): render section list inside lib-doc"
```

---

### Task 3: Rewrite series detail (`nc-series.html`)

**Files:**
- Modify (full rewrite): `layouts/nghien-cuu/nc-series.html`

Series detail column: eyebrow + title + English subtitle + byline stats + description + body + a "start" CTA to the first episode. The episode list moves to the middle column (Task 1), so it is dropped here. Breadcrumb removed (rail + middle provide navigation).

- [ ] **Step 1: Replace the file contents**

```go-html-template
{{ define "main" }}
{{- $data := index hugo.Data "nghien-cuu" .Params.dataKey -}}
{{- $episodes := sort (where .Pages "Layout" "nc-episode") "Weight" -}}
<article class="lib-doc">
  <div class="lib-doc-eyebrow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>
    Loạt bài
  </div>
  <h1 class="lib-doc-title">{{ .Title }}</h1>
  {{ with .Params.titleEn }}<p class="lib-doc-sub"><em>{{ . }}</em></p>{{ end }}
  <div class="lib-doc-stats">
    {{ with .Params.author }}<span>{{ . }}</span>{{ end }}
    {{ if $data }}<span>·</span><span>{{ $data.totalVideos }} bài</span>{{ end }}
    {{ with .Params.language }}<span>·</span><span>{{ . }}</span>{{ end }}
  </div>
  {{ with .Description }}<p class="lib-doc-sub">{{ . }}</p>{{ end }}
  {{ with .Content }}<div class="content">{{ . }}</div>{{ end }}
  {{ with (index $episodes 0) }}
  <a class="lib-cta" href="{{ .RelPermalink }}">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>
    Bắt đầu &middot; Bài {{ .Params.index }}
  </a>
  {{ end }}
</article>
{{ end }}
```

- [ ] **Step 2: Build and verify the series detail**

Run:
```bash
hugo --quiet --destination /tmp/nc-build && grep -c 'lib-cta' /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/index.html && grep -c 'lib-doc-title' /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/index.html
```
Expected: build exits 0; both greps = 1.

- [ ] **Step 3: Commit**

```bash
git add layouts/nghien-cuu/nc-series.html
git commit -m "feat(nghien-cuu): render series page inside lib-doc"
```

---

### Task 4: Rewrite episode detail (`nc-episode.html`)

**Files:**
- Modify (full rewrite): `layouts/nghien-cuu/nc-episode.html`

Episode detail column: eyebrow (`Bài N / total`) + title + English subtitle + YouTube embed + body + prev/next nav. Video lookup and prev/next sibling logic are carried over unchanged. Breadcrumb removed.

- [ ] **Step 1: Replace the file contents**

```go-html-template
{{ define "main" }}
{{- $data := index hugo.Data "nghien-cuu" .Params.dataKey -}}
{{- $idx := .Params.index -}}
{{- $video := index $data.videos (sub $idx 1) -}}
{{- $series := .Parent -}}
{{- $siblings := sort (where $series.Pages "Layout" "nc-episode") "Weight" -}}
{{- $prev := "" -}}{{- $next := "" -}}
{{- range $i, $p := $siblings -}}
  {{- if eq $p.Params.index $idx -}}
    {{- if gt $i 0 }}{{ $prev = index $siblings (sub $i 1) }}{{ end -}}
    {{- if lt (add $i 1) (len $siblings) }}{{ $next = index $siblings (add $i 1) }}{{ end -}}
  {{- end -}}
{{- end -}}

<article class="lib-doc">
  <div class="lib-doc-eyebrow">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>
    Bài {{ $idx }} / {{ $data.totalVideos }}
  </div>
  <h1 class="lib-doc-title">{{ with .Params.shortTitle }}{{ . }}{{ else }}{{ .Title }}{{ end }}</h1>
  {{ with $video.title }}<p class="lib-doc-sub"><em>{{ . }}</em></p>{{ end }}

  <div class="youtube-wrapper nc-episode-video">
    <iframe
      src="https://www.youtube.com/embed/{{ $video.videoId }}"
      title="{{ .Title }}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      frameborder="0"
      loading="lazy"></iframe>
  </div>

  {{ with .Content }}<div class="content">{{ . }}</div>{{ end }}

  <nav class="nc-prev-next">
    <div class="nc-prev-next-cell nc-prev-next-prev">
      {{ with $prev }}
        <a href="{{ .RelPermalink }}">
          <span class="nc-prev-next-label">← Bài trước</span>
          <span class="nc-prev-next-title">Bài {{ .Params.index }} · {{ with .Params.shortTitle }}{{ . }}{{ else }}{{ .Title }}{{ end }}</span>
        </a>
      {{ end }}
    </div>
    <div class="nc-prev-next-cell nc-prev-next-next">
      {{ with $next }}
        <a href="{{ .RelPermalink }}">
          <span class="nc-prev-next-label">Bài kế →</span>
          <span class="nc-prev-next-title">Bài {{ .Params.index }} · {{ with .Params.shortTitle }}{{ . }}{{ else }}{{ .Title }}{{ end }}</span>
        </a>
      {{ end }}
    </div>
  </nav>
</article>
{{ end }}
```

- [ ] **Step 2: Build and verify the episode detail**

Run:
```bash
hugo --quiet --destination /tmp/nc-build && grep -c 'youtube.com/embed' /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/bai-01/index.html && grep -c 'nc-prev-next' /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/bai-01/index.html
```
Expected: build exits 0; first grep = 1 (one iframe); second grep ≥ 1.

- [ ] **Step 3: Commit**

```bash
git add layouts/nghien-cuu/nc-episode.html
git commit -m "feat(nghien-cuu): render episode page inside lib-doc"
```

---

### Task 5: Section shell + head wiring

**Files:**
- Create: `layouts/nghien-cuu/baseof.html`
- Modify: `layouts/partials/head.html:68`

After this task the section renders the full three-column shell with fonts and `lib-app.css` loaded.

- [ ] **Step 1: Create `layouts/nghien-cuu/baseof.html`**

```go-html-template
<!DOCTYPE html>
<html lang="vi">
<head>
  {{- partial "head.html" . -}}
</head>
<body class="lib-app-body">
  <div class="lib-app{{ if in (slice "nc-series" "nc-episode") .Layout }} detail-open{{ end }}">
    <div class="lib-app-backdrop"></div>
    {{- partial "lib/rail.html" (dict "active" "nghien-cuu") -}}
    {{- partial "nghien-cuu/list.html" . -}}
    <main class="lib-detail">
      <div class="lib-detail-scroll">
        {{- block "main" . }}{{- end }}
      </div>
    </main>
  </div>
  {{- partial "lib/app-js.html" . -}}
</body>
</html>
```

- [ ] **Step 2: Add `nghien-cuu` to the lib-app slice in `head.html`**

Change line 68 from:

```go-html-template
{{ $libApp := in (slice "kt" "truong-sabat") .Section }}
```

to:

```go-html-template
{{ $libApp := in (slice "kt" "truong-sabat" "nghien-cuu") .Section }}
```

- [ ] **Step 3: Build and verify the shell + CSS load**

Run:
```bash
hugo --quiet --destination /tmp/nc-build && grep -c 'lib-app-body' /tmp/nc-build/nghien-cuu/index.html && grep -c 'lib-app.' /tmp/nc-build/nghien-cuu/index.html && grep -c 'lib-rail-item is-active' /tmp/nc-build/nghien-cuu/index.html
```
Expected: build exits 0; `lib-app-body` = 1 (shell active); `lib-app.` ≥ 1 (fingerprinted `lib-app.<hash>.css` link present); `is-active` ≥ 1 (rail highlights Nghiên Cứu).

- [ ] **Step 4: Verify episode page gets `detail-open`**

Run:
```bash
grep -c 'lib-app detail-open' /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/bai-01/index.html
```
Expected: = 1.

- [ ] **Step 5: Commit**

```bash
git add layouts/nghien-cuu/baseof.html layouts/partials/head.html
git commit -m "feat(nghien-cuu): wire divine-library shell and stylesheet"
```

---

### Task 6: Scoped CSS for nghien-cuu pieces

**Files:**
- Modify (append): `assets/css/lib-app.css`

Self-contained `.lib-app`-scoped styles for the series-card grid, the video embed, and the prev/next nav — using the existing `--kt-*` design tokens. Loaded after `style.css`, so these win over the global `.nc-*` base rules within the section. `bible-media.css` is left untouched.

- [ ] **Step 1: Append this block to the end of `assets/css/lib-app.css`**

```css

/* ============================================================
   Nghiên Cứu — series cards + video reader (scoped to .lib-app)
   ============================================================ */
.lib-app .nc-series-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; margin-top: 26px; }
.lib-app .nc-series-card { display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; background: var(--kt-paper-2); border: 1px solid var(--kt-hairline); transition: transform .16s, box-shadow .2s; }
.lib-app .nc-series-card:hover { transform: translateY(-2px); box-shadow: var(--kt-sh-md); }
.lib-app .nc-series-thumb { aspect-ratio: 16/9; overflow: hidden; background: var(--kt-sunken); }
.lib-app .nc-series-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lib-app .nc-series-meta { padding: 14px 16px 16px; }
.lib-app .nc-series-card-title { font-family: var(--kt-display); font-size: 17px; font-weight: 600; line-height: 1.25; margin: 0 0 4px; }
.lib-app .nc-series-card-en { font-size: 13px; font-style: italic; color: var(--kt-text-3); margin-bottom: 7px; }
.lib-app .nc-series-card-by { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 13px; color: var(--kt-text-2); margin-bottom: 8px; }
.lib-app .nc-series-card-dot { color: var(--kt-text-3); }
.lib-app .nc-series-card-desc { font-size: 13.5px; line-height: 1.55; color: var(--kt-text-2); margin: 0; }

/* video embed */
.lib-app .nc-episode-video { margin: 22px 0; }
.lib-app .youtube-wrapper { position: relative; aspect-ratio: 16/9; border-radius: 14px; overflow: hidden; background: #000; box-shadow: var(--kt-sh-md); }
.lib-app .youtube-wrapper iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }

/* prev / next */
.lib-app .nc-prev-next { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--kt-hairline); }
.lib-app .nc-prev-next-cell a { display: flex; flex-direction: column; gap: 4px; height: 100%; padding: 12px 16px; border-radius: 12px; background: var(--kt-paper-2); border: 1px solid var(--kt-hairline); transition: transform .16s, box-shadow .2s; }
.lib-app .nc-prev-next-cell a:hover { transform: translateY(-2px); box-shadow: var(--kt-sh-md); }
.lib-app .nc-prev-next-next { text-align: right; }
.lib-app .nc-prev-next-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--kt-accent-deep); }
.lib-app .nc-prev-next-title { font-size: 14px; color: var(--kt-text); line-height: 1.35; }

@media (max-width: 960px) {
  .lib-app .nc-series-grid { grid-template-columns: 1fr; }
  .lib-app .nc-prev-next { grid-template-columns: 1fr; }
  .lib-app .nc-prev-next-next { text-align: left; }
}
```

- [ ] **Step 2: Build to verify CSS compiles and is included**

Run:
```bash
hugo --quiet --destination /tmp/nc-build && grep -rl 'nc-series-grid' /tmp/nc-build/css/ /tmp/nc-build/assets/ 2>/dev/null | head
```
Expected: build exits 0; the fingerprinted `lib-app.*.css` file is listed (confirms the appended rules shipped). If the grep path differs, locate the file with `find /tmp/nc-build -name 'lib-app*.css'` and grep that.

- [ ] **Step 3: Commit**

```bash
git add assets/css/lib-app.css
git commit -m "style(nghien-cuu): scoped lib-app styles for cards, video, nav"
```

---

### Task 7: Full-section build verification

**Files:** none (verification only)

- [ ] **Step 1: Clean build of the whole site**

Run: `hugo --quiet --destination /tmp/nc-build`
Expected: exits 0, no `ERROR`/`WARN`.

- [ ] **Step 2: Confirm all three page types render the shell**

Run:
```bash
for f in \
  /tmp/nc-build/nghien-cuu/index.html \
  /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/index.html \
  /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/bai-01/index.html; do
  echo "== $f =="; grep -c 'lib-app-body' "$f"; grep -c 'lib-rail-item is-active' "$f"; done
```
Expected: every file reports `1` for both greps (shell present, rail active).

- [ ] **Step 3: Confirm the middle column highlights the current episode**

Run:
```bash
grep -c 'lib-lesson is-current' /tmp/nc-build/nghien-cuu/tuong-giao-lanh-manh/bai-01/index.html
```
Expected: = 1.

- [ ] **Step 4: Spot-check a second series builds correctly**

Run:
```bash
grep -c 'lib-doc' /tmp/nc-build/nghien-cuu/duc-tin-summit-24/index.html
```
Expected: ≥ 1.

- [ ] **Step 5: Visual confirmation (manual)**

Run `hugo server` and open `/nghien-cuu/`, a series, and an episode. Confirm: three-column layout, rail "Nghiên Cứu" active, series cards in detail at root, episodes in the middle column on series/episode pages, video + prev/next render, and the layout collapses to the mobile drawer below 960px. (Use the `run` or `verify` skill if a scripted browser check is wanted.)

- [ ] **Step 6: No commit** (verification only). If any check fails, return to the relevant task.

---

## Notes / out of scope

- No changes to `content/nghien-cuu/**`, `data/yt/nghien-cuu/**`, `bible-media.css`, `rail.html` (entry already at `rail.html:20`), or `lib/app-js.html`.
- Mobile "back from detail" behavior matches `truong-sabat` exactly (no extra control added); any improvement there is a cross-cutting divine-library concern, not part of this migration.
- The old `.nc-*` rules remain in `bible-media.css` (still globally concatenated) as a harmless base; the scoped `.lib-app .nc-*` rules override them within the section.
