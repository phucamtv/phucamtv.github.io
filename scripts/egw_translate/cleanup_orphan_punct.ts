/**
 * One-off cleanup for chapter files translated BEFORE the bible.ts regex fix
 * (commit 44d95e7's successor, which now consumes one trailing punctuation char
 * on each [[BIBLE:...]] sentinel). Walks each chuong-NN.md body, splits on blank
 * lines, drops paragraphs that are purely punctuation, and re-attaches a bare
 * leading `. COL N.M` (or similar) to the previous cite line, matching the GC
 * pipeline convention: `> <cite>(Book Ch:Vs)</cite> COL 17.1`.
 *
 * Idempotent: running it twice produces the same output.
 *
 * Usage: bun scripts/egw_translate/cleanup_orphan_punct.ts
 */
import { colp } from "./books/colp";
import { hugoChapterPath } from "./lib/paths";

const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;

function cleanupBody(body: string, citationPrefix: string): string {
  const citeRe = new RegExp(`^(${citationPrefix}\\s+\\d+\\.\\d+)\\s*$`);
  const paragraphs = body.split(/\n\n/);
  const out: string[] = [];
  for (const raw of paragraphs) {
    // Drop paragraphs that are purely punctuation / whitespace (orphaned ; . , : between blockquotes).
    if (/^[\s.,;:!?()\[\]{}'"`]+$/.test(raw)) continue;

    // Strip a leading punctuation+space from any paragraph, e.g. ". COL 421.2" → "COL 421.2".
    const p = raw.replace(/^[.,;:]\s+/, "");

    // If the paragraph is now just a bare citation (e.g., "COL 421.2") and the
    // previous paragraph is a blockquote ending in </cite>, attach the citation
    // to the cite line.
    const citeMatch = p.match(citeRe);
    if (citeMatch && out.length > 0 && out[out.length - 1].endsWith("</cite>")) {
      out[out.length - 1] = `${out[out.length - 1]} ${citeMatch[1]}`;
      continue;
    }
    out.push(p);
  }
  return out.join("\n\n");
}

async function processChapter(path: string, citationPrefix: string): Promise<boolean> {
  const text = await Bun.file(path).text();
  const m = text.match(FRONTMATTER_RE);
  if (!m) throw new Error(`no frontmatter in ${path}`);
  const [, frontmatter, body] = m;
  const cleaned = cleanupBody(body.trim(), citationPrefix);
  const next = `${frontmatter}\n${cleaned}\n`;
  if (next === text) return false;
  await Bun.write(path, next);
  return true;
}

let changed = 0;
for (let n = 1; n <= colp.chapters; n++) {
  const path = hugoChapterPath(colp, n);
  const didChange = await processChapter(path, colp.paragraphCitationPrefix);
  const nn = String(n).padStart(2, "0");
  console.error(`chuong-${nn}.md: ${didChange ? "cleaned" : "no changes"}`);
  if (didChange) changed++;
}
console.error(`---\n${changed} of ${colp.chapters} files updated.`);
