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
