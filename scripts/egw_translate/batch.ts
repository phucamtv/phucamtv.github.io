/**
 * Translate a contiguous range of chapters for one book, end to end.
 *
 * Runs chunk → translate → assemble per chapter, sequentially, logging progress to
 * a per-batch file so a parent process can poll without reading agent streams.
 * Resume-safe: translate skips chunks whose .md already exists (unless --force).
 *
 * Usage:
 *   bun scripts/egw_translate/batch.ts --book da --from 1 --to 15 [--force]
 */
import { mkdirSync } from "fs";
import { join } from "path";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const book = arg("book");
const from = Number(arg("from"));
const to = Number(arg("to"));
const force = process.argv.includes("--force");
if (!book || !Number.isFinite(from) || !Number.isFinite(to)) {
  console.error("Usage: bun scripts/egw_translate/batch.ts --book <slug> --from N --to M [--force]");
  process.exit(1);
}

const REPO_ROOT = `${import.meta.dir}/../..`;
const LOG_DIR = join(REPO_ROOT, "data", `${book}-translated`, "batch-logs");
mkdirSync(LOG_DIR, { recursive: true });
const logPath = join(LOG_DIR, `batch-${from}-${to}.log`);

async function log(msg: string): Promise<void> {
  const line = `${msg}\n`;
  await Bun.write(logPath, (await safeRead(logPath)) + line);
  console.error(msg);
}
async function safeRead(p: string): Promise<string> {
  try { return await Bun.file(p).text(); } catch { return ""; }
}

async function runStage(cmd: string, chapter: number): Promise<boolean> {
  const args = ["bun", "scripts/egw_translate/run.ts", cmd, "--book", book!, "--chapter", String(chapter)];
  if (force && cmd === "translate") args.push("--force");
  const proc = Bun.spawn(args, { cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" });
  const [, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    await log(`ch${String(chapter).padStart(2, "0")}: ${cmd} FAILED (exit ${code}): ${stderr.trim().slice(0, 200)}`);
    return false;
  }
  return true;
}

await log(`=== batch ${from}-${to} starting ===`);
for (let ch = from; ch <= to; ch++) {
  const nn = String(ch).padStart(2, "0");
  if (!(await runStage("chunk", ch))) continue;
  if (!(await runStage("translate", ch))) continue;
  if (!(await runStage("assemble", ch))) continue;
  await log(`ch${nn}: DONE`);
}
await log(`=== batch ${from}-${to} complete ===`);
