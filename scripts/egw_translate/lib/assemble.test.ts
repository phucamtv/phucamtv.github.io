import { test, expect } from "bun:test";
import { mkdtempSync, copyFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { assembleBody, writeChapter } from "./assemble";

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
