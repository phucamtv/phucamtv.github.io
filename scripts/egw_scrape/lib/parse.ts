import type { BookConfig, ChapterEntry } from "./types";

const ORIGIN = "https://m.egwwritings.org";
const SKIP_TEXTS = new Set(["contents", "back", "next", "read", "details"]);

interface RawAnchor {
  href: string;
  text: string;
}

function collectAnchors(html: string): RawAnchor[] {
  const anchors: RawAnchor[] = [];
  let current: RawAnchor | null = null;
  new HTMLRewriter()
    .on("a[href]", {
      element(el) {
        current = { href: el.getAttribute("href") ?? "", text: "" };
        anchors.push(current);
        el.onEndTag(() => {
          current = null;
        });
      },
      text(t) {
        if (current) current.text += t.text;
      },
    })
    .transform(new Response(html));
  return anchors;
}

export function parseToc(html: string, book: BookConfig): ChapterEntry[] {
  const anchors = collectAnchors(html);
  const seen = new Set<string>();
  const out: ChapterEntry[] = [];

  const bookDot = `/book/${book.bookId}.`;
  const bookSlash = `/book/${book.bookId}/`;
  const skipPrefixes = book.skipPrefixes;

  for (const a of anchors) {
    const text = a.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (SKIP_TEXTS.has(text.toLowerCase())) continue;

    const href = a.href;
    if (!href.includes(bookDot) && !href.includes(bookSlash)) continue;

    const url = href.startsWith("http") ? href : `${ORIGIN}${href}`;
    if (url.endsWith("/info") || url.endsWith(".0") || url.endsWith("/toc")) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    if (skipPrefixes.some((p) => text.startsWith(p))) continue;

    out.push({ number: 0, enTitle: text, url });
  }

  return out.map((c, i) => ({ ...c, number: i + 1 }));
}

interface Block {
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";
  text: string;
  paraId: number | null;
  isHeading: boolean;
}

interface PageContent {
  blocks: Block[];
  nextUrl: string | null;
  nextParaId: number | null;
}

const BLOCK_TAGS = "h1, h2, h3, h4, h5, h6, p";

function parsePagedContent(html: string): PageContent {
  let inMain = false;
  let current: Block | null = null;
  const blocks: Block[] = [];
  let nextHref: string | null = null;

  new HTMLRewriter()
    .on("main#main_content", {
      element(el) {
        inMain = true;
        el.onEndTag(() => {
          inMain = false;
        });
      },
    })
    .on("li.next a[href]", {
      element(el) {
        if (!nextHref) {
          nextHref = el.getAttribute("href");
        }
      },
    })
    .on(BLOCK_TAGS, {
      element(el) {
        if (!inMain) return;
        const klass = el.getAttribute("class") ?? "";
        if (!/\begw_content_wrapper\b/.test(klass)) return;
        const paraIdAttr = el.getAttribute("data-para-id") ?? "";
        const paraId = parseParaId(paraIdAttr);
        const tag = el.tagName.toLowerCase() as Block["tag"];
        const isHeading = /^h[1-6]$/.test(tag);
        current = { tag, text: "", paraId, isHeading };
        blocks.push(current);
        el.onEndTag(() => {
          current = null;
        });
      },
      text(t) {
        if (current) current.text += t.text;
      },
    })
    .transform(new Response(html));

  for (const b of blocks) {
    b.text = b.text.replace(/\s+/g, " ").trim();
  }

  const nextUrl = nextHref ? absoluteUrl(nextHref) : null;
  const nextParaId = nextUrl ? parseUrlParaId(nextUrl) : null;
  return { blocks, nextUrl, nextParaId };
}

function parseParaId(s: string): number | null {
  const m = /(\d+)\.(\d+)/.exec(s);
  return m ? Number(m[2]) : null;
}

function parseUrlParaId(url: string): number | null {
  const m = /\/book\/\d+\.(\d+)/.exec(url);
  return m ? Number(m[1]) : null;
}

function absoluteUrl(href: string): string {
  return href.startsWith("http") ? href : `${ORIGIN}${href}`;
}

/**
 * Extracts content from a single chapter HTML page.
 * Returns the chapter title (from the chapter heading block) and a text body
 * with paragraphs joined by blank lines. Section subheadings (h2/h3 inside
 * content) are prefixed with "## ".
 */
export function extractChapter(html: string): { title: string; text: string } {
  const { blocks } = parsePagedContent(html);
  return blocksToChapter(blocks);
}

/**
 * Renders a list of content blocks (possibly accumulated from multiple paginated
 * pages) into chapter title + body text.
 */
export function blocksToChapter(blocks: Block[]): { title: string; text: string } {
  const titleBlock = blocks.find((b) => b.isHeading);
  const title = titleBlock?.text ?? "";

  const lines: string[] = [];
  for (const b of blocks) {
    if (!b.text) continue;
    if (b === titleBlock) continue;
    if (b.isHeading) {
      lines.push(`## ${b.text}`);
    } else {
      lines.push(b.text);
    }
  }
  return { title, text: lines.join("\n\n") };
}

/**
 * Extracts content blocks plus pagination info from a single page.
 * Used by the orchestrator to walk Next links until the next chapter starts.
 */
export function extractPage(html: string): PageContent {
  return parsePagedContent(html);
}

export type { Block };
