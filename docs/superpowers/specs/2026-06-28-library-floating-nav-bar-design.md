# Floating app nav bar for the library shell

**Date:** 2026-06-28
**Status:** Draft (pending review)
**Scope:** Layout + CSS + a small amount of JS, scoped to the `.lib-app` shell. No content edits, no data changes.
**Mockup:** `/tmp/lib-floating-nav-mockup.html` (interactive — width slider, theme switch, item-style toggle).

## Goal

The three-column "divine-library" shell (rail · mid · detail) currently has a single
hard breakpoint at **960px**: above it, three columns; below it, both the rail
(col 1) and the mid list (col 2) become right-side slide-in drawers.

This change introduces a **width-aware intermediate state** so the layout degrades
in two graceful steps instead of one abrupt jump. When the detail column gets too
narrow relative to the side columns, the **rail collapses into a floating app nav
bar** pinned to the bottom of the screen — while the mid list stays visible. Only
when space tightens further does the mid list also collapse.

## The rule (state machine)

Three states, evaluated top to bottom. Let `rail = 200px`, `mid ≈ 380px`,
`detail` = the detail column's width.

1. **Three columns** — when `detail ≥ rail + mid` (≈ container ≥ 1160px).
   Today's full layout: rail sidebar · mid list · detail. Unchanged.

2. **Nav bar floats (two columns)** — when `detail < rail + mid`.
   The rail's nav re-renders as a **floating bottom app nav bar**. The mid list
   and detail remain side-by-side as a two-column layout.

3. **Small screen (stack)** — when, *in the two-column state*, the **rendered**
   `mid + 50 > detail`. The mid list collapses to a right-side drawer; only the
   detail shows full-width. The floating nav bar stays. This replaces the old
   arbitrary 960px cutoff with a principled comparison.

### Why "rendered" widths, and why equal grid mins

State 3 compares the **actual rendered** column widths, not nominal sizes — the
user's request. For the comparison to cross cleanly, the two-column grid uses
**equal min-widths** so mid and detail shrink in lockstep:

```css
.lib-app.rail-float {
  grid-template-columns: minmax(280px, var(--lib-mid-w)) minmax(280px, 1fr);
}
```

With the old asymmetric mins (`mid` floored at 300, `detail` at 360) the columns
hovered near-equal across a wide band and never crossed — the bug caught in review
(screenshot showed `mid 358 / detail 360` still rendering two columns). Equal
280px mins fix it. Verified crossover (rail gone, available width `A` = mid + detail):

| A (px) | mid | detail | state |
|--------|-----|--------|-------|
| 900    | 380 | 520    | two columns |
| **800**| 380 | 420    | → **small screen** (mid+50 = 430 > 420) |
| 760    | 380 | 380    | small screen |
| 660    | 380 | 280    | small screen |

So, by container width: three columns ≥ ~1160px · two columns ~810–1160px ·
small screen < ~810px. (Exact crossover is where `mid + 50 > detail`; ~800px is
already small, the value just above it is still two columns.)

### Lower-bound guard

Below ~660px the two-column grid (280 + 380 mins) would overflow, but state 3
already forces the stack before then, so it never renders. The implementation
must still floor the two-column state defensively — keep the existing
`@media (max-width: 960px)` mobile drawer rules as the hard fallback so nothing
breaks if measurement is unavailable (no-JS, SSR first paint). State 3's JS check
is a progressive enhancement layered **on top of** the existing breakpoint, not a
replacement for it.

## The floating nav bar

### Placement & form

- **Full-width (whole screen):** the bar spans the entire bottom edge — across
  **both** the mid list and the detail columns — anchored to `bottom: 0`.
  (Chosen over the detail-only and centered-pill variants.)
- App-level element (direct child of `.lib-app`), `position: absolute`, so it can
  span both columns independently of the grid. Uses the rail's dark gradient,
  `--kt-sh-win` shadow, and a hairline top border — consistent with the existing
  `.lib-dtrigger` / `.lib-rtrigger` FAB treatment.
- Because it overlays the bottom of the mid list, the mid scroll area needs
  bottom padding so its last row never hides under the bar.

### Items

- **Renders every nav item inline. No overflow / no "Thêm" / nothing hidden.**
- **Default style: icon + label** (icon above a short Vietnamese label).
  - Note: the current rail has **no icons**. This commits us to a small icon set —
    7 top-level + 2 sub-items (9 glyphs). The mockup uses stand-in line icons;
    final icons are a deliverable. They should match the rail's line-weight feel.
- Top-level items mirror the rail:
  **Kinh Thánh · Trường Sa-bát · Nghiên Cứu · Thánh Ca · Tủ Sách · Tác Giả · Khám Phá**
- Active item carries the rail's `.is-active` accent treatment.

### Kinh Thánh sub-items (inline unfold)

"Kinh Thánh" is a parent. Its children — **Cựu & Tân Ước** (= the `/kt/` landing)
and **Tín Lý** (`/tin-ly/`) — are **not** shown as standalone tabs and **not** in a
popover. Instead:

- Clicking the **Kinh Thánh** tab **unfolds its children inline, sliding out
  left→right** with animation; neighboring tabs slide aside.
- Mechanism: a children track whose width animates `grid-template-columns: 0fr → 1fr`
  (`.32s` ease), children fade/slide in staggered.
- No caret/arrow indicator on the parent tab (explicitly removed in review).
- Clicking the parent again, or anywhere outside, folds it back.
- Children read slightly lighter than top-level tabs, so the hierarchy is legible
  without bracket chrome.

## Density caveat (honest)

With all 7 top-level items always visible in **icon + label** mode — and 9 when
Kinh Thánh is unfolded — the whole-screen bar gets tight at the narrow end of the
two-column band (~830px) and on small screens. This is an accepted trade-off of
"render all, no overflow." If it proves too cramped in real use, the fallbacks are:
shrink to icon-only below a sub-threshold, or allow the bar to horizontally scroll.
Not building either now — flagging for post-implementation review.

## Files to touch (implementation)

- `assets/css/lib-app.css` — the `.lib-app.rail-float` two-column grid, the
  `.lib-navbar` (+ `-inner`, `-item`, `-parent`, `-kids`) rules, scoped under
  `.lib-app`. Keep the existing `@media (max-width: 960px)` block as the fallback.
- `layouts/partials/lib/rail.html` — the nav source. The bar should be generated
  from the **same** nav data as the rail (single source of truth), not duplicated.
  Likely a new partial `layouts/partials/lib/navbar.html` rendered alongside the
  rail in each section's `baseof.html`, both fed by a shared nav list.
- `layouts/partials/lib/app-js.html` — add: (a) the rendered-width measurement that
  toggles the `stack` class when `mid + 50 > detail`, run on load + resize;
  (b) the Kinh Thánh parent unfold toggle + outside-click-to-close.
- Section `baseof.html` files (`kt`, `truong-sabat`, `nghien-cuu`, `sach`) — include
  the navbar partial. (It is hidden by CSS in the three-column state, so it's inert
  there.)

## Out of scope

- No change to the rail's contents or the nav information architecture beyond the
  Kinh Thánh inline-unfold presentation.
- No change to the mid list / detail content or the existing right-drawer mechanics.
- Icon-only / label-only stay as latent CSS modes for future tuning, not wired to a
  user toggle.

## Open items for review

1. Confirm **icon + label** as the shipping default (vs. label-only, which needs no
   new icons).
2. Confirm the **50px** margin in the small-screen rule (`mid + 50 > detail`).
3. Confirm whole-screen bar overlapping the mid list's bottom is acceptable (vs.
   reserving fixed space).
