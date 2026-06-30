# Game Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky header bar (mirroring the existing bank-info footer) to each game-detail page, carrying the game icon + name, a compact cycle-style level picker, and restart + sound-toggle actions.

**Architecture:** A new `header` block in `layouts/games/baseof.html` renders `.games-header` as the first child of `<main class="lib-detail">`, above `.lib-detail-scroll` — the structural twin of the existing `bankinfo` block rendered after it. The `.lib-detail` flex column pins both to their edges automatically. `shared/difficulty.js` is rewritten from a three-button row into a single cycle button (same exported signature, so `single.html`'s wiring is untouched). Restart reuses `single.html`'s existing `run(level)`; the sound toggle drives the existing `shared/sound.js` `isMuted()/setMuted()`.

**Tech Stack:** Hugo (static site), vanilla ES modules (`static/games/js/`), CSS with design tokens (`assets/css/games.css`, fingerprinted, games-section only). No JS test runner — verification is `hugo` build + headless Chrome screenshots, per `CLAUDE.DESIGN-PRINCIPLES.md`.

## Global Constraints

- **Tokens only, no hard-coded colors.** Reuse the token names already in `games.css` (`--surface-soft`, `--surface-inverse`, `--text-strong`, `--text-on-inverse-strong`, `--accent`, `--accent-strong`, `--border-default`, `--surface-raised`, `--shadow-soft`, `--link`). Must read in light **and** dark. Tokens are defined in `assets/css/tokens.css`.
- **Scope every CSS rule under `.lib-app`** so app-shell styles never leak (e.g. `.lib-app .games-header`). Beware base resets `.lib-app button { background:none }` — a header `<button>` loses at equal specificity, so scope as `.lib-app .games-header …`.
- **Content is Vietnamese.** `aria-label`s use Vietnamese (e.g. "Đổi độ khó", "Chơi lại", "Bật/tắt âm thanh"). Follow `CLAUDE.md` terminology rules for any visible copy.
- **JS lives in `static/`** (served verbatim, no fingerprint). **CSS lives in `assets/`** (fingerprinted via `head.html`). After editing CSS, the served bundle filename changes — confirm the rebuilt fingerprint before trusting a screenshot.
- **Build/serve:** `hugo --minify` to build into `public/`; `make serve` runs `hugo server -D --buildFuture`. Screenshot evidence required in light + dark for any responsive/visual claim.
- **Six games** share this shell: `books-builder`, `parable-pairs`, `scripture-scramble`, `speed-typer`, `type-the-verse`, `who-said-it`.

---

## File Structure

- **Modify** `static/games/js/shared/difficulty.js` — rewrite three-button row → single cycle button. Same `createDifficultySelector(container, onChange)` signature + `cleanup` return.
- **Modify** `layouts/games/single.html` — remove the bare `#difficulty` div from the `main` block; mount the difficulty selector into the header's cycle slot; wire restart + sound buttons.
- **Modify** `layouts/games/baseof.html` — render a new `header` block at the top of `.lib-detail`.
- **Modify** `assets/css/games.css` — add `.games-header` styles (mirror the footer) + `.gh-cycle` cycle-button styles; remove the now-dead `.difficulty` / `.difficulty-btn` rules.
- **Modify** `content/games/*.md` (6 files) — add optional `icon:` front-matter field.

---

### Task 1: Cycle-button level selector (`difficulty.js`)

Rewrite the difficulty module from a three-button row into one cycle button, keeping the exported function name, `(container, onChange)` signature, the immediate `onChange('normal')` boot call, and the `cleanup` return — so `single.html`'s import contract is unchanged.

**Files:**
- Modify: `static/games/js/shared/difficulty.js` (full rewrite)

**Interfaces:**
- Consumes: nothing.
- Produces: `createDifficultySelector(container, onChange) → cleanup()`. Renders one `<button class="gh-cycle" data-level="…">` into `container` containing `<span class="dot">` + `<span class="lvl">`. Click advances `easy → normal → hard → easy`, updates `data-level` + label text, calls `onChange(level)`. Calls `onChange('normal')` once on mount. `cleanup()` removes the listener and the button.

- [ ] **Step 1: Rewrite the module**

Replace the entire contents of `static/games/js/shared/difficulty.js` with:

```js
const LEVELS = [
  { id: 'easy', label: 'Easy' },
  { id: 'normal', label: 'Normal' },
  { id: 'hard', label: 'Hard' },
];

export function createDifficultySelector(container, onChange) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gh-cycle';
  btn.setAttribute('aria-label', 'Đổi độ khó');

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.setAttribute('aria-hidden', 'true');
  const lvl = document.createElement('span');
  lvl.className = 'lvl';
  btn.append(dot, lvl);

  let index = LEVELS.findIndex((l) => l.id === 'normal');

  function render() {
    const { id, label } = LEVELS[index];
    btn.dataset.level = id;
    lvl.textContent = label;
  }

  const handleClick = () => {
    index = (index + 1) % LEVELS.length;
    render();
    onChange(LEVELS[index].id);
  };

  btn.addEventListener('click', handleClick);
  container.appendChild(btn);

  render();
  onChange(LEVELS[index].id);

  return function cleanup() {
    btn.removeEventListener('click', handleClick);
    btn.remove();
  };
}
```

- [ ] **Step 2: Verify the contract by inspection**

Confirm: exported name is `createDifficultySelector`, signature `(container, onChange)`, returns a `cleanup` function, and `onChange('normal')` fires once on mount (index starts at `normal`). These match `single.html`'s usage at `layouts/games/single.html:58`.

- [ ] **Step 3: Commit**

```bash
git add static/games/js/shared/difficulty.js
git commit -m "feat(games): cycle-style difficulty selector (replaces 3-button row)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Header markup in the shell (`baseof.html` + `single.html` + icon front-matter)

Render the header bar at the top of the detail column and move the difficulty mount into it. The header is rendered by `baseof.html` (a sibling of `.lib-detail-scroll`, like the footer), but its *content blocks* are defined in `single.html` so they can read page params.

**Files:**
- Modify: `layouts/games/baseof.html` (add `header` block render)
- Modify: `layouts/games/single.html` (define `header` block; remove bare `#difficulty`; wire mounts)
- Modify: `content/games/books-builder.md`, `parable-pairs.md`, `scripture-scramble.md`, `speed-typer.md`, `type-the-verse.md`, `who-said-it.md` (add `icon:`)

**Interfaces:**
- Consumes: `createDifficultySelector(container, onChange)` from Task 1; the header DOM (`#gh-cycle-slot`, `#gh-restart`, `#gh-sound`) defined here.
- Produces: the `.games-header` element with id hooks `#gh-cycle-slot` (cycle button mounts here), `#gh-restart`, `#gh-sound`; and `single.html`'s script wiring restart → `run(currentLevel)` and sound → `sound.js`.

- [ ] **Step 1: Add `icon` front-matter to all six games**

Add an `icon:` line under `data:` in each file. Values:

```
books-builder.md     → icon: "📚"
parable-pairs.md     → icon: "🧩"
scripture-scramble.md→ icon: "🔀"
speed-typer.md       → icon: "⌨️"
type-the-verse.md    → icon: "✍️"
who-said-it.md       → icon: "💬"
```

Example for `content/games/books-builder.md`:

```yaml
---
title: "Books of the Bible Builder"
game: "books-builder"
data: "books"
icon: "📚"
summary: "Put the books of the Bible in order."
---
```

- [ ] **Step 2: Render the header block in `baseof.html`**

In `layouts/games/baseof.html`, the `<main>` currently is:

```go-html-template
    <main class="lib-detail{{ if not $index }} lib-detail--has-bankinfo{{ end }}">
      <div class="lib-detail-scroll">
        {{- block "main" . }}{{- end }}
      </div>
      {{- block "bankinfo" . }}{{- end }}
    </main>
```

Add the `header` block as the **first** child of `<main>`, before `.lib-detail-scroll`:

```go-html-template
    <main class="lib-detail{{ if not $index }} lib-detail--has-bankinfo{{ end }}">
      {{- block "header" . }}{{- end }}
      <div class="lib-detail-scroll">
        {{- block "main" . }}{{- end }}
      </div>
      {{- block "bankinfo" . }}{{- end }}
    </main>
```

(The `header` block is empty on the section/index page because `single.html` defines it but list pages don't — matching how `bankinfo` is single-only.)

- [ ] **Step 3: Define the `header` block in `single.html` and remove the bare `#difficulty` div**

In `layouts/games/single.html`, the `main` block currently opens (lines 5-8):

```go-html-template
<div class="games">
  <div id="difficulty" class="difficulty"></div>
  <div id="game"></div>
</div>
```

Remove the `#difficulty` div (the cycle button now lives in the header):

```go-html-template
<div class="games">
  <div id="game"></div>
</div>
```

Then add a new `header` block definition (place it after the `main` block's `{{ end }}`, before the `bankinfo` block):

```go-html-template
{{ define "header" }}
<header class="games-header" aria-label="Game header">
  <span class="gh-icon" aria-hidden="true">{{ .Params.icon | default "🎮" }}</span>
  <h2 class="gh-name">{{ .Title }}</h2>
  <span id="gh-cycle-slot"></span>
  <div class="gh-actions">
    <button type="button" id="gh-restart" class="gh-btn" aria-label="Chơi lại" title="Chơi lại">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
    </button>
    <button type="button" id="gh-sound" class="gh-btn" aria-label="Bật/tắt âm thanh" title="Âm thanh">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>
    </button>
  </div>
</header>
{{ end }}
```

- [ ] **Step 4: Re-point the difficulty mount in `single.html`'s script**

The script currently mounts the selector into `#difficulty` (line 58):

```js
  createDifficultySelector(document.getElementById('difficulty'), run);
```

Change it to mount into the header slot:

```js
  createDifficultySelector(document.getElementById('gh-cycle-slot'), run);
```

- [ ] **Step 5: Build and verify the header renders + game still boots**

```bash
hugo --minify
```

Expected: build succeeds, no template errors. Then serve and screenshot `/games/books-builder/`:

```bash
make serve   # background; or use an already-running server
```

Verify by screenshot: header bar at the top of the detail column showing 📚 + "Books of the Bible Builder" + a cycle button reading "Normal" + two action icons on the right; the game boots below; the bank-info footer still at the bottom. (Styling is unstyled/raw until Task 3 — confirm presence and that the game still loads at Normal.)

- [ ] **Step 6: Commit**

```bash
git add layouts/games/baseof.html layouts/games/single.html content/games/*.md
git commit -m "feat(games): render game header bar with icon, name, level, actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire restart + sound toggle (`single.html` script)

Make the two action buttons live. Restart reboots the current round at the current level; the sound button reflects and toggles the shared mute state.

**Files:**
- Modify: `layouts/games/single.html` (module script only)

**Interfaces:**
- Consumes: `run(level)` and the level value (both already in `single.html`'s script); `#gh-restart`, `#gh-sound` from Task 2; `isMuted()`, `setMuted()` from `static/games/js/shared/sound.js`.
- Produces: nothing downstream.

- [ ] **Step 1: Track the current level and import sound state**

In `single.html`'s `<script type="module">`, add the sound import beside the existing imports (after line 15):

```js
  import { isMuted, setMuted } from '/games/js/shared/sound.js';
```

The `run(level)` function (line 42) is the single place that knows the level. Capture it into an outer variable. Add near the top of the script (beside `let cleanup = null;`):

```js
  let currentLevel = 'normal';
```

And set it at the top of `run` (inside `function run(level) {`, first line of the body):

```js
    currentLevel = level;
```

- [ ] **Step 2: Wire the restart button**

After the `createDifficultySelector(...)` call (now the last line), add:

```js
  document.getElementById('gh-restart').addEventListener('click', () => run(currentLevel));
```

- [ ] **Step 3: Wire the sound toggle**

After the restart wiring, add:

```js
  const soundBtn = document.getElementById('gh-sound');
  const ICON_ON  = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/>';
  const ICON_OFF = '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6"/><path d="m17 9 6 6"/>';
  function renderSound() {
    const muted = isMuted();
    soundBtn.classList.toggle('is-off', muted);
    soundBtn.querySelector('svg').innerHTML = muted ? ICON_OFF : ICON_ON;
    soundBtn.setAttribute('aria-pressed', String(!muted));
  }
  soundBtn.addEventListener('click', () => { setMuted(!isMuted()); renderSound(); });
  renderSound();
```

- [ ] **Step 4: Build and verify behavior**

```bash
hugo --minify
```

Then in the browser at `/games/books-builder/`:
- Click the cycle button → label advances Easy → Normal → Hard → Easy, and the game reboots at each.
- Click restart (↻) → the round restarts at the current level.
- Click sound (♪) → icon swaps to the slashed-speaker; reload the page → the slashed state persists (stored in `bq:muted`). Open a *different* game (`/games/who-said-it/`) → it shows the same muted state.

- [ ] **Step 5: Commit**

```bash
git add layouts/games/single.html
git commit -m "feat(games): wire header restart + sound toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Style the header (`games.css`)

Style `.games-header` to mirror the footer, style the cycle button and action buttons, and remove the now-dead `.difficulty` rules. Tokens only; light + dark.

**Files:**
- Modify: `assets/css/games.css` (add `.games-header` + `.gh-*` rules near the footer block ~line 100-137; remove the `.difficulty` / `.difficulty-btn` block at lines 51-70)

**Interfaces:**
- Consumes: the header DOM from Task 2 (`.games-header`, `.gh-icon`, `.gh-name`, `.gh-cycle` + `.dot`/`.lvl`, `.gh-actions`, `.gh-btn`).
- Produces: nothing downstream.

- [ ] **Step 1: Remove the dead difficulty rules**

Delete the block at `assets/css/games.css:51-70` (the `/* difficulty selector */` comment through the `.difficulty-btn[aria-pressed="true"]:hover` rule). The cycle button replaces it; the old `.difficulty` flex row and `.difficulty-btn` styles are now unused.

- [ ] **Step 2: Add the header styles**

Insert this block immediately **before** the `/* bank-info footer … */` comment at `assets/css/games.css:100` (so the header and footer styles sit together):

```css
/* game header: a bar pinned to the top edge of the detail column — the visual
   twin of .games-bankinfo, mirrored (border-bottom + downward shadow). Rendered
   in the `header` block of games/baseof.html as a sibling of .lib-detail-scroll,
   so it sits outside the scroll area and never scrolls away. Horizontal padding
   (44px / 20px mobile) aligns with the .games content column. */
.lib-app .games-header {
  position: relative;
  z-index: 5;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin: 0;
  padding: 0.7rem 44px;
  background: var(--surface-soft);
  border-bottom: 1px solid var(--border-default);
  box-shadow: 0 2px 12px var(--shadow-soft);
}
.lib-app .games-header .gh-icon {
  flex: none;
  width: 34px; height: 34px;
  display: grid; place-items: center;
  border-radius: 9px;
  background: var(--surface-inverse);
  color: var(--text-on-inverse-strong);
  font-size: 1.05rem;
  box-shadow: 0 1px 3px var(--shadow-soft);
}
.lib-app .games-header .gh-name {
  font-family: Newsreader, Georgia, serif;
  font-weight: 600;
  color: var(--text-strong);
  font-size: 1.15rem;
  margin: 0;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* cycle level button: one button, click advances easy → normal → hard.
   The diamond is color-coded by difficulty. ~96px vs the old 3-button ~180px. */
.lib-app .games-header .gh-cycle {
  flex: none;
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0 0.2rem;
  padding: 0.4rem 0.7rem;
  line-height: 1;
  background: var(--surface-raised);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.lib-app .games-header .gh-cycle:hover { background: var(--surface-soft); border-color: var(--accent); }
.lib-app .games-header .gh-cycle .dot {
  width: 9px; height: 9px; border-radius: 2px;
  transform: rotate(45deg);
  background: var(--accent-strong);
}
.lib-app .games-header .gh-cycle[data-level="easy"]   .dot { background: var(--accent); }
.lib-app .games-header .gh-cycle[data-level="normal"] .dot { background: var(--accent-strong); }
.lib-app .games-header .gh-cycle[data-level="hard"]   .dot { background: var(--link); }
.lib-app .games-header .gh-cycle .lvl {
  font-weight: 600;
  color: var(--text-strong);
  min-width: 3.4em;
  text-align: left;
}

/* right-aligned action buttons: restart + sound */
.lib-app .games-header .gh-actions { display: flex; gap: 0.3rem; margin-left: auto; }
.lib-app .games-header .gh-btn {
  flex: none;
  width: 34px; height: 34px;
  display: grid; place-items: center;
  background: var(--surface-raised);
  color: var(--text-secondary);
  border: 1px solid var(--border-default);
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.lib-app .games-header .gh-btn:hover { background: var(--surface-soft); border-color: var(--accent); color: var(--text-strong); }
.lib-app .games-header .gh-btn.is-off { color: var(--text-faint); }
.lib-app .games-header .gh-btn svg { width: 17px; height: 17px; }

@media (max-width: 960px) {
  .lib-app .games-header { padding-left: 20px; padding-right: 20px; }
}
```

(`.dot` difficulty colors use existing tokens: easy `--accent`, normal `--accent-strong`, hard `--link` — resolving the spec's "confirm the green against tokens" note; no new green token is introduced.)

- [ ] **Step 3: Build, confirm the CSS fingerprint changed, and screenshot light + dark**

```bash
hugo --minify
ls public/css/games.*.css   # note the new fingerprinted filename
grep -o 'games\.[a-f0-9]*\.css' public/games/books-builder/index.html   # confirm the page references the rebuilt bundle
```

Then headless-screenshot `/games/books-builder/` in light and dark (per `CLAUDE.DESIGN-PRINCIPLES.md` — use CDP `Emulation.setDeviceMetricsOverride` for true viewports). Verify:
- Header reads as the mirror of the footer: same `--surface-soft` bar, hairline border, soft shadow — at the **top**.
- Icon chip dark, name in serif, cycle button compact (~96px) with a color-coded diamond, two action icons right-aligned.
- Dark mode: all elements legible, diamond colors distinct, no hard-coded color leaking.

- [ ] **Step 4: Commit**

```bash
git add assets/css/games.css
git commit -m "style(games): header bar mirrors footer; cycle picker + action buttons

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Cross-game + responsive verification

Confirm the header works across all six games and all three responsive bands, in light and dark. No code unless a defect surfaces.

**Files:**
- None (verification only; fixes go to the relevant task's file if a defect is found).

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: nothing.

- [ ] **Step 1: Build once**

```bash
hugo --minify
```

- [ ] **Step 2: Screenshot every game's header**

For each of `books-builder`, `parable-pairs`, `scripture-scramble`, `speed-typer`, `type-the-verse`, `who-said-it`: load `/games/<name>/` and confirm the correct icon + title render, the cycle button boots at "Normal", and the game loads beneath. Watch for long titles ("Books of the Bible Builder") truncating cleanly rather than wrapping or shoving the actions off-row.

- [ ] **Step 3: Screenshot the three responsive bands**

Per `CLAUDE.DESIGN-PRINCIPLES.md`, at true viewports (CDP override): **~1280px** (desktop, 3 cols), **~1080px** (iPad, mid+detail), **~390px** (mobile, detail base). Confirm at 390px the header padding drops to 20px and the bar still fits icon + name + cycle + actions (title truncates if needed). The header is top-pinned so there is no bottom-navbar overlap to check.

- [ ] **Step 4: Confirm sound state is global**

Mute on `/games/who-said-it/`, then open `/games/speed-typer/` — the sound button shows muted (shared `bq:muted`). Unmute, reload — unmuted persists.

- [ ] **Step 5: Final commit (only if Step 2-4 required a fix)**

If any defect was fixed, commit it against the task that owns the file. If everything passed, no commit — note the verification passed and the feature is complete.

---

## Notes for the implementer

- **No unit-test runner exists** for the games. "Verify" means a Hugo build that succeeds plus a browser/headless screenshot showing the named behavior — this is the project's established discipline (`CLAUDE.DESIGN-PRINCIPLES.md` §"Verify before claiming done").
- **Stale-bundle gotcha:** the dev server can serve a stale `games.*.css`. Always confirm the fingerprinted filename in the served HTML matches the freshly built one before trusting a screenshot.
- The interactive mockup at `/tmp/game-header-mockup.html` (cycle + minimal) is the visual target.
