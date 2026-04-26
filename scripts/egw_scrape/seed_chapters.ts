/**
 * Seed Vietnamese stub chapter files with English source from data/<slug>-source/.
 * Frontmatter is preserved; the body is replaced with the source paragraphs (the
 * source's `# Title` first line is dropped — the Vietnamese title already lives
 * in the frontmatter).
 *
 * Usage: bun scripts/egw_scrape/seed_chapters.ts <slug>
 */
import { colp } from "../egw_translate/books/colp";
import { lde } from "../egw_translate/books/lde";
import type { TranslateBookConfig } from "../egw_translate/lib/types";

const BOOKS: Record<string, TranslateBookConfig> = { colp, lde };
const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;

const slug = process.argv[2];
if (!slug || !BOOKS[slug]) {
  console.error(`Usage: bun scripts/egw_scrape/seed_chapters.ts <slug>`);
  console.error(`Known slugs: ${Object.keys(BOOKS).join(", ")}`);
  process.exit(1);
}

const book = BOOKS[slug];
const HUGO_DIR = `${import.meta.dir}/../../${book.hugoBookDir}`;
const SOURCE_DIR = `${import.meta.dir}/../../${book.sourceDir}`;

for (let n = 1; n <= book.chapters; n++) {
  const nn = String(n).padStart(2, "0");
  const sourcePath = `${SOURCE_DIR}/ch${nn}.txt`;
  const targetPath = `${HUGO_DIR}/chuong-${nn}.md`;

  const source = await Bun.file(sourcePath).text();
  const body = source.replace(/^#[^\n]*\n+/, "").trimEnd();

  const stub = await Bun.file(targetPath).text();
  const m = stub.match(FRONTMATTER_RE);
  if (!m) throw new Error(`no frontmatter in ${targetPath}`);
  const frontmatter = m[1];

  await Bun.write(targetPath, `${frontmatter}\n${body}\n`);
  console.error(`seeded chuong-${nn}.md`);
}
