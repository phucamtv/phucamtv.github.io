# Book Page Audio Player — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky-bottom audio player to Bible book pages that supports YouTube (video/playlist) and MP3 sources with per-chapter navigation, playback speed, resume, and sleep timer.

**Architecture:** Pure Hugo + vanilla JS. A Hugo partial renders the player HTML and serializes frontmatter audio data to JSON. A single JS file implements three playback backends (MP3, YouTube video, YouTube playlist) behind a unified controller. All state (speed, resume position) persists in localStorage.

**Tech Stack:** Hugo templates, vanilla JavaScript, CSS (Hugo pipes), YouTube IFrame API (lazy-loaded)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `assets/css/style.css` | Modify | Add audio player sticky bar styles at the end |
| `layouts/partials/audio-player.html` | Create | Player HTML structure, serialize audio data to `window.__audioData`, load JS |
| `assets/js/audio-player.js` | Create | All player logic: backends, controller, UI, localStorage, sleep timer |
| `layouts/kt/kt-book.html` | Modify | Include audio-player partial when audio data exists |
| `content/kt/nt01.md` | Modify | Add sample audio frontmatter for testing |

---

### Task 1: Audio Player CSS

**Files:**
- Modify: `assets/css/style.css` (append after line 1530, after the kt-single styles)

- [ ] **Step 1: Add audio player bar styles**

Append to `assets/css/style.css`:

```css
/* ===== Audio Player ===== */

.audio-player-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: linear-gradient(180deg, #f0ece3 0%, #e8e2d6 100%);
  border-top: 1px solid #d4c9b8;
  box-shadow: 0 -2px 12px rgba(61, 53, 41, 0.1);
  z-index: 1000;
  display: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 0.85rem;
}

.audio-player-bar.is-visible {
  display: flex;
  align-items: center;
}

.audio-player-inner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 1rem;
  width: 100%;
  height: 100%;
}

/* Transport controls: prev, play/pause, next */
.ap-transport {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.ap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: #3d3529;
  cursor: pointer;
  border-radius: 50%;
  transition: background 0.15s ease;
  padding: 0;
}

.ap-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.ap-btn svg {
  width: 20px;
  height: 20px;
}

.ap-btn-play {
  width: 40px;
  height: 40px;
  background: #3d3529;
  color: #f0ece3;
}

.ap-btn-play:hover {
  background: #5c5347;
}

.ap-btn-play svg {
  width: 22px;
  height: 22px;
}

.ap-btn-skip {
  display: none;
}

.audio-player-bar.has-chapters .ap-btn-skip {
  display: inline-flex;
}

/* Info area: title + source selector */
.ap-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex-shrink: 1;
  gap: 0.1rem;
}

.ap-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #3d3529;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ap-source-select {
  font-size: 0.75rem;
  color: #5c5347;
  background: none;
  border: 1px solid #d4c9b8;
  border-radius: 4px;
  padding: 0.1rem 0.3rem;
  cursor: pointer;
  max-width: 200px;
  font-family: inherit;
}

/* Progress bar */
.ap-progress-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.ap-progress-bar {
  flex: 1;
  height: 4px;
  background: #d4c9b8;
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  min-width: 60px;
}

.ap-progress-fill {
  height: 100%;
  background: #3d3529;
  border-radius: 2px;
  width: 0%;
  position: relative;
}

.ap-progress-fill::after {
  content: "";
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  background: #3d3529;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.ap-progress-bar:hover .ap-progress-fill::after {
  opacity: 1;
}

.ap-time {
  font-size: 0.72rem;
  color: #8a7f72;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* Right-side buttons: chapter dropdown, settings, close */
.ap-actions {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex-shrink: 0;
}

/* Chapter dropdown */
.ap-chapter-select {
  font-size: 0.75rem;
  color: #5c5347;
  background: none;
  border: 1px solid #d4c9b8;
  border-radius: 4px;
  padding: 0.15rem 0.3rem;
  cursor: pointer;
  display: none;
  font-family: inherit;
}

.audio-player-bar.has-chapters .ap-chapter-select {
  display: block;
}

/* Settings popover */
.ap-settings-popover {
  position: absolute;
  bottom: 72px;
  right: 1rem;
  background: #fff;
  border: 1px solid #d4c9b8;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(61, 53, 41, 0.15);
  padding: 1rem;
  display: none;
  min-width: 200px;
  z-index: 1001;
}

.ap-settings-popover.is-visible {
  display: block;
}

.ap-settings-group {
  margin-bottom: 0.75rem;
}

.ap-settings-group:last-child {
  margin-bottom: 0;
}

.ap-settings-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #8a7f72;
  margin-bottom: 0.4rem;
}

.ap-speed-options,
.ap-sleep-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.ap-speed-btn,
.ap-sleep-btn {
  font-size: 0.78rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid #d4c9b8;
  border-radius: 4px;
  background: none;
  color: #5c5347;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}

.ap-speed-btn:hover,
.ap-sleep-btn:hover {
  background: #f0ece3;
}

.ap-speed-btn.is-active,
.ap-sleep-btn.is-active {
  background: #3d3529;
  color: #f0ece3;
  border-color: #3d3529;
}

.ap-sleep-countdown {
  font-size: 0.72rem;
  color: #8a7f72;
  margin-top: 0.3rem;
  display: none;
}

.ap-sleep-countdown.is-visible {
  display: block;
}

/* Resume prompt */
.ap-resume-prompt {
  position: absolute;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  border: 1px solid #d4c9b8;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(61, 53, 41, 0.15);
  padding: 0.75rem 1rem;
  display: none;
  z-index: 1001;
  white-space: nowrap;
  font-size: 0.85rem;
  color: #3d3529;
}

.ap-resume-prompt.is-visible {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ap-resume-btn {
  font-size: 0.78rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid #d4c9b8;
  border-radius: 4px;
  background: none;
  color: #5c5347;
  cursor: pointer;
  font-family: inherit;
}

.ap-resume-btn--yes {
  background: #3d3529;
  color: #f0ece3;
  border-color: #3d3529;
}

/* Body padding when player is visible */
body.has-audio-player {
  padding-bottom: 72px;
}

/* Mobile adjustments */
@media (max-width: 600px) {
  .ap-info {
    display: none;
  }

  .ap-progress-wrap {
    flex: 1;
  }

  .audio-player-bar {
    height: 56px;
  }

  body.has-audio-player {
    padding-bottom: 64px;
  }
}
```

- [ ] **Step 2: Verify Hugo builds**

Run: `cd /workspace && hugo --quiet`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "feat(audio): add sticky player bar CSS styles"
```

---

### Task 2: Hugo Partial — Player HTML and Data Serialization

**Files:**
- Create: `layouts/partials/audio-player.html`

- [ ] **Step 1: Create the audio player partial**

Create `layouts/partials/audio-player.html`:

```html
{{/* Audio Player — only included when .Params.audio exists */}}
{{ $audioData := dict
  "slug" .Params.slug
  "title" .Title
  "audio" .Params.audio
}}
<script id="audio-data" type="application/json">{{ $audioData | jsonify }}</script>

<div class="audio-player-bar" id="audio-player">
  <div class="audio-player-inner">
    {{/* Transport: prev, play/pause, next */}}
    <div class="ap-transport">
      <button class="ap-btn ap-btn-skip" id="ap-prev" aria-label="Chương trước">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
      </button>
      <button class="ap-btn ap-btn-play" id="ap-play" aria-label="Phát">
        <svg viewBox="0 0 24 24" fill="currentColor" id="ap-icon-play"><polygon points="5,3 19,12 5,21"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor" id="ap-icon-pause" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
      </button>
      <button class="ap-btn ap-btn-skip" id="ap-next" aria-label="Chương kế">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
      </button>
    </div>

    {{/* Info: title + source selector */}}
    <div class="ap-info">
      <div class="ap-title" id="ap-title">{{ .Title }}</div>
      <select class="ap-source-select" id="ap-source"></select>
    </div>

    {{/* Progress bar */}}
    <div class="ap-progress-wrap">
      <span class="ap-time" id="ap-current-time">0:00</span>
      <div class="ap-progress-bar" id="ap-progress">
        <div class="ap-progress-fill" id="ap-progress-fill"></div>
      </div>
      <span class="ap-time" id="ap-duration">0:00</span>
    </div>

    {{/* Right actions */}}
    <div class="ap-actions">
      <select class="ap-chapter-select" id="ap-chapter"></select>
      <button class="ap-btn" id="ap-settings-btn" aria-label="Cài đặt">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
      <button class="ap-btn" id="ap-close" aria-label="Đóng">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  </div>

  {{/* Settings popover */}}
  <div class="ap-settings-popover" id="ap-settings">
    <div class="ap-settings-group">
      <div class="ap-settings-label">Tốc độ</div>
      <div class="ap-speed-options" id="ap-speed-options"></div>
    </div>
    <div class="ap-settings-group">
      <div class="ap-settings-label">Hẹn giờ tắt</div>
      <div class="ap-sleep-options" id="ap-sleep-options"></div>
      <div class="ap-sleep-countdown" id="ap-sleep-countdown"></div>
    </div>
  </div>

  {{/* Resume prompt */}}
  <div class="ap-resume-prompt" id="ap-resume">
    <span id="ap-resume-text"></span>
    <button class="ap-resume-btn ap-resume-btn--yes" id="ap-resume-yes">Tiếp tục</button>
    <button class="ap-resume-btn" id="ap-resume-no">Từ đầu</button>
  </div>
</div>

{{/* Hidden container for YouTube iframes */}}
<div id="ap-yt-container" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none"></div>

{{ $js := resources.Get "js/audio-player.js" | fingerprint }}
<script src="{{ $js.RelPermalink }}" defer></script>
```

- [ ] **Step 2: Verify Hugo builds**

Run: `cd /workspace && hugo --quiet`
Expected: May warn about missing `js/audio-player.js` — that's fine, we create it next.

- [ ] **Step 3: Commit**

```bash
git add layouts/partials/audio-player.html
git commit -m "feat(audio): add player HTML partial with data serialization"
```

---

### Task 3: Audio Player JavaScript — Core Engine

**Files:**
- Create: `assets/js/audio-player.js`

This is the largest task. The JS file is organized into sections: utilities, backends, controller, UI, and init.

- [ ] **Step 1: Create the audio player JS with all sections**

Create `assets/js/audio-player.js`:

```js
(function () {
  "use strict";

  // ── Utilities ──────────────────────────────────────────────

  var LANG_LABELS = { vi: "Tiếng Việt", en: "English" };
  var GENDER_LABELS = { male: "Nam", female: "Nữ" };
  var SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var SLEEP_OPTIONS = [
    { label: "15 phút", value: 15 },
    { label: "30 phút", value: 30 },
    { label: "60 phút", value: 60 },
    { label: "Cuối chương", value: "end-of-chapter" },
    { label: "Tắt", value: 0 },
  ];
  var RESUME_EXPIRY_DAYS = 30;
  var RESUME_SAVE_INTERVAL = 5000;

  function formatTime(sec) {
    if (!sec || !isFinite(sec)) return "0:00";
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function sourceLabel(entry) {
    var lang = LANG_LABELS[entry.lang] || entry.lang;
    var gender = GENDER_LABELS[entry.voiceGender] || entry.voiceGender;
    return entry.translation + " - " + lang + " - " + gender;
  }

  /** Resolve chapter URLs for an audio entry. Returns null for scope:book. */
  function resolveChapters(entry) {
    if (entry.scope !== "chapter") return null;
    if (entry.chapters) {
      // explicit map — keys may be strings from JSON
      var map = {};
      var keys = Object.keys(entry.chapters);
      for (var i = 0; i < keys.length; i++) {
        map[parseInt(keys[i], 10)] = entry.chapters[keys[i]];
      }
      return map;
    }
    if (entry.baseUrl && entry.pattern && entry.totalChapters) {
      var map = {};
      for (var ch = 1; ch <= entry.totalChapters; ch++) {
        map[ch] = entry.baseUrl + entry.pattern.replace("{chapter}", ch);
      }
      return map;
    }
    return null;
  }

  function chapterCount(chapters) {
    if (!chapters) return 0;
    return Object.keys(chapters).length;
  }

  // ── localStorage helpers ───────────────────────────────────

  function loadSpeed() {
    try {
      var v = parseFloat(localStorage.getItem("ap-speed"));
      return SPEED_OPTIONS.indexOf(v) !== -1 ? v : 1;
    } catch (e) {
      return 1;
    }
  }

  function saveSpeed(rate) {
    try { localStorage.setItem("ap-speed", rate); } catch (e) {}
  }

  function resumeKey(slug, idx) {
    return "audio-resume:" + slug + ":" + idx;
  }

  function loadResume(slug, idx) {
    try {
      var raw = localStorage.getItem(resumeKey(slug, idx));
      if (!raw) return null;
      var data = JSON.parse(raw);
      // expire after 30 days
      if (Date.now() - data.timestamp > RESUME_EXPIRY_DAYS * 86400000) {
        localStorage.removeItem(resumeKey(slug, idx));
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function saveResume(slug, idx, chapter, position) {
    try {
      localStorage.setItem(
        resumeKey(slug, idx),
        JSON.stringify({ chapter: chapter, position: position, timestamp: Date.now() })
      );
    } catch (e) {}
  }

  function cleanOldResumes() {
    try {
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("audio-resume:") === 0) {
          var raw = localStorage.getItem(k);
          try {
            var data = JSON.parse(raw);
            if (Date.now() - data.timestamp > RESUME_EXPIRY_DAYS * 86400000) {
              toRemove.push(k);
            }
          } catch (e) {
            toRemove.push(k);
          }
        }
      }
      for (var j = 0; j < toRemove.length; j++) {
        localStorage.removeItem(toRemove[j]);
      }
    } catch (e) {}
  }

  // ── MP3 Backend ────────────────────────────────────────────

  function MP3Backend() {
    this._audio = document.createElement("audio");
    this._audio.preload = "metadata";
    this._onTimeUpdate = null;
    this._onEnded = null;
    this._onLoaded = null;
    var self = this;
    this._audio.addEventListener("timeupdate", function () {
      if (self._onTimeUpdate) {
        self._onTimeUpdate(self._audio.currentTime, self._audio.duration);
      }
    });
    this._audio.addEventListener("ended", function () {
      if (self._onEnded) self._onEnded();
    });
    this._audio.addEventListener("loadedmetadata", function () {
      if (self._onLoaded) self._onLoaded(self._audio.duration);
    });
  }

  MP3Backend.prototype.load = function (url) {
    this._audio.src = url;
    this._audio.load();
  };

  MP3Backend.prototype.play = function () {
    return this._audio.play();
  };

  MP3Backend.prototype.pause = function () {
    this._audio.pause();
  };

  MP3Backend.prototype.seek = function (seconds) {
    this._audio.currentTime = seconds;
  };

  MP3Backend.prototype.setSpeed = function (rate) {
    this._audio.playbackRate = rate;
  };

  MP3Backend.prototype.getCurrentTime = function () {
    return this._audio.currentTime;
  };

  MP3Backend.prototype.getDuration = function () {
    return this._audio.duration;
  };

  MP3Backend.prototype.onTimeUpdate = function (cb) { this._onTimeUpdate = cb; };
  MP3Backend.prototype.onEnded = function (cb) { this._onEnded = cb; };
  MP3Backend.prototype.onLoaded = function (cb) { this._onLoaded = cb; };

  MP3Backend.prototype.destroy = function () {
    this._audio.pause();
    this._audio.removeAttribute("src");
    this._audio.load();
    this._onTimeUpdate = null;
    this._onEnded = null;
    this._onLoaded = null;
  };

  // ── YouTube Backend ────────────────────────────────────────

  var ytAPILoaded = false;
  var ytAPICallbacks = [];

  function ensureYTAPI(cb) {
    if (ytAPILoaded) { cb(); return; }
    ytAPICallbacks.push(cb);
    if (ytAPICallbacks.length > 1) return; // already loading
    var tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = function () {
      ytAPILoaded = true;
      for (var i = 0; i < ytAPICallbacks.length; i++) ytAPICallbacks[i]();
      ytAPICallbacks = [];
    };
  }

  function YouTubeBackend(containerEl) {
    this._container = containerEl;
    this._player = null;
    this._onTimeUpdate = null;
    this._onEnded = null;
    this._onLoaded = null;
    this._pollTimer = null;
    this._ready = false;
  }

  YouTubeBackend.prototype._createPlayer = function (opts) {
    var self = this;
    // create a div for this player
    var div = document.createElement("div");
    div.id = "ap-yt-player-" + Date.now();
    this._container.appendChild(div);

    this._player = new YT.Player(div.id, {
      width: "1",
      height: "1",
      playerVars: Object.assign({ autoplay: 0, controls: 0, disablekb: 1 }, opts.playerVars || {}),
      videoId: opts.videoId || undefined,
      events: {
        onReady: function () {
          self._ready = true;
          if (opts.listType) {
            // for playlists, duration comes after first video loads
          }
          if (self._onLoaded) {
            self._onLoaded(self._player.getDuration());
          }
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.ENDED) {
            if (self._onEnded) self._onEnded();
          }
          // update duration when a new video loads in a playlist
          if (e.data === YT.PlayerState.PLAYING && self._onLoaded) {
            self._onLoaded(self._player.getDuration());
          }
        },
      },
    });

    // poll for time updates (YT API has no native timeupdate event)
    this._pollTimer = setInterval(function () {
      if (self._ready && self._player && self._player.getCurrentTime && self._onTimeUpdate) {
        self._onTimeUpdate(self._player.getCurrentTime(), self._player.getDuration());
      }
    }, 250);
  };

  YouTubeBackend.prototype.loadVideo = function (videoId) {
    var self = this;
    ensureYTAPI(function () {
      self._createPlayer({ videoId: videoId });
    });
  };

  YouTubeBackend.prototype.loadPlaylist = function (playlistId) {
    var self = this;
    ensureYTAPI(function () {
      self._createPlayer({
        playerVars: { listType: "playlist", list: playlistId },
      });
    });
  };

  YouTubeBackend.prototype.play = function () {
    if (this._ready && this._player) this._player.playVideo();
  };

  YouTubeBackend.prototype.pause = function () {
    if (this._ready && this._player) this._player.pauseVideo();
  };

  YouTubeBackend.prototype.seek = function (seconds) {
    if (this._ready && this._player) this._player.seekTo(seconds, true);
  };

  YouTubeBackend.prototype.setSpeed = function (rate) {
    if (this._ready && this._player) this._player.setPlaybackRate(rate);
  };

  YouTubeBackend.prototype.setPlaylistIndex = function (index) {
    if (this._ready && this._player) this._player.playVideoAt(index);
  };

  YouTubeBackend.prototype.getCurrentTime = function () {
    return this._ready && this._player ? this._player.getCurrentTime() : 0;
  };

  YouTubeBackend.prototype.getDuration = function () {
    return this._ready && this._player ? this._player.getDuration() : 0;
  };

  YouTubeBackend.prototype.onTimeUpdate = function (cb) { this._onTimeUpdate = cb; };
  YouTubeBackend.prototype.onEnded = function (cb) { this._onEnded = cb; };
  YouTubeBackend.prototype.onLoaded = function (cb) { this._onLoaded = cb; };

  YouTubeBackend.prototype.destroy = function () {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._player && this._player.destroy) this._player.destroy();
    this._player = null;
    this._ready = false;
    this._onTimeUpdate = null;
    this._onEnded = null;
    this._onLoaded = null;
    // clean up container
    this._container.innerHTML = "";
  };

  // ── AudioPlayer Controller ────────────────────────────────

  function AudioPlayer(data) {
    this.slug = data.slug;
    this.bookTitle = data.title;
    this.entries = data.audio || [];
    this.currentIndex = 0;
    this.currentChapter = 1;
    this.chapters = null; // resolved chapter map for current entry
    this.backend = null;
    this.playing = false;
    this.speed = loadSpeed();
    this.sleepTimer = null;
    this.sleepMode = 0; // 0=off, number=minutes, "end-of-chapter"
    this.sleepEnd = 0;
    this._resumeSaveTimer = null;
    this._ui = null;
    this._ytContainer = document.getElementById("ap-yt-container");
  }

  AudioPlayer.prototype.currentEntry = function () {
    return this.entries[this.currentIndex];
  };

  AudioPlayer.prototype.load = function (index, chapter, seekTo) {
    if (this.backend) {
      this._stopResumeSave();
      this.backend.destroy();
      this.backend = null;
    }
    this.currentIndex = index;
    var entry = this.currentEntry();
    this.chapters = resolveChapters(entry);
    this.currentChapter = chapter || 1;
    this.playing = false;

    var self = this;
    var onTime = function (cur, dur) {
      if (self._ui) self._ui.updateProgress(cur, dur);
    };
    var onEnd = function () {
      self._handleTrackEnd();
    };
    var onLoaded = function (dur) {
      if (self._ui) self._ui.updateDuration(dur);
      if (seekTo) {
        self.seek(seekTo);
        seekTo = null;
      }
    };

    if (entry.type === "mp3") {
      this.backend = new MP3Backend();
      this.backend.onTimeUpdate(onTime);
      this.backend.onEnded(onEnd);
      this.backend.onLoaded(onLoaded);

      var url;
      if (entry.scope === "book") {
        url = entry.url;
      } else {
        url = this.chapters[this.currentChapter];
      }
      this.backend.load(url);
      this.backend.setSpeed(this.speed);
    } else if (entry.type === "youtube-video") {
      this.backend = new YouTubeBackend(this._ytContainer);
      this.backend.onTimeUpdate(onTime);
      this.backend.onEnded(onEnd);
      this.backend.onLoaded(onLoaded);
      this.backend.loadVideo(entry.id);
    } else if (entry.type === "youtube-playlist") {
      this.backend = new YouTubeBackend(this._ytContainer);
      this.backend.onTimeUpdate(onTime);
      this.backend.onEnded(onEnd);
      this.backend.onLoaded(onLoaded);
      this.backend.loadPlaylist(entry.id);
    }

    if (this._ui) {
      this._ui.updateTrackInfo(this);
    }
  };

  AudioPlayer.prototype.play = function () {
    if (!this.backend) return;
    this.backend.play();
    this.playing = true;
    this._startResumeSave();
    if (this._ui) this._ui.updatePlayState(true);
  };

  AudioPlayer.prototype.pause = function () {
    if (!this.backend) return;
    this.backend.pause();
    this.playing = false;
    this._stopResumeSave();
    this._saveResumeNow();
    if (this._ui) this._ui.updatePlayState(false);
  };

  AudioPlayer.prototype.togglePlay = function () {
    if (this.playing) this.pause();
    else this.play();
  };

  AudioPlayer.prototype.seek = function (seconds) {
    if (this.backend) this.backend.seek(seconds);
  };

  AudioPlayer.prototype.setSpeed = function (rate) {
    this.speed = rate;
    saveSpeed(rate);
    if (this.backend) this.backend.setSpeed(rate);
    if (this._ui) this._ui.updateSpeed(rate);
  };

  AudioPlayer.prototype.setChapter = function (ch) {
    if (!this.chapters || !this.chapters[ch]) return;
    var wasPlaying = this.playing;
    this.currentChapter = ch;
    var entry = this.currentEntry();

    if (entry.type === "youtube-playlist" && this.backend) {
      // playlist: jump to index (0-based)
      this.backend.setPlaylistIndex(ch - 1);
      this.playing = true;
    } else if (entry.type === "mp3" && entry.scope === "chapter") {
      this.backend.destroy();
      var self = this;
      var newBackend = new MP3Backend();
      this.backend = newBackend;
      newBackend.onTimeUpdate(function (cur, dur) {
        if (self._ui) self._ui.updateProgress(cur, dur);
      });
      newBackend.onEnded(function () { self._handleTrackEnd(); });
      newBackend.onLoaded(function (dur) {
        if (self._ui) self._ui.updateDuration(dur);
      });
      newBackend.load(this.chapters[ch]);
      newBackend.setSpeed(this.speed);
      if (wasPlaying) {
        newBackend.play();
        this.playing = true;
      }
    }

    if (this._ui) this._ui.updateTrackInfo(this);
  };

  AudioPlayer.prototype.nextChapter = function () {
    if (!this.chapters) return;
    var next = this.currentChapter + 1;
    if (this.chapters[next]) this.setChapter(next);
  };

  AudioPlayer.prototype.prevChapter = function () {
    if (!this.chapters) return;
    var prev = this.currentChapter - 1;
    if (prev >= 1 && this.chapters[prev]) this.setChapter(prev);
  };

  AudioPlayer.prototype._handleTrackEnd = function () {
    // sleep timer: end-of-chapter mode
    if (this.sleepMode === "end-of-chapter") {
      this.pause();
      this.clearSleep();
      if (this._ui) this._ui.showSleepNotification();
      return;
    }

    // auto-advance to next chapter
    if (this.chapters) {
      var next = this.currentChapter + 1;
      if (this.chapters[next]) {
        this.setChapter(next);
        this.play();
        return;
      }
    }
    // end of content
    this.pause();
  };

  AudioPlayer.prototype.setSleep = function (mode) {
    this.clearSleep();
    this.sleepMode = mode;
    if (typeof mode === "number" && mode > 0) {
      this.sleepEnd = Date.now() + mode * 60000;
      var self = this;
      this.sleepTimer = setInterval(function () {
        var remaining = self.sleepEnd - Date.now();
        if (remaining <= 0) {
          self.pause();
          self.clearSleep();
          if (self._ui) self._ui.showSleepNotification();
        } else if (self._ui) {
          self._ui.updateSleepCountdown(remaining);
        }
      }, 1000);
    }
    if (this._ui) this._ui.updateSleepMode(mode);
  };

  AudioPlayer.prototype.clearSleep = function () {
    if (this.sleepTimer) clearInterval(this.sleepTimer);
    this.sleepTimer = null;
    this.sleepMode = 0;
    this.sleepEnd = 0;
    if (this._ui) this._ui.updateSleepMode(0);
  };

  AudioPlayer.prototype._startResumeSave = function () {
    var self = this;
    this._resumeSaveTimer = setInterval(function () {
      self._saveResumeNow();
    }, RESUME_SAVE_INTERVAL);
  };

  AudioPlayer.prototype._stopResumeSave = function () {
    if (this._resumeSaveTimer) clearInterval(this._resumeSaveTimer);
    this._resumeSaveTimer = null;
  };

  AudioPlayer.prototype._saveResumeNow = function () {
    if (!this.backend) return;
    var pos = this.backend.getCurrentTime();
    if (pos > 0) {
      saveResume(this.slug, this.currentIndex, this.currentChapter, pos);
    }
  };

  AudioPlayer.prototype.destroy = function () {
    this._stopResumeSave();
    this.clearSleep();
    if (this.backend) this.backend.destroy();
  };

  // ── UI Manager ─────────────────────────────────────────────

  function PlayerUI(player) {
    this.player = player;
    this.bar = document.getElementById("audio-player");
    this.playBtn = document.getElementById("ap-play");
    this.iconPlay = document.getElementById("ap-icon-play");
    this.iconPause = document.getElementById("ap-icon-pause");
    this.prevBtn = document.getElementById("ap-prev");
    this.nextBtn = document.getElementById("ap-next");
    this.titleEl = document.getElementById("ap-title");
    this.sourceSelect = document.getElementById("ap-source");
    this.chapterSelect = document.getElementById("ap-chapter");
    this.progressBar = document.getElementById("ap-progress");
    this.progressFill = document.getElementById("ap-progress-fill");
    this.currentTimeEl = document.getElementById("ap-current-time");
    this.durationEl = document.getElementById("ap-duration");
    this.settingsBtn = document.getElementById("ap-settings-btn");
    this.settingsPopover = document.getElementById("ap-settings");
    this.closeBtn = document.getElementById("ap-close");
    this.speedContainer = document.getElementById("ap-speed-options");
    this.sleepContainer = document.getElementById("ap-sleep-options");
    this.sleepCountdown = document.getElementById("ap-sleep-countdown");
    this.resumePrompt = document.getElementById("ap-resume");
    this.resumeText = document.getElementById("ap-resume-text");
    this.resumeYes = document.getElementById("ap-resume-yes");
    this.resumeNo = document.getElementById("ap-resume-no");
    this._duration = 0;

    this._initSourceDropdown();
    this._initSpeedButtons();
    this._initSleepButtons();
    this._bindEvents();
  }

  PlayerUI.prototype._initSourceDropdown = function () {
    var entries = this.player.entries;
    this.sourceSelect.innerHTML = "";
    for (var i = 0; i < entries.length; i++) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = sourceLabel(entries[i]);
      this.sourceSelect.appendChild(opt);
    }
  };

  PlayerUI.prototype._initSpeedButtons = function () {
    this.speedContainer.innerHTML = "";
    var self = this;
    for (var i = 0; i < SPEED_OPTIONS.length; i++) {
      (function (rate) {
        var btn = document.createElement("button");
        btn.className = "ap-speed-btn" + (rate === self.player.speed ? " is-active" : "");
        btn.textContent = rate + "x";
        btn.setAttribute("data-speed", rate);
        btn.addEventListener("click", function () {
          self.player.setSpeed(rate);
        });
        self.speedContainer.appendChild(btn);
      })(SPEED_OPTIONS[i]);
    }
  };

  PlayerUI.prototype._initSleepButtons = function () {
    this.sleepContainer.innerHTML = "";
    var self = this;
    for (var i = 0; i < SLEEP_OPTIONS.length; i++) {
      (function (opt) {
        var btn = document.createElement("button");
        btn.className = "ap-sleep-btn" + (opt.value === 0 ? " is-active" : "");
        btn.textContent = opt.label;
        btn.setAttribute("data-sleep", opt.value);
        btn.addEventListener("click", function () {
          self.player.setSleep(opt.value);
        });
        self.sleepContainer.appendChild(btn);
      })(SLEEP_OPTIONS[i]);
    }
  };

  PlayerUI.prototype._bindEvents = function () {
    var self = this;

    this.playBtn.addEventListener("click", function () {
      if (!self.player.backend) {
        // first play — load first source
        self._loadAndPlay(0);
      } else {
        self.player.togglePlay();
      }
    });

    this.prevBtn.addEventListener("click", function () { self.player.prevChapter(); });
    this.nextBtn.addEventListener("click", function () { self.player.nextChapter(); });

    this.sourceSelect.addEventListener("change", function () {
      self._loadAndPlay(parseInt(self.sourceSelect.value, 10));
    });

    this.chapterSelect.addEventListener("change", function () {
      self.player.setChapter(parseInt(self.chapterSelect.value, 10));
      if (!self.player.playing) self.player.play();
    });

    this.progressBar.addEventListener("click", function (e) {
      if (!self._duration) return;
      var rect = self.progressBar.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      self.player.seek(pct * self._duration);
    });

    this.settingsBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      self.settingsPopover.classList.toggle("is-visible");
    });

    // close popover when clicking outside
    document.addEventListener("click", function (e) {
      if (!self.settingsPopover.contains(e.target) && e.target !== self.settingsBtn) {
        self.settingsPopover.classList.remove("is-visible");
      }
    });

    this.closeBtn.addEventListener("click", function () {
      self.player.pause();
      self.bar.classList.remove("is-visible");
      document.body.classList.remove("has-audio-player");
    });

    this.resumeYes.addEventListener("click", function () {
      self.resumePrompt.classList.remove("is-visible");
      self._pendingResume && self._pendingResume(true);
    });

    this.resumeNo.addEventListener("click", function () {
      self.resumePrompt.classList.remove("is-visible");
      self._pendingResume && self._pendingResume(false);
    });
  };

  PlayerUI.prototype._loadAndPlay = function (index) {
    var self = this;
    var resumeData = loadResume(this.player.slug, index);
    if (resumeData && resumeData.position > 10) {
      // ask to resume
      var chLabel = resumeData.chapter > 0 ? "Chương " + resumeData.chapter + ", " : "";
      this.resumeText.textContent = "Tiếp tục từ " + chLabel + formatTime(resumeData.position) + "?";
      this.resumePrompt.classList.add("is-visible");
      this._pendingResume = function (yes) {
        if (yes) {
          self.player.load(index, resumeData.chapter, resumeData.position);
        } else {
          self.player.load(index);
        }
        self.show();
        self.player.play();
      };
    } else {
      this.player.load(index);
      this.show();
      this.player.play();
    }
  };

  PlayerUI.prototype.show = function () {
    this.bar.classList.add("is-visible");
    document.body.classList.add("has-audio-player");
  };

  PlayerUI.prototype.updateProgress = function (current, duration) {
    this._duration = duration;
    var pct = duration > 0 ? (current / duration) * 100 : 0;
    this.progressFill.style.width = pct + "%";
    this.currentTimeEl.textContent = formatTime(current);
  };

  PlayerUI.prototype.updateDuration = function (duration) {
    this._duration = duration;
    this.durationEl.textContent = formatTime(duration);
  };

  PlayerUI.prototype.updatePlayState = function (isPlaying) {
    this.iconPlay.style.display = isPlaying ? "none" : "";
    this.iconPause.style.display = isPlaying ? "" : "none";
    this.playBtn.setAttribute("aria-label", isPlaying ? "Tạm dừng" : "Phát");
  };

  PlayerUI.prototype.updateTrackInfo = function (player) {
    var entry = player.currentEntry();
    var title = player.bookTitle;
    if (entry.scope === "chapter") {
      title += " - Chương " + player.currentChapter;
    }
    this.titleEl.textContent = title;
    this.sourceSelect.value = player.currentIndex;

    // update chapter dropdown
    var hasChapters = !!player.chapters;
    this.bar.classList.toggle("has-chapters", hasChapters);
    if (hasChapters) {
      this.chapterSelect.innerHTML = "";
      var keys = Object.keys(player.chapters).map(Number).sort(function (a, b) { return a - b; });
      for (var i = 0; i < keys.length; i++) {
        var opt = document.createElement("option");
        opt.value = keys[i];
        opt.textContent = "Chương " + keys[i];
        if (keys[i] === player.currentChapter) opt.selected = true;
        this.chapterSelect.appendChild(opt);
      }
    }
  };

  PlayerUI.prototype.updateSpeed = function (rate) {
    var btns = this.speedContainer.querySelectorAll(".ap-speed-btn");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-active", parseFloat(btns[i].getAttribute("data-speed")) === rate);
    }
  };

  PlayerUI.prototype.updateSleepMode = function (mode) {
    var btns = this.sleepContainer.querySelectorAll(".ap-sleep-btn");
    for (var i = 0; i < btns.length; i++) {
      var val = btns[i].getAttribute("data-sleep");
      var match = (val === String(mode)) || (mode === 0 && val === "0");
      btns[i].classList.toggle("is-active", match);
    }
    if (!mode || mode === 0) {
      this.sleepCountdown.classList.remove("is-visible");
    }
  };

  PlayerUI.prototype.updateSleepCountdown = function (remainingMs) {
    this.sleepCountdown.textContent = formatTime(remainingMs / 1000) + " còn lại";
    this.sleepCountdown.classList.add("is-visible");
  };

  PlayerUI.prototype.showSleepNotification = function () {
    // brief visual feedback — flash the title
    var self = this;
    var orig = this.titleEl.textContent;
    this.titleEl.textContent = "Đã tạm dừng (hẹn giờ)";
    setTimeout(function () {
      self.titleEl.textContent = orig;
    }, 3000);
  };

  // ── Init ───────────────────────────────────────────────────

  function init() {
    var dataEl = document.getElementById("audio-data");
    if (!dataEl) return;

    var data;
    try {
      data = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }

    if (!data.audio || data.audio.length === 0) return;

    cleanOldResumes();

    var player = new AudioPlayer(data);
    var ui = new PlayerUI(player);
    player._ui = ui;

    // Show bar in "ready" state — no backend loaded yet.
    // Backend is created on first play click (respects autoplay policy,
    // avoids eager YouTube API load).
    ui.show();
    ui.updatePlayState(false);
    // Set initial title without loading a backend
    player.chapters = resolveChapters(player.entries[0]);
    ui.updateTrackInfo(player);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Verify Hugo builds**

Run: `cd /workspace && hugo --quiet`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add assets/js/audio-player.js
git commit -m "feat(audio): add player JS — backends, controller, UI, and enhanced features"
```

---

### Task 4: Wire Partial Into Book Template

**Files:**
- Modify: `layouts/kt/kt-book.html`

- [ ] **Step 1: Add partial include**

Modify `layouts/kt/kt-book.html` to include the audio player partial after the article:

```html
{{ define "main" }}
<article class="kt-single">
  <div class="breadcrumb">
    <a href="/kt/">Kinh Thánh</a>
    <span class="breadcrumb-sep">›</span>
    {{ if eq .Params.testament "old" }}Cựu Ước{{ else }}Tân Ước{{ end }}
    <span class="breadcrumb-sep">›</span>
    {{ .Params.group }}
  </div>
  <h1>{{ .Title }} <span class="kt-single-en">{{ .Params.titleEn }}</span></h1>
  <p class="kt-single-short">{{ .Description }}</p>
  <div class="kt-single-body content">
    {{ .Content }}
  </div>
</article>
{{ if .Params.audio }}
  {{ partial "audio-player.html" . }}
{{ end }}
{{ end }}
```

- [ ] **Step 2: Verify Hugo builds**

Run: `cd /workspace && hugo --quiet`
Expected: Build succeeds. Pages without `audio` frontmatter are unaffected.

- [ ] **Step 3: Commit**

```bash
git add layouts/kt/kt-book.html
git commit -m "feat(audio): wire player partial into book template"
```

---

### Task 5: Add Sample Audio Data and Test

**Files:**
- Modify: `content/kt/nt01.md` (Matthew — add sample audio frontmatter for testing)

- [ ] **Step 1: Add sample audio frontmatter to Matthew**

Update the frontmatter in `content/kt/nt01.md` to include test audio entries:

```yaml
---
title: "Ma-thi-ơ"
titleEn: "Matthew"
slug: "nt01"
layout: kt-book
testament: new
group: "Các Sách Tin Lành"
groupEn: "Gospels"
weight: 40
description: "Tin Lành về Đức Chúa Giê-su là Vua của dân Do Thái."
audio:
  - type: youtube-playlist
    id: PLw6g1eaPSXUGX6ZZuGSbXkUYvfFoT3_w0
    lang: vi
    translation: VN1925
    voiceGender: male
    scope: book
  - type: youtube-video
    id: dQw4w9WgXcQ
    lang: en
    translation: KJV
    voiceGender: male
    scope: book
---
```

Note: Use a real YouTube playlist ID if available. The above IDs are placeholders for testing the UI flow.

- [ ] **Step 2: Start Hugo dev server and test in browser**

Run: `cd /workspace && hugo server -D`

Open `http://localhost:1313/kt/nt01/` in a browser and verify:
1. The sticky bar appears at the bottom
2. Source dropdown shows both entries
3. Play button triggers playback
4. Progress bar updates
5. Settings popover opens with speed and sleep timer options
6. Close button hides the bar
7. Switching source in dropdown loads the other entry

- [ ] **Step 3: Commit**

```bash
git add content/kt/nt01.md
git commit -m "feat(audio): add sample audio data to Matthew for testing"
```

---

### Task 6: Polish and Edge Cases

**Files:**
- Modify: `assets/js/audio-player.js`

- [ ] **Step 1: Test and fix edge cases**

After browser testing, address any issues found. Common things to check:

- YouTube IFrame API loading race conditions (API may take a moment to load)
- Progress bar seek on YouTube (seekTo may not work until video is playing)
- Speed persistence across page reloads
- Resume prompt appears correctly when revisiting a partially-listened track
- Sleep timer countdown displays and pauses correctly
- Mobile layout: info section hides, bar height adjusts
- Page scrolls correctly with bottom padding

- [ ] **Step 2: Verify no CSS regressions on other pages**

Open the homepage, an article page, and the /kt/ index in the browser. Verify no visual regressions from the CSS additions.

- [ ] **Step 3: Commit any fixes**

```bash
git add assets/js/audio-player.js assets/css/style.css
git commit -m "fix(audio): address edge cases from browser testing"
```
