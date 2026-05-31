# Design Principles — "Divine Library" app shell

The library sections (Kinh Thánh, Trường Sa-bát, Nghiên Cứu) share one responsive
app shell: `assets/css/lib-app.css` plus the `partials/lib/*` partials. Read this
before building or restyling any page in those sections, or before adding a new
section meant to feel part of the library.

## The three-column model

- **Col 1 — rail** (`.lib-rail`): global site nav. Dark, with the brand mark (logo + site name) pinned at the **bottom**. First-level nav items are UPPER-CASE; nested sub-items stay sentence case. Identical on every page.
- **Col 2 — mid** (`.lib-mid`): the contextual list for the current section (book browser, lesson list, episode list). Navigation — never the primary content.
- **Col 3 — detail** (`.lib-detail` › `.lib-doc`): the actual content/reader. ALWAYS the meaningful, primary content of the page.

Desktop (>960px): CSS grid, three columns side by side. The 960px breakpoint equals the sum of the column min-widths — don't lower it without re-checking the grid.

## Mobile (≤960px): detail is the base, the others are right-side drawers

- Detail (col 3) is the full-screen base, always visible.
- Col 2 and col 1 slide in as overlay drawers **from the right** (`translateX(100%)` → `0`). Everything opens from the right so it lines up with the trigger.
- A **floating action button** (`.lib-dtrigger`, `position: fixed` top-right, panel-right icon) opens col 2. It floats over the content — it never takes a header row.
- A matching panel FAB at col 2's top-right (`.lib-rtrigger`, same look as col 3's) opens col 1 (the rail). It lives inside the transformed `.lib-mid`, so it pins to the drawer and slides in with it; the rail still layers over it.
- Backdrop dims and closes; `Esc` closes; swipe in from the right edge opens col 2; swipe right peels back the top drawer.

## Index / landing pages: the "no-mid" pattern

A section's landing page does NOT show col 2 as a separate column. Instead:

- Add `no-mid` to `.lib-app` and skip the col-2 partial in that section's `baseof.html`.
- Render what col 2 would have shown **as the col-3 content** — the list IS the page.
- Use the solo rail trigger (`.lib-mtrigger-solo`, the brand mark) to reach col 1; no col-2 FAB (there's no col 2 to open).
- Drop redundant "start" CTAs once the full list is on the page.
- Precedents: Nghiên Cứu root (series grid), Trường Sa-bát quarter (lesson list), Kinh Thánh index (book browser).

Rule of thumb: if a page's col-2 list is the whole point of the page, make it `no-mid` and promote that list into the detail.

## Consistency

- One icon per action, everywhere: panel-right for "open col 2", brand mark for "open the rail". No per-page icon variants.
- Triggers float; they don't consume layout rows.
- Olive/sage ("Ô-liu") accent, dark rail, paper detail. Theme through the CSS custom properties at the top of `lib-app.css` (there is a dark-mode block too) — don't hard-code colors.
- Body/scripture copy is sized with `calc(<px> * var(--app-fs))` — a fixed reading scale (`--app-fs` defaults to 1).
- Display serif (Newsreader) for titles and scripture; UI sans (Be Vietnam Pro) for chrome.

## Implementation discipline

- **Scope everything** under `.lib-app` / `body.lib-app-body` so app-shell styles never leak to the rest of the site.
- **Reuse, don't duplicate**: content shown in two places gets a shared partial (e.g. `partials/kt/book-list.html` feeds both col 2 and the index detail). Render it once per page so element IDs stay unique.
- **Prefer pure-CSS controls** (e.g. the OT/NT tabs are radio inputs + sibling selectors) over JS when it stays clean.
- **CSS source order is load-bearing**: when a base rule (`display: none`) and a media-query rule (`display: grid`) have equal specificity, the later one wins. Put the base rule BEFORE the media query — otherwise you hide the very thing you meant to reveal.

## Verify before claiming done

Responsive claims need evidence at BOTH widths. Screenshot headless at ~1280px (desktop, three columns) and ~900px (mobile, drawers) and confirm before saying it works.
