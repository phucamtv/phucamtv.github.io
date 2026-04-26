import type { TranslateBookConfig } from "../lib/types";

export const lde: TranslateBookConfig = {
  slug: "lde",
  bookId: 39,
  chapters: 20,
  sourceDir: "data/lde-source",
  chunksDir: "data/lde-source/chunks",
  translatedDir: "data/lde-translated",
  hugoBookDir: "content/sach/egw/su-kien-ngay-cuoi-cung",
  glossaryPath: "data/egw-translation/glossary.yaml",
  bibleRefsPath: "data/egw-translation/bible-refs.yaml",
  bibleVersesPath: "data/bible/vi1934.json",
  chunkTargetWords: 1500,
  paragraphCitationPrefix: "LDE",
};
