import type { BookConfig } from "../lib/types";

// The Desire of Ages (1898) — egwwritings book 130. Public-domain text.
// The live chapter pages are Cloudflare-blocked, so source is obtained from the
// open White Estate EPUB via scripts/egw_scrape/extract_epub.ts (not scrape.ts).
export const da: BookConfig = {
  slug: "da",
  bookId: 130,
  chapters: 87,
  tocUrl: "https://m.egwwritings.org/en/book/130/toc",
  sourceDir: "data/da-source",
  skipPrefixes: ["Preface", "Introduction", "Contents", "Appendix", "Index", "Information about this Book"],
  epubUrl: "https://media2.egwwritings.org/epub/en_DA.epub",
  paragraphCitationPrefix: "DA",
};
