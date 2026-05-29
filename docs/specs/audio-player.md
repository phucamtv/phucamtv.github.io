# Audio Player

A sticky, bottom-of-page audio player for Bible content. It plays book- or
chapter-scoped recordings from multiple backends (MP3 files, YouTube videos,
YouTube playlists), lets the listener switch between alternate recordings of the
same book, and persists selection, speed, and listening position across page
loads.

## Files

| File | Role |
| --- | --- |
| `layouts/partials/audio-player.html` | Markup + the `audio-data` JSON the JS reads |
| `assets/js/audio-player.js` | All behavior (backends, controller, UI, persistence) |
| `assets/css/bible-media.css` | Styling (`.audio-player-*`, `.ap-*`) |
| `layouts/kt/single.html` | Renders the player on chapter pages |
| `layouts/kt/kt-book.html` | Renders the player on the book overview page |
| `content/kt/<book>.md` | `audio:` front matter declares the sources |

## Data flow

1. A `content/kt/<book>.md` book file declares one or more sources under
   `audio:` in front matter.
2. The layout includes the partial with a context dict:
   - `single.html` (chapter page): `(dict "book" $curBook "chapter" $c)`
   - `kt-book.html` (overview): `(dict "book" .)` — no `chapter` key.
3. The partial serializes a JSON blob into `<script id="audio-data">`:
   ```json
   {
     "slug": "ot19",
     "title": "Thi-thiên",
     "audio": [ ...entries... ],
     "initialChapter": 91,
     "isChapterPage": true
   }
   ```
   - `initialChapter` = the page's chapter, or `1` on the overview.
   - `isChapterPage` = `true` only when the layout passed a `chapter` key.
4. `audio-player.js` reads the blob on `DOMContentLoaded`, builds the controller
   and UI, and shows the bar in a "ready" state (no media loaded until the first
   play click — respects autoplay policy and avoids eager YouTube API loading).

The player is only rendered when `.Params.audio` is non-empty.

## Front matter: `audio` entries

`audio` is an ordered list. Order matters: index 0 is the default source, and the
source picker lists them top-to-bottom. Each entry shares these fields:

| Field | Required | Notes |
| --- | --- | --- |
| `type` | yes | `mp3`, `youtube-video`, or `youtube-playlist` |
| `lang` | yes | `vi`, `en`; mapped to a display label |
| `translation` | yes | e.g. `VN1925` — shown in the picker |
| `voiceGender` | yes | `male` / `female` → `Nam` / `Nữ` |
| `scope` | yes | `book` (one recording for the whole book) or `chapter` |

Type-specific fields:

### `type: mp3`

- **`scope: book`** — single file:
  - `url` — direct URL to the MP3.
- **`scope: chapter`** — one file per chapter, resolved one of two ways:
  - Explicit map: `chapters: { 1: "...", 2: "...", ... }` (keys are chapter numbers).
  - Pattern: `baseUrl` + `pattern` + `totalChapters`, where `pattern` contains
    the literal `{chapter}` token. The player expands chapters `1..totalChapters`
    as `baseUrl + pattern.replace("{chapter}", n)`.

### `type: youtube-video`

- `id` — YouTube video ID. Typically `scope: book` (one continuous video).

### `type: youtube-playlist`

- `id` — YouTube playlist ID. Chapter switching maps chapter `n` → playlist
  index `n-1` (assumes playlist videos are in chapter order). Exposing the
  chapter UI still requires `scope: chapter` with a resolvable chapter map.

### Example (Thi-thiên, `content/kt/ot19.md`)

```yaml
audio:
  - type: youtube-video
    id: z3AxrNZBs1k
    lang: vi
    translation: VN1925
    voiceGender: male
    scope: book
  - type: mp3
    lang: vi
    translation: VN1925
    voiceGender: male
    scope: chapter
    baseUrl: "https://nghekinhthanhviet.org//Uploads/Mp3/VIE1925MS/VIE1925-thi/"
    pattern: "thi{chapter}.mp3"
    totalChapters: 150
```

## Backends

A pluggable backend abstraction; the controller swaps backends when the source
changes. All expose `load`/`play`/`pause`/`seek`/`setSpeed`/`getCurrentTime`/
`getDuration`/`destroy` plus `onTimeUpdate`/`onEnded`/`onLoaded` callbacks.

- **MP3Backend** — wraps an `<audio>` element (`preload="metadata"`).
- **YouTubeBackend** — wraps the YouTube IFrame API in a hidden 1×1 player.
  Lazy-loads the IFrame API once, polls `getCurrentTime()` every 250ms (the API
  has no native timeupdate event), and supports both single videos and playlists.

## Features

### Source picker

- Rendered as a `<select>` (`#ap-source`).
- With **one** source: the `<select>` is hidden and a plain text label is shown.
- With **multiple** sources: each option is `sourceLabel(entry)` + a coverage
  suffix to disambiguate otherwise-identical labels — ` (trọn sách)` for
  `scope: book`, ` (theo chương)` for `scope: chapter`. The suffix only appears
  when there is more than one source.
- `sourceLabel` = `"<translation> - <lang> - <gender>"`, e.g.
  `VN1925 - Tiếng Việt - Nam`.
- The selected source index is **persisted per book** (see Persistence) and
  restored on load.
- **Default selection** (when nothing is stored for the book): on a chapter page,
  the first `scope: chapter` source is preferred (falling back to the first entry
  if none); on the book overview page, the first entry. An explicit prior choice
  always wins over the default.

### Chapter navigation

- Only for `scope: chapter` sources. The bar gets the `has-chapters` class,
  which reveals the prev/next skip buttons and a chapter `<select>` (`#ap-chapter`).
- Switching chapters tears down and reloads the MP3 backend at the new chapter
  URL (or jumps the playlist index), preserving play state.
- At the end of a chapter, the player auto-advances to the next chapter and keeps
  playing; at the last chapter it stops.
- On a **chapter page**, `currentChapter` initializes to that page's chapter, so
  a chapter-scoped source starts on the chapter being read.

### Resume

- Listening position is saved to localStorage every 5s while playing, and on
  pause, as `{ chapter, position, timestamp }`, keyed per `(slug, sourceIndex)`.
- Entries expire after 30 days; stale entries are pruned on init.
- On first play of a source, if a saved position > 10s exists, a prompt offers
  **Tiếp tục** (resume at saved chapter + position) or **Từ đầu** (restart the
  current chapter).
- **Suppressed on chapter pages for chapter-scoped sources** — being on a chapter
  page is an explicit request for that chapter, so it plays without prompting.
  Resume still applies to book-scoped sources and on the book overview page.

### Playback speed

- Options: `0.5, 0.75, 1, 1.25, 1.5, 2`×, chosen in the settings popover.
- Persisted globally in localStorage (`ap-speed`), applied to whichever backend
  is active.

### Sleep timer

- Options: 15 / 30 / 60 minutes, **Cuối chương** (stop at end of current
  chapter), or **Tắt** (off).
- Timed modes show a live countdown; on expiry playback pauses with brief
  on-title feedback.

### Progress bar & seeking

- Full-width Spotify-style bar at the top of the player; drag (mouse or touch)
  anywhere on it to seek. Current time / duration shown as `m:ss` (or `h:mm:ss`).

### Media Session API

- Publishes metadata (title, source as artist, album "Kinh Thánh") and wires
  lock-screen / hardware controls: play, pause, seek ±, and previous/next track
  (mapped to prev/next chapter when chapters exist). Position state is reported
  for scrubbing UIs.

### Close

- The × button pauses, clears any sleep timer, and hides the bar.

## Persistence (localStorage keys)

| Key | Scope | Value |
| --- | --- | --- |
| `ap-speed` | global | playback rate |
| `ap-source:<slug>` | per book | selected source index |
| `audio-resume:<slug>:<sourceIndex>` | per source | `{ chapter, position, timestamp }` |

## Layout & styling

- Fixed bar pinned to the bottom; `body.has-audio-player` adds bottom padding so
  content isn't obscured.
- Inner row capped at `max-width: 1100px`, centered. Columns: transport · info
  (title + source) · time · actions (chapter select, settings, close).
- The source `<select>` sizes to its content (`align-self: flex-start`,
  `max-width: 100%`) so it fits the label without stretching the full column or
  truncating when there's room.
- Mobile (≤600px): time display hidden, shorter bar height.

## Known limitations

- Playback does **not** continue across chapter page navigations — each chapter
  link is a full page load, and browsers block autoplay on navigation. Only the
  *selection* (source, speed) and resume position persist; the listener re-presses
  play. (Within a single page, end-of-chapter auto-advance does continue.)
- Resume is keyed per source, not unified across sources of the same book.
