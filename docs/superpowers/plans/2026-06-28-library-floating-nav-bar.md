# Library Floating Nav Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the library shell's left rail collapse into a full-width floating bottom app-nav bar when the detail column gets narrow, and collapse the mid list to a drawer when the list gets nearly as wide as the content.

**Architecture:** Pure CSS handles the layout state via one media query `@media (min-width: 961px) and (max-width: 1160px)` (scoped under `.lib-app` in `assets/css/lib-app.css`); a new shared partial `lib/navbar.html` renders the bar from the same nav data as the rail; the shared `lib/app-js.html` gains only the Kinh Thánh inline-unfold toggle (no width measurement — the layout is pure CSS). Both the partial and the JS live in files already included by every section, so no per-section `baseof.html` edits are needed.

**Tech Stack:** Hugo v0.163.1 (extended), hand-authored CSS + vanilla JS. No build step beyond `hugo`. No front-end test framework exists — verification is `hugo` build success + manual browser checks against the mockup `/tmp/lib-floating-nav-mockup.html`.

## Global Constraints

- All new CSS rules MUST be scoped under `.lib-app` (nothing leaks to other sections). Verbatim convention from `assets/css/lib-app.css`.
- The bar nav data MUST be a single source of truth shared with `lib/rail.html` — do not duplicate the item list. Reuse the rail's existing inline SVG icons (the rail already has icons; no new icon set).
- Keep the existing `@media (max-width: 960px)` mobile drawer block **completely untouched** — it is the floor. The new floating-bar state lives only in the 961–1160px band. There is no `stack` state and no JS layout logic (decision 2026-06-28).
- Divine names and Vietnamese copy exactly as in the rail: `Kinh Thánh`, `Trường Sa-bát`, `Nghiên Cứu`, `Thánh Ca`, `Tủ Sách`, `Tác Giả`, `Khám Phá`, `Cựu & Tân Ước`, `Tín Lý`.
- Default item style: **icon + label**.
- Two-column (`rail-float`) state operates only in `@media (min-width: 961px) and (max-width: 1160px)`. Equal grid mins keep the columns clean within the band: `minmax(280px, var(--lib-mid-w)) minmax(280px, 1fr)`.
- Run `hugo` from the repo root (`/Users/htruong/code/phucamtv`). `make dev` serves at `http://localhost:1313`.

---

## File Structure

- **`layouts/partials/lib/nav-data.html`** (new) — the single nav list as a Hugo slice of dicts; returns it via a `return` so both rail and navbar consume it. Holds key, href, label, icon-name, and (for Kinh Thánh) children.
- **`layouts/partials/lib/nav-icon.html`** (new) — maps an icon name → the exact inline SVG markup already used in `rail.html`. Called by both rail and navbar so icons never drift.
- **`layouts/partials/lib/navbar.html`** (new) — renders `<nav class="lib-navbar">` (the floating bar) from `nav-data.html`. Rendered once from inside `rail.html`.
- **`layouts/partials/lib/rail.html`** (modify) — refactor to render from `nav-data.html` + `nav-icon.html`; append the navbar partial. (Optional refactor of the rail body is folded into this; the rail's rendered HTML must stay byte-equivalent except for the appended bar.)
- **`assets/css/lib-app.css`** (modify) — add the `.lib-navbar*` visual rules + a `@media (min-width: 961px) and (max-width: 1160px)` block that turns the shell into the two-column rail-float layout. Scoped under `.lib-app`.
- **`layouts/partials/lib/app-js.html`** (modify) — add only the Kinh Thánh parent-unfold toggle + outside-click-close. No layout JS.

---

### Task 1: Extract shared nav data + icon partials (no visual change)

This task makes rail render from shared data with **identical output**, so it's safe and independently reviewable before any new UI exists.

**Files:**
- Create: `layouts/partials/lib/nav-data.html`
- Create: `layouts/partials/lib/nav-icon.html`
- Modify: `layouts/partials/lib/rail.html`
- Verify against: current rendered `/kt/` page

**Interfaces:**
- Produces: `partial "lib/nav-data.html" .` → returns a slice of dicts. Each dict: `key` (string, e.g. `"kt"`, `"tin-ly"`, or `""` for items with no active-state), `href` (string), `label` (string), `icon` (string icon name), and optionally `children` (slice of the same dict shape). The Khám Phá item uses `key ""`.
- Produces: `partial "lib/nav-icon.html" "<name>"` → returns inline `<svg>…</svg>` string for that name. Names: `kt`, `cuu-tan-uoc`, `tin-ly`, `truong-sabat`, `nghien-cuu`, `tc`, `authors`, `sach`, `kham-pha`.

- [ ] **Step 1: Create the nav-data partial**

Create `layouts/partials/lib/nav-data.html`:

```go-html-template
{{- /* Single source of truth for library nav (rail + floating bar).
       Returns a slice of item dicts. Kinh Thánh carries children. */ -}}
{{- $nav := slice
  (dict "key" "kt" "href" "/kt/" "label" "Kinh Thánh" "icon" "kt" "children" (slice
    (dict "key" "" "href" "/kt/" "label" "Cựu & Tân Ước" "icon" "cuu-tan-uoc")
    (dict "key" "tin-ly" "href" "/tin-ly/" "label" "Tín Lý" "icon" "tin-ly")
  ))
  (dict "key" "truong-sabat" "href" "/truong-sabat/" "label" "Trường Sa-bát" "icon" "truong-sabat")
  (dict "key" "nghien-cuu" "href" "/nghien-cuu/" "label" "Nghiên Cứu" "icon" "nghien-cuu")
  (dict "key" "tc" "href" "/tc/" "label" "Thánh Ca" "icon" "tc")
  (dict "key" "authors" "href" "/authors/" "label" "Tác Giả" "icon" "authors")
  (dict "key" "sach" "href" "/sach/" "label" "Tủ Sách" "icon" "sach")
  (dict "key" "" "href" "/" "label" "Khám Phá" "icon" "kham-pha")
-}}
{{- return $nav -}}
```

- [ ] **Step 2: Create the nav-icon partial**

Create `layouts/partials/lib/nav-icon.html` (SVGs copied verbatim from the current `rail.html`):

```go-html-template
{{- /* Inline SVG by icon name. Shared by rail + navbar. Arg: the name string. */ -}}
{{- $n := . -}}
{{- if eq $n "kt" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H2z"/><path d="M22 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H22z"/></svg>
{{- else if eq $n "cuu-tan-uoc" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V6a3 3 0 0 1 6 0v15M13 21V6a3 3 0 0 1 6 0v15M3 21h18"/></svg>
{{- else if eq $n "tin-ly" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5z"/></svg>
{{- else if eq $n "truong-sabat" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
{{- else if eq $n "nghien-cuu" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>
{{- else if eq $n "tc" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
{{- else if eq $n "authors" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
{{- else if eq $n "sach" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>
{{- else if eq $n "kham-pha" -}}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>
{{- end -}}
```

- [ ] **Step 3: Refactor rail.html to render from shared data**

Replace the body of `layouts/partials/lib/rail.html` (keep the leading comment + `$a := .active` + the `lib-rail-brand` block at the end):

```go-html-template
{{- /* Shared library rail. Call with (dict "active" "<section-key>").
       Keys: kt, tc, authors, sach, nghien-cuu, tin-ly, truong-sabat. */ -}}
{{- $a := .active -}}
{{- $nav := partial "lib/nav-data.html" . -}}
<aside class="lib-rail">
  <nav class="lib-rail-nav">
    {{- range $nav }}
    <a class="lib-rail-item{{ if and .key (eq $a .key) }} is-active{{ end }}" href="{{ .href }}">{{ partial "lib/nav-icon.html" .icon }}{{ .label }}</a>
    {{- with .children }}
    <div class="lib-rail-sub">
      {{- range . }}
      <a class="lib-rail-item{{ if and .key (eq $a .key) }} is-active{{ end }}" href="{{ .href }}">{{ partial "lib/nav-icon.html" .icon }}{{ .label }}</a>
      {{- end }}
    </div>
    {{- end }}
    {{- end }}
  </nav>

  <a class="lib-rail-brand" href="/">
    {{ partial "lib/mark.html" . }}
    <span><span>Thư Viện</span><b>Phúc Âm</b></span>
  </a>
</aside>
```

Note: the original rail nests the `lib-rail-sub` div *inside* nothing special — it appears right after the Kinh Thánh `<a>`. This range structure reproduces that: the children div renders immediately after the parent `<a>`.

- [ ] **Step 4: Build and diff the rendered rail**

Run from repo root:

```bash
hugo --minify -d /tmp/hugo-out-after >/dev/null 2>&1 && echo BUILD_OK || echo BUILD_FAIL
```

Expected: `BUILD_OK`.

Then confirm the rail markup is unchanged. Before starting Task 1 you should have captured a baseline; if not, `git stash`, build to `/tmp/hugo-out-before`, `git stash pop`. Compare the rail region of a known page:

```bash
grep -o '<aside class="lib-rail">.*</aside>' /tmp/hugo-out-after/kt/index.html | head -c 4000
```

Expected: the same items, hrefs, labels, icons, and the `is-active` on the Kinh Thánh item, in the same order as the pre-change rail.

- [ ] **Step 5: Commit**

```bash
git add layouts/partials/lib/nav-data.html layouts/partials/lib/nav-icon.html layouts/partials/lib/rail.html
git commit -m "refactor(lib): extract shared nav-data + nav-icon partials for rail

No visual change — rail now renders from a single nav source so the
upcoming floating bar can reuse the same items and icons.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Render the floating nav bar partial (hidden until CSS state exists)

**Files:**
- Create: `layouts/partials/lib/navbar.html`
- Modify: `layouts/partials/lib/rail.html` (append one line)

**Interfaces:**
- Consumes: `partial "lib/nav-data.html" .`, `partial "lib/nav-icon.html" .icon`, and `.active` (passed through the same dict the rail receives).
- Produces: DOM `<nav class="lib-navbar"><div class="lib-navbar-inner">…</div></nav>` with: each top-level item as `<a class="lib-navbar-item">` (icon + `<span>` label); the Kinh Thánh item as `<div class="lib-navbar-parent"><button class="lib-navbar-item is-parent" data-toggle>…</button><div class="lib-navbar-kids"><div class="lib-navbar-kids-track"><a class="lib-navbar-item is-child">…</a>…</div></div></div>`. Active item gets `is-active`. This is the DOM contract the CSS (Task 3) and JS (Task 4) depend on.

- [ ] **Step 1: Create the navbar partial**

Create `layouts/partials/lib/navbar.html`:

```go-html-template
{{- /* Floating app nav bar (library shell). Rendered from the same nav data
       as the rail. Hidden by CSS except in the rail-float band (961–1160px).
       Call with the same dict as the rail: (dict "active" "<key>"). */ -}}
{{- $a := .active -}}
{{- $nav := partial "lib/nav-data.html" . -}}
<nav class="lib-navbar" aria-label="Thư viện">
  <div class="lib-navbar-inner">
    {{- range $nav }}
    {{- if .children }}
    <div class="lib-navbar-parent" data-parent>
      <button type="button" class="lib-navbar-item is-parent{{ if and .key (eq $a .key) }} is-active{{ end }}" data-toggle>{{ partial "lib/nav-icon.html" .icon }}<span>{{ .label }}</span></button>
      <div class="lib-navbar-kids"><div class="lib-navbar-kids-track">
        {{- range .children }}
        <a class="lib-navbar-item is-child{{ if and .key (eq $a .key) }} is-active{{ end }}" href="{{ .href }}">{{ partial "lib/nav-icon.html" .icon }}<span>{{ .label }}</span></a>
        {{- end }}
      </div></div>
    </div>
    {{- else }}
    <a class="lib-navbar-item{{ if and .key (eq $a .key) }} is-active{{ end }}" href="{{ .href }}">{{ partial "lib/nav-icon.html" .icon }}<span>{{ .label }}</span></a>
    {{- end }}
    {{- end }}
  </div>
</nav>
```

- [ ] **Step 2: Append the navbar to rail.html**

The bar must be a child of `.lib-app` (sibling of `.lib-rail`), so render it right after the closing `</aside>` of the rail. In `layouts/partials/lib/rail.html`, add after the `</aside>` line:

```go-html-template
</aside>
{{- partial "lib/navbar.html" (dict "active" .active) -}}
```

(The line to change is the final `</aside>` from Task 1 Step 3 — append the partial call immediately after it, before the partial file ends.)

- [ ] **Step 3: Build and confirm the bar is in the DOM but invisible**

```bash
hugo --minify -d /tmp/hugo-out-after >/dev/null 2>&1 && echo BUILD_OK || echo BUILD_FAIL
grep -c 'lib-navbar' /tmp/hugo-out-after/kt/index.html
```

Expected: `BUILD_OK`, and the grep count ≥ 1 (the bar markup is present). It is `display:none` by default (no CSS yet → renders but unstyled; acceptable at this step).

- [ ] **Step 4: Add the default hidden rule so it doesn't show unstyled**

In `assets/css/lib-app.css`, immediately before the `Mobile — drawer rail` section (the line `.lib-app-backdrop { display: none; }`), add:

```css
/* floating app nav bar — hidden by default; shown in the rail-float band */
.lib-navbar { display: none; }
```

- [ ] **Step 5: Build, then verify in browser the three-column layout is unchanged**

```bash
make dev
```

Open `http://localhost:1313/kt/genesis/` (a chapter page with all three columns) at a wide window (>1200px). Expected: looks exactly as before — no floating bar visible, rail/mid/detail intact. Stop the server (Ctrl-C) when done.

- [ ] **Step 6: Commit**

```bash
git add layouts/partials/lib/navbar.html layouts/partials/lib/rail.html assets/css/lib-app.css
git commit -m "feat(lib): render hidden floating nav bar partial from shared nav data

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: CSS — rail-float band (961–1160px) + the floating bar visuals

**Files:**
- Modify: `assets/css/lib-app.css`

**Interfaces:**
- Consumes: the DOM contract from Task 2.
- Produces: the `rail-float` class applied **by a media query** (not JS) in the 961–1160px band, plus the `.lib-navbar*` visual rules. No `stack` state, no JS dependency, no `--bar-left` var (the bar always spans the whole screen).

- [ ] **Step 1: Add the rail-float media query + bar visuals**

In `assets/css/lib-app.css`, replace the placeholder rule added in Task 2 Step 4:

```css
/* floating app nav bar — hidden by default; shown in the rail-float band */
.lib-navbar { display: none; }
```

with this block (the layout state is gated to the 961–1160px band; the bar's own
visual rules sit outside the query but only show when `.rail-float` is present):

```css
/* ============================================================
   Floating app nav bar — between the 3-column layout (≥1160px) and
   the mobile layout (≤960px), the rail collapses to a bottom bar.
   The 960px mobile block below is the floor and is untouched.
   ============================================================ */
.lib-navbar { display: none; }

/* the bar's look (only rendered when .rail-float adds it to the flow) */
.lib-app .lib-navbar {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 35;
  justify-content: center; align-items: stretch; pointer-events: none;
}
.lib-app .lib-navbar > * { pointer-events: auto; }
.lib-navbar-inner {
  flex: 1; display: flex; align-items: stretch; justify-content: space-around;
  gap: 2px; padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--kt-accent) 24%, #1d1610),
    color-mix(in srgb, var(--kt-accent) 15%, #130f08));
  border-top: 1px solid rgba(255, 255, 255, .1);
  box-shadow: var(--kt-sh-win);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
}

/* items — icon + label (default) */
.lib-app .lib-navbar-item {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; padding: 7px 12px; border-radius: 14px; cursor: pointer;
  color: var(--lib-rail-text); font-size: 11px; font-weight: 600; line-height: 1.1;
  white-space: nowrap; background: none; border: none; font-family: inherit;
  transition: background .15s, color .15s;
}
.lib-navbar-item svg { width: 21px; height: 21px; opacity: .85; }
.lib-navbar-item:hover { background: rgba(255, 255, 255, .07); color: #fff; }
.lib-navbar-item:hover svg { opacity: 1; }
.lib-navbar-item.is-active { background: color-mix(in srgb, var(--kt-accent) 40%, transparent); color: #fff; }
.lib-navbar-item.is-active svg { opacity: 1; }
.lib-navbar-item.is-child { color: var(--lib-rail-text-2); }
.lib-navbar-item.is-child:hover { color: #fff; }

/* parent + inline children that unfold left→right on click */
.lib-navbar-parent { display: flex; align-items: stretch; gap: 2px; }
.lib-navbar-kids {
  display: grid; grid-template-columns: 0fr; min-width: 0; overflow: hidden;
  transition: grid-template-columns .32s cubic-bezier(.3, .8, .25, 1);
}
.lib-navbar-parent.open .lib-navbar-kids { grid-template-columns: 1fr; margin-left: 2px; }
.lib-navbar-kids-track { display: flex; gap: 2px; min-width: 0; }
.lib-navbar-kids .lib-navbar-item {
  opacity: 0; transform: translateX(-8px);
  transition: opacity .2s .04s, transform .28s cubic-bezier(.3, .8, .25, 1);
}
.lib-navbar-parent.open .lib-navbar-kids .lib-navbar-item { opacity: 1; transform: none; }
.lib-navbar-parent.open .lib-navbar-kids .lib-navbar-item:nth-child(2) { transition-delay: .12s, .12s; }

/* THE STATE — applied automatically in the 961–1160px band. Equal grid mins
   so mid + detail share the space cleanly. No JS. */
@media (min-width: 961px) and (max-width: 1160px) {
  .lib-app:not(.no-mid) {
    grid-template-columns: minmax(280px, var(--lib-mid-w)) minmax(280px, 1fr);
  }
  .lib-app:not(.no-mid) .lib-rail { display: none; }
  .lib-app:not(.no-mid) .lib-mid { grid-column: 1; }
  .lib-app:not(.no-mid) .lib-detail { grid-column: 2; }
  .lib-app:not(.no-mid) .lib-navbar { display: flex; }
  /* keep the mid list's last row clear of the floating bar */
  .lib-app:not(.no-mid) .lib-mid-body { padding-bottom: 84px; }
}
```

Note: `:not(.no-mid)` excludes the index/root sections (kt index, nghien-cuu root)
that have no middle column — they keep their existing two-state behavior. Their
floating bar handling is out of scope (Task 5 confirms they don't break).

- [ ] **Step 2: Build, then verify the band by resizing the window**

```bash
make dev
```

Open `http://localhost:1313/kt/genesis/` (a chapter — three real columns). Resize:
- **> 1160px:** three columns, no bar (unchanged).
- **961–1160px:** rail disappears; mid + detail as two columns; the dark floating
  bar spans the full bottom with all 7 items as icon + label; Kinh Thánh is a tab
  (children hidden until Task 4 wires the click).
- **≤ 960px:** existing mobile drawers, no floating bar (unchanged).

Verify in light and dark (OS appearance toggle). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add assets/css/lib-app.css
git commit -m "feat(lib): CSS for floating nav bar in the 961-1160px band

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: JS — Kinh Thánh inline unfold (no layout logic)

The layout states are pure CSS (Task 3). This task adds only the click-to-unfold
behavior for the Kinh Thánh parent tab.

**Files:**
- Modify: `layouts/partials/lib/app-js.html`

**Interfaces:**
- Consumes: `.lib-app`, and `[data-toggle]` / `[data-parent]` / `.lib-navbar-parent` from Task 2.
- Produces: clicking a `[data-toggle]` toggles `.open` on its `[data-parent]`; any document click closes open parents. Does NOT touch the existing `rail-open` / `mid-open` drawer logic and adds no resize/measurement handlers.

- [ ] **Step 1: Add the unfold IIFE**

In `layouts/partials/lib/app-js.html`, inside the existing `<script>`, after the closing `})();` of the current IIFE (line 47) and before `</script>`, add a second IIFE:

```javascript
(function () {
  var app = document.querySelector(".lib-app");
  if (!app) return;

  /* ---- Kinh Thánh parent: unfold children inline on click ---- */
  app.querySelectorAll(".lib-navbar [data-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      btn.closest("[data-parent]").classList.toggle("open");
    });
  });
  document.addEventListener("click", function () {
    app.querySelectorAll(".lib-navbar-parent.open").forEach(function (p) { p.classList.remove("open"); });
  });
})();
```

- [ ] **Step 2: Build**

```bash
hugo --minify -d /tmp/hugo-out-after >/dev/null 2>&1 && echo BUILD_OK || echo BUILD_FAIL
```

Expected: `BUILD_OK`.

- [ ] **Step 3: Verify the Kinh Thánh unfold**

```bash
make dev
```

Open `http://localhost:1313/truong-sabat/` and size the window into the **961–1160px** band (the floating-bar state). Click the **Kinh Thánh** tab. Expected: **Cựu & Tân Ước** then **Tín Lý** slide out left→right with animation, pushing neighbors aside. Click the parent again, or anywhere outside → they fold back. No caret on the parent. Confirm in dark mode too. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add layouts/partials/lib/app-js.html
git commit -m "feat(lib): Kinh Thánh inline unfold for the floating nav bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Cross-section verification + regression sweep

**Files:** none (verification only; fix-forward if a section breaks)

- [ ] **Step 1: Build the whole site clean**

```bash
hugo --minify -d /tmp/hugo-out-after 2>&1 | tail -5
```

Expected: completes with no `ERROR`/template errors; page count printed.

- [ ] **Step 2: Walk every library section at three widths**

```bash
make dev
```

For each URL, check three widths (wide >1160px / mid-band ~1050px / mobile ~800px) and confirm: bar appears only in the 961–1160px band, mid + detail render as two clean columns there, active item is highlighted, no horizontal scrollbar, content not hidden under the bar, and ≤960px is exactly today's mobile behavior.

- `/kt/genesis/` (chapter, 3 columns)
- `/truong-sabat/`
- `/nghien-cuu/`
- `/sach/`
- `/authors/`
- A single article (`/` feed → open any post)
- `/kt/` (index, `.no-mid`) and `/nghien-cuu/` root (`.no-mid`)

For the `.no-mid` sections: the CSS uses `:not(.no-mid)`, so the rail-float band does **not** apply — they keep today's two-state (rail sidebar ≥961px / rail drawer ≤960px) behavior. Confirm no floating bar appears and no broken two-column state in the 961–1160px band there. (Bringing the bar to `.no-mid` sections is out of scope unless it visibly breaks.)

- [ ] **Step 3: Confirm active-state correctness**

On `/truong-sabat/`, the bar's Trường Sa-bát item has `is-active`. On `/tin-ly/`, the Kinh Thánh parent OR the Tín Lý child shows active (per `nav-data` keys). Verify.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(lib): cross-section adjustments for floating nav bar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

If no fixes were needed, skip this commit.

---

## Self-Review

**Spec coverage:**
- Two-state-plus-floor model (3-col / rail-float / mobile) → Task 3 CSS media query `(min-width: 961px) and (max-width: 1160px)`. ✓
- 960px kept as the floor; existing mobile block untouched → Task 3 (the new query starts at 961px; `:not(.no-mid)` only). ✓
- Equal grid mins (280px) within the band → Task 3 Step 1. ✓
- "small screen" / `mid + 50 > detail` rule dropped → not implemented (decision); no JS layout logic. ✓
- Whole-screen bar placement → Task 3 Step 1 (`left:0;right:0`). ✓
- All items inline, no overflow → Task 2 partial renders every item; no "Thêm". ✓
- Icon + label default → Task 3 item CSS (column flex, icon + span). ✓
- Kinh Thánh inline unfold L→R, no caret → Task 2 DOM + Task 3 animation + Task 4 toggle. ✓
- Single source of truth for nav → Task 1 (`nav-data.html` shared by rail + navbar). ✓
- Reuse existing rail icons (no new icon set) → Task 1 `nav-icon.html` copies rail SVGs verbatim. ✓
- Mid-list bottom clearance under the bar → Task 3 Step 1 (inside the media query). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full content. Verification is build + browser (no FE test framework exists in repo — confirmed in `tests/`).

**Type/name consistency:** DOM classes match across tasks — `lib-navbar`, `lib-navbar-inner`, `lib-navbar-item`, `is-parent`, `is-child`, `lib-navbar-parent`, `lib-navbar-kids`, `lib-navbar-kids-track`, `data-toggle`, `data-parent`. No `stack` class, no `--bar-left` var (both removed with the dropped state). nav-data dict keys (`key`/`href`/`label`/`icon`/`children`) used identically in rail + navbar. ✓

**Note carried to execution:** the `.no-mid` sections (kt index, nghien-cuu root) are excluded via `:not(.no-mid)` and keep existing behavior. Flagged in Task 5 Step 2 for a look-and-confirm; expanding the bar to those is out of scope unless it visibly breaks.
