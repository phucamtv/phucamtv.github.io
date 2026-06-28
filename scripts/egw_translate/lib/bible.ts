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

/** One chapter and its verse spans, e.g. { chapter: 8, spans: [[28, 28]] }. */
export interface RefSegment {
  chapter: number;
  spans: Array<[number, number]>;
}

export interface ParsedRef {
  canonicalBook: string;                // key used for vi1934.json lookup (e.g., "Matthew")
  viBook: string;                       // Vietnamese display name (e.g., "Ma-thi-ơ")
  chapter: number;                      // first segment's chapter (back-compat)
  verseSpans: Array<[number, number]>;  // first segment's spans (back-compat)
  segments: RefSegment[];               // all chapter/verse segments, in order
  display: string;                      // reproduced ref for the cite line, e.g., "24:20-25" or "8:28,6:57"
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
 * Parse a sentinel body like "Matthew 24:20", "Luke 15:1,4", "Jude 3",
 * "Matt 24:20-25", or a multi-chapter list "John 8:28,6:57,8:50,7:18".
 *
 * Within the verse spec, comma-separated groups normally share the chapter from
 * the first group (e.g. "15:1,4" → 15:1 and 15:4). A group carrying its own colon
 * (e.g. "8:28,6:57") starts a new chapter for the verses that follow.
 */
export function parseRef(body: string, lookup: BibleLookup): ParsedRef | null {
  // Allow each comma group to optionally carry its own "chapter:" prefix.
  const m = body.trim().match(/^(\d?\s?[A-Za-z][A-Za-z. ]*?)\s+(\d+(?::\d+(?:-\d+)?)?(?:,(?:\d+:)?\d+(?:-\d+)?)*)$/);
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

  const segments: RefSegment[] = [];

  if (spec.includes(":")) {
    // Walk comma groups, carrying the chapter forward until a group overrides it.
    let chapter = 0;
    for (const group of spec.split(",")) {
      let versePart = group;
      if (group.includes(":")) {
        const [chStr, vStr] = group.split(":");
        chapter = Number(chStr);
        versePart = vStr;
      }
      if (chapter === 0) return null; // first group must establish a chapter
      const spans = parseVerseSpec(versePart);
      const last = segments[segments.length - 1];
      if (last && last.chapter === chapter) last.spans.push(...spans);
      else segments.push({ chapter, spans });
    }
  } else {
    if (!SINGLE_CHAPTER_BOOKS.has(canonical)) return null;
    segments.push({ chapter: 1, spans: parseVerseSpec(spec) });
  }

  const first = segments[0];
  return {
    canonicalBook: canonical,
    viBook: viName,
    chapter: first.chapter,
    verseSpans: first.spans,
    segments,
    display: spec,
  };
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
 * Resolve a parsed ref to the concatenated Vietnamese verse text.
 *
 * Individual verses absent from VI1934 are skipped — some verses (e.g. Mark 9:44,
 * Matthew 17:21) are genuinely omitted from the 1934 text, and a range that spans
 * such a gap should still resolve from the verses that ARE present. Returns null
 * only when the reference resolves to no verses at all (a truly bad reference).
 */
export function lookupVerses(ref: ParsedRef, lookup: BibleLookup): string | null {
  const parts: string[] = [];
  for (const seg of ref.segments) {
    for (const [from, to] of seg.spans) {
      for (let v = from; v <= to; v++) {
        const key = `${ref.canonicalBook} ${seg.chapter}:${v}`;
        const text = lookup.verses.get(key);
        if (text != null) parts.push(text);
      }
    }
  }
  return parts.length ? parts.join(" ") : null;
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
