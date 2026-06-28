# Design Principles — "Divine Library" app shell

The library sections (Kinh Thánh, Trường Sa-bát, Nghiên Cứu) share one responsive
app shell: `assets/css/lib-app.css` plus the `partials/lib/*` partials. Read this
before building or restyling any page in those sections, or before adding a new
section meant to feel part of the library.

## The three-column model

- **Col 1 — rail** (`.lib-rail`): global site nav. Dark, with the brand mark (logo + site name) pinned at the **bottom**. First-level nav items are UPPER-CASE; nested sub-items stay sentence case. Identical on every page — but **desktop-only**; below 1161px the bottom navbar replaces it (see Three responsive bands).
- **Col 2 — mid** (`.lib-mid`): the contextual list for the current section (book browser, lesson list, episode list, chapter list). Navigation — never the primary content. It can also host pure-CSS tabs (radios + `.lib-tabbar`/`.lib-tabpanel`) — e.g. the bài viết column tabs author+tags / more-by-author / monthly archive.
- **Col 3 — detail** (`.lib-detail` › `.lib-doc`): the actual content/reader. ALWAYS the meaningful, primary content of the page.

## Three responsive bands

The shell has **three** layouts, not two. Section nav changes form across them:

| Band | Width | Layout | Section nav |
| --- | --- | --- | --- |
| **Desktop** | ≥1161px | 3-column grid: rail \| mid \| detail | the rail (col 1) |
| **iPad** | 961–1160px | 2-column: mid \| detail (rail hidden) | bottom **navbar** (`.lib-navbar`) |
| **Mobile** | ≤960px | detail base + mid drawer (rail hidden) | bottom **navbar** (`.lib-navbar`) |

Grid track widths: `--lib-rail-w` 200px, `--lib-mid-w` 380px; desktop grid is `200px minmax(300px,380px) minmax(460px,1fr)`. The 960/1160 breakpoints are tied to the column min-widths — don't move them without re-checking every band.

The **rail is desktop-only**. In both the iPad and mobile bands it is `display: none` and the bottom navbar takes over section navigation — they are the same component (`partials/lib/navbar.html`, rendered from `nav-data.html`, the single source of truth for both rail and navbar).

## Desktop (≥1161px): the three-column grid

CSS grid, three columns side by side, rail always visible. Articles/feed (`.lib-app--article` / `--feed`) reorder to rail \| detail \| info so the article content is the wide middle column and the list/archive is the narrow right sidebar.

## The bottom navbar (`.lib-navbar`) — iPad + mobile

One markup (`navbar.html`), two behaviours by band:

- **iPad band (961–1160px):** all items sit inline on the bar; **Kinh Thánh unfolds its children left→right inline** on tap (`[data-toggle]`, handled in `app-js.html`). No "⋮", no subrow — there's room for everything.
- **Mobile (≤960px):** the **first 4** nav items (from `nav-data` order) stay on the bar; items 5+ are flagged `is-overflow` and hidden, collapsing into a narrow icon-only **"⋮" More button** (`.lib-navbar-more`). Tapping **Kinh Thánh** or **⋮** swaps the whole bar for a **same-height subrow** (`.lib-navbar-subrow`) of the matching items, fronted by a light, theme-aware **back pill** (`.lib-navbar-back`). The inline children (`.lib-navbar-kids`) are hidden on mobile; the subrow is used instead because a phone row has no spare width to unfold into.

The navbar is `position: fixed; width: 100vw` on mobile — pinned to the **visual** viewport, not `left/right:0`, because some pages have horizontal overflow that would otherwise drag the "⋮" off-screen. Per-band visibility of `.lib-navbar-more` / `.lib-navbar-subrow` is a specificity fight — see Implementation discipline.

## Mobile (≤960px): detail is the base, mid is a right-side drawer

- Detail (col 3) is the full-screen base, always visible.
- **Col 2 (mid)** slides in as an overlay drawer **from the right** (`translateX(100%)` → `0`), opened by the `.lib-dtrigger` FAB (`position: fixed` top-right, panel-right icon). It floats over the content — it never takes a header row. Backdrop dims and closes; `Esc` closes; swipe in from the right edge opens it; swipe right peels it back.
- **Col 1 (rail) is retired on mobile** — the bottom navbar handles section nav, exactly like the iPad band. The old rail-opening triggers (`.lib-rtrigger`, `.lib-mtrigger-solo`) are hidden; the mid FAB opens only the mid drawer.

## Index / landing pages: the "no-mid" pattern

A section's landing page does NOT show col 2 as a separate column. Instead:

- Add `no-mid` to `.lib-app` and skip the col-2 partial in that section's `baseof.html`.
- Render what col 2 would have shown **as the col-3 content** — the list IS the page.
- No col-2 FAB (there's no col 2 to open). On desktop the rail is still col 1; on iPad/mobile section nav is the bottom navbar. The solo rail trigger (`.lib-mtrigger-solo`) still ships in these layouts but is hidden on mobile (the navbar replaced it) — leave it for the desktop/no-band cases, don't wire it to anything new.
- Drop redundant "start" CTAs once the full list is on the page.
- Precedents: Nghiên Cứu root (series grid), Trường Sa-bát quarter (lesson list), Kinh Thánh index (book browser), Tín Lý index (doctrine list), Tủ Sách library + book landings (book cards / chapter index). In Tủ Sách only the chapter reader keeps col 2 (the chapter list); the library, author, and book-landing pages are all no-mid.

Rule of thumb: if a page's col-2 list is the whole point of the page, make it `no-mid` and promote that list into the detail.

## Consistency

- One icon per action, everywhere: panel-right (`.lib-dtrigger`) for "open the mid drawer". Section nav is the rail (desktop) or the bottom navbar (iPad/mobile) — not a per-page trigger. No per-page icon variants.
- Triggers float; they don't consume layout rows.
- The navbar's active section, icons, labels, and ordering all come from `nav-data.html`. Add or reorder sections there once — never hard-code the split or duplicate the list.
- Olive/sage ("Ô-liu") accent, dark rail, paper detail. Theme through the CSS custom properties at the top of `lib-app.css` (there is a dark-mode block too) — don't hard-code colors.
- Body/scripture copy is sized with `calc(<px> * var(--app-fs))` — a fixed reading scale (`--app-fs` defaults to 1).
- Display serif (Newsreader) for titles and scripture; UI sans (Be Vietnam Pro) for chrome.

## Implementation discipline

- **Scope everything** under `.lib-app` / `body.lib-app-body` so app-shell styles never leak to the rest of the site.
- **Reuse, don't duplicate**: content shown in two places gets a shared partial (e.g. `partials/kt/book-list.html` feeds both col 2 and the index detail). Render it once per page so element IDs stay unique.
- **Prefer pure-CSS controls** (e.g. the OT/NT tabs are radio inputs + sibling selectors) over JS when it stays clean.
- **CSS source order is load-bearing**: when a base rule (`display: none`) and a media-query rule (`display: grid`) have equal specificity, the later one wins. Put the base rule BEFORE the media query — otherwise you hide the very thing you meant to reveal.
- **Watch the specificity ties against the base resets.** The shell has broad base rules: `.lib-app button { background: none }` and `.lib-app .lib-navbar-item { display: flex }` (both `0,2,0`). A new control that is a `<button>` or carries `.lib-navbar-item` will lose to these at equal specificity and silently render transparent / wrong-display. Match or beat their specificity — e.g. scope your rule as `.lib-app .lib-navbar-back { … }` or `.lib-app .lib-navbar .lib-navbar-more { … }`. This caused two separate "the element isn't showing" bugs in the navbar work; if a style won't apply and the value is clearly set, suspect a base reset winning on source order, not a typo.

## Verify before claiming done

Responsive claims need evidence in **all three bands**. Screenshot headless at:

- **~1280px** — desktop: three columns, rail visible, no navbar.
- **~1080px** — iPad band: rail hidden, mid + detail, navbar with all items inline (no "⋮").
- **~390px** — mobile: detail base + mid drawer, navbar with 4 items + "⋮". Also open a subrow (tap Kinh Thánh and tap "⋮") and confirm the back pill and items show — in **light and dark** (the back pill is theme-tinted).

Two gotchas learned the hard way: (1) headless `--screenshot --window-size=390` actually renders a **wider** viewport (~500px) and captures the full document width, so a page's horizontal overflow makes the navbar *look* clipped when it isn't — use `Emulation.setDeviceMetricsOverride` (CDP) for a true 390px viewport, or measure element rects rather than trusting the raw screenshot. (2) confirm the **served** CSS actually rebuilt (check the fingerprinted filename / grep the served bundle) before trusting a screenshot — a stale dev-server bundle wasted several iterations.
