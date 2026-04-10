# YouTube Channel Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript (Bun) YouTube channel video crawler with task-queue-based orchestration, per-channel SQLite storage, incremental/recrawl modes, and API metrics.

**Architecture:** Single-file script (`scripts/yt/channel/fetch-videos.ts`) reads config from `data/yt/crawler/config.yaml`, manages a task queue in `data/yt/crawler/channels.sqlite`, and stores full video metadata in per-channel SQLite DBs under `data/yt/`. Uses YouTube Data API v3 (playlistItems + videos.list approach). All YouTube API calls go through a wrapper that logs metrics.

**Tech Stack:** Bun runtime (bun:sqlite, bun:yaml, native fetch). Zero external dependencies.

**Spec:** `docs/superpowers/specs/2026-04-10-yt-channel-crawler-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `scripts/yt/channel/fetch-videos.ts` | Single-file entry point: config, DB init, API calls, task queue, worker loop, CLI |
| Create | `data/yt/crawler/config.yaml` | Channel list and settings |

Everything lives in one TypeScript file. The config YAML is the only other file to create.

---

### Task 1: Config file and config loading

**Files:**
- Create: `data/yt/crawler/config.yaml`
- Create: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Create the config YAML**

Create `data/yt/crawler/config.yaml`:

```yaml
dataDir: ./data/yt
workers: 1

channels:
  - handle: "@TiengNoiHyVong"
```

- [ ] **Step 2: Write config loading and CLI arg parsing**

Create `scripts/yt/channel/fetch-videos.ts` with config loading and arg parsing:

```typescript
import { Database } from "bun:sqlite";
import YAML from "bun:yaml";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { resolve, join } from "path";

// --- Types ---

interface ChannelConfig {
  handle: string;
}

interface Config {
  dataDir: string;
  workers: number;
  channels: ChannelConfig[];
}

interface CliArgs {
  recrawl: boolean;
  recrawlHandle: string | null;
}

// --- Config ---

const CONFIG_PATH = "data/yt/crawler/config.yaml";

function loadConfig(): Config {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = YAML.parse(raw) as Config;
  if (!parsed.channels || !Array.isArray(parsed.channels)) {
    throw new Error("config.yaml: 'channels' must be an array");
  }
  return {
    dataDir: parsed.dataDir || "./data/yt",
    workers: parsed.workers || 1,
    channels: parsed.channels,
  };
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const recrawlIdx = args.indexOf("--recrawl");
  if (recrawlIdx === -1) {
    return { recrawl: false, recrawlHandle: null };
  }
  const next = args[recrawlIdx + 1];
  const handle = next && !next.startsWith("--") ? next : null;
  return { recrawl: true, recrawlHandle: handle };
}

// --- Placeholder main ---

async function main() {
  const config = loadConfig();
  const cliArgs = parseArgs();
  console.log("Config loaded:", config);
  console.log("CLI args:", cliArgs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run to verify config loads**

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Prints the parsed config and CLI args with `recrawl: false`.

Run: `bun scripts/yt/channel/fetch-videos.ts --recrawl @TiengNoiHyVong`

Expected: Prints CLI args with `recrawl: true, recrawlHandle: "@TiengNoiHyVong"`.

- [ ] **Step 4: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts data/yt/crawler/config.yaml
git commit -m "feat(yt-crawler): config loading and CLI arg parsing"
```

---

### Task 2: Central database initialization

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add central DB initialization**

Add after the `parseArgs` function in `scripts/yt/channel/fetch-videos.ts`:

```typescript
// --- Central DB (channels.sqlite) ---

function initCentralDb(config: Config): Database {
  const crawlerDir = join(config.dataDir, "crawler");
  mkdirSync(crawlerDir, { recursive: true });
  const dbPath = join(crawlerDir, "channels.sqlite");
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode=WAL");
  db.run("PRAGMA foreign_keys=ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      handle TEXT,
      name TEXT,
      url TEXT,
      uploads_playlist_id TEXT,
      registered_at TEXT,
      last_crawled_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT,
      quota_cost INTEGER,
      status_code INTEGER,
      called_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      type TEXT DEFAULT 'incremental',
      next_page_token TEXT,
      newest_known_video_id TEXT,
      videos_fetched INTEGER DEFAULT 0,
      error TEXT,
      created_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    )
  `);

  return db;
}
```

- [ ] **Step 2: Add per-channel DB initialization**

Add after `initCentralDb`:

```typescript
// --- Per-Channel DB ---

function initChannelDb(dbPath: string): Database {
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode=WAL");

  db.run(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      channel_id TEXT,
      title TEXT,
      description TEXT,
      published_at TEXT,
      duration TEXT,
      duration_seconds INTEGER,
      channel_title TEXT,
      tags TEXT,
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
      topic_categories TEXT,
      fetched_at TEXT
    )
  `);

  return db;
}

function channelDbPath(config: Config, channelName: string): string {
  const sanitized = channelName
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .trim()
    .toLowerCase();
  return join(config.dataDir, `${sanitized}.db`);
}
```

- [ ] **Step 3: Wire into main and verify**

Update the `main` function:

```typescript
async function main() {
  const config = loadConfig();
  const cliArgs = parseArgs();
  mkdirSync(config.dataDir, { recursive: true });

  const centralDb = initCentralDb(config);
  console.log("Central DB initialized");

  // Quick test: create and verify a channel DB
  const testPath = channelDbPath(config, "Test Channel");
  console.log("Channel DB path:", testPath);

  centralDb.close();
}
```

- [ ] **Step 4: Run to verify DBs initialize**

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Prints "Central DB initialized" and a channel DB path like `./data/yt/test_channel.db`.

- [ ] **Step 5: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): central and per-channel DB initialization"
```

---

### Task 3: YouTube API wrapper with metrics logging

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add the API wrapper**

Add after the DB functions:

```typescript
// --- YouTube API ---

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const QUOTA_COSTS: Record<string, number> = {
  "channels.list": 1,
  "playlistItems.list": 1,
  "videos.list": 1,
};

interface ApiCallOptions {
  endpoint: string;
  params: Record<string, string>;
  centralDb: Database;
}

async function youtubeApi({ endpoint, params, centralDb }: ApiCallOptions): Promise<any> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY not set in environment");
  }

  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  url.searchParams.set("key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  const now = new Date().toISOString();
  const quotaCost = QUOTA_COSTS[endpoint] || 1;

  centralDb.run(
    "INSERT INTO api_calls (endpoint, quota_cost, status_code, called_at) VALUES (?, ?, ?, ?)",
    [endpoint, quotaCost, res.status, now]
  );

  if (res.status === 403) {
    const body = await res.json();
    const reason = body?.error?.errors?.[0]?.reason || "unknown";
    throw new QuotaExceededError(`YouTube API 403: ${reason}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body}`);
  }

  return res.json();
}

class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}
```

- [ ] **Step 2: Add channel resolution function**

Add after `youtubeApi`:

```typescript
interface ResolvedChannel {
  id: string;
  name: string;
  handle: string;
  uploadsPlaylistId: string;
}

async function resolveChannel(
  handle: string,
  centralDb: Database
): Promise<ResolvedChannel> {
  // Normalize handle: ensure it starts with @
  const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;

  // Try by handle (forHandle parameter)
  const data = await youtubeApi({
    endpoint: "channels",
    params: {
      part: "snippet,contentDetails",
      forHandle: normalizedHandle.slice(1), // API expects without @
    },
    centralDb,
  });

  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found: ${normalizedHandle}`);
  }

  const item = data.items[0];
  return {
    id: item.id,
    name: item.snippet.title,
    handle: normalizedHandle,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}
```

- [ ] **Step 3: Verify API wrapper compiles**

Update `main` to a simple test:

```typescript
async function main() {
  const config = loadConfig();
  const cliArgs = parseArgs();
  mkdirSync(config.dataDir, { recursive: true });

  const centralDb = initCentralDb(config);
  console.log("Central DB initialized");
  console.log(`API key present: ${!!process.env.YOUTUBE_API_KEY}`);
  console.log(`Channels to process: ${config.channels.length}`);

  centralDb.close();
}
```

- [ ] **Step 4: Run to verify it compiles**

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Prints DB initialized, API key status, and channel count. No errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): YouTube API wrapper with metrics logging"
```

---

### Task 4: Channel sync — resolve handles and upsert to central DB

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add syncChannels function**

Add after `resolveChannel`:

```typescript
// --- Channel Sync ---

async function syncChannels(
  config: Config,
  centralDb: Database
): Promise<void> {
  const upsertChannel = centralDb.prepare(`
    INSERT INTO channels (id, handle, name, url, uploads_playlist_id, registered_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      handle = excluded.handle,
      name = excluded.name,
      url = excluded.url,
      uploads_playlist_id = excluded.uploads_playlist_id
  `);

  for (const ch of config.channels) {
    console.log(`Resolving channel: ${ch.handle}`);
    const resolved = await resolveChannel(ch.handle, centralDb);
    console.log(`  -> ${resolved.name} (${resolved.id})`);

    upsertChannel.run(
      resolved.id,
      resolved.handle,
      resolved.name,
      `https://www.youtube.com/${resolved.handle}`,
      resolved.uploadsPlaylistId,
      new Date().toISOString()
    );
  }
}
```

- [ ] **Step 2: Wire syncChannels into main**

Update `main`:

```typescript
async function main() {
  const config = loadConfig();
  const cliArgs = parseArgs();
  mkdirSync(config.dataDir, { recursive: true });

  const centralDb = initCentralDb(config);

  try {
    await syncChannels(config, centralDb);
    console.log("Channel sync complete");
  } finally {
    centralDb.close();
  }
}
```

- [ ] **Step 3: Test with a real API key**

Set `YOUTUBE_API_KEY` in `.env` and run:

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Resolves `@TiengNoiHyVong` and prints the channel name and ID. Check `data/yt/crawler/channels.sqlite` has a row in `channels` and a row in `api_calls`.

Verify:
```bash
bun -e "import { Database } from 'bun:sqlite'; const db = new Database('data/yt/crawler/channels.sqlite'); console.log(db.query('SELECT * FROM channels').all()); console.log(db.query('SELECT * FROM api_calls').all()); db.close();"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): channel sync with YouTube API resolution"
```

---

### Task 5: Task creation — incremental and recrawl modes

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add task creation function**

Add after `syncChannels`:

```typescript
// --- Task Creation ---

function getNewestVideoId(config: Config, channelName: string): string | null {
  const dbPath = channelDbPath(config, channelName);
  if (!existsSync(dbPath)) return null;

  const db = new Database(dbPath, { readonly: true });
  const row = db.query(
    "SELECT id FROM videos ORDER BY published_at DESC LIMIT 1"
  ).get() as { id: string } | null;
  db.close();
  return row?.id ?? null;
}

interface ChannelRow {
  id: string;
  handle: string;
  name: string;
  uploads_playlist_id: string;
}

function createTasks(
  centralDb: Database,
  config: Config,
  cliArgs: CliArgs
): void {
  // Reset stale in_progress tasks from previous crashed runs
  centralDb.run(
    "UPDATE tasks SET status = 'pending' WHERE status = 'in_progress'"
  );

  const channels = centralDb.query("SELECT * FROM channels").all() as ChannelRow[];

  const insertTask = centralDb.prepare(`
    INSERT INTO tasks (channel_id, status, type, newest_known_video_id, created_at)
    VALUES (?, 'pending', ?, ?, ?)
  `);

  for (const ch of channels) {
    // If --recrawl with a specific handle, skip non-matching channels
    if (cliArgs.recrawl && cliArgs.recrawlHandle) {
      const target = cliArgs.recrawlHandle.startsWith("@")
        ? cliArgs.recrawlHandle
        : `@${cliArgs.recrawlHandle}`;
      if (ch.handle !== target) continue;
    }

    // Check if there's already a pending/in_progress task for this channel
    const existing = centralDb.query(
      "SELECT id FROM tasks WHERE channel_id = ? AND status IN ('pending', 'in_progress')"
    ).get(ch.id);
    if (existing) {
      console.log(`Task already pending for ${ch.name}, skipping`);
      continue;
    }

    const type = cliArgs.recrawl ? "recrawl" : "incremental";
    const newestVideoId = cliArgs.recrawl
      ? null
      : getNewestVideoId(config, ch.name);

    insertTask.run(ch.id, type, newestVideoId, new Date().toISOString());
    console.log(`Created ${type} task for ${ch.name}${newestVideoId ? ` (resume after ${newestVideoId})` : ""}`);
  }
}
```

- [ ] **Step 2: Wire into main**

Update `main`:

```typescript
async function main() {
  const config = loadConfig();
  const cliArgs = parseArgs();
  mkdirSync(config.dataDir, { recursive: true });

  const centralDb = initCentralDb(config);

  try {
    await syncChannels(config, centralDb);
    createTasks(centralDb, config, cliArgs);

    const pendingCount = (
      centralDb.query("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get() as { count: number }
    ).count;
    console.log(`\n${pendingCount} task(s) pending`);
  } finally {
    centralDb.close();
  }
}
```

- [ ] **Step 3: Test task creation**

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Creates an incremental task for the channel. Second run should say "Task already pending, skipping".

Run: `bun scripts/yt/channel/fetch-videos.ts --recrawl`

Expected: Creates a recrawl task (after first clearing/completing existing tasks — for testing, manually delete old tasks first or just verify the output).

- [ ] **Step 4: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): task creation for incremental and recrawl modes"
```

---

### Task 6: Video ID collection — paginate playlistItems

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add playlistItems pagination**

Add after `createTasks`:

```typescript
// --- Video ID Collection ---

interface TaskRow {
  id: number;
  channel_id: string;
  status: string;
  type: string;
  next_page_token: string | null;
  newest_known_video_id: string | null;
  videos_fetched: number;
}

async function collectVideoIds(
  task: TaskRow,
  uploadsPlaylistId: string,
  centralDb: Database
): Promise<string[]> {
  const videoIds: string[] = [];
  let pageToken: string | null = task.next_page_token;
  let page = 0;

  while (true) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await youtubeApi({
      endpoint: "playlistItems",
      params,
      centralDb,
    });

    let hitKnown = false;
    for (const item of data.items || []) {
      const videoId = item.contentDetails.videoId;

      // Incremental mode: stop at known video
      if (task.type === "incremental" && task.newest_known_video_id && videoId === task.newest_known_video_id) {
        hitKnown = true;
        break;
      }

      videoIds.push(videoId);
    }

    page++;
    console.log(`  Page ${page}: ${data.items?.length || 0} items (total collected: ${videoIds.length})`);

    if (hitKnown) {
      console.log(`  Hit known video ${task.newest_known_video_id}, stopping`);
      break;
    }

    pageToken = data.nextPageToken || null;

    // Save page token for resumability
    centralDb.run(
      "UPDATE tasks SET next_page_token = ? WHERE id = ?",
      [pageToken, task.id]
    );

    if (!pageToken) break;
  }

  // Reverse for old-first ordering
  videoIds.reverse();
  return videoIds;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): playlistItems pagination with resumability"
```

---

### Task 7: Fetch full video details and upsert to channel DB

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add ISO 8601 duration parser**

Add after `collectVideoIds`:

```typescript
// --- Helpers ---

function parseDurationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}
```

- [ ] **Step 2: Add batch video detail fetching and upserting**

Add after `parseDurationToSeconds`:

```typescript
// --- Video Detail Fetching ---

async function fetchAndUpsertVideos(
  videoIds: string[],
  channelDb: Database,
  centralDb: Database
): Promise<number> {
  let totalUpserted = 0;
  const now = new Date().toISOString();

  const upsertVideo = channelDb.prepare(`
    INSERT INTO videos (
      id, channel_id, title, description, published_at,
      duration, duration_seconds, channel_title, tags, category_id,
      default_language, default_audio_language, live_broadcast_content,
      view_count, like_count, comment_count,
      thumbnail_default, thumbnail_medium, thumbnail_high, thumbnail_maxres,
      caption_available, license, embeddable, privacy_status,
      made_for_kids, topic_categories, fetched_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      published_at = excluded.published_at,
      duration = excluded.duration,
      duration_seconds = excluded.duration_seconds,
      channel_title = excluded.channel_title,
      tags = excluded.tags,
      category_id = excluded.category_id,
      default_language = excluded.default_language,
      default_audio_language = excluded.default_audio_language,
      live_broadcast_content = excluded.live_broadcast_content,
      view_count = excluded.view_count,
      like_count = excluded.like_count,
      comment_count = excluded.comment_count,
      thumbnail_default = excluded.thumbnail_default,
      thumbnail_medium = excluded.thumbnail_medium,
      thumbnail_high = excluded.thumbnail_high,
      thumbnail_maxres = excluded.thumbnail_maxres,
      caption_available = excluded.caption_available,
      license = excluded.license,
      embeddable = excluded.embeddable,
      privacy_status = excluded.privacy_status,
      made_for_kids = excluded.made_for_kids,
      topic_categories = excluded.topic_categories,
      fetched_at = excluded.fetched_at
  `);

  // Process in batches of 50 (API max)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);

    const data = await youtubeApi({
      endpoint: "videos",
      params: {
        part: "snippet,contentDetails,statistics,status,topicDetails",
        id: batch.join(","),
      },
      centralDb,
    });

    for (const item of data.items || []) {
      const s = item.snippet;
      const cd = item.contentDetails;
      const stats = item.statistics;
      const status = item.status;
      const topics = item.topicDetails;

      upsertVideo.run(
        item.id,
        s.channelId,
        s.title,
        s.description,
        s.publishedAt,
        cd.duration,
        parseDurationToSeconds(cd.duration),
        s.channelTitle,
        JSON.stringify(s.tags || []),
        s.categoryId,
        s.defaultLanguage || null,
        s.defaultAudioLanguage || null,
        s.liveBroadcastContent,
        parseInt(stats.viewCount || "0", 10),
        parseInt(stats.likeCount || "0", 10),
        parseInt(stats.commentCount || "0", 10),
        s.thumbnails?.default?.url || null,
        s.thumbnails?.medium?.url || null,
        s.thumbnails?.high?.url || null,
        s.thumbnails?.maxres?.url || null,
        cd.caption === "true" ? 1 : 0,
        cd.licensedContent ? 1 : 0,
        status.embeddable ? 1 : 0,
        status.privacyStatus,
        status.madeForKids ? 1 : 0,
        JSON.stringify(topics?.topicCategories || []),
        now
      );
      totalUpserted++;
    }

    console.log(`  Fetched details: ${i + batch.length}/${videoIds.length}`);
  }

  return totalUpserted;
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): video detail fetching and upsert to channel DB"
```

---

### Task 8: Worker loop — process tasks from queue

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add the worker function**

Add after `fetchAndUpsertVideos`:

```typescript
// --- Worker ---

async function processTask(
  task: TaskRow,
  config: Config,
  centralDb: Database
): Promise<void> {
  // Mark in_progress
  centralDb.run(
    "UPDATE tasks SET status = 'in_progress', started_at = ? WHERE id = ?",
    [new Date().toISOString(), task.id]
  );

  // Get channel info
  const channel = centralDb.query(
    "SELECT * FROM channels WHERE id = ?"
  ).get(task.channel_id) as ChannelRow | null;

  if (!channel) {
    centralDb.run(
      "UPDATE tasks SET status = 'failed', error = 'Channel not found in DB' WHERE id = ?",
      [task.id]
    );
    return;
  }

  console.log(`\nProcessing: ${channel.name} (${task.type})`);

  // Collect video IDs
  const videoIds = await collectVideoIds(
    task,
    channel.uploads_playlist_id,
    centralDb
  );

  if (videoIds.length === 0) {
    console.log("  No new videos found");
    centralDb.run(
      "UPDATE tasks SET status = 'completed', videos_fetched = 0, completed_at = ? WHERE id = ?",
      [new Date().toISOString(), task.id]
    );
    return;
  }

  console.log(`  Collected ${videoIds.length} video IDs, fetching details...`);

  // Init channel DB and fetch details
  const dbPath = channelDbPath(config, channel.name);
  const channelDb = initChannelDb(dbPath);

  try {
    const upserted = await fetchAndUpsertVideos(videoIds, channelDb, centralDb);

    // Mark task completed
    centralDb.run(
      "UPDATE tasks SET status = 'completed', videos_fetched = ?, next_page_token = NULL, completed_at = ? WHERE id = ?",
      [upserted, new Date().toISOString(), task.id]
    );

    // Update channel last_crawled_at
    centralDb.run(
      "UPDATE channels SET last_crawled_at = ? WHERE id = ?",
      [new Date().toISOString(), channel.id]
    );

    console.log(`  Done: ${upserted} videos upserted to ${dbPath}`);
  } finally {
    channelDb.close();
  }
}

async function runWorker(
  workerId: number,
  config: Config,
  centralDb: Database
): Promise<void> {
  while (true) {
    // Pick oldest pending task
    const task = centralDb.query(
      "SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
    ).get() as TaskRow | null;

    if (!task) break;

    try {
      await processTask(task, config, centralDb);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        console.log(`\nWorker ${workerId}: Quota exceeded, saving progress and stopping`);
        centralDb.run(
          "UPDATE tasks SET status = 'pending' WHERE id = ?",
          [task.id]
        );
        break;
      }
      // Other errors: mark task failed
      centralDb.run(
        "UPDATE tasks SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
        [String(err), new Date().toISOString(), task.id]
      );
      console.error(`  Task ${task.id} failed:`, err);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): worker loop with quota handling"
```

---

### Task 9: Wire everything together in main

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Replace main with the full orchestration**

Replace the existing `main` function:

```typescript
// --- Main ---

async function main() {
  const config = loadConfig();
  const cliArgs = parseArgs();
  mkdirSync(config.dataDir, { recursive: true });

  const centralDb = initCentralDb(config);

  try {
    // 1. Sync channels from config
    await syncChannels(config, centralDb);

    // 2. Create tasks
    createTasks(centralDb, config, cliArgs);

    const pendingCount = (
      centralDb.query("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get() as { count: number }
    ).count;

    if (pendingCount === 0) {
      console.log("\nNo tasks to process");
      return;
    }

    console.log(`\n${pendingCount} task(s) to process with ${config.workers} worker(s)`);

    // 3. Run workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < config.workers; i++) {
      workers.push(runWorker(i, config, centralDb));
    }
    await Promise.all(workers);

    // 4. Summary
    const stats = centralDb.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        SUM(videos_fetched) FILTER (WHERE status = 'completed') as total_videos
      FROM tasks
      WHERE created_at >= datetime('now', '-1 hour')
    `).get() as { completed: number; failed: number; pending: number; total_videos: number };

    console.log(`\n--- Summary ---`);
    console.log(`Completed: ${stats.completed}, Failed: ${stats.failed}, Pending: ${stats.pending}`);
    console.log(`Total videos fetched: ${stats.total_videos || 0}`);

    const apiStats = centralDb.query(`
      SELECT endpoint, COUNT(*) as calls, SUM(quota_cost) as quota
      FROM api_calls
      WHERE called_at >= datetime('now', '-1 hour')
      GROUP BY endpoint
    `).all() as { endpoint: string; calls: number; quota: number }[];

    if (apiStats.length > 0) {
      console.log(`\nAPI calls (last hour):`);
      for (const row of apiStats) {
        console.log(`  ${row.endpoint}: ${row.calls} calls (${row.quota} quota units)`);
      }
    }
  } finally {
    centralDb.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run end-to-end test**

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected output flow:
```
Resolving channel: @TiengNoiHyVong
  -> Tieng Noi Hy Vong (UC...)
Created incremental task for Tieng Noi Hy Vong

1 task(s) to process with 1 worker(s)

Processing: Tieng Noi Hy Vong (incremental)
  Page 1: 50 items (total collected: 50)
  Page 2: 50 items (total collected: 100)
  ...
  Collected N video IDs, fetching details...
  Fetched details: 50/N
  ...
  Done: N videos upserted to ./data/yt/tieng_noi_hy_vong.db

--- Summary ---
Completed: 1, Failed: 0, Pending: 0
Total videos fetched: N

API calls (last hour):
  channels: 1 calls (1 quota units)
  playlistItems: X calls (X quota units)
  videos: Y calls (Y quota units)
```

- [ ] **Step 3: Test recrawl mode**

Run: `bun scripts/yt/channel/fetch-videos.ts --recrawl @TiengNoiHyVong`

Expected: Creates a recrawl task that fetches ALL videos without stopping at a known ID.

- [ ] **Step 4: Test incremental mode (second run)**

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Creates an incremental task. Since all videos are already in the DB, it should stop quickly after hitting the `newest_known_video_id` and report 0 or very few new videos.

- [ ] **Step 5: Verify data integrity**

```bash
bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('data/yt/tieng_noi_hy_vong.db', { readonly: true });
console.log('Total videos:', db.query('SELECT COUNT(*) as count FROM videos').get());
console.log('Oldest:', db.query('SELECT id, title, published_at FROM videos ORDER BY published_at ASC LIMIT 1').get());
console.log('Newest:', db.query('SELECT id, title, published_at FROM videos ORDER BY published_at DESC LIMIT 1').get());
console.log('Sample tags:', db.query('SELECT id, tags FROM videos WHERE tags != \"[]\" LIMIT 1').get());
db.close();
"
```

- [ ] **Step 6: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): complete orchestration with workers, summary, and metrics"
```

---

### Task 10: Edge cases and polish

**Files:**
- Modify: `scripts/yt/channel/fetch-videos.ts`

- [ ] **Step 1: Add .env loading**

Bun auto-loads `.env` files, but verify the API key is read. Add at the very top of the file, after imports:

```typescript
// Bun auto-loads .env — verify API key is available early
if (!process.env.YOUTUBE_API_KEY) {
  console.error("Error: YOUTUBE_API_KEY not set. Add it to .env or export it.");
  process.exit(1);
}
```

Remove the duplicate check inside `youtubeApi` (the one that throws `"YOUTUBE_API_KEY not set in environment"`).

- [ ] **Step 2: Handle channel URL formats in config**

Update `resolveChannel` to handle all input formats (not just `@handle`):

```typescript
async function resolveChannel(
  handle: string,
  centralDb: Database
): Promise<ResolvedChannel> {
  let params: Record<string, string>;

  if (handle.startsWith("UC") && handle.length === 24) {
    // Channel ID
    params = { part: "snippet,contentDetails", id: handle };
  } else if (handle.includes("youtube.com")) {
    // URL — extract handle or ID
    const match = handle.match(/@([\w-]+)/) || handle.match(/channel\/(UC[\w-]+)/);
    if (!match) throw new Error(`Cannot parse channel URL: ${handle}`);
    if (match[1].startsWith("UC")) {
      params = { part: "snippet,contentDetails", id: match[1] };
    } else {
      params = { part: "snippet,contentDetails", forHandle: match[1] };
    }
  } else {
    // Assume @handle
    const h = handle.startsWith("@") ? handle.slice(1) : handle;
    params = { part: "snippet,contentDetails", forHandle: h };
  }

  const data = await youtubeApi({
    endpoint: "channels",
    params,
    centralDb,
  });

  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found: ${handle}`);
  }

  const item = data.items[0];
  const originalHandle = handle.startsWith("@") ? handle : `@${item.snippet.customUrl || handle}`;

  return {
    id: item.id,
    name: item.snippet.title,
    handle: originalHandle,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
  };
}
```

- [ ] **Step 3: Test URL format handling**

Update `config.yaml` temporarily to test URL format:

```yaml
dataDir: ./data/yt
workers: 1

channels:
  - handle: "@TiengNoiHyVong"
```

Run: `bun scripts/yt/channel/fetch-videos.ts`

Expected: Resolves correctly regardless of handle format. Revert config if changed.

- [ ] **Step 4: Commit**

```bash
git add scripts/yt/channel/fetch-videos.ts
git commit -m "feat(yt-crawler): early API key validation and flexible channel URL parsing"
```

---

## Self-Review Checklist

- **Spec coverage:** All spec sections are covered — CLI interface (Task 1), config (Task 1), DB schemas (Task 2), API strategy (Tasks 3, 6, 7), crawl flow (Tasks 5-9), recrawl mode (Task 5), resumability (Tasks 6, 8), quota handling (Task 8), API metrics (Task 3).
- **Placeholder scan:** No TBDs, TODOs, or vague steps. All code blocks are complete.
- **Type consistency:** `ChannelRow`, `TaskRow`, `Config`, `CliArgs`, `ResolvedChannel` used consistently across all tasks. Function names match between definition and usage.
- **Spec gap check:** Verified: channel sync, task creation, video ID collection, video detail fetching, worker loop, quota handling, API metrics, resumability, recrawl mode — all present.
