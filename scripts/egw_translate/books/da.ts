import type { TranslateBookConfig } from "../lib/types";

// The Desire of Ages (1898) → "Khát Vọng Muôn Đời". Source obtained from the
// White Estate EPUB via scripts/egw_scrape/extract_epub.ts.
export const da: TranslateBookConfig = {
  slug: "da",
  bookId: 130,
  chapters: 87,
  sourceDir: "data/da-source",
  chunksDir: "data/da-source/chunks",
  translatedDir: "data/da-translated",
  hugoBookDir: "content/sach/egw/khat-vong-muon-doi",
  glossaryPath: "data/egw-translation/glossary.yaml",
  bibleRefsPath: "data/egw-translation/bible-refs.yaml",
  bibleVersesPath: "data/bible/vi1934.json",
  chunkTargetWords: 1500,
  paragraphCitationPrefix: "DA",
};
