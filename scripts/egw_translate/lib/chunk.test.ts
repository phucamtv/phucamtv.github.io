import { test, expect } from "bun:test";
import { chunkChapter } from "./chunk";

test("chunkChapter drops title and splits on ## headings", () => {
  const input = `# Chapter 1

Intro paragraph.

Another intro paragraph.

## Section A

Para A1.

Para A2.

## Section B

Para B1.`;
  const chunks = chunkChapter(input, 1500);
  expect(chunks.length).toBe(3);
  expect(chunks[0].text.startsWith("Intro paragraph")).toBe(true);
  expect(chunks[1].text.startsWith("## Section A")).toBe(true);
  expect(chunks[2].text.startsWith("## Section B")).toBe(true);
});

test("chunkChapter subdivides long sections on paragraph boundaries", () => {
  const para = "word ".repeat(100).trim();
  const input = `# Ch\n\n## Big\n\n${para}\n\n${para}\n\n${para}\n\n${para}`;
  const chunks = chunkChapter(input, 150);
  expect(chunks.length).toBeGreaterThan(1);
  for (const c of chunks) {
    const words = c.text.split(/\s+/).filter(Boolean).length;
    expect(words <= 300).toBe(true);
  }
});

test("chunkChapter assigns 1-based sequential indices", () => {
  const input = `# T\n\n## A\n\nfoo\n\n## B\n\nbar`;
  const chunks = chunkChapter(input, 1500);
  expect(chunks.map((c) => c.index)).toEqual([1, 2]);
});

test("chunkChapter handles input without any ## headings", () => {
  const input = `# T\n\nParagraph one.\n\nParagraph two.`;
  const chunks = chunkChapter(input, 1500);
  expect(chunks.length).toBe(1);
  expect(chunks[0].text).toBe("Paragraph one.\n\nParagraph two.");
});
