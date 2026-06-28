export interface BookConfig {
  slug: string;
  bookId: number;
  chapters: number;
  tocUrl: string;
  sourceDir: string;
  skipPrefixes: string[];
  /** Open EPUB download (media2.egwwritings.org) — used by extract_epub.ts when the live pages are Cloudflare-blocked. */
  epubUrl?: string;
  /** Citation prefix for reconstructed `<PREFIX> N.M` references (e.g. "DA"). */
  paragraphCitationPrefix?: string;
}

export interface ChapterEntry {
  number: number;
  enTitle: string;
  url: string;
}
