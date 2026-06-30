# Sách Chapter Header/Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give book-chapter pages a pinned top header (book name) and pinned bottom footer (chapter name + prev/next pager + reading-progress line), as visual twins of the existing game header/footer.

**Architecture:** Restructure `sach/baseof.html` to render `header`/`footer` blocks as siblings of `.lib-detail-scroll` (the games pattern). Two new partials (`chapter-header.html`, `chapter-footer.html`) hold the markup; both chapter layouts (`chapter.html`, `lde-chapter.html`) define the blocks via those partials. The prev/next neighbor walk and the `lib-dtrigger` button move out of `reader.html` into the footer/header. CSS goes in `lib-app.css` (already loaded on sach pages). A small scroll listener in `app-js.html` drives the progress line.

**Tech Stack:** Hugo templates (Go templates), vanilla CSS with the project's `--kt-*` / `--surface-*` token system, vanilla JS.

## Global Constraints

- All UI copy is **Vietnamese**. Use "Đức Chúa Giê-su", "Kinh Thánh", "Hội Thánh" capitalization rules per `CLAUDE.md`. (No new prose copy here beyond button labels "Trước" / "Sau" and aria-labels.)
- Use "…" not "...". After "," a space.
- **No hard-coded colors** — only existing CSS variables (`--surface-soft`, `--surface-inverse`, `--surface-raised`, `--text-strong`, `--text-secondary`, `--text-faint`, `--border-default`, `--accent`, `--shadow-soft`, `--kt-display`, `--kt-accent`). Must work in light + dark + system.
- **No absolute phucam.tv URLs** — use `.RelPermalink` only.
- Bars render on **chapter pages only** (`.Kind == "page"`), never on book-landing / author / library list pages.
- No test runner exists for layouts. Each task's "test" = `hugo` build succeeds + visual check on `/sach/egw/khat-vong-muon-doi/chuong-01/` via `hugo server`.
- Reuse, don't duplicate: the `lib-detail--has-bankinfo` rule and the `.games-header`/`.games-bankinfo` token recipe already exist — mirror them, don't reinvent.

**Build/serve commands:**
- Build check: `hugo --quiet` (exit 0 = templates compile)
- Local server: `hugo server -D` → http://localhost:1313/sach/egw/khat-vong-muon-doi/chuong-01/

---

## File Structure

- **Create** `layouts/partials/sach/chapter-header.html` — header bar markup (book icon + name + mục-lục button).
- **Create** `layouts/partials/sach/chapter-footer.html` — footer bar markup (progress line + chapter label/name + prev/next pager).
- **Modify** `layouts/sach/baseof.html` — render `header`/`footer` blocks around `.lib-detail-scroll`, chapter-only; add `lib-detail--has-bankinfo`.
- **Modify** `layouts/sach/chapter.html` — define `header`/`footer` blocks calling the new partials.
- **Modify** `layouts/sach/lde-chapter.html` — same.
- **Modify** `layouts/partials/sach/reader.html` — remove the in-content `.lib-dtrigger` button and the `nc-prev-next` nav (they move to header/footer).
- **Modify** `assets/css/lib-app.css` — add `.sach-header` / `.sach-footer` rules.
- **Modify** `layouts/partials/lib/app-js.html` — add scroll → progress-line listener.

---

## Task 1: Header partial + footer partial (markup only)

Create both partials first so the block-defining layouts in Task 2 have something to call. No styling yet — markup will look unstyled until Task 5; that's expected.

**Files:**
- Create: `layouts/partials/sach/chapter-header.html`
- Create: `layouts/partials/sach/chapter-footer.html`

**Interfaces:**
- Consumes: the chapter page context (`.`), passed by the layout block. From it: `.Parent.Title` (book title), `.Params.chapter` (chapter number), `.Title` (chapter title with `Chương N: ` prefix), `.Parent.Pages.ByWeight` + `.RelPermalink` (neighbor walk).
- Produces: `<header class="sach-header">` and `<footer class="sach-footer">` consumed by `baseof.html`'s flex column (Task 3) and styled by Task 5. The footer emits `.sf-progress` consumed by the JS in Task 6.

- [ ] **Step 1: Create the header partial**

`layouts/partials/sach/chapter-header.html`:

```go-html-template
{{- /* Pinned top bar for a book chapter: book icon + book name + mục-lục
       trigger. Twin of .games-header. Receives the chapter page as `.`. */ -}}
{{- $book := .Parent -}}
<header class="sach-header" aria-label="Đầu trang sách">
  <span class="sh-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>
  </span>
  <h2 class="sh-book">{{ $book.Title }}</h2>
  <div class="sh-actions">
    <button class="lib-dtrigger sh-btn" type="button" aria-label="Mở mục lục" title="Mục lục">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
    </button>
  </div>
</header>
```

- [ ] **Step 2: Create the footer partial**

`layouts/partials/sach/chapter-footer.html`:

```go-html-template
{{- /* Pinned bottom bar for a book chapter: reading-progress line (top edge,
       JS-driven), chapter label + name, prev/next pager. Twin of
       .games-bankinfo. Receives the chapter page as `.`. */ -}}
{{- $book := .Parent -}}
{{- $title := replaceRE "^Chương [0-9]+: " "" .Title -}}
{{- $pages := $book.Pages.ByWeight -}}
{{- $prev := false }}{{ $next := false -}}
{{- range $i, $p := $pages -}}
  {{- if eq $p.RelPermalink $.RelPermalink -}}
    {{- if gt $i 0 }}{{ $prev = index $pages (sub $i 1) }}{{ end -}}
    {{- if lt $i (sub (len $pages) 1) }}{{ $next = index $pages (add $i 1) }}{{ end -}}
  {{- end -}}
{{- end -}}
<footer class="sach-footer" aria-label="Cuối trang sách">
  <span class="sf-progress" aria-hidden="true"></span>
  {{ with .Params.chapter }}<span class="sf-label">Chương {{ . }}</span>{{ end }}
  <span class="sf-chapter">{{ $title }}</span>
  <nav class="sf-pager" aria-label="Điều hướng chương">
    {{ if $prev }}
      <a href="{{ $prev.RelPermalink }}" title="Chương trước">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg><span class="lbl">Trước</span>
      </a>
    {{ else }}
      <span class="sf-pg-disabled" aria-disabled="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg><span class="lbl">Trước</span>
      </span>
    {{ end }}
    {{ if $next }}
      <a href="{{ $next.RelPermalink }}" title="Chương kế">
        <span class="lbl">Sau</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </a>
    {{ else }}
      <span class="sf-pg-disabled" aria-disabled="true">
        <span class="lbl">Sau</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </span>
    {{ end }}
  </nav>
</footer>
```

- [ ] **Step 3: Build check (partials compile, even if unused yet)**

Run: `hugo --quiet`
Expected: exit 0, no template errors. (The partials aren't referenced yet — Hugo won't render them, but creating them must not break the build.)

- [ ] **Step 4: Commit**

```bash
git add layouts/partials/sach/chapter-header.html layouts/partials/sach/chapter-footer.html
git commit -m "feat(sach): chapter header/footer partials (markup)"
```

---

## Task 2: Wire blocks into both chapter layouts

Make `chapter.html` and `lde-chapter.html` define `header`/`footer` blocks that call the partials. After this task the blocks exist but `baseof.html` doesn't render them yet (Task 3), so the page is unchanged — this task only adds the block definitions.

**Files:**
- Modify: `layouts/sach/chapter.html`
- Modify: `layouts/sach/lde-chapter.html`

**Interfaces:**
- Consumes: the partials from Task 1.
- Produces: `header` / `footer` blocks named exactly `"header"` and `"footer"`, rendered by `baseof.html` in Task 3.

- [ ] **Step 1: Update `chapter.html`**

Replace the entire file `layouts/sach/chapter.html` (currently one line) with:

```go-html-template
{{ define "main" }}{{ partial "sach/reader.html" . }}{{ end }}
{{ define "header" }}{{ partial "sach/chapter-header.html" . }}{{ end }}
{{ define "footer" }}{{ partial "sach/chapter-footer.html" . }}{{ end }}
```

- [ ] **Step 2: Update `lde-chapter.html`**

Replace the entire file `layouts/sach/lde-chapter.html` (currently one line) with:

```go-html-template
{{ define "main" }}{{ partial "sach/reader.html" . }}{{ end }}
{{ define "header" }}{{ partial "sach/chapter-header.html" . }}{{ end }}
{{ define "footer" }}{{ partial "sach/chapter-footer.html" . }}{{ end }}
```

- [ ] **Step 3: Build check**

Run: `hugo --quiet`
Expected: exit 0. (Blocks defined but not yet rendered by baseof; page output unchanged.)

- [ ] **Step 4: Commit**

```bash
git add layouts/sach/chapter.html layouts/sach/lde-chapter.html
git commit -m "feat(sach): define header/footer blocks in chapter layouts"
```

---

## Task 3: Render the blocks in the shell (baseof)

Restructure `sach/baseof.html` to render the `header` block above `.lib-detail-scroll` and the `footer` block below it, **chapter-only**, mirroring `games/baseof.html`. After this task the bars appear on chapter pages (unstyled until Task 5).

**Files:**
- Modify: `layouts/sach/baseof.html`

**Interfaces:**
- Consumes: `header` / `footer` blocks from Task 2.
- Produces: rendered `.sach-header` / `.sach-footer` in the DOM as flex siblings of `.lib-detail-scroll`; the `.lib-detail--has-bankinfo` class on `<main>` for chapter pages (Task 5 CSS uses it for mobile spacing).

- [ ] **Step 1: Edit the `<main>` block in `baseof.html`**

In `layouts/sach/baseof.html`, replace:

```go-html-template
    <main class="lib-detail">
      <div class="lib-detail-scroll">
        {{- block "main" . }}{{- end }}
      </div>
    </main>
```

with:

```go-html-template
    <main class="lib-detail{{ if $isChapter }} lib-detail--has-bankinfo{{ end }}">
      {{- if $isChapter }}{{- block "header" . }}{{- end }}{{- end }}
      <div class="lib-detail-scroll">
        {{- block "main" . }}{{- end }}
      </div>
      {{- if $isChapter }}{{- block "footer" . }}{{- end }}{{- end }}
    </main>
```

(`$isChapter` is already defined at the top of `baseof.html` as `eq .Kind "page"`.)

- [ ] **Step 2: Build + visual check**

Run: `hugo server -D` then open http://localhost:1313/sach/egw/khat-vong-muon-doi/chuong-01/
Expected: a `<header class="sach-header">` appears above the content and a `<footer class="sach-footer">` below it (unstyled — plain text "Khát Vọng Muôn Đời", "Chương 1 …", "Trước"/"Sau"). Open a non-chapter page (the book landing http://localhost:1313/sach/egw/khat-vong-muon-doi/) and confirm **no** bars render there.

- [ ] **Step 3: Commit**

```bash
git add layouts/sach/baseof.html
git commit -m "feat(sach): render chapter header/footer in detail shell"
```

---

## Task 4: Remove the moved elements from the reader

The `.lib-dtrigger` button (now in the header) and the `nc-prev-next` nav (now in the footer) are duplicated in `reader.html`. Remove them so each appears once. The neighbor-walk template lines that fed `nc-prev-next` are now dead and removed too.

**Files:**
- Modify: `layouts/partials/sach/reader.html`

**Interfaces:**
- Consumes: nothing new.
- Produces: a reader body with no top `.lib-dtrigger` and no bottom pager (those live in header/footer now).

- [ ] **Step 1: Remove the in-content `.lib-dtrigger` button**

In `layouts/partials/sach/reader.html`, delete these lines (currently right after `<article class="lib-doc">`):

```go-html-template
  <button class="lib-dtrigger" type="button" aria-label="Mở mục lục">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>
  </button>
```

- [ ] **Step 2: Remove the neighbor-walk + `nc-prev-next` nav**

In the same file, delete from the `{{- $pages := $book.Pages.ByWeight -}}` line through the closing `</nav>` of `nc-prev-next` — i.e. delete this whole block:

```go-html-template
  {{- $pages := $book.Pages.ByWeight -}}
  {{- $prev := false }}{{ $next := false -}}
  {{- range $i, $p := $pages -}}
    {{- if eq $p.RelPermalink $.RelPermalink -}}
      {{- if gt $i 0 }}{{ $prev = index $pages (sub $i 1) }}{{ end -}}
      {{- if lt $i (sub (len $pages) 1) }}{{ $next = index $pages (add $i 1) }}{{ end -}}
    {{- end -}}
  {{- end -}}
  <nav class="nc-prev-next">
    <div class="nc-prev-next-cell nc-prev-next-prev">
      {{ with $prev }}
        <a href="{{ .RelPermalink }}">
          <span class="nc-prev-next-label">← Chương trước</span>
          <span class="nc-prev-next-title">{{ replaceRE "^Chương [0-9]+: " "" .Title }}</span>
        </a>
      {{ end }}
    </div>
    <div class="nc-prev-next-cell nc-prev-next-next">
      {{ with $next }}
        <a href="{{ .RelPermalink }}">
          <span class="nc-prev-next-label">Chương kế →</span>
          <span class="nc-prev-next-title">{{ replaceRE "^Chương [0-9]+: " "" .Title }}</span>
        </a>
      {{ end }}
    </div>
  </nav>
```

The `$book` variable defined at the top of `reader.html` (`{{- $book := .Parent -}}`) is **still used** by the eyebrow link above — do **not** remove it.

- [ ] **Step 3: Build + visual check**

Run: `hugo server -D` then open http://localhost:1313/sach/egw/khat-vong-muon-doi/chuong-01/
Expected: exactly one mục-lục trigger (in the header), and the big prev/next cards no longer appear at the bottom of the article body. The footer's "Trước"/"Sau" are the only navigation. Click the header mục-lục button → the chapter-list column opens (the `lib-dtrigger` class still binds via `app-js.html`).

- [ ] **Step 4: Commit**

```bash
git add layouts/partials/sach/reader.html
git commit -m "refactor(sach): move dtrigger + pager out of reader into header/footer"
```

---

## Task 5: Style the bars (lib-app.css)

Add `.sach-header` / `.sach-footer` rules to `lib-app.css` (already loaded on all sach pages — no head.html change). Mirror the `.games-header` / `.games-bankinfo` recipe.

**Files:**
- Modify: `assets/css/lib-app.css` (append a new scoped block, e.g. near the existing `.nc-prev-next` rules around line 540)

**Interfaces:**
- Consumes: the markup classes from Tasks 1 (`sh-icon`, `sh-book`, `sh-actions`, `sh-btn`, `sf-progress`, `sf-label`, `sf-chapter`, `sf-pager`, `sf-pg-disabled`, `lbl`) and `lib-detail--has-bankinfo` from Task 3.
- Produces: styled bars; `.sf-progress` width animatable by the JS in Task 6.

- [ ] **Step 1: Append the CSS block**

Add to `assets/css/lib-app.css`:

```css
/* ── Sách chapter pinned bars — twins of .games-header / .games-bankinfo,
   scoped to the divine-library shell. Header pins to the top edge of the
   detail column, footer to the bottom; both are flex siblings of
   .lib-detail-scroll (rendered in sach/baseof.html, chapter pages only). ── */
.lib-app .sach-header {
  position: relative; z-index: 5; flex: 0 0 auto;
  display: flex; align-items: center; gap: 0.9rem; margin: 0;
  padding: 0.7rem 44px;
  background: var(--surface-soft);
  border-bottom: 1px solid var(--border-default);
  box-shadow: 0 2px 12px var(--shadow-soft);
}
.lib-app .sach-header .sh-icon {
  flex: none; width: 34px; height: 34px; display: grid; place-items: center;
  border-radius: 9px; background: var(--surface-inverse);
  color: var(--text-on-inverse-strong); box-shadow: 0 1px 3px var(--shadow-soft);
}
.lib-app .sach-header .sh-icon svg { width: 18px; height: 18px; }
.lib-app .sach-header .sh-book {
  font-family: var(--kt-display); font-weight: 600; color: var(--text-strong);
  font-size: 1.15rem; line-height: 1.15; margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.lib-app .sach-header .sh-actions { display: flex; gap: 0.3rem; margin-left: auto; flex: none; }
.lib-app .sach-header .sh-btn {
  flex: none; width: 34px; height: 34px; display: grid; place-items: center;
  background: var(--surface-raised); color: var(--text-secondary);
  border: 1px solid var(--border-default); border-radius: 9px; cursor: pointer;
  transition: background .12s ease, border-color .12s ease, color .12s ease;
}
.lib-app .sach-header .sh-btn:hover {
  background: var(--surface-soft); border-color: var(--accent); color: var(--text-strong);
}
.lib-app .sach-header .sh-btn svg { width: 17px; height: 17px; }

.lib-app .sach-footer {
  position: relative; z-index: 5; flex: 0 0 auto; width: auto; margin: 0;
  background: var(--surface-soft);
  border-top: 1px solid var(--border-default);
  box-shadow: 0 -2px 12px var(--shadow-soft);
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 44px; font-size: 0.84rem; color: var(--text-secondary);
}
/* reading-progress line on the footer's top hairline; JS sets width 0→100% */
.lib-app .sach-footer .sf-progress {
  position: absolute; top: -1px; left: 0; height: 2px; width: 0;
  background: var(--kt-accent); transition: width .12s linear;
}
.lib-app .sach-footer .sf-label {
  flex: none; font-size: 0.66rem; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--text-faint);
}
.lib-app .sach-footer .sf-chapter {
  font-family: var(--kt-display); font-weight: 600; color: var(--text-strong);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.lib-app .sach-footer .sf-pager { display: flex; gap: 0.3rem; margin-left: auto; flex: none; }
.lib-app .sach-footer .sf-pager a,
.lib-app .sach-footer .sf-pager .sf-pg-disabled {
  display: inline-flex; align-items: center; gap: 0.35rem;
  height: 30px; padding: 0 0.7rem;
  background: var(--surface-raised); color: var(--text-secondary);
  border: 1px solid var(--border-default); border-radius: 8px;
  font-size: 0.78rem; font-weight: 600;
  transition: background .12s ease, border-color .12s ease, color .12s ease;
}
.lib-app .sach-footer .sf-pager a:hover {
  background: var(--surface-soft); border-color: var(--accent); color: var(--text-strong);
}
.lib-app .sach-footer .sf-pager .sf-pg-disabled { opacity: .4; }
.lib-app .sach-footer .sf-pager svg { width: 15px; height: 15px; }

@media (max-width: 960px) {
  .lib-app .sach-header { padding-left: 20px; padding-right: 20px; }
  .lib-app .sach-footer { padding-left: 20px; padding-right: 20px; }
  /* mobile bottom navbar floats over the detail column; reserve its height so
     the footer stacks above it (same pattern as games' bankinfo) */
  .lib-app .lib-detail--has-bankinfo { padding-bottom: 64px; }
}
@media (max-width: 600px) {
  .lib-app .sach-footer .sf-pager .lbl { display: none; }
}
```

- [ ] **Step 2: Build + visual check (the core acceptance check)**

Run: `hugo server -D` then open http://localhost:1313/sach/egw/khat-vong-muon-doi/chuong-01/
Expected:
- Header: dark icon chip + "Khát Vọng Muôn Đời" (serif) left, mục-lục button right; bottom hairline + downward shadow.
- Footer: "CHƯƠNG 1" eyebrow + chapter name (serif) left; "Trước" (disabled, faded) + "Sau" pills right; top hairline + upward shadow.
- Content scrolls between the two pinned bars.
- Toggle OS appearance light ↔ dark: both bars read correctly with no hard-coded color leaking.

- [ ] **Step 3: Commit**

```bash
git add assets/css/lib-app.css
git commit -m "style(sach): style chapter header/footer bars"
```

---

## Task 6: Reading-progress line JS

Add a scroll listener that sets `.sf-progress` width from scroll position. Lives in `app-js.html` (shared, already scoped to `.lib-app`, already runs on sach pages). Guarded so it's inert where the bars don't exist.

**Files:**
- Modify: `layouts/partials/lib/app-js.html`

**Interfaces:**
- Consumes: `.lib-detail-scroll` (scroll container) and `.sach-footer .sf-progress` (from Tasks 1/5).
- Produces: live `style.width` on `.sf-progress`, 0% at top → 100% at bottom.

- [ ] **Step 1: Add the listener inside the existing `app-js.html` IIFE**

In `layouts/partials/lib/app-js.html`, inside the existing `(function () { … })();` (after the `var app = document.querySelector(".lib-app"); if (!app) return;` guard, so it shares the early-out), add:

```javascript
  /* ---- sách chapter reading-progress line (footer top edge) ---- */
  var rpScroll = document.querySelector(".lib-detail-scroll");
  var rpLine = document.querySelector(".sach-footer .sf-progress");
  if (rpScroll && rpLine) {
    var rpUpdate = function () {
      var max = rpScroll.scrollHeight - rpScroll.clientHeight;
      rpLine.style.width = (max > 0 ? (rpScroll.scrollTop / max) * 100 : 0) + "%";
    };
    rpScroll.addEventListener("scroll", rpUpdate, { passive: true });
    rpUpdate();
  }
```

- [ ] **Step 2: Build + visual check**

Run: `hugo server -D` then open http://localhost:1313/sach/egw/khat-vong-muon-doi/chuong-01/
Expected: scrolling the chapter grows the accent line along the footer's top edge from left (0%) to full width (100%) at the bottom. On a non-chapter page (no `.sach-footer`) the script does nothing and throws no console error.

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/lib/app-js.html
git commit -m "feat(sach): reading-progress line on chapter footer"
```

---

## Task 7: Full verification pass

No code change — a final acceptance sweep against the spec's verification list, capturing evidence per the design-principles "verify before claiming done" rule.

**Files:** none.

- [ ] **Step 1: Desktop, normal book chapter**

`hugo server -D`, open http://localhost:1313/sach/egw/khat-vong-muon-doi/chuong-01/
Confirm: header pinned top (book name), footer pinned bottom (chapter name + pager), content scrolls between; progress line grows 0→100%; "Trước" disabled on chapter 1; "Sau" navigates to chapter 2.

- [ ] **Step 2: Last chapter (next disabled)**

Open the book's final chapter (highest `weight`). Confirm "Sau" is disabled and "Trước" works.

- [ ] **Step 3: LDE chapter layout**

Find an LDE book chapter (uses `lde-chapter.html` — check `content/sach/` for a book whose chapters use that layout) and confirm the same header/footer render correctly.

- [ ] **Step 4: Mobile width**

Narrow the viewport to ≤600px. Confirm: header/footer padding tightens to 20px; pager labels ("Trước"/"Sau") collapse to icon-only; footer sits above the mobile bottom navbar (not hidden behind it).

- [ ] **Step 5: Light / dark / system**

Toggle OS appearance. Confirm both bars and the progress line read correctly in each; no hard-coded color. Capture screenshots (light + dark) as evidence.

- [ ] **Step 6: mục-lục trigger**

Click the header mục-lục button on desktop and mobile → chapter-list column opens/closes.

- [ ] **Step 7: Final build**

Run: `hugo --quiet`
Expected: exit 0, clean build.

---

## Self-Review Notes

- **Spec coverage:** Header (Task 1,3,5) · Footer chapter name (1,3,5) · pager moved to footer (1,4) · progress line (1,5,6) · in-content pager + dtrigger removed (4) · shell wiring chapter-only (3) · both layouts (2) · CSS mirrors game recipe, tokens only (5) · light/dark/system + mobile (5,7). All spec sections map to a task.
- **CSS delivery:** `lib-app.css` already loads on sach pages (`$libApp` includes `sach`), so no `head.html` change — confirmed against `layouts/partials/head.html:67,85`.
- **`lib-dtrigger` binding:** binds by class in `app-js.html` (`querySelectorAll(".lib-dtrigger")`), so the header button works with no JS change — confirmed against `app-js.html`.
- **`$book` reuse in reader.html:** kept (used by eyebrow link); only the dtrigger + nc-prev-next + their neighbor walk are removed.
