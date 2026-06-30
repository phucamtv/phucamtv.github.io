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
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    if (h > 0) return h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function sourceLabel(entry) {
    var lang = LANG_LABELS[entry.lang] || entry.lang;
    var gender = GENDER_LABELS[entry.voiceGender] || entry.voiceGender;
    return entry.translation + " - " + lang + " - " + gender;
  }

  // Disambiguating suffix, only used when a book has multiple sources.
  function scopeSuffix(entry) {
    return entry.scope === "chapter" ? " (theo chương)" : " (trọn sách)";
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

  function sourceKey(slug) {
    return "ap-source:" + slug;
  }

  // Returns the stored index, or null when nothing valid is stored.
  function loadSourceIndex(slug, count) {
    try {
      var raw = localStorage.getItem(sourceKey(slug));
      if (raw === null) return null;
      var v = parseInt(raw, 10);
      return (v >= 0 && v < count) ? v : null;
    } catch (e) {
      return null;
    }
  }

  function firstScopeIndex(entries, scope) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].scope === scope) return i;
    }
    return -1;
  }

  function saveSourceIndex(slug, idx) {
    try { localStorage.setItem(sourceKey(slug), idx); } catch (e) {}
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
    this._pendingPlay = false;
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
      playerVars: (function() {
        var pv = { autoplay: 0, controls: 0, disablekb: 1 };
        var extra = opts.playerVars || {};
        for (var k in extra) { if (extra.hasOwnProperty(k)) pv[k] = extra[k]; }
        return pv;
      })(),
      videoId: opts.videoId || undefined,
      events: {
        onReady: function () {
          self._ready = true;
          if (self._pendingPlay) {
            self._pendingPlay = false;
            self._player.playVideo();
          }
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
    if (this._ready && this._player) {
      this._player.playVideo();
    } else {
      this._pendingPlay = true;
    }
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
    this.currentChapter = data.initialChapter || 1;
    this.isChapterPage = !!data.isChapterPage;
    // An explicit prior choice wins; otherwise chapter pages prefer a
    // chapter-scoped source, falling back to the first entry.
    var stored = loadSourceIndex(this.slug, this.entries.length);
    if (stored !== null) {
      this.currentIndex = stored;
    } else if (this.isChapterPage) {
      var ci = firstScopeIndex(this.entries, "chapter");
      this.currentIndex = ci >= 0 ? ci : 0;
    } else {
      this.currentIndex = 0;
    }
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
      self._updateMediaSessionPosition(cur, dur);
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
    this._updateMediaSession();
    this._setMediaSessionState("playing");
  };

  AudioPlayer.prototype.pause = function () {
    if (!this.backend) return;
    this.backend.pause();
    this.playing = false;
    this._stopResumeSave();
    this._saveResumeNow();
    if (this._ui) this._ui.updatePlayState(false);
    this._setMediaSessionState("paused");
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
    if (this.backend) {
      this._updateMediaSessionPosition(this.backend.getCurrentTime(), this.backend.getDuration());
    }
  };

  AudioPlayer.prototype.setChapter = function (ch) {
    if (!this.chapters || !this.chapters[ch]) return;
    var wasPlaying = this.playing;
    this.currentChapter = ch;
    var entry = this.currentEntry();

    if (entry.type === "youtube-playlist" && this.backend) {
      // playlist: jump to index (0-based)
      // Assumes playlist videos are in chapter order (1-based chapter → 0-based index)
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
    this._updateMediaSession();
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
    this._stopResumeSave();
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

  // ── Media Session API (lock screen controls, background playback) ──

  AudioPlayer.prototype._updateMediaSession = function () {
    if (!("mediaSession" in navigator)) return;
    var entry = this.currentEntry();
    var title = this.bookTitle;
    if (entry.scope === "chapter") title += " - Chương " + this.currentChapter;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: sourceLabel(entry),
      album: "Kinh Thánh",
    });
    var self = this;
    navigator.mediaSession.setActionHandler("play", function () { self.play(); });
    navigator.mediaSession.setActionHandler("pause", function () { self.pause(); });
    navigator.mediaSession.setActionHandler("seekbackward", function () {
      var t = self.backend.getCurrentTime();
      self.seek(Math.max(0, t - 10));
    });
    navigator.mediaSession.setActionHandler("seekforward", function () {
      var t = self.backend.getCurrentTime();
      self.seek(t + 30);
    });
    try {
      navigator.mediaSession.setActionHandler("previoustrack", self.chapters ? function () { self.prevChapter(); } : null);
      navigator.mediaSession.setActionHandler("nexttrack", self.chapters ? function () { self.nextChapter(); } : null);
    } catch (e) { /* unsupported */ }
  };

  AudioPlayer.prototype._setMediaSessionState = function (state) {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = state;
  };

  AudioPlayer.prototype._updateMediaSessionPosition = function (position, duration) {
    if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
    if (duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: this.speed,
          position: Math.min(position, duration),
        });
      } catch (e) { /* invalid state */ }
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
    this.progressWrap = this.progressBar.parentElement;
    this.currentTimeEl = document.getElementById("ap-current-time");
    this.durationEl = document.getElementById("ap-duration");
    this.settingsBtn = document.getElementById("ap-settings-btn");
    this.settingsPopover = document.getElementById("ap-settings");
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
    if (entries.length <= 1) {
      this.sourceSelect.style.display = "none";
      var span = document.createElement("span");
      span.className = "ap-source-label";
      span.textContent = sourceLabel(entries[0]);
      this.sourceSelect.parentNode.appendChild(span);
      return;
    }
    for (var i = 0; i < entries.length; i++) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = sourceLabel(entries[i]) + scopeSuffix(entries[i]);
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
        // first play — load the (possibly restored) selected source
        self._loadAndPlay(self.player.currentIndex);
      } else {
        self.player.togglePlay();
      }
    });

    this.prevBtn.addEventListener("click", function () { self.player.prevChapter(); });
    this.nextBtn.addEventListener("click", function () { self.player.nextChapter(); });

    this.sourceSelect.addEventListener("change", function () {
      var idx = parseInt(self.sourceSelect.value, 10);
      saveSourceIndex(self.player.slug, idx);
      self._loadAndPlay(idx);
    });

    this.chapterSelect.addEventListener("change", function () {
      self.player.setChapter(parseInt(self.chapterSelect.value, 10));
      if (!self.player.playing) self.player.play();
    });

    // Drag-to-seek on full-width progress bar
    var dragging = false;
    function seekFromEvent(e) {
      var touch = e.touches ? e.touches[0] : e;
      var rect = self.progressBar.getBoundingClientRect();
      var pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      self.player.seek(pct * self._duration);
    }
    self.progressWrap.addEventListener("mousedown", function (e) {
      if (!self._duration) return;
      dragging = true;
      seekFromEvent(e);
    });
    document.addEventListener("mousemove", function (e) {
      if (dragging && self._duration) seekFromEvent(e);
    });
    document.addEventListener("mouseup", function () { dragging = false; });
    self.progressWrap.addEventListener("touchstart", function (e) {
      if (!self._duration) return;
      dragging = true;
      seekFromEvent(e);
    }, { passive: true });
    self.progressWrap.addEventListener("touchmove", function (e) {
      if (dragging && self._duration) seekFromEvent(e);
    }, { passive: true });
    self.progressWrap.addEventListener("touchend", function () { dragging = false; });

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
    // On a chapter page the user explicitly wants this chapter — skip the
    // resume prompt for chapter-scoped sources.
    var skipResume = this.player.isChapterPage && this.player.entries[index].scope === "chapter";
    var resumeData = skipResume ? null : loadResume(this.player.slug, index);
    if (resumeData && resumeData.position > 10) {
      // ask to resume
      var chLabel = resumeData.chapter > 0 ? "Chương " + resumeData.chapter + ", " : "";
      this.resumeText.textContent = "Tiếp tục từ " + chLabel + formatTime(resumeData.position) + "?";
      this.resumePrompt.classList.add("is-visible");
      this._pendingResume = function (yes) {
        if (yes) {
          self.player.load(index, resumeData.chapter, resumeData.position);
        } else {
          self.player.load(index, self.player.currentChapter);
        }
        self.show();
        self.player.play();
      };
    } else {
      this.player.load(index, this.player.currentChapter);
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
    player.chapters = resolveChapters(player.entries[player.currentIndex]);
    ui.updateTrackInfo(player);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
