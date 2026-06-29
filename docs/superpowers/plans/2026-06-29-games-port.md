# Bible Quest Games Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the standalone "Bible Quest" mini-game collection inside the phucam.tv Hugo site at `/games/`, with the hub at `/games/` and each game on its own real URL `/games/<name>/`, styled to match the site.

**Architecture:** Vendor the games as plain ES modules under `static/games/js/` (served verbatim by Hugo — no Vite, no bundler, no build step). Game data lives in Hugo's `data/games/` dir and is injected inline as `window.GAME_DATA` on each game page, so each game's existing synchronous `init(container, difficulty)` runs unchanged. Pages are Hugo content + a `games` layout, inheriting the site `<head>`, fonts, and design tokens. Game CSS is rewritten on the site's CSS custom properties.

**Tech Stack:** Hugo v0.163 (extended), vanilla JS ES modules, Hugo data files + `jsonify`, Hugo asset pipeline (`resources` / `fingerprint`).

## Global Constraints

- **No build tooling.** No Vite, no Node, no `node_modules`, no `package.json` in this repo. JS/CSS ship as source.
- **JS source** lives under `static/games/js/` and is served verbatim at `/games/js/...`.
- **Game data** lives under `data/games/*.json` (Hugo data dir). It is read at build time and injected inline; it is NOT web-served and NOT fetched at runtime. **`hugo.toml` uses explicit `[[module.mounts]]`, which disables Hugo's default `data/` auto-mount — so `data/games` MUST be added as an explicit mount or `.Site.Data.games` will be empty (verified).**
- **Game CSS** lives at `assets/css/games.css`, scoped under `.games`, themed via the site's CSS custom properties from `assets/css/tokens.css` (`--surface-*`, `--text-*`, `--border-*`, `--accent`, `--link`). No hard-coded colors.
- **Game logic is copied unchanged** except the single `import xData from '../../data/x.json'` → `const xData = window.GAME_DATA` line per game.
- **Content stays English** (port now, translate later). The only Vietnamese string introduced is the error fallback `Không tải được trò chơi.`.
- **Verification is manual** (no JS test runner): `make dev` on :1313, play each game, toggle dark mode, `hugo --minify`.
- Source of truth for the games being copied: `~/dirs/games/src/`.

---

### Task 1: Vendor the game JS modules and data into the repo

Copy the shared utilities and game modules verbatim, apply the one-line data-source change per game, and place the JSON in Hugo's data dir. No pages yet — this task just lands the assets and proves the data injection mechanic.

**Files:**
- Create: `static/games/js/shared/storage.js` (copy, verbatim)
- Create: `static/games/js/shared/scoring.js` (copy, verbatim)
- Create: `static/games/js/shared/sound.js` (copy, verbatim)
- Create: `static/games/js/shared/difficulty.js` (copy, verbatim)
- Create: `static/games/js/games/books-builder.js` (copy + 1-line edit)
- Create: `static/games/js/games/who-said-it.js` (copy + 1-line edit)
- Create: `static/games/js/games/scripture-scramble.js` (copy + 1-line edit)
- Create: `static/games/js/games/type-the-verse.js` (copy + 1-line edit)
- Create: `static/games/js/games/parable-pairs.js` (copy + 1-line edit)
- Create: `data/games/books.json` `data/games/quotes.json` `data/games/verses.json` `data/games/parables.json` (copy, verbatim)

**Interfaces:**
- Produces:
  - `shared/storage.js`: `getItem(key, fallback=null)`, `setItem(key, value)`, `removeItem(key)`
  - `shared/scoring.js`: `getHighScore(gameId) → number`, `saveScore(gameId, score)`
  - `shared/sound.js`: `playSound(name)`, `isMuted()`, `setMuted(v)`
  - `shared/difficulty.js`: `createDifficultySelector(container, onChange) → cleanup()` — calls `onChange('normal')` immediately on mount; buttons carry `data-level`
  - each `games/<name>.js`: `init(container, difficulty) → cleanup()`; reads `window.GAME_DATA`

- [ ] **Step 1: Create the directories**

```bash
mkdir -p static/games/js/shared static/games/js/games data/games
```

- [ ] **Step 2: Copy shared modules and data verbatim**

```bash
SRC=~/dirs/games/src
cp "$SRC"/shared/storage.js     static/games/js/shared/storage.js
cp "$SRC"/shared/scoring.js     static/games/js/shared/scoring.js
cp "$SRC"/shared/sound.js       static/games/js/shared/sound.js
cp "$SRC"/shared/difficulty.js  static/games/js/shared/difficulty.js
cp "$SRC"/games/books-builder/books-builder.js             static/games/js/games/books-builder.js
cp "$SRC"/games/who-said-it/who-said-it.js                 static/games/js/games/who-said-it.js
cp "$SRC"/games/scripture-scramble/scripture-scramble.js   static/games/js/games/scripture-scramble.js
cp "$SRC"/games/type-the-verse/type-the-verse.js           static/games/js/games/type-the-verse.js
cp "$SRC"/games/parable-pairs/parable-pairs.js             static/games/js/games/parable-pairs.js
cp "$SRC"/data/books.json     data/games/books.json
cp "$SRC"/data/quotes.json    data/games/quotes.json
cp "$SRC"/data/verses.json    data/games/verses.json
cp "$SRC"/data/parables.json  data/games/parables.json
```

- [ ] **Step 3: Apply the one-line data-source change to each game**

In each game file, replace the JSON import with a read of the page global. Exact replacements:

`static/games/js/games/books-builder.js`:
```js
// replace:
import booksData from '../../data/books.json';
// with:
const booksData = window.GAME_DATA;
```

`static/games/js/games/who-said-it.js`:
```js
// replace:
import quotesData from '../../data/quotes.json';
// with:
const quotesData = window.GAME_DATA;
```

`static/games/js/games/scripture-scramble.js`:
```js
// replace:
import versesData from '../../data/verses.json';
// with:
const versesData = window.GAME_DATA;
```

`static/games/js/games/type-the-verse.js`:
```js
// replace:
import versesData from '../../data/verses.json';
// with:
const versesData = window.GAME_DATA;
```

`static/games/js/games/parable-pairs.js`:
```js
// replace:
import parablesData from '../../data/parables.json';
// with:
const parablesData = window.GAME_DATA;
```

The relative imports of `../../shared/scoring.js` and `../../shared/sound.js` are unchanged — they still resolve correctly because the `shared/` and `games/` dirs keep the same relative layout under `static/games/js/`.

- [ ] **Step 4: Verify no stale JSON imports remain**

Run:
```bash
grep -rn "from '../../data" static/games/js/games/ ; echo "exit: $?"
```
Expected: no matching lines; `grep` exits non-zero (`exit: 1`). If any line prints, fix it before moving on.

- [ ] **Step 5: Verify the shared imports are intact**

Run:
```bash
grep -rn "from '../../shared/" static/games/js/games/ | wc -l
```
Expected: `10` (each of the 5 games imports both `scoring.js` and `sound.js`).

- [ ] **Step 6: Commit**

```bash
git add static/games/js data/games
git commit -m "feat(games): vendor Bible Quest JS modules and data

Copy the shared utilities and 5 game modules from the standalone Vite app as
plain ES modules under static/games/js/. Game data goes to Hugo's data/games/.
Each game's JSON import is swapped for a read of window.GAME_DATA so the
synchronous init() is unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Game CSS on site tokens

Rewrite Bible Quest's 31-line stylesheet as `assets/css/games.css`, scoped under `.games`, themed entirely via the site's CSS custom properties so light/dark works for free. This is a standalone deliverable: a reviewer can judge the CSS without the pages existing yet.

**Files:**
- Create: `assets/css/games.css`

**Interfaces:**
- Produces: a stylesheet scoped under `.games` covering: layout container, headings, the shared button look, state classes `.correct` / `.wrong` / `.matched` / `.selected` / `.locked` / `.filled`, the `shake` keyframe, hub cards (`.games-hub`, `.games-card`), the difficulty selector (`.difficulty-btn[aria-pressed]`), and the back-to-hub link (`.games-back`). Consumed by `head.html` (Task 4) and the layouts (Tasks 3, 5).

- [ ] **Step 1: Write `assets/css/games.css`**

```css
/* Bible Quest games — scoped under .games, themed via site tokens. */

.games {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
  font-family: "Be Vietnam Pro", system-ui, sans-serif;
  color: var(--text-body);
}

.games h1,
.games h2 {
  font-family: Newsreader, Georgia, serif;
  color: var(--text-strong);
  font-weight: 600;
}

.games p { color: var(--text-body); }

/* shared button look */
.games button {
  font: inherit;
  cursor: pointer;
  background: var(--surface-raised);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  margin: 0.2rem;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.games button:hover:not(:disabled) { background: var(--surface-hover); }
.games button:disabled { cursor: default; opacity: 0.6; }

/* state classes (kept identical to game JS class names) */
.games .correct  { background: var(--surface-soft); border-color: var(--accent); color: var(--text-strong); }
.games .wrong    { background: var(--surface-sunken); border-color: var(--link); color: var(--text-strong); }
.games .matched  { background: var(--surface-soft); border-color: var(--accent); opacity: 0.7; }
.games .selected { outline: 3px solid var(--accent); }
.games .locked   { background: var(--surface-soft); }
.games .filled   { background: var(--surface-tint); }

@keyframes games-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
.games .shake { animation: games-shake 0.3s ease-in-out; }

/* difficulty selector */
.games .difficulty {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 1rem;
}
.games .difficulty-btn[aria-pressed="true"] {
  background: var(--surface-inverse);
  color: var(--text-on-inverse-strong);
  border-color: var(--surface-inverse);
}

/* back-to-hub link */
.games-back {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--link);
  text-decoration: none;
}
.games-back:hover { color: var(--link-hover); text-decoration: underline; }

/* hub */
.games-hub {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
  list-style: none;
  padding: 0;
}
.games-card {
  display: block;
  padding: 1.1rem 1.2rem;
  background: var(--surface-raised);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 1px 3px var(--shadow-soft);
  text-decoration: none;
  color: var(--text-strong);
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.games-card:hover { border-color: var(--accent); box-shadow: 0 3px 10px var(--shadow-card); }
.games-card h2 { margin: 0 0 0.35rem; font-size: 1.15rem; }
.games-card p { margin: 0; color: var(--text-muted); font-size: 0.92rem; }
```

- [ ] **Step 2: Verify the CSS references only tokens, no hard-coded hex colors**

Run:
```bash
grep -nE '#[0-9a-fA-F]{3,6}' assets/css/games.css ; echo "exit: $?"
```
Expected: no matches; `grep` exits non-zero (`exit: 1`). Every color must come from a `var(--…)` token.

- [ ] **Step 3: Commit**

```bash
git add assets/css/games.css
git commit -m "feat(games): add games.css themed on site tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Content pages and Hugo wiring for the games section

Create the content pages (hub `_index.md` + one per game) and add `"games"` to the `$libApp` section list in `head.html` so the games inherit the site fonts/tokens and load `games.css`. After this task, `/games/` and `/games/<name>/` exist as routes (rendered by the default layouts) and the CSS/fonts load — even though the custom layouts (Tasks 4–5) aren't in yet.

**Files:**
- Create: `content/games/_index.md`
- Create: `content/games/books-builder.md`
- Create: `content/games/who-said-it.md`
- Create: `content/games/scripture-scramble.md`
- Create: `content/games/type-the-verse.md`
- Create: `content/games/parable-pairs.md`
- Modify: `hugo.toml` (add a `data/games` module mount)
- Modify: `layouts/partials/head.html` (the `$libApp` section list and the CSS block)

**Interfaces:**
- Consumes: `assets/css/games.css` (Task 2); the `data/games/*.json` files (Task 1).
- Produces: pages with front-matter params `game` (module basename) and `data` (data-file key under `.Site.Data.games`), consumed by `single.html` (Task 5). Section `games` is registered as a `$libApp` section, so `head.html` loads Newsreader/Be Vietnam Pro and emits the games stylesheet link.

- [ ] **Step 1: Create the hub content page**

`content/games/_index.md`:
```markdown
---
title: "Trò Chơi"
description: "Bible learning mini-games for the whole family."
---
```

- [ ] **Step 2: Create the five game content pages**

`content/games/books-builder.md`:
```markdown
---
title: "Books of the Bible Builder"
game: "books-builder"
data: "books"
summary: "Put the books of the Bible in order."
---
```

`content/games/who-said-it.md`:
```markdown
---
title: "Who Said It?"
game: "who-said-it"
data: "quotes"
summary: "Match the quote to the Bible character."
---
```

`content/games/scripture-scramble.md`:
```markdown
---
title: "Scripture Scramble"
game: "scripture-scramble"
data: "verses"
summary: "Rebuild a shuffled Bible verse word by word."
---
```

`content/games/type-the-verse.md`:
```markdown
---
title: "Type the Verse"
game: "type-the-verse"
data: "verses"
summary: "Type a Bible verse from prompt or memory."
---
```

`content/games/parable-pairs.md`:
```markdown
---
title: "Parable Pairs"
game: "parable-pairs"
data: "parables"
summary: "Match each parable to its meaning."
---
```

- [ ] **Step 3: Add the `data/games` mount to `hugo.toml`**

`hugo.toml` declares explicit `[[module.mounts]]`, which turns OFF Hugo's default `data/` auto-mount. Without an explicit mount, `.Site.Data.games` is empty and `window.GAME_DATA` would be `null`. Add a mount next to the existing `data/bible` one. Find this block in `hugo.toml`:
```toml
[[module.mounts]]
  source = "data/bible"
  target = "data/bible"
```
Add immediately after it:
```toml
[[module.mounts]]
  source = "data/games"
  target = "data/games"
```

- [ ] **Step 4: Add `"games"` to the `$libApp` section list in `head.html`**

In `layouts/partials/head.html`, find this line:
```go-html-template
{{ $libApp := or .IsHome (in (slice "kt" "truong-sabat" "nghien-cuu" "doctrines" "sach" "articles" "tc" "authors") .Section) }}
```
Change it to add `"games"`:
```go-html-template
{{ $libApp := or .IsHome (in (slice "kt" "truong-sabat" "nghien-cuu" "doctrines" "sach" "articles" "tc" "authors" "games") .Section) }}
```

- [ ] **Step 5: Emit the games stylesheet link in `head.html`**

In `layouts/partials/head.html`, find the final line (the lib-app stylesheet block):
```go-html-template
{{ if $libApp }}{{ $la := resources.Get "css/lib-app.css" | fingerprint }}<link rel="stylesheet" href="{{ $la.RelPermalink }}">{{ end }}
```
Add a games-stylesheet line immediately after it:
```go-html-template
{{ if eq .Section "games" }}{{ $g := resources.Get "css/games.css" | fingerprint }}<link rel="stylesheet" href="{{ $g.RelPermalink }}">{{ end }}
```

- [ ] **Step 6: Build and verify the routes, data namespace, and stylesheet**

Run:
```bash
hugo --gc 2>&1 | tail -5
ls public/games/ public/games/who-said-it/
grep -o 'css/games[.][0-9a-f]*[.]css' public/games/index.html | head -1
```
Expected: build succeeds with no errors; `public/games/index.html` and `public/games/who-said-it/index.html` exist; the grep prints a fingerprinted `css/games.<hash>.css` (confirming the stylesheet linked). The data-namespace check happens in Task 5 Step 2 (the `window.GAME_DATA` grep) — if that shows `null`, this mount step was skipped.

- [ ] **Step 7: Commit**

```bash
git add content/games hugo.toml layouts/partials/head.html
git commit -m "feat(games): add games content pages, data mount, and head wiring

Register the games section as a lib-app section so it inherits the site fonts
and tokens, emit the games.css link, and mount data/games (the explicit module
mounts disable Hugo's default data/ auto-mount). Each game page carries
game/data front-matter params consumed by the games layout.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Hub layout (`/games/`)

The `/games/` list layout renders the five games as cards linking to their pages. Pure Hugo, no JS (replaces the old `hub.js` view-swapping).

**Files:**
- Create: `layouts/games/list.html`

**Interfaces:**
- Consumes: the games content pages (Task 3) — iterates `.Pages`, reads each page's `.Title` and `.Params.summary`; uses `.games-hub` / `.games-card` from `games.css` (Task 2).

- [ ] **Step 1: Write `layouts/games/list.html`**

```go-html-template
{{ define "main" }}
<div class="games">
  <h1>{{ .Title }}</h1>
  {{ with .Description }}<p>{{ . }}</p>{{ end }}
  <ul class="games-hub">
    {{ range .Pages }}
    <li>
      <a class="games-card" href="{{ .RelPermalink }}">
        <h2>{{ .Title }}</h2>
        {{ with .Params.summary }}<p>{{ . }}</p>{{ end }}
      </a>
    </li>
    {{ end }}
  </ul>
</div>
{{ end }}
```

- [ ] **Step 2: Build and verify the hub renders five cards**

Run:
```bash
hugo --gc 2>&1 | tail -3
grep -c 'class="games-card"' public/games/index.html
```
Expected: build succeeds; the count is `5`.

- [ ] **Step 3: Commit**

```bash
git add layouts/games/list.html
git commit -m "feat(games): hub layout listing games as cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Single game layout (`/games/<name>/`)

The single layout mounts one game: it injects that game's data as `window.GAME_DATA`, renders the difficulty selector + mount point + back link, and boots the game (re-running on difficulty change). This is the task that makes the games actually playable.

**Files:**
- Create: `layouts/games/single.html`

**Interfaces:**
- Consumes: `.Params.game` (module basename) and `.Params.data` (data-file key); `index .Site.Data.games .Params.data` (the JSON from Task 1); `createDifficultySelector` and each game's `init` (Task 1); `.games`, `.difficulty`, `.games-back` styles (Task 2).

- [ ] **Step 1: Write `layouts/games/single.html`**

```go-html-template
{{ define "main" }}
<div class="games">
  <a class="games-back" href="/games/">← All games</a>
  <h1>{{ .Title }}</h1>
  <div id="difficulty" class="difficulty"></div>
  <div id="game"></div>
</div>

{{ $data := index .Site.Data.games .Params.data }}
<script>window.GAME_DATA = {{ $data | jsonify }};</script>
<script type="module">
  import { init } from '/games/js/games/{{ .Params.game }}.js';
  import { createDifficultySelector } from '/games/js/shared/difficulty.js';

  const mount = document.getElementById('game');
  let cleanup = null;

  function run(level) {
    if (cleanup) cleanup();
    try {
      cleanup = init(mount, level);
    } catch (e) {
      cleanup = null;
      mount.textContent = 'Không tải được trò chơi.';
      console.error(e);
    }
  }

  // createDifficultySelector calls onChange('normal') immediately,
  // so the game boots at Normal on load.
  createDifficultySelector(document.getElementById('difficulty'), run);
</script>
{{ end }}
```

- [ ] **Step 2: Build and verify data injection + module wiring**

Run:
```bash
hugo --gc 2>&1 | tail -3
grep -o 'window.GAME_DATA = .\{0,30\}' public/games/who-said-it/index.html
grep -o "games/js/games/who-said-it.js" public/games/who-said-it/index.html
grep -o "games/js/games/scripture-scramble.js" public/games/scripture-scramble/index.html
```
Expected: build succeeds; the first grep shows `window.GAME_DATA = [{...` (an array of quote objects, not `null`); each module path grep prints its match.

- [ ] **Step 3: Verify the difficulty selector mounts on the page**

Run:
```bash
grep -o 'id="difficulty"' public/games/who-said-it/index.html
grep -o 'id="game"' public/games/who-said-it/index.html
```
Expected: both print their match.

- [ ] **Step 4: Commit**

```bash
git add layouts/games/single.html
git commit -m "feat(games): single game layout with data injection + difficulty

Inject the game's data as window.GAME_DATA, render the difficulty selector and
mount point, and boot the game (re-running on difficulty change).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: End-to-end manual verification

No code — this task is the manual play-through that stands in for the dropped test suite. It is its own task because a reviewer should gate on "the games actually work in the browser," not just that files exist.

**Files:** none.

- [ ] **Step 1: Confirm the dev server is serving the games**

The user runs `make dev` (Hugo on :1313). Then:
```bash
curl -s -o /dev/null -w "hub:%{http_code}\n" http://localhost:1313/games/
curl -s -o /dev/null -w "wsi:%{http_code}\n" http://localhost:1313/games/who-said-it/
```
Expected: both `200`.

- [ ] **Step 2: Play each game in a browser**

Open each URL and confirm it boots and is playable (mount point fills, difficulty buttons re-roll the game):
- `http://localhost:1313/games/` — five styled cards
- `http://localhost:1313/games/books-builder/`
- `http://localhost:1313/games/who-said-it/`
- `http://localhost:1313/games/scripture-scramble/`
- `http://localhost:1313/games/type-the-verse/`
- `http://localhost:1313/games/parable-pairs/`

For each: pick an answer/word, confirm correct/wrong states show (colors from tokens), sound plays (if unmuted), and the score/best message appears at the end.

- [ ] **Step 3: Verify refresh-safe direct URLs and difficulty re-roll**

Refresh a game page directly (not via the hub) — it must boot the same. Click Easy / Normal / Hard — the game must restart at that difficulty.

- [ ] **Step 4: Verify dark mode**

Toggle OS appearance to dark. The games re-theme (warm dark surfaces, cream text) with no hard-coded light colors leaking. Toggle back to light.

- [ ] **Step 5: Verify the production build**

Run:
```bash
hugo --minify 2>&1 | tail -3
ls public/games/who-said-it/index.html public/games/index.html
ls public/games/js/games/ public/games/js/shared/
```
Expected: build succeeds; all listed paths exist (`static/games/js/**` is copied verbatim into `public/`).

- [ ] **Step 6: No commit** (verification only). If any step fails, fix in the relevant task and re-verify.

---

## Notes for the implementer

- The games render plain semantic HTML (`<h2>`, `<button>`, `<blockquote>`, etc.) with a few state classes. All styling is in `games.css` scoped under `.games` — do not add inline styles to the JS.
- `window.GAME_DATA` is set by an inline `<script>` that runs **before** the `<script type="module">`. Module scripts are deferred, so ordering is guaranteed even though the module appears later. Do not convert `GAME_DATA` reads to `await`/`fetch`.
- The relative module imports inside the games (`../../shared/...`) only work because the `shared/` and `games/` dirs sit side by side under `static/games/js/`. Keep that layout.
- Leaving `/games/` out of the site navigation is intentional (separate, design-system-bound task). Don't wire it into the rail/navbar here.
