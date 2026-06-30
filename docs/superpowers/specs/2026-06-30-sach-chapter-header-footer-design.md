# Sách Chapter Header/Footer — design spec

Date: 2026-06-30
Status: Approved (mockup-validated)
Mockup: `/tmp/sach-header-footer-mockup.html` (interactive; theme-switchable)

## Goal

Bring the game-detail page's **pinned header + footer** concept to the **book
chapter reader** (e.g. `/sach/egw/khat-vong-muon-doi/chuong-01/`). Today a chapter
renders only `partial "sach/reader.html"` inside `.lib-detail-scroll` — there is no
pinned top bar and no pinned bottom bar; the prev/next pager lives at the bottom of
the scrolling content. This adds two bars that pin to the detail column's edges,
visual twins of `.games-header` / `.games-bankinfo`.

## Decisions (locked from mockup review)

- **Header — book name.** A bar pinned to the **top** edge of the detail column
  carrying the **book icon + book title** (`$book.Title`, serif), with a small
  mục-lục (table-of-contents) action button on the right. Visual twin of
  `.games-header`: `--surface-soft` bg, `--border-default` bottom hairline,
  downward `--shadow-soft`. Padding aligns with the reader column (44px / 20px).
- **Footer — chapter name + pager + progress line.** A bar pinned to the **bottom**
  edge carrying:
  - **Left:** a small `CHƯƠNG N` eyebrow label + the **chapter name** (`.Title`
    with the `^Chương N: ` prefix stripped, serif), matching the reader title.
  - **Right:** the **prev/next chapter pager**, moved out of the scrolling content
    into the footer. Pill buttons matching the header action style; "Trước" is
    disabled when there is no previous chapter, "Sau" disabled at the last chapter.
    Labels collapse to icon-only under 600px.
  - **Top edge:** a **reading-progress line** — a 2px `--kt-accent` overlay sitting
    on the footer's top hairline that grows left→right with scroll position.
  Visual twin of `.games-bankinfo`: `--surface-soft` bg, `--border-default` top
  hairline, upward `--shadow-soft`.
- **Progress is client-side presentation.** The line width is driven by a small
  scroll listener on `.lib-detail-scroll`; no build-time data. Knowingly a runtime
  element (we'd earlier scoped out *computed stats* like reading-time/word-count —
  those stay out; this is pure scroll-position presentation, which is in).
- **In-content pager removed.** The big `nc-prev-next` cards at the bottom of the
  chapter body are removed from the reader; navigation lives only in the footer.

## Components

### 1. Shell wiring (`layouts/sach/baseof.html`)

`sach/baseof.html` currently renders only `{{ block "main" . }}` inside
`<main class="lib-detail"><div class="lib-detail-scroll">…</div></main>`. Restructure
to mirror `games/baseof.html` — render a `header` block and a `footer` block as
siblings of `.lib-detail-scroll`, **only on chapter pages** (`$isChapter`, i.e.
`.Kind == "page"`):

```
<main class="lib-detail{{ if $isChapter }} lib-detail--has-bankinfo{{ end }}">
  {{- if $isChapter }}{{- block "header" . }}{{- end }}{{- end }}
  <div class="lib-detail-scroll">
    {{- block "main" . }}{{- end }}
  </div>
  {{- if $isChapter }}{{- block "footer" . }}{{- end }}{{- end }}
</main>
```

`.lib-detail` is already a flex column with `.lib-detail-scroll: flex 1`, so a
header (`flex:0 0 auto`) at the top and a footer at the bottom both pin to their
edges automatically — no extra CSS for the pinning itself. The
`lib-detail--has-bankinfo` class reserves bottom space for the mobile navbar, same
as games.

The two chapter layouts (`sach/chapter.html`, `sach/lde-chapter.html`) each define
the `header` and `footer` blocks. Both already share `partial "sach/reader.html"`
for `main`; they will likewise share header/footer partials to avoid duplication.

### 2. Header partial (`layouts/partials/sach/chapter-header.html`)

New partial rendered by each chapter layout's `header` block. Receives the chapter
page context; derives the book from `.Parent`.

```
<header class="sach-header" aria-label="Đầu trang sách">
  <span class="sh-icon" aria-hidden="true"><svg book-icon/></span>
  <h2 class="sh-book">{{ $book.Title }}</h2>
  <div class="sh-actions">
    <button class="lib-dtrigger sh-btn" aria-label="Mở mục lục"><svg list/></button>
  </div>
</header>
```

- **Book title** = `.Parent.Title`.
- **Icon** = the same book glyph used in the reader eyebrow (the four-bars "books"
  SVG), in a dark `--surface-inverse` chip.
- **mục-lục button** reuses the existing `lib-dtrigger` behavior (the reader partial
  already ships a `.lib-dtrigger` that toggles the chapter-list column). Moving the
  trigger into the header means the one currently inside `.lib-doc` is **removed**
  from `reader.html` (it becomes redundant). Verify the `lib-dtrigger` JS selector
  still binds when the button lives in the header.

### 3. Footer partial (`layouts/partials/sach/chapter-footer.html`)

New partial rendered by each chapter layout's `footer` block. Computes prev/next via
the same `$book.Pages.ByWeight` walk the reader partial does today.

```
<footer class="sach-footer" aria-label="Cuối trang sách">
  <span class="sf-progress" aria-hidden="true"></span>
  <span class="sf-label">Chương {{ .Params.chapter }}</span>
  <span class="sf-chapter">{{ $title }}</span>
  <nav class="sf-pager" aria-label="Điều hướng chương">
    <a href="{{ $prev.RelPermalink }}" {{ if not $prev }}class="is-disabled" aria-disabled="true"{{ end }}>
      <svg chevron-left/><span class="lbl">Trước</span>
    </a>
    <a href="{{ $next.RelPermalink }}" {{ if not $next }}class="is-disabled" aria-disabled="true"{{ end }}>
      <span class="lbl">Sau</span><svg chevron-right/>
    </a>
  </nav>
</footer>
```

- **Chapter label/name** = `Chương {{ .Params.chapter }}` + `$title` (`.Title` with
  `^Chương [0-9]+: ` stripped — same regex the reader already uses).
- **Prev/next** = the `ByWeight` neighbor walk currently in `reader.html`. This logic
  **moves** from `reader.html` to the footer partial; the `nc-prev-next` `<nav>` is
  removed from `reader.html`.
- A disabled side (no prev at chapter 1 / no next at last chapter) renders as a
  non-interactive pill (`is-disabled`, `aria-disabled`, no href / `pointer-events:none`).

### 4. Reading-progress line (small JS)

A tiny script (add to `lib/app-js.html` or a small scoped module) that, on chapter
pages, listens to `.lib-detail-scroll` scroll and sets the `.sf-progress` width:

```
const sc = document.querySelector('.lib-detail-scroll');
const prog = document.querySelector('.sach-footer .sf-progress');
if (sc && prog) {
  const update = () => {
    const max = sc.scrollHeight - sc.clientHeight;
    prog.style.width = (max > 0 ? (sc.scrollTop / max) * 100 : 0) + '%';
  };
  sc.addEventListener('scroll', update, { passive: true });
  update();
}
```

Pure presentation; no persistence, no build data. Guards (`if sc && prog`) keep it
inert on non-chapter pages where the bars don't exist.

## Styling (`assets/css/lib-app.css` or a scoped block)

Add `.sach-header` / `.sach-footer` rules scoped under `.lib-app`, parallel to the
`.games-header` / `.games-bankinfo` recipe in `games.css`. Reuse the same token
recipe — no hard-coded colors; must work in light + dark + system (verified in
mockup):

- **Header:** flex row, icon+name left, `.sh-actions` pushed right (`margin-left:auto`).
  `--surface-soft` bg, `border-bottom: 1px var(--border-default)`, `box-shadow: 0 2px
  12px var(--shadow-soft)`. `.sh-icon` 34px dark `--surface-inverse` chip. `.sh-book`
  serif (`var(--kt-display)`), `--text-strong`, ellipsis. `.sh-btn` 34px square,
  `--surface-raised` bg, hover → `--surface-soft` + `--accent` border.
- **Footer:** flex row, `--surface-soft` bg, `border-top: 1px var(--border-default)`,
  `box-shadow: 0 -2px 12px var(--shadow-soft)`. `.sf-label` uppercase tracked eyebrow
  (`--text-faint`). `.sf-chapter` serif `--text-strong`, ellipsis. `.sf-pager` pushed
  right; pill `<a>` matching `.sh-btn` surfaces; `.is-disabled` → opacity .4 +
  `pointer-events:none`. `.lbl` hidden under 600px.
- **Progress line:** `.sf-progress` absolutely positioned `top:-1px; left:0; height:2px;
  width:0`, `background: var(--kt-accent)`, `transition: width .12s linear`. Sits on
  the footer's top hairline so 0% reads as a normal border.
- **Mobile (≤960px):** header/footer horizontal padding → 20px (match `.lib-doc`).
  Reserve mobile-navbar height via `lib-detail--has-bankinfo` (already an existing
  rule in `games.css`; either share it or add the sach equivalent).

## Out of scope

- Computed reading stats (reading-time, word-count, % text) — only the visual
  progress line is in; no numbers.
- Font-size / bookmark / theme controls in the header (only mục-lục for now).
- Persisting scroll position or "continue reading."
- Non-chapter sach pages (library / author / book-landing) — bars are chapter-only,
  same as games' header is detail-only.
- Bible (`/kt`) and other library sections — this spec is `/sach` chapters only.
- Changing the reader typography / content fix-ups in `reader.html` (only the
  `.lib-dtrigger` and `nc-prev-next` blocks move out of it).

## Verification

- Build the site; load `/sach/egw/khat-vong-muon-doi/chuong-01/`.
- Header pinned at top (book name), footer pinned at bottom (chapter name + pager),
  content scrolls between — desktop + mobile.
- Progress line on the footer's top edge grows 0→100% as you scroll the chapter.
- Pager: "Trước" disabled on chapter 1; "Sau" navigates to the next chapter; "Sau"
  disabled on the last chapter. In-content `nc-prev-next` cards are gone.
- mục-lục button in the header opens/closes the chapter-list column.
- Light + dark + system themes all read correctly (screenshot evidence per the
  design-principles "verify before claiming done" rule).
- Both layouts work: a normal book chapter (`chapter.html`) and an LDE chapter
  (`lde-chapter.html`).
