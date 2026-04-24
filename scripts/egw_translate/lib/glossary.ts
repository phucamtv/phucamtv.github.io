import { parseYaml } from "./yaml";

export type Glossary = Map<string, string>;

export async function loadGlossary(path: string): Promise<Glossary> {
  const text = await Bun.file(path).text();
  const parsed = parseYaml(text);
  const out = new Map<string, string>();
  for (const v of Object.values(parsed)) {
    if (typeof v === "string") continue;
    for (const [en, vi] of Object.entries(v)) {
      out.set(en, vi);
    }
  }
  return out;
}

export function formatGlossaryTable(g: Glossary): string {
  const rows: string[] = ["| English | Vietnamese |", "| --- | --- |"];
  for (const [en, vi] of g) {
    rows.push(`| ${en} | ${vi} |`);
  }
  return rows.join("\n");
}
