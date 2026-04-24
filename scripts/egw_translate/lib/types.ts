export interface TranslateBookConfig {
  slug: string;
  bookId: number;
  chapters: number;
  sourceDir: string;             // data/colp-source
  chunksDir: string;             // data/colp-source/chunks
  translatedDir: string;         // data/colp-translated
  hugoBookDir: string;           // content/sach/egw/nhung-loi-vi-du-cua-dang-christ
  glossaryPath: string;          // data/egw-translation/glossary.yaml
  bibleRefsPath: string;         // data/egw-translation/bible-refs.yaml
  bibleVersesPath: string;       // data/bible/vi1934.json
  chunkTargetWords: number;      // 1500
  paragraphCitationPrefix: string; // "COL"
}
