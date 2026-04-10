# YouTube Channel Video Crawler

## Overview

A TypeScript (Bun) script that crawls YouTube channels via the Data API v3, stores full video metadata in per-channel SQLite databases, and uses a task queue for orchestration and resumability.

**Key constraints:**
- Pure Bun — zero external dependencies (bun:sqlite, native fetch, built-in YAML parser)
- Single file: `scripts/yt/channel/fetch-videos.ts`
- YouTube Data API v3 (not yt-dlp)
- API key via `YOUTUBE_API_KEY` env var (`.env`)

## CLI Interface

```bash
# Run crawler (reads config, creates tasks, processes them)
bun scripts/yt/channel/fetch-videos.ts

# Recrawl specific channel
bun scripts/yt/channel/fetch-videos.ts --recrawl @TiengNoiHyVong

# Recrawl all channels
bun scripts/yt/channel/fetch-videos.ts --recrawl
```

## Configuration

**File:** `data/yt/crawler/config.yaml`

```yaml
dataDir: ./data/yt
workers: 1

channels:
  - handle: "@TiengNoiHyVong"
  - handle: "@AnotherChannel"
```

- `dataDir` — where per-channel SQLite files are stored
- `workers` — number of concurrent workers processing the task queue
- `channels` — list of channels to crawl

## API Strategy

**Approach: playlistItems + videos.list**

1. Resolve channel handle/URL/ID to channel ID via `channels.list` API
2. Get the channel's "uploads" playlist ID (replace `UC` prefix with `UU`)
3. Page through `playlistItems.list` on the uploads playlist (returns newest-first)
4. Collect video IDs, reverse for old-first insertion
5. Batch `videos.list` (50 per call) to get full metadata
6. Upsert into per-channel SQLite DB

**Quota cost:** ~2 API calls per 50 videos (1 playlistItems + 1 videos.list).

## File Structure

```
scripts/yt/channel/
  fetch-videos.ts          -- single file, entry point

data/yt/
  crawler/
    config.yaml            -- channel list + settings
    channels.sqlite        -- task queue + channel registry
  tiengnoihyvong.db        -- per-channel video DB
  anotherchannel.db
```

## Database Schema

### Central DB: `data/yt/crawler/channels.sqlite`

```sql
CREATE TABLE channels (
  id TEXT PRIMARY KEY,              -- YouTube channel ID (UC...)
  handle TEXT,                      -- @handle
  name TEXT,
  url TEXT,
  uploads_playlist_id TEXT,         -- UU... playlist for fetching
  registered_at TEXT,
  last_crawled_at TEXT
);

CREATE TABLE api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT,                    -- channels.list | playlistItems.list | videos.list
  quota_cost INTEGER,               -- estimated units consumed
  status_code INTEGER,
  called_at TEXT                    -- ISO timestamp
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',    -- pending | in_progress | completed | failed
  type TEXT DEFAULT 'incremental',  -- incremental | recrawl
  next_page_token TEXT,             -- YouTube API page token for resumability
  newest_known_video_id TEXT,       -- stop marker for incremental crawls
  videos_fetched INTEGER DEFAULT 0,
  error TEXT,
  created_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);
```

### Per-Channel DB: `data/yt/{channel_name}.db`

```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  title TEXT,
  description TEXT,
  published_at TEXT,
  duration TEXT,                     -- ISO 8601 (PT4M13S)
  duration_seconds INTEGER,
  channel_title TEXT,
  tags TEXT,                         -- JSON array
  category_id TEXT,
  default_language TEXT,
  default_audio_language TEXT,
  live_broadcast_content TEXT,
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  thumbnail_default TEXT,
  thumbnail_medium TEXT,
  thumbnail_high TEXT,
  thumbnail_maxres TEXT,
  caption_available INTEGER,
  license TEXT,
  embeddable INTEGER,
  privacy_status TEXT,
  made_for_kids INTEGER,
  topic_categories TEXT,             -- JSON array
  fetched_at TEXT
);
```

## Crawl Flow

### 1. Startup
- Read `config.yaml` (Bun built-in YAML parser)
- Load `.env` for `YOUTUBE_API_KEY`
- Init `channels.sqlite` (create tables if not exist)

### 2. Sync Channels
- For each channel in config:
  - Resolve handle/URL to channel ID via `channels.list` API
  - Upsert into `channels` table (with `uploads_playlist_id`)
- Create tasks for channels needing crawl:
  - `--recrawl @handle` → create "recrawl" task for that channel
  - `--recrawl` (no handle) → create "recrawl" tasks for all channels
  - Default → create "incremental" task, set `newest_known_video_id` from channel's existing DB

### 3. Worker Loop
Each worker runs concurrently (up to `workers` count from config):

1. Pick oldest pending task → set `status=in_progress`, `started_at=now`
2. Page through `playlistItems.list(uploads_playlist_id)`:
   - Each page: collect video IDs
   - Save `next_page_token` to task row (resumability checkpoint)
   - **Incremental mode:** stop when encountering a video ID that matches `newest_known_video_id` (set at task creation from the channel DB's most recent `published_at` video)
   - **Quota error (403):** save progress, set task back to `pending`, stop worker
3. Reverse collected IDs (old-first ordering)
4. Batch `videos.list` (50 per call) for collected IDs
5. Upsert full metadata into `{channel}.db`
6. Update task: `status=completed`, `videos_fetched` count, `completed_at=now`
7. Update channel: `last_crawled_at=now`
8. Pick next task (loop)

### 4. Recrawl Mode
- Same flow but skips the "stop at known ID" check
- Still upserts, so existing records get updated with fresh data

### 5. Resumability
- If process crashes mid-crawl, task remains `in_progress` with a saved `next_page_token`
- On next run: detect stale `in_progress` tasks, reset to `pending` with the saved page token
- Worker resumes from that page token instead of starting over

### 6. Quota Handling
- On HTTP 403 (quota exceeded): save `next_page_token` to task, set task to `pending`, stop gracefully
- Next run picks up where it left off

### 7. API Metrics
- All YouTube API calls go through a single wrapper function
- Each call logs to `api_calls` table: endpoint, quota cost, status code, timestamp
- Queryable for simple analytics (calls per hour, quota usage, error rates)
