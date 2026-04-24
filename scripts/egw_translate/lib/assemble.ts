import { readdirSync } from "fs";
import { join } from "path";
import { lintText, findUnresolvedBibleSentinels } from "./lint";

const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;

/**
 * Read all translated chunks for a chapter, concatenate in numeric order, and return
 * the assembled Vietnamese body (lint already applied).
 */
export async function assembleBody(translatedDir: string, chapter: number): Promise<{
  body: string;
  unresolved: string[];
  chunkCount: number;
}> {
  const nn = String(chapter).padStart(2, "0");
  const entries = readdirSync(translatedDir)
    .filter((f) => f.startsWith(`ch${nn}-`) && f.endsWith(".md"))
    .sort();
  if (entries.length === 0) {
    throw new Error(`no translated chunks found for chapter ${chapter} in ${translatedDir}`);
  }
  const parts: string[] = [];
  for (const f of entries) {
    const text = (await Bun.file(join(translatedDir, f)).text()).trim();
    if (text) parts.push(text);
  }
  const raw = parts.join("\n\n");
  const body = lintText(raw);
  const unresolved = findUnresolvedBibleSentinels(body);
  return { body, unresolved, chunkCount: entries.length };
}

/**
 * Write the assembled body into the Hugo chapter file, preserving the existing frontmatter.
 */
export async function writeChapter(hugoPath: string, body: string): Promise<void> {
  const existing = await Bun.file(hugoPath).text();
  const m = existing.match(FRONTMATTER_RE);
  if (!m) throw new Error(`no frontmatter in ${hugoPath}`);
  const frontmatter = m[1];
  await Bun.write(hugoPath, `${frontmatter}\n${body}\n`);
}
