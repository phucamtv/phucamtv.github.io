import { test, expect } from "bun:test";
import { mkdtempSync, copyFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { assembleBody, writeChapter } from "./assemble";
import type { BibleLookup } from "./bible";

test("assembleBody concatenates chunks in order", async () => {
  const dir = mkdtempSync(join(tmpdir(), "assemble-"));
  copyFileSync(`${import.meta.dir}/fixtures/assemble-ch01-01.md`, join(dir, "ch01-01.md"));
  copyFileSync(`${import.meta.dir}/fixtures/assemble-ch01-02.md`, join(dir, "ch01-02.md"));

  const { body, unresolved, chunkCount } = await assembleBody(dir, 1);
  expect(chunkCount).toBe(2);
  expect(unresolved).toEqual([]);
  expect(body).toContain("Đoạn Vietnamese thứ nhất. COL 17.1");
  expect(body).toContain("## Phần A");
  expect(body).toContain("## Phần B");
  expect(body.indexOf("Phần A")).toBeLessThan(body.indexOf("Phần B"));
});

test("assembleBody resolves residual sentinels when given a bible lookup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "assemble-bible-"));
  // A translated chunk still carrying an unresolved sentinel (e.g. from an older resolver).
  writeFileSync(join(dir, "ch01-01.md"), "Ngài phán: [[BIBLE:John 3:16]] DA 19.1\n");
  const bible: BibleLookup = {
    bookNames: new Map([["John", "Giăng"]]),
    verses: new Map([["John 3:16", "Vì Đức Chúa Trời yêu thương thế gian."]]),
  };
  const { body, unresolved } = await assembleBody(dir, 1, bible);
  expect(unresolved).toEqual([]);
  expect(body).toContain("Vì Đức Chúa Trời yêu thương thế gian.");
  expect(body).toContain("(Giăng 3:16)");
  expect(body).not.toContain("[[BIBLE");
});

test("writeChapter preserves frontmatter byte-for-byte", async () => {
  const dir = mkdtempSync(join(tmpdir(), "write-"));
  const hugoPath = join(dir, "chuong-01.md");
  copyFileSync(`${import.meta.dir}/fixtures/assemble-stub.md`, hugoPath);

  await writeChapter(hugoPath, "Đã dịch xong.\n\n## Section\n\nMore.");

  const out = await Bun.file(hugoPath).text();
  const fmEnd = out.indexOf("---\n", 4) + 4;
  const frontmatter = out.slice(0, fmEnd);
  expect(frontmatter).toContain('title: "Chương 1: Giảng Dạy Bằng Thí Dụ"');
  expect(frontmatter).toContain("draft: true");
  const body = out.slice(fmEnd).trim();
  expect(body).toBe("Đã dịch xong.\n\n## Section\n\nMore.");
});
