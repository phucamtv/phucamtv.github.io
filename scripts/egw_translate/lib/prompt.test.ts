import { test, expect } from "bun:test";
import { buildSystemPrompt } from "./prompt";

test("buildSystemPrompt includes all required sections", () => {
  const glossary = new Map<string, string>([["God", "Đức Chúa Trời"]]);
  const prompt = buildSystemPrompt({ glossary, paragraphCitationPrefix: "COL" });
  expect(prompt).toContain("Seventh-day Adventist");
  expect(prompt).toContain("Đức Chúa Giê-su");
  expect(prompt).toContain("Sa-bát");
  expect(prompt).toContain("| English | Vietnamese |");
  expect(prompt).toContain("| God | Đức Chúa Trời |");
  expect(prompt).toContain("[[BIBLE:Book Chapter:Verse]]");
  expect(prompt).toContain("COL N.M");
  expect(prompt).toContain("Output Vietnamese Markdown ONLY");
});

test("buildSystemPrompt uses the configured citation prefix", () => {
  const glossary = new Map<string, string>();
  const prompt = buildSystemPrompt({ glossary, paragraphCitationPrefix: "GC" });
  expect(prompt).toContain("GC N.M");
  expect(prompt).not.toContain("COL N.M");
});
