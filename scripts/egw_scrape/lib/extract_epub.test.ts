import { test, expect } from "bun:test";
import { extractTitle, extractParagraphs, withCitations } from "../extract_epub";

// Markup mirrors the real en_DA.epub: pagebreak spans carry `title="N"` BEFORE
// `class="pagebreak"`, and the [N] marker sits mid-paragraph. Page numbers seen
// here (19/20/21) match the published Desire of Ages citations DA 19.1, 19.2, 20.1.
const SAMPLE = `
<div class="chapter" id="content01">
  <h2 class="chapterhead">Chapter 1—“God With Us”</h2>
  <p class="standard-indented">Therefore it was prophesied of Him, “His name shall be called Immanuel.”</p>
  <p class="standard-indented">By coming to dwell with us, Jesus was to reveal God. Both the redeemed <span epub:type="pagebreak" id="p20" title="20" class="pagebreak">[20]</span> and the unfallen beings will find their song.</p>
  <p class="standard-indented">Now sin has marred God’s perfect work. The flowers breathe fragrance in blessing <span epub:type="pagebreak" id="p21" title="21" class="pagebreak">[21]</span> to the world.</p>
  <p class="standard-indented">The angels of glory find their joy in giving.</p>
</div>`;

test("extractTitle strips the 'Chapter N—' prefix", () => {
  expect(extractTitle(SAMPLE)).toBe("“God With Us”");
});

test("extractParagraphs assigns each paragraph the page it BEGINS on", () => {
  const paras = extractParagraphs(SAMPLE);
  // Chapter opens on page 19 (= firstMarker 20 − 1). Para 2 contains the [20]
  // break but began on 19, so it belongs to 19. Para 3 began after [20] → 20,
  // and itself contains [21]. Para 4 began after [21] → 21.
  expect(paras.map((p) => p.page)).toEqual([19, 19, 20, 21]);
});

test("extractParagraphs strips the visible [N] page markers from reading text", () => {
  const paras = extractParagraphs(SAMPLE);
  for (const p of paras) {
    expect(p.text).not.toMatch(/\[\d+\]/);
  }
  // The break must not leave a glued word: "redeemed [20] and" → "redeemed and".
  expect(paras[1].text).toContain("reveal God. Both the redeemed and the unfallen");
});

test("withCitations numbers paragraphs per-page, resetting ordinal each page", () => {
  const paras = extractParagraphs(SAMPLE);
  const lines = withCitations(paras, "DA");
  expect(lines[0]).toMatch(/Immanuel\.” DA 19\.1$/);
  expect(lines[1]).toMatch(/their song\. DA 19\.2$/);
  expect(lines[2]).toMatch(/to the world\. DA 20\.1$/);
  expect(lines[3]).toMatch(/joy in giving\. DA 21\.1$/);
});
