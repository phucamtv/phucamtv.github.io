/**
 * Scrape egwwritings book source.
 *
 * Usage:
 *   bun scripts/egw_scrape/scrape.ts <book-slug> <command> [--force]
 *
 * Commands:
 *   toc        Fetch TOC, write {sourceDir}/chapters.json
 *   chapters   Fetch each chapter, write chNN.html and chNN.txt
 *   all        toc then chapters
 */
import { mkdirSync, existsSync } from "fs";
import { join } from "path";

import { colp } from "./books/colp";
import { lde } from "./books/lde";
import { fetchUrl, sleep } from "./lib/fetch";
import { parseToc, extractPage, blocksToChapter } from "./lib/parse";
import type { Block } from "./lib/parse";
import type { BookConfig, ChapterEntry } from "./lib/types";

const REPO_ROOT = `${import.meta.dir}/../..`;
const BOOKS: Record<string, BookConfig> = { colp, lde };

function chapterPath(book: BookConfig, n: number, ext: "html" | "txt"): string {
  const nn = String(n).padStart(2, "0");
  return join(REPO_ROOT, book.sourceDir, `ch${nn}.${ext}`);
}

function chaptersJsonPath(book: BookConfig): string {
  return join(REPO_ROOT, book.sourceDir, "chapters.json");
}

async function cmdToc(book: BookConfig): Promise<void> {
  const html = await fetchUrl(book.tocUrl);
  const entries = parseToc(html, book);
  if (entries.length !== book.chapters) {
    console.error(
      `WARNING: parsed ${entries.length} TOC entries, expected ${book.chapters}. ` +
        `Inspect ${chaptersJsonPath(book)} before running 'chapters'.`,
    );
  }
  mkdirSync(join(REPO_ROOT, book.sourceDir), { recursive: true });
  await Bun.write(chaptersJsonPath(book), JSON.stringify(entries, null, 2) + "\n");
  console.error(`Wrote ${entries.length} chapters to ${chaptersJsonPath(book)}`);
}

function urlParaId(url: string): number | null {
  const m = /\/book\/\d+\.(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

async function cmdChapters(book: BookConfig, force: boolean): Promise<void> {
  const path = chaptersJsonPath(book);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run 'toc' first.`);
  }
  const entries = JSON.parse(await Bun.file(path).text()) as ChapterEntry[];
  mkdirSync(join(REPO_ROOT, book.sourceDir), { recursive: true });
  for (let i = 0; i < entries.length; i++) {
    const c = entries[i];
    const next = entries[i + 1];
    const nextStartId = next ? urlParaId(next.url) : null;
    const tag = `ch${String(c.number).padStart(2, "0")}`;
    const htmlPath = chapterPath(book, c.number, "html");
    const txtPath = chapterPath(book, c.number, "txt");
    if (!force && existsSync(htmlPath) && existsSync(txtPath)) {
      console.error(`${tag}: already scraped, skipping`);
      continue;
    }
    console.error(`${tag}: fetching ${c.url}`);
    const firstHtml = await fetchUrl(c.url);
    const allBlocks: Block[] = [];
    const pageHtmls: string[] = [firstHtml];
    let page = extractPage(firstHtml);
    allBlocks.push(...page.blocks);

    while (page.nextUrl && page.nextParaId !== null) {
      // Stop if the next page starts at or after the next chapter's first paragraph.
      if (nextStartId !== null && page.nextParaId >= nextStartId) break;
      await sleep(1000);
      console.error(`${tag}: fetching ${page.nextUrl} (paginated)`);
      const html = await fetchUrl(page.nextUrl);
      pageHtmls.push(html);
      page = extractPage(html);
      // Filter out any blocks that already crossed into the next chapter, just in case.
      const blocks =
        nextStartId !== null
          ? page.blocks.filter((b) => b.paraId === null || b.paraId < nextStartId)
          : page.blocks;
      allBlocks.push(...blocks);
    }

    await Bun.write(htmlPath, pageHtmls.join("\n<!-- PAGE BREAK -->\n"));
    let { title, text } = blocksToChapter(allBlocks);
    if (!title) title = c.enTitle;
    // Drop "Chapter N—" prefix if present so the txt header is the bare chapter title.
    const stripped = title.replace(/^Chapter\s+\d+[—–-]\s*/, "");
    await Bun.write(txtPath, `# ${stripped}\n\n${text}\n`);
    console.error(`${tag}: wrote ${txtPath} (${allBlocks.length} blocks, ${pageHtmls.length} page${pageHtmls.length === 1 ? "" : "s"})`);
    await sleep(1000);
  }
}


async function main(argv: string[]): Promise<number> {
  const [slug, cmd, ...rest] = argv;
  if (!slug || !cmd) {
    console.error("Usage: bun scripts/egw_scrape/scrape.ts <book-slug> <toc|chapters|all> [--force]");
    return 1;
  }
  const book = BOOKS[slug];
  if (!book) {
    console.error(`Unknown book slug: ${slug}. Known: ${Object.keys(BOOKS).join(", ")}`);
    return 1;
  }
  const force = rest.includes("--force");

  switch (cmd) {
    case "toc":
      await cmdToc(book);
      return 0;
    case "chapters":
      await cmdChapters(book, force);
      return 0;
    case "all":
      await cmdToc(book);
      await cmdChapters(book, force);
      return 0;
    default:
      console.error(`Unknown command: ${cmd}`);
      return 1;
  }
}

const code = await main(process.argv.slice(2));
process.exit(code);
