# COLP source scraper

## Context

The Vietnamese translation stub for *Những Lời Ví Dụ Của Đấng Christ* (Ellen G. White, *Christ's Object Lessons*, book id 15 on egwwritings.org) lives at `content/sach/egw/nhung-loi-vi-du-cua-dang-christ/` with 30 empty chapter files. We need the English source text to translate from.

The previous book (Great Controversy, book id 132) was scraped with a Python pipeline at `scripts/gc_translation/`. That pipeline assumes Python is on PATH — but this environment only has Bun. The Python scripts were run elsewhere; we cannot rerun them here.

## Goal

Produce, for book 15, the same on-disk artifacts the GC pipeline produces for book 132 — a TOC manifest plus per-chapter raw HTML and extracted plain text — using TypeScript on Bun.

Out of scope: chunking, translation, assembly. Those happen later and are not constrained by this spec.

## Architecture

A small TypeScript module under `scripts/egw_scrape/` with a per-book config file. Bun runs it directly.

```
scripts/egw_scrape/
  scrape.ts              CLI entry
  books/
    colp.ts              BookConfig for Christ's Object Lessons
  lib/
    fetch.ts             throttled fetch with User-Agent
    parse.ts             TOC parser + chapter extractor
    types.ts             BookConfig type
```

Per-book config keeps the script reusable for future EGW books (next time: add `books/foo.ts`, run `bun scrape.ts foo all`).

## Components

### `lib/types.ts`

```ts
export interface BookConfig {
  slug: string;
  bookId: number;
  chapters: number;          // expected count, used as a sanity check
  tocUrl: string;
  sourceDir: string;         // repo-relative
  skipPrefixes: string[];    // TOC entries starting with these are dropped
}

export interface ChapterEntry {
  number: number;
  enTitle: string;
  url: string;
}
```

### `books/colp.ts`

```ts
export const colp: BookConfig = {
  slug: "colp",
  bookId: 15,
  chapters: 30,
  tocUrl: "https://m.egwwritings.org/en/book/15/toc",
  sourceDir: "data/colp-source",
  skipPrefixes: ["Preface", "Introduction", "Contents", "Appendix", "Index"],
};
```

### `lib/fetch.ts`

Single function `fetchUrl(url: string): Promise<string>`:

- Uses Bun's native `fetch`
- User-Agent header `phucam.tv-egw-scraper/1.0 (contact: site admin)`
- 30s timeout via `AbortSignal.timeout(30_000)`
- Throws on non-2xx with status + URL in the error message

Throttling is the caller's responsibility (see scrape loop).

### `lib/parse.ts`

Two pure functions, no I/O:

**`parseToc(html: string, book: BookConfig): ChapterEntry[]`**

Mirrors `scrape_toc.py:parse_toc`:

- Find all `<a href>` whose href contains `/book/{bookId}.` or `/book/{bookId}/`
- Drop empty text and texts in `{contents, back, next, read, details}` (case-insensitive)
- Drop URLs ending in `/info` or `.0`
- Dedupe by URL
- Drop entries whose title starts with any `skipPrefixes` value
- Number remaining entries 1..N in order
- Resolve relative hrefs against `https://m.egwwritings.org`

Implementation: use Bun's `HTMLRewriter` to collect anchors into an array, then filter.

**`extractChapter(html: string): { title: string; text: string }`**

Mirrors `scrape_chapter.py:extract_chapter`:

- Title = first `<h1>` text content
- Body = walk `<article>` (fallback `<body>`) in document order, emit one line per `h2|h3|p`:
  - `h2`/`h3` → `## {text}` (the GC pipeline already keys off this marker for chunking, so preserve exactly)
  - `p` → `{text}`
  - Skip empty
- Join lines with `\n\n`

Implementation note: `HTMLRewriter` is event-based, so scoping emission to "inside `<article>`" requires entering/exiting handlers on the `article` element to flip a boolean gate, then conditionally emitting in `h2|h3|p` handlers. If that proves awkward against the actual page markup, fall back to `cheerio` (Bun-compatible, single dep). Either implementation must satisfy the input/output contract above.

### `scrape.ts` (CLI)

```
bun scripts/egw_scrape/scrape.ts <book-slug> <command> [--force]

commands:
  toc        fetch TOC, write {sourceDir}/chapters.json
  chapters   for each entry in chapters.json: fetch + extract, write chNN.html and chNN.txt
  all        toc then chapters
```

Behavior:

- Resolve `<book-slug>` against a small registry (`{ colp }`) in `scrape.ts`. Unknown slug → exit 1.
- `mkdir -p` the source dir.
- TOC sanity check: if `parseToc` returns a count != `book.chapters`, print a warning to stderr but still write the file. Operator can hand-edit before running `chapters`.
- Chapter loop: skip if both `chNN.html` and `chNN.txt` exist and `--force` not set. Sleep 1s between fetches.
- Output text file format: `# {title}\n\n{body}\n` (matches the Python version byte-for-byte where possible).

## File layout produced

```
data/colp-source/
  chapters.json          [{number, enTitle, url}, ...]
  ch01.html              raw HTML as fetched
  ch01.txt               # Title \n\n para \n\n ## Heading \n\n para ...
  ch02.html
  ch02.txt
  ...
  ch30.html
  ch30.txt
```

`data/colp-source/` is a new directory; nothing else writes there.

## Errors and edge cases

- **Network failure / non-2xx:** fail loudly. Operator reruns; existing successful chapters are skipped.
- **TOC count mismatch:** warn + write anyway. The Python version did the same; this gives the operator a chance to inspect.
- **Empty `<article>`:** `extractChapter` returns empty body. The downstream `# {title}\n\n\n` is harmless; warning printed.
- **HTML structure change at egwwritings.org:** out of scope. Bug surfaces as missing or misaligned text; operator inspects HTML and patches `parse.ts`.

## Testing

Manual verification only — this script runs once per book and the output is human-inspected before translation. No automated tests.

Verification steps:

1. Run `bun scripts/egw_scrape/scrape.ts colp toc`. Confirm `chapters.json` has 30 entries with sensible titles ("Teaching in Parables", "The Sower Went Forth to Sow", etc.).
2. Run `bun scripts/egw_scrape/scrape.ts colp chapters`. Confirm 30 `.html` + 30 `.txt` files.
3. Spot-check `ch01.txt` and `ch15.txt`: title on line 1, paragraphs separated by blank lines, h2 lines start with `## `.
4. Diff one chapter's text format against an existing `data/gc-source/chNN.txt` (if present locally) to confirm structural parity.

## Non-goals

- Generalizing the existing Python pipeline.
- Touching the existing `scripts/gc_translation/` Python code.
- Translation, chunking, or Hugo emission.
- Caching beyond "skip if file exists".
- Concurrent fetching. 1s sequential is polite and fast enough for 30 chapters.
