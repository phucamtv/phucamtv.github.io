import { test, expect } from "bun:test";
import { loadGlossary, formatGlossaryTable } from "./glossary";

test("loadGlossary flattens categories", async () => {
  const g = await loadGlossary(`${import.meta.dir}/fixtures/glossary-sample.yaml`);
  expect(g.get("God")).toBe("Đức Chúa Trời");
  expect(g.get("Jesus")).toBe("Đức Chúa Giê-su");
  expect(g.get("Satan")).toBe("Sa-tan");
  expect(g.size).toBe(3);
});

test("formatGlossaryTable produces Markdown table", async () => {
  const g = await loadGlossary(`${import.meta.dir}/fixtures/glossary-sample.yaml`);
  const table = formatGlossaryTable(g);
  expect(table).toContain("| English | Vietnamese |");
  expect(table).toContain("| --- | --- |");
  expect(table).toContain("| God | Đức Chúa Trời |");
});

test("loadGlossary works on the real shared glossary", async () => {
  const g = await loadGlossary(`${import.meta.dir}/../../../data/egw-translation/glossary.yaml`);
  expect(g.get("God")).toBe("Đức Chúa Trời");
  expect(g.get("Jesus")).toBe("Đức Chúa Giê-su");
  expect(g.get("Satan")).toBe("Sa-tan");
  expect(g.size).toBeGreaterThan(30);
});
