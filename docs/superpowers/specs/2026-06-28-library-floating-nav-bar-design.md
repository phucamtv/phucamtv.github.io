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

## The rule (two states above the mobile floor)

Let `rail = 200px`, `mid ≈ 380px`, `detail` = the detail column's width. The new
behavior lives entirely in the band **above the existing 960px mobile breakpoint**,
which is kept as the floor (review decision, 2026-06-28).

1. **Three columns** — container ≥ ~1160px (`detail ≥ rail + mid`).
   Today's full layout: rail sidebar · mid list · detail. Unchanged.

2. **Nav bar floats (two columns)** — container **961–1160px**
   (`detail < rail + mid`). The rail's nav re-renders as a **floating bottom app
   nav bar**; the mid list and detail remain side-by-side.

3. **Mobile (unchanged)** — container ≤ 960px. The existing
   `@media (max-width: 960px)` layout takes over completely: rail and mid become
   right-side drawers with their FAB triggers. **No floating bar here.**

This is a clean **two-state-plus-fallback** model expressible as pure CSS media
queries — no width measurement, no JS layout logic. State 2 is:

```css
@media (min-width: 961px) and (max-width: 1160px) { /* rail-float */ }
```

with the two-column grid using **equal min-widths** so mid and detail shrink in
lockstep within the band (avoids the asymmetric-min bug from review where the
columns hovered near-equal and never resolved cleanly):

```css
.lib-app.rail-float {
  grid-template-columns: minmax(280px, var(--lib-mid-w)) minmax(280px, 1fr);
}
```

### Dropped: the "small screen" (`mid + 50 > detail`) rule

Earlier iterations added a third state that collapsed the mid list to a drawer
when the rendered `mid + 50 > detail`. With the 960px floor kept, that crossover
(~800px container) falls **below** the floor — the mobile layout already owns that
width — so the rule can never fire and is **removed**. This also removes the need
for JS width measurement / resize handling entirely. (Decision: "Keep 960 as the
floor", 2026-06-28.)

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
two-column band (~961px) . This is an accepted trade-off of "render all, no
overflow." If it proves too cramped in real use, the fallbacks are: shrink to
icon-only below a sub-threshold, or allow the bar to horizontally scroll. Not
building either now — flagging for post-implementation review.

## Files to touch (implementation)

- `assets/css/lib-app.css` — the `.lib-app.rail-float` two-column grid + the
  `.lib-navbar` (+ `-inner`, `-item`, `-parent`, `-kids`) rules, all gated inside
  `@media (min-width: 961px) and (max-width: 1160px)` and scoped under `.lib-app`.
  The existing `@media (max-width: 960px)` block is untouched (the floor).
- `layouts/partials/lib/rail.html` — refactored to render from a shared nav source
  (single source of truth), and to append the bar. New partials:
  `lib/nav-data.html` (the item list), `lib/nav-icon.html` (icons reused from the
  rail), `lib/navbar.html` (the bar). Both `rail.html` and `navbar.html` are already
  included site-wide via `rail.html` + `app-js.html`, so **no per-section
  `baseof.html` edits are needed.**
- `layouts/partials/lib/app-js.html` — add only the Kinh Thánh parent unfold toggle
  + outside-click-to-close. **No width measurement / resize logic** — the layout
  states are pure CSS.

## Out of scope

- No change to the rail's contents or the nav information architecture beyond the
  Kinh Thánh inline-unfold presentation.
- No change to the mid list / detail content or the existing right-drawer mechanics.
- Icon-only / label-only stay as latent CSS modes for future tuning, not wired to a
  user toggle.

## Resolved decisions

1. **Icon + label** is the shipping default. (Icons reused from the existing rail —
   no new icon set needed.)
2. **960px kept as the floor.** Floating bar operates only in 961–1160px; below 960
   the existing mobile layout is unchanged. The `mid + 50 > detail` small-screen
   rule is **dropped** (it would only fire below the floor).
3. Whole-screen bar overlapping the mid list's bottom is accepted; the mid scroll
   area gets bottom padding so nothing hides under it.
