/**
 * Translate EGW book source into Vietnamese, stitched into Hugo chapter files.
 *
 * Usage:
 *   bun scripts/egw_translate/run.ts <command> --book <slug> [--chapter N] [--force]
 *
 * Commands:
 *   chunk      Split source into chunks at data/<book>-source/chunks/
 *   translate  Translate each chunk via `claude` CLI, output at data/<book>-translated/
 *   assemble   Concatenate chunks, lint, write body into content/sach/egw/<slug>/chuong-NN.md
 *   all        chunk → translate → assemble
 */
import { mkdirSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";

import { colp } from "./books/colp";
import type { TranslateBookConfig } from "./lib/types";
import {
  sourceTextPath, chunkPath, translatedChunkPath, errorChunkPath, hugoChapterPath,
  chaptersJsonPath, absPath,
} from "./lib/paths";
import { chunkChapter } from "./lib/chunk";
import { loadGlossary } from "./lib/glossary";
import { loadBibleLookup, resolveBibleSentinels } from "./lib/bible";
import { buildSystemPrompt } from "./lib/prompt";
import { callClaude } from "./lib/claude";
import { assembleBody, writeChapter } from "./lib/assemble";

const BOOKS: Record<string, TranslateBookConfig> = { colp };

interface ChapterEntry {
  number: number;
  enTitle: string;
  url: string;
}

async function loadChapters(book: TranslateBookConfig): Promise<ChapterEntry[]> {
  const path = chaptersJsonPath(book);
  if (!existsSync(path)) throw new Error(`missing ${path} — run scrape first`);
  return JSON.parse(await Bun.file(path).text()) as ChapterEntry[];
}

function selectChapters(entries: ChapterEntry[], only: number | null): ChapterEntry[] {
  if (only == null) return entries;
  const e = entries.find((c) => c.number === only);
  if (!e) throw new Error(`chapter ${only} not found in chapters.json`);
  return [e];
}

async function cmdChunk(book: TranslateBookConfig, chapter: number | null, force: boolean): Promise<void> {
  const entries = selectChapters(await loadChapters(book), chapter);
  const chunksDirAbs = absPath(book, book.chunksDir);
  mkdirSync(chunksDirAbs, { recursive: true });

  for (const c of entries) {
    const nn = String(c.number).padStart(2, "0");
    const src = await Bun.file(sourceTextPath(book, c.number)).text();
    const chunks = chunkChapter(src, book.chunkTargetWords);

    for (const f of readdirSync(chunksDirAbs)) {
      if (f.startsWith(`ch${nn}-`)) unlinkSync(join(chunksDirAbs, f));
    }

    for (const ch of chunks) {
      await Bun.write(chunkPath(book, c.number, ch.index), ch.text + "\n");
    }
    console.error(`ch${nn}: wrote ${chunks.length} chunks`);
  }
  void force;
}

async function cmdTranslate(book: TranslateBookConfig, chapter: number | null, force: boolean): Promise<void> {
  const entries = selectChapters(await loadChapters(book), chapter);
  mkdirSync(absPath(book, book.translatedDir), { recursive: true });

  const glossary = await loadGlossary(absPath(book, book.glossaryPath));
  const bible = await loadBibleLookup(
    absPath(book, book.bibleRefsPath),
    absPath(book, book.bibleVersesPath),
  );
  const systemPrompt = buildSystemPrompt({
    glossary,
    paragraphCitationPrefix: book.paragraphCitationPrefix,
  });

  const chunksDirAbs = absPath(book, book.chunksDir);

  for (const c of entries) {
    const nn = String(c.number).padStart(2, "0");
    const chunkFiles = readdirSync(chunksDirAbs)
      .filter((f) => f.startsWith(`ch${nn}-`) && f.endsWith(".txt"))
      .sort();
    if (chunkFiles.length === 0) throw new Error(`no chunks for chapter ${c.number} — run chunk first`);

    for (const f of chunkFiles) {
      const mm = Number(f.slice(5, 7));
      const outPath = translatedChunkPath(book, c.number, mm);
      const errPath = errorChunkPath(book, c.number, mm);
      if (!force && existsSync(outPath)) {
        console.error(`ch${nn}-${String(mm).padStart(2, "0")}: already translated, skipping`);
        continue;
      }
      const userText = await Bun.file(join(chunksDirAbs, f)).text();
      console.error(`ch${nn}-${String(mm).padStart(2, "0")}: translating ${userText.split(/\s+/).length} words`);
      const result = await callClaude({ systemPrompt, userText });
      if (!result.ok || !result.text) {
        await Bun.write(errPath, result.error ?? "unknown error");
        console.error(`ch${nn}-${String(mm).padStart(2, "0")}: ERROR, wrote ${errPath}`);
        continue;
      }
      const resolved = resolveBibleSentinels(result.text, bible);
      await Bun.write(outPath, resolved.output + "\n");
      if (existsSync(errPath)) unlinkSync(errPath);
      if (resolved.unresolved.length) {
        console.error(`ch${nn}-${String(mm).padStart(2, "0")}: ${resolved.unresolved.length} unresolved Bible refs: ${resolved.unresolved.slice(0, 3).join("; ")}`);
      }
      console.error(`ch${nn}-${String(mm).padStart(2, "0")}: wrote ${outPath}`);
    }
  }
}

async function cmdAssemble(book: TranslateBookConfig, chapter: number | null, force: boolean): Promise<void> {
  void force;
  const entries = selectChapters(await loadChapters(book), chapter);
  for (const c of entries) {
    const nn = String(c.number).padStart(2, "0");
    const translatedDirAbs = absPath(book, book.translatedDir);
    const { body, unresolved, chunkCount } = await assembleBody(translatedDirAbs, c.number);
    if (unresolved.length) {
      console.error(`ch${nn}: WARNING — ${unresolved.length} unresolved Bible sentinels`);
    }
    await writeChapter(hugoChapterPath(book, c.number), body);
    console.error(`ch${nn}: assembled ${chunkCount} chunks → chuong-${nn}.md`);
  }
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd) {
    console.error("Usage: bun scripts/egw_translate/run.ts <chunk|translate|assemble|all> --book <slug> [--chapter N] [--force]");
    return 1;
  }
  const bookIdx = rest.indexOf("--book");
  const slug = bookIdx >= 0 ? rest[bookIdx + 1] : undefined;
  if (!slug) {
    console.error("--book <slug> is required");
    return 1;
  }
  const book = BOOKS[slug];
  if (!book) {
    console.error(`Unknown book: ${slug}. Known: ${Object.keys(BOOKS).join(", ")}`);
    return 1;
  }
  const chIdx = rest.indexOf("--chapter");
  const chapter = chIdx >= 0 ? Number(rest[chIdx + 1]) : null;
  const force = rest.includes("--force");

  switch (cmd) {
    case "chunk": await cmdChunk(book, chapter, force); return 0;
    case "translate": await cmdTranslate(book, chapter, force); return 0;
    case "assemble": await cmdAssemble(book, chapter, force); return 0;
    case "all":
      await cmdChunk(book, chapter, force);
      await cmdTranslate(book, chapter, force);
      await cmdAssemble(book, chapter, force);
      return 0;
    default:
      console.error(`Unknown command: ${cmd}`);
      return 1;
  }
}

const code = await main(process.argv.slice(2));
process.exit(code);
