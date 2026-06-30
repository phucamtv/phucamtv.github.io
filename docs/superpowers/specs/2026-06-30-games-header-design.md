# Game Header — design spec

Date: 2026-06-30
Status: Approved (mockup-validated)
Mockup: `/tmp/game-header-mockup.html` (interactive; cycle + minimal selected)

## Goal

Give each game-detail page a **header** that mirrors the existing `bank-info`
footer: a solid bar pinned to the **top** edge of the detail column, carrying the
game's identity and its primary controls. Today the top of a game is a bare
`#difficulty` row (three Easy/Normal/Hard pill buttons); this replaces that loose
row with a proper header.

## Decisions (locked from mockup review)

- **Placement — sticky bar, mirrors the footer.** A sibling of `.lib-detail-scroll`
  rendered in a new `header` block of `games/baseof.html`, sitting at the column's
  top edge so it never scrolls. It is the visual twin of `.games-bankinfo`: same
  `--surface-soft` bg, `--border-default` hairline, and `--shadow-soft`, just
  mirrored (border-bottom + downward shadow). Horizontal padding aligns with the
  `.games` content column (44px desktop / 20px mobile).
- **Variant — Minimal.** The header carries only: game **icon + name**, the
  **level control**, and **restart + sound** actions. No subtitle, and **no live
  score in the header** — score/streak/progress stay in each game's own body where
  they already live. (This keeps scope small: no new score-reporting API.)
- **Level control — Cycle button.** One button showing the current level
  (`◆ Normal`); clicking advances Easy → Normal → Hard → Easy. A small diamond is
  color-coded by difficulty (easy green / normal sand / hard terra). ~96px wide vs.
  ~180px for the old three-pill row. Replaces `createDifficultySelector`'s three
  buttons; the existing `aria-pressed`/active styling no longer applies.
- **Icon — per-game glyph kept.** A single character/emoji per game, shown in a
  dark `--surface-inverse` chip. Sourced from a new optional front-matter field.
- **No hint label** beside the cycle button.

## Components

### 1. Header markup (`layouts/games/baseof.html` + `single.html`)

A new `{{ define "header" }}` block, rendered by `baseof.html` as the first child
of `<main class="lib-detail">`, above `.lib-detail-scroll` — exactly mirroring how
the `bankinfo` block is rendered after the scroll area.

```
<header class="games-header" aria-label="Game header">
  <span class="gh-icon">{{ icon }}</span>
  <h2 class="gh-name">{{ .Title }}</h2>
  <button class="gh-cycle" data-level="normal" aria-label="Đổi độ khó">…</button>
  <div class="gh-actions">
    <button class="gh-restart" …>↻</button>
    <button class="gh-sound" …>♪</button>
  </div>
</header>
```

- **Name** = `.Title` (e.g. "Books of the Bible Builder").
- **Icon** = new optional front-matter field `icon` on each `content/games/*.md`.
  Falls back to a neutral default (e.g. `♦`) when absent.
- The bare `<div id="difficulty">` in `single.html`'s `main` block is **removed**;
  the cycle button replaces it.

### 2. Cycle level control (replaces `shared/difficulty.js`)

`shared/difficulty.js` currently renders three buttons and calls
`onChange('normal')` once on load. Rewrite `createDifficultySelector(container, onChange)`
to render the single cycle button instead:

- Renders one `<button class="gh-cycle" data-level="…">` with a `.dot` + label.
- Click advances through `['easy','normal','hard']`, updates `data-level` + label,
  calls `onChange(level)`.
- Still calls `onChange('normal')` immediately on mount (boots the game at Normal,
  unchanged contract). `single.html`'s `run(level)` wiring is untouched.
- The container moves from the old `#difficulty` div in `single.html` to the new
  header (mounted by `baseof.html`); `single.html` queries it by id from the header.

Keep the same exported function name and `(container, onChange)` signature so
`single.html`'s import and `cleanup` contract don't change.

### 3. Restart action

No shared restart exists today. `single.html` already has `run(level)` which
reboots via `init()`. Add a `gh-restart` button that calls `run(currentLevel)`.
`single.html` owns `run` and the current level, so the button is wired there
(the header markup ships the button; `single.html` attaches the handler).

### 4. Sound toggle

`shared/sound.js` already exposes `isMuted()` / `setMuted()` (persisted to
`bq:muted`); games call `playSound()` which already respects mute. The header adds
the **UI** that was missing:

- On mount, the `gh-sound` button reflects `isMuted()` (muted = slashed-speaker
  icon + `.is-off`).
- Click flips `setMuted(!isMuted())` and swaps the icon.
- This is the single source of truth for mute across all games; no per-game change.

Wire this in `single.html`'s module script (it already imports game modules; add a
small import from `shared/sound.js`).

## Styling (`assets/css/games.css`)

Add a `.games-header` block scoped under `.lib-app`, parallel to the existing
`.games-bankinfo` block:

- Layout: `display:flex; align-items:center; gap`, icon+name left, cycle next,
  `.gh-actions` pushed right with `margin-left:auto`.
- Surfaces/borders/shadows: reuse the footer's token recipe, mirrored to the top.
- Reuse token names already in `games.css` (`--surface-soft`, `--surface-inverse`,
  `--text-strong`, `--accent`, `--border-default`, `--shadow-soft`). No hard-coded
  colors — must work in light + dark (verified in mockup).
- `.gh-cycle .dot` difficulty colors: easy `#7faa5a`-ish, normal `--accent-strong`,
  hard `--link`. (Confirm exact greens against tokens during build; prefer a token
  if one fits.)
- Icon/action buttons: 34px square, `--surface-raised` bg, `--border-default`,
  hover → `--surface-soft` + `--accent` border.
- Mobile (≤960px): reduce horizontal padding to 20px (match footer). The header is
  at the **top** of the detail column; no navbar overlap concern (the navbar is
  bottom-fixed) — so no `padding-bottom` reservation like the footer needs.

## Shell wiring (`layouts/games/baseof.html`)

`baseof.html` renders the new `header` block at the top of `<main class="lib-detail">`,
before `.lib-detail-scroll`, only on non-index pages (same condition as the existing
`bankinfo` block / `lib-detail--has-bankinfo`). The `.lib-detail` flex column already
makes `.lib-detail-scroll` flex:1, so a header (flex:0 0 auto) at the top and the
footer at the bottom both pin to their edges automatically — no extra CSS for the
pinning itself.

## Out of scope

- Live score/streak/progress in the header (Minimal variant excludes it).
- Any score-reporting API from games to the header.
- Subtitle / summary text in the header.
- The hub/list page (`/games/`) — header is per-game-detail only.
- Changing the footer.

## Verification

- Build the site; load a game page (e.g. `/games/books-builder/`).
- Header pinned at top, footer at bottom, game scrolls between — desktop + mobile.
- Cycle button advances E→N→H→E, reboots the game at each level, diamond recolors.
- Sound toggle persists across reload and across different game pages (`bq:muted`).
- Restart reboots the current round at the current level.
- Light + dark + system themes all read correctly (screenshot evidence per the
  design-principles "verify before claiming done" rule).
- Icon renders from front-matter; a game without an `icon` field falls back cleanly.
```
