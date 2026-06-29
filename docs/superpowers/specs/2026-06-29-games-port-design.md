# Design — Port Bible Quest games into phucam.tv under `/games/`

**Date:** 2026-06-29
**Status:** Approved for spec review

## Goal

Bring the standalone "Bible Quest" mini-game collection (currently a Vite SPA in
`~/dirs/games`) into the phucam.tv Hugo site, served at `/games/`, with each game
on its own real URL and styled to match the site.

## Decisions (locked with user)

| Decision | Choice |
| --- | --- |
| Integration | Build output served under `static/games/`; games reachable at `/games/` |
| Source | Vendor into the phucam.tv repo (no external build dir) |
| **Build tool** | **None — drop Vite entirely.** Vanilla ES modules served by Hugo |
| Routing | `/games/` is the hub; each game is a real page `/games/<name>/` |
| Page generation | Hugo content pages + a `games` layout (native to the site) |
| Styling | Harmonize with site design tokens (`assets/css/tokens.css`) |
| Language | Port in English now; Vietnamese translation is a separate later task |
| Tests | Drop the vitest suite (the site has no JS test runner); verify by playing |

## Why no Vite

The games are plain JS with `import`/`export`, no framework, no JSX/TS. Vite only
provided a dev server (Hugo already is one), a bundler (unnecessary — Hugo serves
modules verbatim and can fingerprint), and JSON imports (replaceable with `fetch`).
Removing it means **no `node_modules`, no build step**: the source files *are* the
deployed assets. `make dev` serves them live; `hugo --minify` ships them.

## Architecture

### File layout (in the phucam.tv repo)

```
content/games/
  _index.md                      # hub page (front matter only; layout renders the list)
  books-builder.md               # one thin content page per game
  who-said-it.md
  scripture-scramble.md
  type-the-verse.md
  parable-pairs.md

layouts/games/
  list.html                      # the /games/ hub: grid of game cards + difficulty note
  single.html                    # a single game page: mounts one game, back-to-hub link

static/games/
  js/
    shared/  scoring.js difficulty.js sound.js storage.js
    games/   books-builder.js who-said-it.js scripture-scramble.js
             type-the-verse.js parable-pairs.js
    hub.js                       # (only if the hub needs JS; see Hub below)
  data/
    books.json quotes.json verses.json parables.json
  games.css                      # game-specific styles, on top of site tokens
```

JS and JSON live under `static/` (served verbatim at `/games/js/...`,
`/games/data/...`). The HTML pages are Hugo-rendered so they inherit the site
`<head>`, fonts, and design tokens.

### Per-game page (`layouts/games/single.html`)

Each game page:
1. Renders site chrome via `baseof.html`.
2. Has a mount point: `<div id="game"></div>` and a back link to `/games/`.
3. Renders the difficulty selector (Easy / Normal / Hard) above the mount point,
   using the existing `shared/difficulty.js`.
4. Boots one game, and **re-boots it when difficulty changes** — mirroring the
   original hub's `runGame(currentDifficulty)`:
   ```html
   <script type="module">
     import { init } from '/games/js/games/{{ .Params.game }}.js';
     import { createDifficultySelector } from '/games/js/shared/difficulty.js';
     const mount = document.getElementById('game');
     let cleanup = null;
     function run(level) {
       if (cleanup) cleanup();
       cleanup = init(mount, level);   // each game's init returns a cleanup fn
     }
     createDifficultySelector(document.getElementById('difficulty'), run);
     // createDifficultySelector calls onChange('normal') immediately, so the
     // game boots at Normal on load without extra wiring.
   </script>
   ```
5. Front matter carries `game:` (module basename) and `title:`.

   Note: the JSON `fetch` (see "Code changes" below) happens **inside** each
   game's `init`, so `run(level)` stays synchronous from the page's perspective;
   the game renders a brief loading state until its data resolves.

### Hub page (`layouts/games/list.html`)

`/games/` lists the five games as cards linking to `/games/<name>/`. The current
`hub.js` swapped views in-place; that behaviour is **replaced** by real links, so
hub.js is removed in favour of static Hugo-rendered cards. The difficulty
selector lives on each game page (it is an in-memory control — `difficulty.js`
defaults to Normal on load and does not persist), not on the hub.

### Code changes to the ported games

The game/shared modules are copied **unchanged** except for one mechanical fix:
the four `import xData from '../../data/x.json'` statements become a runtime
`fetch('/games/data/x.json')`. Concretely, each game's `init` already runs async-
friendly; we load JSON before mounting:

```js
// before:  import quotesData from '../../data/quotes.json';
// after:   const quotesData = await fetch('/games/data/quotes.json').then(r => r.json());
```

The page-level boot script awaits the fetch, then calls the game's existing
`init(container, difficulty)`. Internal game logic, scoring, sound, storage:
untouched.

### Styling — harmonize with site tokens

- Add `"games"` to the `$libApp` section list in `partials/head.html` so game
  pages load Newsreader + Be Vietnam Pro and the shared stylesheet (which carries
  `tokens.css`).
- Replace Bible Quest's 31-line `styles.css` with `static/games/games.css`,
  scoped under a `.games` wrapper, using the site CSS custom properties:
  surfaces (`--surface-raised`, `--surface-soft`), text (`--text-strong`,
  `--text-body`), borders (`--border-default`), accent (`--accent`), links
  (`--link`). Buttons, option lists, the `.correct`/`.wrong` states, and the
  hub cards all read from these tokens, so light/dark mode comes for free.
- Display serif (Newsreader) for game titles/scripture; UI sans (Be Vietnam Pro)
  for buttons and chrome — matching the library convention.
- Games do **not** adopt the full three-column library app-shell (rail/mid/detail).
  They use site tokens + fonts to *harmonize*, but keep their own simple
  single-column game layout. (Confirmed scope: "adopt design tokens/shell", not
  "full library-shell integration".)

## Data flow

1. User opens `/games/` → Hugo-rendered hub, five cards.
2. Clicks a card → navigates to `/games/<name>/` (a real page).
3. Page boot script `fetch`es that game's JSON, reads difficulty from
   `localStorage` (default `normal`), calls `init()`.
4. Game runs entirely client-side; scores persist via `shared/storage.js`
   (`localStorage`). No server, no login — unchanged from the original.

## Error handling

- JSON fetch failure: boot script shows a short Vietnamese-friendly fallback
  message in the mount point ("Không tải được trò chơi.") rather than a blank page.
- Unknown `game:` param: `single.html` renders the back-to-hub link only.

## Out of scope (explicit)

- Vietnamese translation of UI strings and Bible data (separate task).
- Adding `/games/` to the site navigation/menu (separate, design-system-bound task).
- Reintroducing a JS test runner.
- Full library app-shell (rail/mid/detail) for games.

## Verification

No automated tests. Verify by:
1. `make dev` (Hugo on :1313).
2. Visit `/games/` → five cards render, styled with site fonts/colors.
3. Visit each `/games/<name>/` directly (refresh-safe) → game boots and is playable.
4. Play one round of each game → scoring, sound, correct/wrong states work.
5. Toggle OS dark mode → games re-theme via tokens.
6. `hugo --minify` → confirm `public/games/...` contains the pages + assets.
