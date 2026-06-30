# Books Builder — Drag & Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/games/books-builder/` from a click-in-order game into a drag-and-drop board where you place shuffled books into numbered slots, then "Check order" scores every position (green ✓ / red ✕ with a "should be {Book}" hint).

**Architecture:** A two-column board inside the existing `.lib-app .games` shell — a shuffled **pool** of draggable book chips (left) and N numbered **drop-slots** (right). HTML5 drag-and-drop (`draggable` + `dragstart`/`dragover`/`drop`) moves chips between pool and slots. A pure `scorePlacement(correctOrder, placed)` counts slots in the correct position; the live Best score is surfaced through the page shell's footer (`setBest`/`setDrawn` from `shared/bankinfo.js`), not in the board itself.

**Tech Stack:** Vanilla ES modules (no build step, no framework), Hugo (`hugo server` for manual verification), CSS custom properties in `assets/css/games.css`. **No JS test runner exists in this repo and we are deliberately not adding one** — verification is manual in the browser, plus a one-off `node -e` check for the pure function.

## Global Constraints

- **No test runner / no test files.** Repo is vanilla ES modules with zero test infrastructure. Do NOT add a `package.json`, a test file, or a test dependency. Verify the pure function with a throwaway `node -e` snippet (not committed); verify everything else by hand in the browser. (User decision — see handover.)
- **`init()` must NOT render a title/`<h2>`.** The page shell (`layouts/games/single.html`) already renders the game name (`gh-name`), difficulty cycle, restart, and sound buttons in its header. A board-level title duplicates the shell.
- **Best score lives in the footer, not the board.** Use `setBest(getHighScore('books-builder'))` on boot and `setBest(best)` after each check. The shell footer (`data-gb-best`) renders a bare integer — save/show the integer score, NOT `X/N`. (User decision: "Footer only".) The inline result line below the board still shows `Score: X/N in correct position`.
- **`init(container, difficulty)` returns a `cleanup()`** that removes listeners and clears the container — same contract as today. Difficulty switching reboots via the shell's `run()`.
- **`window.GAME_DATA`** is injected by the shell; module top keeps `const booksData = window.GAME_DATA;`.
- **`pickBooks(books, difficulty)` is unchanged** (easy = OT, normal = NT, hard = all; sorted by `order`).
- **Colors:** introduce `--ok` (green) and `--bad` (orange) tokens **locally in `assets/css/games.css`**, with light + dark values, scoped so they don't leak. This is the one approved palette departure.
- **CSS scope:** all new rules live under the `.lib-app .games` scope in `assets/css/games.css`, using site tokens. Class prefix is `bb-` (matches the approved mockup).
- **Out of scope:** touch/pointer drag fallback, keyboard reordering, chip fly-in animation, connector ribbons. HTML5 DnD only.
- **Authoritative target look/behavior:** the approved mockup `/tmp/books-builder-mockup.html`. If `/tmp` was cleared, the spec `docs/superpowers/specs/2026-06-30-books-builder-drag-check-design.md` is authoritative.

---

## File Structure

- `static/games/js/games/books-builder.js` — **rewrite.** Holds `pickBooks` (unchanged), the new pure `scorePlacement`, and a rebuilt `init` that builds the pool/slots DnD DOM, wires drag handlers, runs Check, and reports Best via `bankinfo`. `scoreSequence` is deleted.
- `assets/css/games.css` — **modify.** Add `--ok`/`--bad` tokens (light + dark) and the `.bb-*` board styles; remove the now-dead `.book-tag` / `.book-done` rules.

Two files, one responsibility each. The JS owns behavior; the CSS owns presentation. They change together (a new board needs both), so they're planned together but split into separate tasks per the right-sizing rule (a reviewer could approve the CSS palette while rejecting the JS DnD logic, or vice-versa).

---

## Task 1: Pure scoring function `scorePlacement`

Replace the stop-at-first-mistake `scoreSequence` with the score-every-position `scorePlacement`. This is the one piece with a precise, checkable contract, so it goes first and is verified in isolation before any DOM work.

**Files:**
- Modify: `static/games/js/games/books-builder.js` (remove `scoreSequence` lines 11–18; add `scorePlacement`)

**Interfaces:**
- Consumes: nothing (pure function over plain objects with an `.order` number).
- Produces: `scorePlacement(correctOrder, placed)` → integer. `correctOrder` is the ordered array from `pickBooks` (each item has a numeric `.order`). `placed` is an array the same length as `correctOrder`; `placed[i]` is either a book object (`{ order, name, ... }`) or `null`/`undefined` for an empty slot. Returns the count of indices `i` where `placed[i]?.order === correctOrder[i].order`. Empty slots are never counted. `init` (Task 3) consumes this on Check.

- [ ] **Step 1: Remove `scoreSequence`**

Delete the whole function (current lines 11–18):

```js
export function scoreSequence(correctOrder, chosen) {
  let score = 0;
  for (let i = 0; i < chosen.length; i++) {
    if (chosen[i].order === correctOrder[i].order) score++;
    else break;
  }
  return score;
}
```

- [ ] **Step 2: Add `scorePlacement` in its place**

```js
export function scorePlacement(correctOrder, placed) {
  let score = 0;
  for (let i = 0; i < correctOrder.length; i++) {
    if (placed[i] && placed[i].order === correctOrder[i].order) score++;
  }
  return score;
}
```

- [ ] **Step 3: Verify the contract with a throwaway node check (do NOT commit this)**

The function is a pure export with no DOM or `window` dependency, so it can be exercised directly. Run from the repo root:

```bash
node --input-type=module -e '
import { scorePlacement } from "./static/games/js/games/books-builder.js";
const correct = [{order:1},{order:2},{order:3},{order:4}];
const eq = (a,b,m) => console.log(a===b ? "PASS" : "FAIL "+m, a, "expected", b);
eq(scorePlacement(correct, [{order:1},{order:2},{order:3},{order:4}]), 4, "all correct");
eq(scorePlacement(correct, [{order:4},{order:3},{order:2},{order:1}]), 0, "all wrong");
eq(scorePlacement(correct, [{order:1},{order:3},{order:3},{order:4}]), 3, "mixed");
eq(scorePlacement(correct, [{order:1},null,undefined,{order:4}]), 2, "empty slots not counted");
eq(scorePlacement(correct, [{order:1},{order:2}]), 2, "short placed array");
'
```

Expected: five `PASS` lines.

> **Note:** `books-builder.js` line 3 does `const booksData = window.GAME_DATA;`. Under `node`, `window` is undefined, so `booksData` becomes `undefined` at module load — that's fine because nothing in `scorePlacement` (or this check) touches it. If node ever errors on `window`, change the check to copy the two functions into a scratch file instead; do not alter the module to satisfy node.

- [ ] **Step 4: Commit**

```bash
git add static/games/js/games/books-builder.js
git commit -m "refactor(games): replace scoreSequence with scorePlacement (score every slot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Board styles + `--ok`/`--bad` tokens in games.css

Add the visual layer the rebuilt `init` will target, and retire the dead click-game CSS. Doing CSS before the JS rewrite means that when Task 3 renders the board, the styles are already present and the manual check shows the real look immediately.

The mockup's `.bb-*` rules are written against bare `:root` tokens; here they must be **scoped under `.lib-app .games`** to match this repo's convention (every existing rule in `games.css` is so scoped). Copy the mockup's declarations verbatim, only adding the `.lib-app .games ` prefix.

**Files:**
- Modify: `assets/css/games.css` (add `--ok`/`--bad` tokens; add `.bb-*` block; remove `.book-tag` and `.book-done` rules at lines ~229–244)

**Interfaces:**
- Consumes: nothing.
- Produces: the class contract the JS in Task 3 depends on — `bb-head`, `bb-board`, `bb-col-label`, `bb-pool`, `bb-slots`, `bb-slot`, `bb-slot-num`, `bb-drop` (+ states `empty`/`filled`/`dragover`), `bb-chip` (+ `dragging`), `bb-grip`, `bb-name`, `bb-ph`, `bb-mark`, `bb-hint`, `bb-controls`, `bb-check`, `bb-result`, `bb-finish` (+ `show`), `bb-seal`; slot states `correct`/`wrong`/`shake`. The JS must use exactly these names.

- [ ] **Step 1: Add `--ok` / `--bad` tokens scoped to the games shell**

The repo's tokens live in `assets/css/tokens.css`; per the spec these two are introduced **locally in games.css**. Add a token block near the top of `assets/css/games.css`, immediately after the existing `.lib-app .games { … }` base rule (so the variables are in scope for every `.bb-*` rule that follows). Use the light values on the scope itself and override for both dark mechanisms (explicit `data-theme="dark"` and system dark), matching how the mockup defined them:

```css
/* books-builder: per-slot right/wrong feedback. The only place we depart from
   the gold-only "correct" signal — per-slot correctness is this game's point.
   Light values here; dark overridden for both explicit and system dark below. */
.lib-app .games { --ok: #3f7d4e; --bad: #9c4a1f; }
:root[data-theme="dark"] .lib-app .games { --ok: #7fb98c; --bad: #e8a87c; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .lib-app .games { --ok: #7fb98c; --bad: #e8a87c; }
}
```

- [ ] **Step 2: Remove the dead `.book-tag` and `.book-done` rules**

Delete these (current lines ~228–244), including the `/* books-builder: … */` comment that introduces them — the old click game they styled is gone after Task 3:

```css
/* books-builder: placed-book badges + the drop zone */
.lib-app .games .book-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  margin: 0.2rem;
  background: var(--surface-soft);
  border: 1px solid var(--accent);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--text-strong);
}
.lib-app .games .book-done {
  min-height: 2.5rem;
  border-top: 1px solid var(--border-default);
  padding-top: 0.5rem;
  margin-top: 0.75rem;
}
```

> Leave `.locked`, `.shake`, `.correct`, `.wrong`, `.filled`, `.matched`, `.selected` (lines ~37–49) ALONE — those are shared by other games. The new `.bb-slot.correct` / `.bb-slot.wrong` rules below are more specific and won't collide.

- [ ] **Step 3: Add the `.bb-*` board block**

Append this near the end of the games-specific section (e.g. right after the block you removed in Step 2). Every selector is the mockup's, prefixed with `.lib-app .games `:

```css
/* ===== books-builder: drag & check board ===== */
.lib-app .games .bb-head { display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
.lib-app .games .bb-head p { margin: 0; }

.lib-app .games .bb-board { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.15fr); gap: 1rem 2rem; align-items: start; }
.lib-app .games .bb-col-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.13em; text-transform: uppercase; color: var(--text-faint); margin: 0 0 0.6rem 0.15rem; }

.lib-app .games .bb-pool { display: flex; flex-direction: column; gap: 0.45rem; min-height: 2rem; }
.lib-app .games .bb-pool.dragover { outline: 2px dashed var(--accent-soft); outline-offset: 4px; border-radius: 10px; }

.lib-app .games .bb-chip {
  display: flex; align-items: center; gap: 0.55rem;
  background: var(--surface-raised); color: var(--text-strong);
  border: 1px solid var(--border-default); border-radius: 9px;
  padding: 0.5rem 0.7rem; font-size: 0.95rem; cursor: grab; user-select: none;
  transition: border-color 0.12s, background 0.12s, box-shadow 0.12s, transform 0.08s;
}
.lib-app .games .bb-chip:hover { border-color: var(--accent); background: var(--surface-hover); }
.lib-app .games .bb-chip:active { cursor: grabbing; }
.lib-app .games .bb-chip.dragging { opacity: 0.45; }
.lib-app .games .bb-grip { color: var(--text-faint); font-size: 1rem; line-height: 1; flex: none; }
.lib-app .games .bb-chip .bb-name { flex: 1; }

.lib-app .games .bb-slots { display: flex; flex-direction: column; gap: 0.45rem; }
.lib-app .games .bb-slot { display: flex; align-items: stretch; gap: 0.55rem; min-height: 2.6rem; border-radius: 9px; }
.lib-app .games .bb-slot-num {
  flex: none; width: 30px; display: grid; place-items: center;
  font-size: 0.78rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-faint);
}
.lib-app .games .bb-drop {
  flex: 1; display: flex; align-items: center; gap: 0.55rem;
  border: 1.5px dashed var(--border-strong); border-radius: 9px;
  background: var(--surface-tint); padding: 0.45rem 0.6rem; min-height: 2.6rem;
  transition: border-color 0.12s, background 0.12s;
}
.lib-app .games .bb-drop.empty { color: var(--text-faint); font-size: 0.85rem; }
.lib-app .games .bb-drop.dragover { border-color: var(--accent); background: var(--surface-soft); border-style: solid; }
.lib-app .games .bb-drop.filled { border-style: solid; border-color: var(--border-default); background: var(--surface-raised); }
.lib-app .games .bb-drop .bb-chip { flex: 1; border: none; background: transparent; padding: 0.15rem 0; }
.lib-app .games .bb-drop .bb-chip:hover { background: transparent; }

.lib-app .games .bb-slot.correct .bb-drop { border-color: var(--ok); background: var(--surface-soft); border-style: solid; }
.lib-app .games .bb-slot.correct .bb-slot-num { color: var(--ok); }
.lib-app .games .bb-slot.wrong .bb-drop { border-color: var(--bad); border-style: solid; }
.lib-app .games .bb-slot.wrong .bb-slot-num { color: var(--bad); }
.lib-app .games .bb-mark { flex: none; font-size: 0.95rem; font-weight: 700; width: 1.1rem; text-align: center; }
.lib-app .games .bb-slot.correct .bb-mark { color: var(--ok); }
.lib-app .games .bb-slot.wrong .bb-mark { color: var(--bad); }
.lib-app .games .bb-hint { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.2rem; }

.lib-app .games .bb-controls { display: flex; align-items: center; gap: 0.6rem; margin-top: 1.4rem; flex-wrap: wrap; }
.lib-app .games .bb-check { background: var(--surface-inverse); color: var(--text-on-inverse-strong); border-color: var(--surface-inverse); }
.lib-app .games .bb-check:hover:not(:disabled) { background: var(--surface-inverse-hover); border-color: var(--surface-inverse-hover); }
.lib-app .games .bb-result { font-size: 0.9rem; color: var(--text-secondary); }
.lib-app .games .bb-result b { color: var(--text-emphasis); }

@keyframes bb-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
.lib-app .games .bb-slot.shake { animation: bb-shake 0.3s ease-in-out; }

.lib-app .games .bb-finish { margin-top: 1.6rem; padding: 1.1rem 1.3rem; border-radius: 14px; background: var(--surface-soft); border: 1px solid var(--accent); display: none; align-items: center; gap: 1rem; }
.lib-app .games .bb-finish.show { display: flex; }
.lib-app .games .bb-seal { flex: none; width: 46px; height: 46px; border-radius: 50%; background: var(--surface-inverse); color: var(--text-on-inverse-strong); display: grid; place-items: center; font-family: Newsreader, serif; font-size: 1.3rem; }
.lib-app .games .bb-finish h3 { margin: 0 0 0.15rem; font-family: Newsreader, serif; color: var(--text-strong); font-size: 1.15rem; }
.lib-app .games .bb-finish p { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }

@media (max-width: 620px) {
  .lib-app .games .bb-board { grid-template-columns: 1fr; gap: 1.4rem; }
}
```

> The mockup's `.bb-check` used `!important` to beat the mockup's own generic `.games button` rule. Here the scoped `.lib-app .games .bb-check` is already as specific as `.lib-app .games button:hover`, so `!important` is unnecessary — omit it (kept out above).

- [ ] **Step 4: Verify the CSS compiles / no Hugo build break**

```bash
hugo --quiet 2>&1 | head -20
```

Expected: no error output (Hugo bundles `assets/css/games.css`; a CSS syntax slip surfaces here). A clean exit means the stylesheet parsed.

- [ ] **Step 5: Commit**

```bash
git add assets/css/games.css
git commit -m "style(games): add books-builder drag board styles + --ok/--bad tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rebuild `init` as the drag-and-drop board

Replace the click-game `init` with the pool/slots DnD board: build the DOM, wire drag handlers, run Check (using `scorePlacement` from Task 1), surface Best through the footer, and return a working `cleanup()`. This is the heart of the change and is verified end-to-end in the browser against the mockup.

**Files:**
- Modify: `static/games/js/games/books-builder.js` (replace the whole `init` body, lines ~20–85; add the `bankinfo` import)

**Interfaces:**
- Consumes: `pickBooks` (unchanged), `scorePlacement` (Task 1), `getHighScore`/`saveScore`/`signalFinished` (`shared/scoring.js`), `playSound` (`shared/sound.js`), `setBest`/`setDrawn` (`shared/bankinfo.js`).
- Produces: `init(container, difficulty)` → `cleanup()`. No other module imports from this file's `init`.

- [ ] **Step 1: Add the bankinfo import**

At the top of `static/games/js/games/books-builder.js`, after the existing imports (lines 1–2), add:

```js
import { setBest, setDrawn } from '../shared/bankinfo.js';
```

Resulting import block:

```js
import { getHighScore, saveScore, signalFinished } from '../shared/scoring.js';
import { playSound } from '../shared/sound.js';
import { setBest, setDrawn } from '../shared/bankinfo.js';
const booksData = window.GAME_DATA;
```

- [ ] **Step 2: Replace the entire `init` function with the DnD board**

Replace everything from `export function init(container, difficulty) {` through its closing `}` (current lines 20–85) with:

```js
export function init(container, difficulty) {
  const correct = pickBooks(booksData, difficulty);
  const N = correct.length;

  // Fisher–Yates shuffle of the books for the pool.
  const shuffled = correct.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // book.order -> book, so a chip's data-order attribute can be resolved back.
  const byOrder = new Map(correct.map((b) => [b.order, b]));

  let best = getHighScore('books-builder');
  let dragged = null;

  container.innerHTML = `
    <div class="bb-head">
      <p>Drag each book from the pool into the numbered slot you think is right, then press <b>Check order</b>.</p>
    </div>
    <div class="bb-board">
      <div>
        <div class="bb-col-label">Pool — drag from here</div>
        <div class="bb-pool" id="bb-pool"></div>
      </div>
      <div>
        <div class="bb-col-label">Correct order</div>
        <div class="bb-slots" id="bb-slots"></div>
      </div>
    </div>
    <div class="bb-controls">
      <button type="button" class="bb-check" id="bb-check">Check order</button>
      <button type="button" id="bb-reset">Reset</button>
      <span class="bb-result" id="bb-result"></span>
    </div>
    <div class="bb-finish" id="bb-finish">
      <div class="bb-seal">✓</div>
      <div>
        <h3>Perfect order!</h3>
        <p>All books placed correctly. Best score saved.</p>
      </div>
    </div>
  `;

  const pool = container.querySelector('#bb-pool');
  const slotsEl = container.querySelector('#bb-slots');
  const checkBtn = container.querySelector('#bb-check');
  const resetBtn = container.querySelector('#bb-reset');
  const resultEl = container.querySelector('#bb-result');
  const finishEl = container.querySelector('#bb-finish');

  function makeChip(book) {
    const chip = document.createElement('div');
    chip.className = 'bb-chip';
    chip.draggable = true;
    chip.dataset.order = book.order;
    chip.innerHTML =
      `<span class="bb-grip" aria-hidden="true">⠿</span><span class="bb-name"></span>`;
    chip.querySelector('.bb-name').textContent = book.name;
    chip.addEventListener('dragstart', (e) => {
      dragged = chip;
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      dragged = null;
    });
    return chip;
  }

  function clearMarks() {
    slotsEl.querySelectorAll('.bb-slot').forEach((s) => {
      s.classList.remove('correct', 'wrong', 'shake');
      const m = s.querySelector('.bb-mark');
      if (m) m.textContent = '';
      const h = s.querySelector('.bb-hint');
      if (h) h.remove();
    });
    resultEl.textContent = '';
    finishEl.classList.remove('show');
  }

  function refreshDropStates() {
    slotsEl.querySelectorAll('.bb-drop').forEach((d) => {
      const has = !!d.querySelector('.bb-chip');
      d.classList.toggle('filled', has);
      d.classList.toggle('empty', !has);
      const ph = d.querySelector('.bb-ph');
      if (ph) ph.style.display = has ? 'none' : '';
    });
  }

  function makeDropTarget(el, isPool) {
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('dragover');
    });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (!dragged) return;
      clearMarks();
      if (isPool) {
        pool.appendChild(dragged);
      } else {
        // dropping onto an occupied slot returns the resident chip to the pool
        const existing = el.querySelector('.bb-chip');
        if (existing && existing !== dragged) pool.appendChild(existing);
        el.appendChild(dragged);
      }
      refreshDropStates();
    });
  }

  // Build the pool.
  shuffled.forEach((b) => pool.appendChild(makeChip(b)));
  makeDropTarget(pool, true);

  // Build N numbered slots.
  for (let i = 0; i < N; i++) {
    const slot = document.createElement('div');
    slot.className = 'bb-slot';
    slot.innerHTML = `
      <div class="bb-slot-num">${i + 1}</div>
      <div class="bb-drop empty">
        <span class="bb-ph">drop a book here</span>
        <span class="bb-mark"></span>
      </div>`;
    const drop = slot.querySelector('.bb-drop');
    makeDropTarget(drop, false);
    slotsEl.appendChild(slot);
  }

  // Read the current placement as an array aligned to slot index.
  function readPlaced() {
    const drops = [...slotsEl.querySelectorAll('.bb-drop')];
    return drops.map((d) => {
      const chip = d.querySelector('.bb-chip');
      return chip ? byOrder.get(Number(chip.dataset.order)) : null;
    });
  }

  function check() {
    const placed = readPlaced();
    const slots = [...slotsEl.querySelectorAll('.bb-slot')];
    slots.forEach((slot, i) => {
      const drop = slot.querySelector('.bb-drop');
      const mark = slot.querySelector('.bb-mark');
      const oldHint = slot.querySelector('.bb-hint');
      if (oldHint) oldHint.remove();
      slot.classList.remove('correct', 'wrong', 'shake');
      if (placed[i] && placed[i].order === correct[i].order) {
        slot.classList.add('correct');
        mark.textContent = '✓';
      } else {
        slot.classList.add('wrong', 'shake');
        mark.textContent = '✕';
        setTimeout(() => slot.classList.remove('shake'), 300);
        const hint = document.createElement('span');
        hint.className = 'bb-hint';
        hint.textContent = `should be ${correct[i].name}`;
        drop.appendChild(hint);
      }
    });

    const score = scorePlacement(correct, placed);
    resultEl.innerHTML =
      `Score: <b>${score}/${N}</b> in correct position. ` +
      (score === N ? 'Perfect!' : 'Fix the red slots and check again.');

    if (score > best) {
      best = score;
      saveScore('books-builder', score);
      setBest(best);
    }

    if (score === N) {
      playSound('correct');
      finishEl.classList.add('show');
      signalFinished(container);
    } else {
      playSound('wrong');
    }
  }

  function reset() {
    clearMarks();
    // collect every chip (in pool or slots) and re-shuffle back into the pool
    const chips = [...container.querySelectorAll('.bb-chip')];
    for (let i = chips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chips[i], chips[j]] = [chips[j], chips[i]];
    }
    chips.forEach((c) => pool.appendChild(c));
    refreshDropStates();
  }

  checkBtn.addEventListener('click', check);
  resetBtn.addEventListener('click', reset);

  setDrawn(N);
  setBest(best);
  refreshDropStates();

  return function cleanup() {
    container.innerHTML = '';
  };
}
```

> **Why `cleanup()` is just `container.innerHTML = ''`:** every listener is attached to an element inside `container` (chips, drop zones, the two buttons) — none on `window` or `document`. Clearing `innerHTML` drops those nodes and their listeners for GC. (The shell's `beforeunload` guard is the shell's own concern; `init` doesn't touch it.)

- [ ] **Step 3: Manual browser verification — start the server**

```bash
hugo server
```

Open `http://localhost:1313/games/books-builder/`. The page boots at **Normal** difficulty (NT). The footer should show `Drawn this round: 27` and `Best: 0` (or a prior persisted value).

- [ ] **Step 4: Manual browser verification — drag mechanics**

Walk the handover checklist; each must hold:
- Drag a chip from the pool into a slot → it lands; the slot's placeholder text disappears.
- Drag a chip onto an **occupied** slot → the resident chip returns to the pool, the dragged chip takes the slot.
- Drag a chip from a slot back to the **pool** → the slot goes empty again (placeholder returns).
- After a Check, placing/moving any chip → all green/red marks and hints clear, the finish banner hides.

- [ ] **Step 5: Manual browser verification — Check scoring**

- Place a few books correctly and a few wrong, leave one slot empty. Press **Check order**.
- Every slot is marked: correct → green border + `✓`; wrong/empty → red border + `✕` + a "should be {Book}" hint; the wrong slots shake once.
- The inline result reads `Score: X/N in correct position.` with X = number of correctly placed slots (empty does NOT count).
- The footer **Best** updates to the session max and never decreases on a worse later check.

- [ ] **Step 6: Manual browser verification — perfect score + persistence + difficulty**

- Place every book correctly (drag in `order`), press Check → result shows `Score: N/N … Perfect!`, the finish banner appears, the correct sound plays.
- Reload the page → footer **Best** still shows the persisted value (localStorage `bq:books-builder:highscore`).
- Cycle difficulty (easy → normal → hard via the header chip): the board rebuilds with the right N (easy = OT count, hard = all), footer `Drawn` updates, and the previous board's listeners are gone (no console errors, no leftover chips).
- Click the header **restart** → the pool reshuffles, slots clear.
- Toggle **Reset** under the board → all chips return to a freshly shuffled pool, marks/result/banner clear.

- [ ] **Step 7: Manual browser verification — theming**

Switch the site theme (or OS) through **light**, **dark**, and **system**. In every mode: chips, slot borders, the green `✓` (`--ok`) and red `✕` (`--bad`), the Check button, and the finish banner all render with legible contrast — matching the mockup's light and dark previews.

- [ ] **Step 8: Commit**

```bash
git add static/games/js/games/books-builder.js
git commit -m "feat(games): rebuild Books Builder as drag-and-drop check-all-positions

Drag shuffled books from a pool into numbered slots; Check order scores every
slot (green/red + 'should be X' hint) instead of stopping at the first mistake.
Best score surfaced via the shell footer; in-board title dropped (shell renders
it). Removes the old click-in-order flow.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (against `2026-06-30-books-builder-drag-check-design.md`):
- Layout pool→numbered slots, "Correct order" label → Task 2 (CSS) + Task 3 Step 2 (DOM). ✓
- Draggable chips with grip glyph + name → Task 3 `makeChip`. ✓
- Drop onto occupied slot returns resident to pool; drag back to pool empties slot → Task 3 `makeDropTarget`. ✓
- Placing/moving clears marks + hides banner → Task 3 `clearMarks` called on every drop. ✓
- Check scores all slots; correct=green✓, wrong/empty=red✕ + shake + "should be {Book}"; empty counts wrong; always enabled; unlimited re-checks → Task 3 `check`. ✓
- Score line `X/N in correct position` → Task 3 `check` `resultEl`. ✓
- Best = session max, persisted via `saveScore`/`getHighScore`, surfaced in footer (user decision) → Task 3 `check` + boot. ✓
- `score === N` → finish banner + `signalFinished` → Task 3 `check`. ✓
- `--ok`/`--bad` local tokens, light+dark → Task 2 Step 1. ✓
- `pickBooks` unchanged → untouched in all tasks. ✓
- `scoreSequence` removed, `scorePlacement` added (pure, empty slots not counted) → Task 1. ✓
- `init` returns `cleanup()` → Task 3 Step 2. ✓
- No in-board title (shell renders it) → Task 3 DOM has no `<h2>`. ✓ (departs from mockup per integration constraint + user decision.)
- Non-goals (touch fallback, keyboard reorder, animation) → not implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; commands have expected output. ✓

**Type consistency:** `scorePlacement(correctOrder, placed)` signature identical in Task 1 (def) and Task 3 (call, passing `correct` + `placed` array of book-or-null). Class names in Task 2 CSS match the strings emitted by Task 3 DOM (`bb-chip`, `bb-drop`, `bb-slot`, `bb-mark`, `bb-hint`, `bb-result`, `bb-finish`, `bb-seal`, `bb-col-label`, `bb-pool`, `bb-slots`, `bb-controls`, `bb-check`, states `correct`/`wrong`/`shake`/`empty`/`filled`/`dragover`/`dragging`). Footer hooks `data-gb-best`/`data-gb-drawn` driven only via `setBest`/`setDrawn`. ✓
