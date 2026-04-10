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

async function youtubeApi({
  endpoint,
  params,
  centralDb,
}: ApiCallOptions): Promise<any> {
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

// --- Channel Resolution ---

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
  const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;

  const data = await youtubeApi({
    endpoint: "channels",
    params: {
      part: "snippet,contentDetails",
      forHandle: normalizedHandle.slice(1),
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

// --- Helpers ---

function parseDurationToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] || "0", 10);
  const m = parseInt(match[2] || "0", 10);
  const s = parseInt(match[3] || "0", 10);
  return h * 3600 + m * 60 + s;
}

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
