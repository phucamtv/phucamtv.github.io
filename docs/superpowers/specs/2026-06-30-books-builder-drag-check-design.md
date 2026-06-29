# Books Builder — drag-and-drop reorder + check-all-positions

**Date:** 2026-06-30
**Status:** Approved (design)
**Files:** `static/games/js/games/books-builder.js`, `assets/css/games.css`

## Problem

The current Books Builder is a **click-in-order** game: you click books one at a time, and a wrong
click breaks the streak (`scoreSequence` stops at the first mismatch). The score is just "how many
you got right before the first mistake."

Two requested changes redefine the interaction:

1. **Drag and drop** to place/reorder books into positions.
2. **Score all positions** — count every slot that is in the correct place, not stop-at-first-mistake.

## Design

### Layout — pool → numbered slots

Two columns inside the existing `.lib-app .games` shell:

- **Left — Pool:** all books for the chosen difficulty, shuffled, as draggable chips.
- **Right — Slots:** N numbered drop zones (`1 … N`), one per book, labelled "Correct order".

A header row holds the title + a live **Best** score. Below the board: a **Check order** button
(inverse-surface style, like the active difficulty / play buttons), a **Reset** button, and an inline
result line.

### Interaction

- Each book is a **draggable chip** (grip glyph + name).
- Drag a chip onto a slot to place it. Dropping onto an **occupied** slot sends the existing chip back
  to the pool, then places the dragged chip.
- Drag a chip back to the **pool** to empty its slot.
- Placing/moving a chip **clears prior check marks** and hides the finish banner (the board is "dirty"
  again until re-checked).
- HTML5 drag-and-drop API (`draggable`, `dragstart`/`dragover`/`drop`). Pointer/touch fallback is
  **out of scope** for this change (noted under Non-goals).

### Check behaviour — score all, mark each slot

On **Check order**:

- For each slot *i* (1-based), compare the chip's `order` to the slot's correct order.
- **Correct** → slot gets `correct` state: green check `✓`, green border/number.
- **Wrong or empty** → slot gets `wrong` state: red cross `✕`, red border/number, shake once, and an
  inline **"should be {Book}"** hint.
- **Empty slots count as wrong.** Check is **always enabled** (no requirement to fill all slots first).
- **Score = number of slots in the correct position.** Shown as `Score: X/N in correct position`.
- **Unlimited re-checks.** `best` = max score achieved across checks this session; persisted via the
  shared `saveScore` / `getHighScore`.
- When `score === N`: show the **finish banner** (seal + "Perfect order!") and call `signalFinished`.

### Difficulty

Unchanged contract: `pickBooks(books, difficulty)` still returns the correct, ordered subset
(easy = OT, normal = NT, hard = all). N = subset length; slots and pool are built from it.

### Theming / styles

- New CSS lives in `assets/css/games.css` under the `.lib-app .games` scope, using site tokens.
- Reuses existing conventions: inverse-surface Check button, Newsreader headings, `.pp-finish`-style
  banner, `games-shake`-style shake.
- **New tokens** `--ok` (green) / `--bad` (reuse link orange) are introduced **locally in games.css**
  for unambiguous right/wrong per-slot feedback, with light + dark values. This is the one intentional
  departure from the gold-only "correct" signal used elsewhere, justified because per-slot correctness
  is this game's entire point. (Approved in mockup review.)

## Function contracts

- `pickBooks(books, difficulty)` — **unchanged.**
- `scoreSequence(correctOrder, chosen)` — **removed** (stop-at-first-mistake no longer used).
- **New** `scorePlacement(correctOrder, placed)` → integer count of positions where
  `placed[i]?.order === correctOrder[i].order`. `placed[i]` may be `null`/`undefined` (empty slot →
  not counted). Pure, unit-testable.
- `init(container, difficulty)` — rebuilt around the pool/slots DOM, returns a `cleanup()` that removes
  listeners and clears the container (same shape as today).

## Testing / verification

- **Unit:** `scorePlacement` — all correct → N; all wrong → 0; mixed → exact count; empty slots → not
  counted; full vs partial fills.
- **Manual (mockup parity):** drag a chip into a slot; swap into an occupied slot; drag back to pool;
  Check marks every slot green/red with hints; partial score; perfect score shows banner; Best updates
  and persists; light/dark/system render correctly; Reset reshuffles.

## Non-goals

- Touch/pointer drag fallback (HTML5 DnD only this pass).
- Animated chip fly-in or connector ribbons.
- Changing `pickBooks` difficulty semantics or the books data file.
- Keyboard-driven reordering (accessibility follow-up, not in this change).
