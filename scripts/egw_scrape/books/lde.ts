import type { BookConfig } from "../lib/types";

export const lde: BookConfig = {
  slug: "lde",
  bookId: 39,
  chapters: 20,
  tocUrl: "https://m.egwwritings.org/en/book/39/toc",
  sourceDir: "data/lde-source",
  skipPrefixes: ["Preface", "Introduction", "Contents", "Appendix", "Index", "To the Reader"],
};
