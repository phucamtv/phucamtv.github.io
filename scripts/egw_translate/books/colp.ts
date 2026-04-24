import type { TranslateBookConfig } from "../lib/types";

export const colp: TranslateBookConfig = {
  slug: "colp",
  bookId: 15,
  chapters: 29,
  sourceDir: "data/colp-source",
  chunksDir: "data/colp-source/chunks",
  translatedDir: "data/colp-translated",
  hugoBookDir: "content/sach/egw/nhung-loi-vi-du-cua-dang-christ",
  glossaryPath: "data/egw-translation/glossary.yaml",
  bibleRefsPath: "data/egw-translation/bible-refs.yaml",
  bibleVersesPath: "data/bible/vi1934.json",
  chunkTargetWords: 1500,
  paragraphCitationPrefix: "COL",
};
