import { parseYaml } from "./yaml";

const SINGLE_CHAPTER_BOOKS = new Set(["Obadiah", "Philemon", "2 John", "3 John", "Jude"]);

export interface BibleLookup {
  bookNames: Map<string, string>;       // English → Vietnamese
  verses: Map<string, string>;          // "Book Ch:Vs" → text
}

export async function loadBibleLookup(refsPath: string, versesPath: string): Promise<BibleLookup> {
  const refsText = await Bun.file(refsPath).text();
  const parsedRefs = parseYaml(refsText);
  const bookNames = new Map<string, string>();
  for (const [en, vi] of Object.entries(parsedRefs)) {
    if (typeof vi === "string") bookNames.set(en, vi);
  }
  const versesJson = JSON.parse(await Bun.file(versesPath).text()) as Record<string, string>;
  const verses = new Map<string, string>(Object.entries(versesJson));
  return { bookNames, verses };
}

export interface ParsedRef {
  canonicalBook: string;                // key used for vi1934.json lookup (e.g., "Matthew")
  viBook: string;                       // Vietnamese display name (e.g., "Ma-thi-ơ")
  chapter: number;
  verseSpans: Array<[number, number]>;  // e.g., [[20, 25]] or [[1, 1], [4, 4]]
  display: string;                      // reproduced ref for the cite line, e.g., "24:20-25" or "1:1,4"
}

/**
 * Find the canonical English book key for a name. Tries exact, then case-insensitive.
 */
function findBookKey(raw: string, bookNames: Map<string, string>): string | null {
  if (bookNames.has(raw)) return raw;
  const lower = raw.toLowerCase();
  for (const key of bookNames.keys()) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

/**
 * Parse a sentinel body like "Matthew 24:20", "Luke 15:1,4", "Jude 3", "Matt 24:20-25".
 */
export function parseRef(body: string, lookup: BibleLookup): ParsedRef | null {
  const m = body.trim().match(/^(\d?\s?[A-Za-z][A-Za-z. ]*?)\s+(\d+(?::\d+(?:[-,]\d+)*)?)$/);
  if (!m) return null;
  const rawBook = m[1].replace(/\s+/g, " ").trim();
  const spec = m[2].trim();

  const bookKey = findBookKey(rawBook, lookup.bookNames);
  if (!bookKey) return null;

  // Follow aliases: bible-refs.yaml maps both "Matt" and "Matthew" to "Ma-thi-ơ".
  // The canonical English book key (used for vi1934.json lookup) is the longest English
  // form pointing to the same Vietnamese name.
  const viName = lookup.bookNames.get(bookKey)!;
  let canonical = bookKey;
  for (const [en, vi] of lookup.bookNames) {
    if (vi === viName && en.length > canonical.length) canonical = en;
  }

  let chapter: number;
  let verseSpans: Array<[number, number]>;
  let display: string;

  if (spec.includes(":")) {
    const [chStr, versesStr] = spec.split(":");
    chapter = Number(chStr);
    verseSpans = parseVerseSpec(versesStr);
    display = `${chapter}:${versesStr}`;
  } else {
    if (!SINGLE_CHAPTER_BOOKS.has(canonical)) return null;
    chapter = 1;
    verseSpans = parseVerseSpec(spec);
    display = spec;
  }
  return { canonicalBook: canonical, viBook: viName, chapter, verseSpans, display };
}

function parseVerseSpec(s: string): Array<[number, number]> {
  const parts = s.split(",");
  const out: Array<[number, number]> = [];
  for (const p of parts) {
    if (p.includes("-")) {
      const [a, b] = p.split("-").map(Number);
      out.push([a, b]);
    } else {
      const n = Number(p);
      out.push([n, n]);
    }
  }
  return out;
}

/**
 * Resolve a parsed ref to the concatenated Vietnamese verse text. Returns null if any
 * verse is missing from the verses map.
 */
export function lookupVerses(ref: ParsedRef, lookup: BibleLookup): string | null {
  const parts: string[] = [];
  for (const [from, to] of ref.verseSpans) {
    for (let v = from; v <= to; v++) {
      const key = `${ref.canonicalBook} ${ref.chapter}:${v}`;
      const text = lookup.verses.get(key);
      if (text == null) return null;
      parts.push(text);
    }
  }
  return parts.join(" ");
}

/**
 * Replace every [[BIBLE:...]] sentinel in `text` with a formatted blockquote.
 * Unresolved sentinels are left in place; the caller can grep for them.
 */
export function resolveBibleSentinels(text: string, lookup: BibleLookup): { output: string; unresolved: string[] } {
  const unresolved: string[] = [];
  // Mirror gc_translation/bible.py SENTINEL_RE: consume optional wrapping parens
  // and one trailing punctuation char so they don't get orphaned when the sentinel
  // is replaced by an isolated blockquote paragraph.
  const replaced = text.replace(/[ \t]*\(?\[\[BIBLE:([^\]]+)\]\]\)?[.,;:!?]?[ \t]*/g, (match, body: string) => {
    const ref = parseRef(body, lookup);
    if (!ref) {
      unresolved.push(body.trim());
      return match;
    }
    const verseText = lookupVerses(ref, lookup);
    if (verseText == null) {
      unresolved.push(body.trim());
      return match;
    }
    // Wrap with blank lines so the blockquote always becomes its own paragraph,
    // even when the model emitted the sentinel mid-sentence. Trailing collapse
    // normalizes runs of >2 newlines back to a single paragraph break.
    return `\n\n> "${verseText}"\n> <cite>(${ref.viBook} ${ref.display})</cite>\n\n`;
  });
  const output = replaced.replace(/\n{3,}/g, "\n\n").trim();
  return { output, unresolved };
}
