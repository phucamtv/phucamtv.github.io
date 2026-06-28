/**
 * Extract EGW book source from the White Estate EPUB (media2.egwwritings.org).
 *
 * Used when the live egwwritings.org chapter pages are unreachable (Cloudflare
 * challenge) but the official EPUB download is open. The EPUB carries clean,
 * paginated XHTML with embedded `pagebreak` spans whose `title` attribute is the
 * print page number — enough to reconstruct the canonical `<PREFIX> N.M`
 * paragraph citations egwwritings.org shows on the web.
 *
 * Output matches the `egw_scrape` scrape stage byte-for-byte in shape:
 *   data/<book>-source/chapters.json   — [{ number, enTitle, url }]
 *   data/<book>-source/chNN.txt        — "# Title\n\n<paragraphs with citations>"
 * so the downstream chunk → translate → assemble pipeline is unchanged.
 *
 * Usage:
 *   bun scripts/egw_scrape/extract_epub.ts <book-slug> [--force]
 */
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { unzipSync } from "zlib";

import { da } from "./books/da";
import { fetchUrl } from "./lib/fetch";
import type { BookConfig, ChapterEntry } from "./lib/types";

const REPO_ROOT = `${import.meta.dir}/../..`;
const BOOKS: Record<string, BookConfig> = { da };

/** A paragraph paired with the print page it begins on. */
export interface ExtractedPara {
  text: string;
  page: number;
}

/** Decode the small set of named/numeric HTML entities that appear in EGW XHTML. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Strip all tags from an inner-HTML fragment and normalise whitespace. */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/**
 * Extract the chapter title from `<h2 class="chapterhead">`, dropping the
 * "Chapter N—" prefix so the txt header is the bare title (matches scrape.ts).
 */
export function extractTitle(xhtml: string): string {
  const m = /<h2[^>]*class="chapterhead"[^>]*>([\s\S]*?)<\/h2>/i.exec(xhtml);
  const raw = m ? stripTags(m[1]) : "";
  return raw.replace(/^Chapter\s+\d+[—–-]\s*/, "");
}

/**
 * Walk the chapter body in document order, emitting one ExtractedPara per `<p>`.
 *
 * Page tracking: a `<span ... class="pagebreak" title="N">[N]</span>` marks where
 * print page N begins (it sits mid-paragraph). The canonical citation for a
 * paragraph is `<page>.<ordinal>` where `page` is the page in effect when the
 * paragraph STARTS — a paragraph that contains a `[N]` break still belongs to the
 * page before that break (it began earlier). The chapter's opening page is
 * implicit: it is `firstMarkerPage - 1`.
 */
// A pagebreak span, attribute order independent: `<span ... class="pagebreak" ...>`
// where `title="N"` may appear before or after the class. Capture the page number.
const PAGEBREAK_RE = /<span\b[^>]*\bclass="[^"]*\bpagebreak\b[^"]*"[^>]*>/gi;
// Whole pagebreak element including its visible "[N]" text, for removal.
const PAGEBREAK_SPAN_RE = /<span\b[^>]*\bclass="[^"]*\bpagebreak\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi;
const TITLE_RE = /\btitle="(\d+)"/i;

function pageNumOf(spanTag: string): number | null {
  const m = TITLE_RE.exec(spanTag);
  return m ? Number(m[1]) : null;
}

export function extractParagraphs(xhtml: string): ExtractedPara[] {
  // Discover the first pagebreak's page number to seed the opening page.
  PAGEBREAK_RE.lastIndex = 0;
  const firstSpan = PAGEBREAK_RE.exec(xhtml);
  const firstPage = firstSpan ? pageNumOf(firstSpan[0]) : null;
  let currentPage = firstPage !== null ? firstPage - 1 : 1;

  const paras: ExtractedPara[] = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(xhtml)) !== null) {
    const inner = m[1];
    // The paragraph's page is whatever is in effect as it begins, BEFORE
    // consuming any pagebreak markers inside it.
    const startPage = currentPage;

    // Advance currentPage for every pagebreak marker inside this paragraph, so
    // the next paragraph starts on the right page.
    PAGEBREAK_RE.lastIndex = 0;
    let b: RegExpExecArray | null;
    while ((b = PAGEBREAK_RE.exec(inner)) !== null) {
      const pg = pageNumOf(b[0]);
      if (pg !== null) currentPage = pg;
    }

    // Remove pagebreak spans entirely (tag + their visible "[20]" text) — they
    // are print-page artifacts that must not appear in the reading text. The page
    // advance was already recorded above. Collapse the resulting double space.
    const cleaned = inner.replace(PAGEBREAK_SPAN_RE, " ");
    const text = stripTags(cleaned);
    if (!text) continue;
    paras.push({ text, page: startPage });
  }
  return paras;
}

/** Append canonical `<PREFIX> page.ordinal` citations, resetting ordinal per page. */
export function withCitations(paras: ExtractedPara[], prefix: string): string[] {
  const ordinalByPage = new Map<number, number>();
  return paras.map((p) => {
    const ord = (ordinalByPage.get(p.page) ?? 0) + 1;
    ordinalByPage.set(p.page, ord);
    return `${p.text} ${prefix} ${p.page}.${ord}`;
  });
}

/** content<NN>.xhtml within the EPUB for chapter n (content01 = chapter 1). */
function chapterEntryName(n: number): string {
  return `OEBPS/content${String(n).padStart(2, "0")}.xhtml`;
}

async function downloadEpub(book: BookConfig, force: boolean): Promise<string> {
  const dir = join(REPO_ROOT, book.sourceDir);
  mkdirSync(dir, { recursive: true });
  const epubPath = join(dir, `${book.slug}.epub`);
  if (!force && existsSync(epubPath)) {
    console.error(`epub: already downloaded, skipping`);
    return epubPath;
  }
  if (!book.epubUrl) throw new Error(`book ${book.slug} has no epubUrl`);
  console.error(`epub: downloading ${book.epubUrl}`);
  const bytes = await fetchBinary(book.epubUrl);
  await Bun.write(epubPath, bytes);
  console.error(`epub: wrote ${epubPath} (${bytes.byteLength} bytes)`);
  return epubPath;
}

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  // fetch.ts returns text; binary needs its own call but the same UA hygiene.
  const resp = await fetch(url, {
    headers: { "User-Agent": "phucam.tv-egw-scraper/1.0 (contact: site admin)" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok) throw new Error(`download failed ${resp.status} ${resp.statusText}: ${url}`);
  return await resp.arrayBuffer();
}

/** Read the named entries out of a zip (EPUB) using Bun's built-in unzip. */
async function readEpubEntries(epubPath: string, names: string[]): Promise<Map<string, string>> {
  // Bun can shell out to `unzip`, but reading via the zip central directory keeps
  // us dependency-free. Use `unzip -p` per entry — simplest and robust for ~88 files.
  const out = new Map<string, string>();
  for (const name of names) {
    const proc = Bun.spawn(["unzip", "-p", epubPath, name], { stdout: "pipe", stderr: "pipe" });
    const [text, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) throw new Error(`unzip ${name} failed: ${err.trim()}`);
    out.set(name, text);
  }
  void unzipSync; // (kept import available if we move to in-process inflate later)
  return out;
}

async function main(argv: string[]): Promise<number> {
  const [slug, ...rest] = argv;
  if (!slug) {
    console.error("Usage: bun scripts/egw_scrape/extract_epub.ts <book-slug> [--force]");
    return 1;
  }
  const book = BOOKS[slug];
  if (!book) {
    console.error(`Unknown book slug: ${slug}. Known: ${Object.keys(BOOKS).join(", ")}`);
    return 1;
  }
  const force = rest.includes("--force");
  const prefix = book.paragraphCitationPrefix ?? slug.toUpperCase();

  const epubPath = await downloadEpub(book, force);

  const dir = join(REPO_ROOT, book.sourceDir);
  const names = Array.from({ length: book.chapters }, (_, i) => chapterEntryName(i + 1));
  const entries = await readEpubEntries(epubPath, names);

  const manifest: ChapterEntry[] = [];
  for (let n = 1; n <= book.chapters; n++) {
    const xhtml = entries.get(chapterEntryName(n))!;
    const title = extractTitle(xhtml) || `Chapter ${n}`;
    const paras = extractParagraphs(xhtml);
    const lines = withCitations(paras, prefix);
    const txtPath = join(dir, `ch${String(n).padStart(2, "0")}.txt`);
    await Bun.write(txtPath, `# ${title}\n\n${lines.join("\n\n")}\n`);
    manifest.push({ number: n, enTitle: title, url: `epub:${chapterEntryName(n)}` });
    console.error(`ch${String(n).padStart(2, "0")}: ${paras.length} paragraphs → ${txtPath}`);
  }

  await Bun.write(
    join(dir, "chapters.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.error(`wrote chapters.json (${manifest.length} chapters)`);
  return 0;
}

if (import.meta.main) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
