import { test, expect } from "bun:test";
import { parseToc, extractPage, blocksToChapter } from "./parse";
import { colp } from "../books/colp";

test("parseToc filters and numbers entries", async () => {
  const html = await Bun.file(`${import.meta.dir}/fixtures/toc-sample.html`).text();
  const entries = parseToc(html, colp);
  expect(entries).toEqual([
    { number: 1, enTitle: "Teaching in Parables", url: "https://m.egwwritings.org/en/book/15.17" },
    { number: 2, enTitle: "The Sower Went Forth to Sow", url: "https://m.egwwritings.org/en/book/15.30" },
    { number: 3, enTitle: "First the Blade, Then the Ear", url: "https://m.egwwritings.org/en/book/15.45" },
  ]);
});

test("extractPage parses egwwritings markup, ignores chrome, and reports next link", async () => {
  const html = await Bun.file(`${import.meta.dir}/fixtures/chapter-egw.html`).text();
  const { blocks, nextUrl, nextParaId } = extractPage(html);
  expect(nextUrl).toBe("https://m.egwwritings.org/en/book/15.774");
  expect(nextParaId).toBe(774);
  // Site title h1 (header), pager Next text, and footer paragraph must all be skipped;
  // only egw_content_wrapper blocks inside <main id="main_content"> are kept.
  expect(blocks.map((b) => [b.tag, b.text])).toEqual([
    ["h3", "Chapter 15—“This Man Receiveth Sinners”"],
    ["p", "This chapter is based on Luke 15:1-10."],
    ["p", "As the “publicans and sinners” gathered about Christ. COL 185.1"],
    ["h4", "The Lost Sheep"],
    ["p", "The Saviour told the parable. COL 187.1"],
  ]);

  const { title, text } = blocksToChapter(blocks);
  expect(title).toBe("Chapter 15—“This Man Receiveth Sinners”");
  expect(text).toBe(
    [
      "This chapter is based on Luke 15:1-10.",
      "As the “publicans and sinners” gathered about Christ. COL 185.1",
      "## The Lost Sheep",
      "The Saviour told the parable. COL 187.1",
    ].join("\n\n"),
  );
});
