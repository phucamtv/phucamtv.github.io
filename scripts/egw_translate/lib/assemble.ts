import { readdirSync } from "fs";
import { join } from "path";
import { lintText, findUnresolvedBibleSentinels } from "./lint";
import { resolveBibleSentinels, type BibleLookup } from "./bible";

const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)([\s\S]*)$/;

/**
 * Read all translated chunks for a chapter, concatenate in numeric order, and return
 * the assembled Vietnamese body (lint already applied).
 *
 * If `bible` is supplied, a final sentinel-resolution pass runs over the whole body.
 * Per-chunk resolution already happened at translate time, but resolving again here
 * catches sentinels left unresolved under an older resolver — so resolver fixes can
 * be applied by re-assembling, without re-calling the model.
 */
export async function assembleBody(
  translatedDir: string,
  chapter: number,
  bible?: BibleLookup,
): Promise<{
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
  let raw = parts.join("\n\n");
  if (bible) raw = resolveBibleSentinels(raw, bible).output;
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
