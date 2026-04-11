# Book Page Audio Player — Design Spec

## Overview

Add an audio player to the 66 Bible book pages (`/content/kt/*.md`) on phucam.tv. The player supports multiple audio sources per book (YouTube video, YouTube playlist, MP3 single, MP3 playlist), with per-chapter or whole-book scope. It renders as a sticky bottom bar with a dropdown selector, enhanced playback features, and localStorage persistence.

## Data Model (Frontmatter)

Each book's `.md` file gets an optional `audio` array. Each entry:

```yaml
audio:
  # Whole-book YouTube playlist
  - type: youtube-playlist
    id: PLw6g1eaPSXUGX6ZZu
    lang: vi
    translation: VN1925
    voiceGender: male
    scope: book

  # Single YouTube video
  - type: youtube-video
    id: dQw4w9WgXcQ
    lang: en
    translation: KJV
    voiceGender: female
    scope: book

  # Per-chapter MP3s — convention-based pattern
  - type: mp3
    lang: vi
    translation: VN1925
    voiceGender: male
    scope: chapter
    baseUrl: /audio/mat/
    pattern: "ch{chapter}.mp3"
    totalChapters: 28

  # Per-chapter MP3s — explicit chapter map
  - type: mp3
    lang: en
    translation: KJV
    voiceGender: female
    scope: chapter
    chapters:
      1: https://example.com/matt-ch1.mp3
      2: https://example.com/matt-ch2.mp3

  # Single MP3 (whole book)
  - type: mp3
    url: /audio/mat/full.mp3
    lang: vi
    translation: VN1925
    voiceGender: female
    scope: book
```

### Field Reference

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `type` | yes | `youtube-video`, `youtube-playlist`, `mp3` | Source type |
| `lang` | yes | ISO 639-1 code (`vi`, `en`, etc.) | Language |
| `translation` | yes | string (`VN1925`, `KJV`, `NKJV`, etc.) | Bible translation name |
| `voiceGender` | yes | `male`, `female` | Voice gender |
| `scope` | yes | `book`, `chapter` | Whether source covers whole book or per-chapter |
| `id` | for youtube types | string | YouTube video or playlist ID |
| `url` | for mp3 scope:book | string | URL to single MP3 file |
| `baseUrl` | for mp3 scope:chapter (pattern) | string | Base URL for chapter files |
| `pattern` | for mp3 scope:chapter (pattern) | string | Filename pattern with `{chapter}` placeholder |
| `totalChapters` | for mp3 scope:chapter (pattern) | number | Total chapter count |
| `chapters` | for mp3 scope:chapter (explicit) | map[int]string | Chapter number → URL mapping |

### Chapter Resolution Logic

1. If `chapters` map exists → use explicit URLs
2. If `baseUrl` + `pattern` + `totalChapters` → generate URLs from pattern
3. If `scope: book` → single source, no chapter nav needed

## Player UI

### Layout

Sticky bottom bar, fixed to viewport bottom. Only appears on book pages with `audio` in frontmatter. Hidden by default — appears on first play action.

```
┌─────────────────────────────────────────────────────────────────┐
│ [▶]  Title area              ──●────── 3:42/12:05  [🔽][⚙][×] │
│      "VN1925 - Tiếng Việt ▾"                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Components

- **Play/Pause button** — left side
- **Title area** — current track info (e.g., "Ma-thi-ơ - Chương 3"). Below: dropdown selector for audio source
- **Progress bar** — seekable, shows current time / total duration
- **Chapter nav** `[🔽]` — dropdown to jump to chapter (hidden for `scope: book` single track)
- **Prev/Next chapter buttons** — flanking play button, visible only for `scope: chapter`
- **Settings** `[⚙]` — popover with playback speed and sleep timer
- **Close** `[×]` — dismisses the player

### Dropdown Selector Format

`"{translation} - {language} - {voiceGender}"`

Example: "VN1925 - Tiếng Việt - Nam"

### Bar Dimensions

- Height: ~60px
- Content area gets matching bottom padding when audio exists to prevent overlap

## Player Engine

### Architecture

Three playback backends behind a unified controller interface.

#### MP3 Backend
- Native `<audio>` element, hidden
- Handles single files and per-chapter files
- Direct control: play, pause, seek, speed, time events

#### YouTube Video Backend
- YouTube IFrame API, iframe hidden (`width:0, height:0`)
- Loads single video by `id`
- Audio-only presentation
- Controls: `playVideo()`, `pauseVideo()`, `seekTo()`, `setPlaybackRate()`

#### YouTube Playlist Backend
- IFrame API with `listType: 'playlist', list: id`
- Chapter nav maps to `playVideoAt(index)`
- Auto-advances to next video

#### Unified Controller Interface

```
AudioPlayer
  ├── .load(audioEntry)     → picks backend, loads source
  ├── .play() / .pause()
  ├── .seek(seconds)
  ├── .setSpeed(rate)
  ├── .setChapter(n)        → for chapter-scoped sources
  ├── .onTimeUpdate(cb)     → progress updates
  ├── .onTrackEnd(cb)       → auto-advance or stop
  └── .destroy()            → cleanup
```

The UI never talks to YouTube or `<audio>` directly — always through the controller.

**Source switching:** dropdown selection → `.destroy()` current backend → `.load()` new entry.

## Enhanced Features

### Playback Speed
- Options: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×
- Persisted in `localStorage` across sessions
- Applied to both MP3 (`audio.playbackRate`) and YouTube (`setPlaybackRate()`)

### Resume Playback
- localStorage key: `audio-resume:{bookSlug}:{audioEntryIndex}`
- Stores: `{ chapter, position, timestamp }`
- On load with existing resume point: prompt "Tiếp tục từ Chương 3, 3:42?" (Yes/No)
- Auto-saved every 5 seconds during playback
- Entries older than 30 days auto-cleaned on page load

### Sleep Timer
- Options: 15min, 30min, 60min, end of chapter, off
- Countdown displayed in settings popover when active
- On expiry: pause playback, show brief notification
- "End of chapter" — listens for `onTrackEnd`, pauses instead of auto-advancing

## Hugo Integration

### Template Changes

**`layouts/kt/kt-book.html`:**
```html
{{ if .Params.audio }}
  {{ partial "audio-player.html" . }}
{{ end }}
```

Adds bottom padding to content area when audio exists.

### New Files

| File | Purpose |
|------|---------|
| `layouts/partials/audio-player.html` | Sticky bar HTML, serializes frontmatter to `window.__audioData` JSON |
| `static/js/audio-player.js` | Player controller, backends, UI logic, localStorage, sleep timer |
| `static/css/audio-player.css` | Sticky bar styles |

### Data Flow

```
Frontmatter (YAML)
  → Hugo partial serializes to JSON
    → window.__audioData (includes book slug, title, audio array)
      → AudioPlayer.init() reads data
        → Populates dropdown
        → Loads source on user interaction
```

### YouTube IFrame API Loading

- Loaded lazily — only when user selects a YouTube source
- Script tag injected dynamically
- `onYouTubeIframeAPIReady` callback wires up the backend

### Autoplay Policy

No play-on-page-load. Audio starts only on explicit user action.
