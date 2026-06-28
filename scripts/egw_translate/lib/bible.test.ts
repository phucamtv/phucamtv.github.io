import { test, expect } from "bun:test";
import { parseRef, lookupVerses, resolveBibleSentinels, loadBibleLookup, type BibleLookup } from "./bible";

const fakeLookup: BibleLookup = {
  bookNames: new Map<string, string>([
    ["Matthew", "Ma-thi-ơ"],
    ["Matt", "Ma-thi-ơ"],
    ["Luke", "Lu-ca"],
    ["Jude", "Giu-đe"],
  ]),
  verses: new Map<string, string>([
    ["Matthew 13:31", "Verse text 13:31."],
    ["Matthew 13:32", "Verse text 13:32."],
    ["Luke 15:1", "Verse text 15:1."],
    ["Luke 15:4", "Verse text 15:4."],
    ["Jude 1:3", "Verse text Jude 1:3."],
  ]),
};

test("parseRef handles simple chapter:verse", () => {
  const ref = parseRef("Matthew 13:31", fakeLookup);
  expect(ref).not.toBeNull();
  expect(ref!.canonicalBook).toBe("Matthew");
  expect(ref!.viBook).toBe("Ma-thi-ơ");
  expect(ref!.chapter).toBe(13);
  expect(ref!.verseSpans).toEqual([[31, 31]]);
  expect(ref!.display).toBe("13:31");
});

test("parseRef resolves abbreviation to canonical book", () => {
  const ref = parseRef("Matt 13:31", fakeLookup);
  expect(ref).not.toBeNull();
  expect(ref!.canonicalBook).toBe("Matthew");
  expect(ref!.viBook).toBe("Ma-thi-ơ");
});

test("parseRef handles verse range", () => {
  const ref = parseRef("Matthew 13:31-32", fakeLookup);
  expect(ref!.verseSpans).toEqual([[31, 32]]);
  expect(ref!.display).toBe("13:31-32");
});

test("parseRef handles comma-separated verses", () => {
  const ref = parseRef("Luke 15:1,4", fakeLookup);
  expect(ref!.verseSpans).toEqual([[1, 1], [4, 4]]);
  expect(ref!.display).toBe("15:1,4");
});

test("parseRef handles single-chapter book without chapter", () => {
  const ref = parseRef("Jude 3", fakeLookup);
  expect(ref).not.toBeNull();
  expect(ref!.chapter).toBe(1);
  expect(ref!.verseSpans).toEqual([[3, 3]]);
  expect(ref!.display).toBe("3");
});

test("resolveBibleSentinels rewrites single-verse sentinel", () => {
  const { output, unresolved } = resolveBibleSentinels("See [[BIBLE:Matthew 13:31]] now.", fakeLookup);
  expect(unresolved).toEqual([]);
  expect(output).toContain('> "Verse text 13:31."');
  expect(output).toContain("> <cite>(Ma-thi-ơ 13:31)</cite>");
});

test("resolveBibleSentinels isolates blockquote with blank lines when sentinel is mid-sentence", () => {
  const { output } = resolveBibleSentinels("See [[BIBLE:Matthew 13:31]] now.", fakeLookup);
  // Blockquote must start on its own line — preceded by a blank line, followed by a blank line.
  expect(output).toContain('See\n\n> "Verse text 13:31."');
  expect(output).toContain("</cite>\n\nnow.");
});

test("resolveBibleSentinels collapses runs of more than two newlines", () => {
  const { output } = resolveBibleSentinels("Para one.\n\n[[BIBLE:Matthew 13:31]]\n\nPara two.", fakeLookup);
  // No triple-newline runs after collapsing.
  expect(/\n{3,}/.test(output)).toBe(false);
});

test("resolveBibleSentinels consumes one trailing punctuation char", () => {
  // Mirror gc_translation/bible.py: sentinel regex eats `;`, `.`, `,`, `:`, `!`, `?` after ]].
  // Input: two sentinels chained with `;` and a trailing `. COL 421.2`.
  const input = "Mở đầu [[BIBLE:Matthew 13:31]]; [[BIBLE:Matthew 13:32]]. COL 421.2";
  const { output } = resolveBibleSentinels(input, fakeLookup);
  // No orphan punctuation paragraphs.
  expect(output.split(/\n\n/).some((p) => /^[;.,:!?]+$/.test(p.trim()))).toBe(false);
  // The `. COL 421.2` must become `COL 421.2` (period consumed as trailing punct on sentinel 2).
  expect(output).toContain("COL 421.2");
  expect(output).not.toContain(". COL 421.2");
});

test("resolveBibleSentinels consumes wrapping parentheses", () => {
  const { output } = resolveBibleSentinels("Xem ([[BIBLE:Matthew 13:31]]) để biết thêm.", fakeLookup);
  // No leftover orphan "(" or ")" paragraphs around the blockquote.
  expect(output.split(/\n\n/).some((p) => /^[()]+$/.test(p.trim()))).toBe(false);
  expect(output).toContain('> "Verse text 13:31."');
});

test("resolveBibleSentinels rewrites range sentinel with concatenated verses", () => {
  const { output, unresolved } = resolveBibleSentinels("[[BIBLE:Matthew 13:31-32]]", fakeLookup);
  expect(unresolved).toEqual([]);
  expect(output).toContain("Verse text 13:31.");
  expect(output).toContain("Verse text 13:32.");
  expect(output).toContain("(Ma-thi-ơ 13:31-32)");
});

test("resolveBibleSentinels resolves multi-chapter comma list (same book, new chapters)", () => {
  // "John 8:28,6:57" = John 8:28 AND John 6:57. Each comma group after the first
  // carries its own chapter:verse. The translator emits these as one sentinel.
  const lookup: BibleLookup = {
    bookNames: new Map([["John", "Giăng"]]),
    verses: new Map([
      ["John 8:28", "Verse 8:28."],
      ["John 6:57", "Verse 6:57."],
    ]),
  };
  const { output, unresolved } = resolveBibleSentinels("[[BIBLE:John 8:28,6:57]]", lookup);
  expect(unresolved).toEqual([]);
  expect(output).toContain("Verse 8:28.");
  expect(output).toContain("Verse 6:57.");
  expect(output).toContain("(Giăng 8:28,6:57)");
});

test("resolveBibleSentinels still treats bare comma verses as same chapter", () => {
  // "Luke 15:1,4" = Luke 15:1 AND Luke 15:4 (bare verse inherits chapter 15).
  const lookup: BibleLookup = {
    bookNames: new Map([["Luke", "Lu-ca"]]),
    verses: new Map([
      ["Luke 15:1", "V1."],
      ["Luke 15:4", "V4."],
    ]),
  };
  const { output, unresolved } = resolveBibleSentinels("[[BIBLE:Luke 15:1,4]]", lookup);
  expect(unresolved).toEqual([]);
  expect(output).toContain("V1.");
  expect(output).toContain("V4.");
  expect(output).toContain("(Lu-ca 15:1,4)");
});

test("lookupVerses skips a verse omitted from VI1934 inside a range", () => {
  // Mark 9:44 is genuinely absent from the VI1934 text; a 43-45 range must still
  // resolve using 43 and 45 rather than failing the whole reference.
  const lookup: BibleLookup = {
    bookNames: new Map([["Mark", "Mác"]]),
    verses: new Map([
      ["Mark 9:43", "Câu 43."],
      ["Mark 9:45", "Câu 45."],
    ]),
  };
  const ref = parseRef("Mark 9:43-45", lookup);
  expect(ref).not.toBeNull();
  const text = lookupVerses(ref!, lookup);
  expect(text).toBe("Câu 43. Câu 45.");
});

test("lookupVerses returns null when NO verse in the reference exists", () => {
  const lookup: BibleLookup = {
    bookNames: new Map([["Mark", "Mác"]]),
    verses: new Map([["Mark 9:1", "Câu 1."]]),
  };
  const ref = parseRef("Mark 9:43-45", lookup);
  expect(lookupVerses(ref!, lookup)).toBeNull();
});

test("resolveBibleSentinels leaves unresolved sentinels in place and reports them", () => {
  const { output, unresolved } = resolveBibleSentinels(
    "Known [[BIBLE:Matthew 13:31]] and unknown [[BIBLE:Matthew 99:99]]",
    fakeLookup,
  );
  expect(unresolved).toEqual(["Matthew 99:99"]);
  expect(output).toContain("[[BIBLE:Matthew 99:99]]");
});

test("loadBibleLookup works on real data", async () => {
  const lookup = await loadBibleLookup(
    `${import.meta.dir}/../../../data/egw-translation/bible-refs.yaml`,
    `${import.meta.dir}/../../../data/bible/vi1934.json`,
  );
  expect(lookup.bookNames.get("Matthew")).toBe("Ma-thi-ơ");
  expect(lookup.verses.size).toBeGreaterThan(20000);
  // Sanity-check one well-known verse exists
  expect(lookup.verses.has("Matthew 13:31")).toBe(true);
});
