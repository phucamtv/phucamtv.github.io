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

// --- Main ---

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
