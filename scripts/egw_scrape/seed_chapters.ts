/**
 * Seed COLP Vietnamese stub chapter files with English source from data/colp-source/.
 * Frontmatter is preserved; the body is replaced with the source paragraphs (the
 * source's `# Title` first line is dropped — the Vietnamese title already lives
 * in the frontmatter).
 *
 * Usage: bun scripts/egw_scrape/seed_chapters.ts
 */

const HUGO_DIR = `${import.meta.dir}/../../content/sach/egw/nhung-loi-vi-du-cua-dang-christ`;
const SOURCE_DIR = `${import.meta.dir}/../../data/colp-source`;
const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;
const CHAPTERS = 29;

for (let n = 1; n <= CHAPTERS; n++) {
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
