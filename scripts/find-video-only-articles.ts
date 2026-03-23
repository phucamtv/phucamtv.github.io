/**
 * Scan all article .md files and find ones that only contain
 * YouTube/Playlist shortcodes with no real text content.
 *
 * Usage: bun scripts/find-video-only-articles.ts
 */

import { Glob } from "bun";

const CONTENT_DIR = `${import.meta.dir}/../content/articles`;

// Patterns that are NOT real content (shortcodes, headings-only like "## Phần 1")
const NON_CONTENT_PATTERN =
  /^\s*$|^\s*\{\{[<\%].*[>\%]\}\}\s*$|^\s*#{1,6}\s+(Phần|Part)\s+\d+\s*$/;

function extractBody(raw: string): string {
  // Strip YAML frontmatter
  const match = raw.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1] : raw;
}

function isVideoOnly(body: string): boolean {
  const lines = body.split("\n");
  for (const line of lines) {
    if (!NON_CONTENT_PATTERN.test(line)) {
      return false;
    }
  }
  return true;
}

function extractTitle(raw: string): string {
  const m = raw.match(/^title:\s*"(.+?)"/m);
  return m ? m[1] : "(no title)";
}

const glob = new Glob("**/*.md");
const results: { path: string; title: string }[] = [];

for await (const file of glob.scan(CONTENT_DIR)) {
  const fullPath = `${CONTENT_DIR}/${file}`;
  const raw = await Bun.file(fullPath).text();
  const body = extractBody(raw);
  const title = extractTitle(raw);

  if (body.trim().length > 0 && isVideoOnly(body)) {
    results.push({ path: file, title });
  }
}

results.sort((a, b) => a.path.localeCompare(b.path));

console.log(`# Bài viết chỉ có YouTube video (${results.length} bài)\n`);
for (const r of results) {
  console.log(`- [ ] ${r.title} (\`articles/${r.path}\`)`);
}
