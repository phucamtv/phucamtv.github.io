import type { Glossary } from "./glossary";
import { formatGlossaryTable } from "./glossary";

export interface PromptInputs {
  glossary: Glossary;
  paragraphCitationPrefix: string; // e.g., "COL"
}

/**
 * Build the system prompt used for every translation chunk. The prompt is stable within a
 * run, so a future migration to the Anthropic SDK can prompt-cache it for cost savings.
 */
export function buildSystemPrompt({ glossary, paragraphCitationPrefix }: PromptInputs): string {
  const sections: string[] = [];

  sections.push(
    "You are an expert Vietnamese translator for Seventh-day Adventist literature by Ellen G. White. " +
    "Translate the provided English passage into natural, reverent Vietnamese.",
  );

  sections.push(
    "# Terminology rules (HARD — never deviate)\n" +
    "- Use \"Đức Chúa Giê-su\" (never \"Chúa Giê-su\", \"Jesus\", or \"Giê-xu\").\n" +
    "- Use \"ban phước\" when God is the subject; \"chúc phước\" only when a human is the subject.\n" +
    "- Use \"Sa-bát\" (never \"Sabát\").\n" +
    "- Use \"Do Thái Giáo\" (never \"Giu-đa-izt\").\n" +
    "- Use \"Cơ-đốc\" (never \"Cơ Đốc\").\n" +
    "- Capitalize divine names correctly: \"Đức Chúa Trời\", \"Đức Thánh Linh\", \"Kinh Thánh\", \"Đức Chúa Giê-su\".",
  );

  sections.push(
    "# Glossary (MANDATORY — use these Vietnamese renderings verbatim when the English term appears)\n" +
    formatGlossaryTable(glossary),
  );

  sections.push(
    "# Bible quotations\n" +
    "When the passage quotes or paraphrases a Bible verse with an explicit reference (e.g., \"Matthew 13:31\", \"Luke 15:1-4\"), " +
    "REPLACE the quoted English verse text plus its reference with a single sentinel of the form `[[BIBLE:Book Chapter:Verse]]` " +
    "(or `[[BIBLE:Book Chapter:Verse-Verse]]` for ranges, or `[[BIBLE:Book Chapter:V1,V2]]` for comma lists). " +
    "Do NOT translate the quoted verse text yourself — a post-processor will substitute the canonical Vietnamese (VI1934) translation. " +
    "Use the CANONICAL English book name exactly as given in the English source.",
  );

  sections.push(
    "# Paragraph citations\n" +
    `Each English paragraph ends with a citation like \`${paragraphCitationPrefix} N.M\` (e.g., \`${paragraphCitationPrefix} 17.1\`). ` +
    "Preserve these citations VERBATIM at the end of the corresponding Vietnamese paragraph.",
  );

  sections.push(
    "# Output format\n" +
    "- Output Vietnamese Markdown ONLY. No preamble, no explanation, no wrapping in code fences.\n" +
    "- Preserve `## ` section headings (translate the heading text into Vietnamese).\n" +
    "- Separate paragraphs with a single blank line.\n" +
    "- Do not add content that was not in the source.",
  );

  return sections.join("\n\n");
}
