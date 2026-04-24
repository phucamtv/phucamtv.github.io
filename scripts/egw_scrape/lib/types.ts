export interface BookConfig {
  slug: string;
  bookId: number;
  chapters: number;
  tocUrl: string;
  sourceDir: string;
  skipPrefixes: string[];
}

export interface ChapterEntry {
  number: number;
  enTitle: string;
  url: string;
}
