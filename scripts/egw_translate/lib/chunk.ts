export interface Chunk {
  index: number; // 1-based
  text: string;
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * Split text into chunks: first by `## ` h2 headings (each heading kept with its section),
 * then subdivide any section longer than targetWords on paragraph (blank-line) boundaries.
 * The leading `# Title` line, if present, is dropped.
 */
export function chunkChapter(text: string, targetWords: number): Chunk[] {
  const body = text.replace(/^#[^\n]*\n+/, "").trimEnd();

  const sections: string[] = [];
  const lines = body.split("\n");
  let buf: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (buf.length) sections.push(buf.join("\n").trim());
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) sections.push(buf.join("\n").trim());

  const chunks: string[] = [];
  for (const section of sections) {
    if (!section) continue;
    if (countWords(section) <= targetWords) {
      chunks.push(section);
      continue;
    }
    const paras = section.split(/\n\s*\n/);
    let current: string[] = [];
    let currentWords = 0;
    for (const p of paras) {
      const w = countWords(p);
      if (currentWords + w > targetWords && current.length) {
        chunks.push(current.join("\n\n"));
        current = [p];
        currentWords = w;
      } else {
        current.push(p);
        currentWords += w;
      }
    }
    if (current.length) chunks.push(current.join("\n\n"));
  }

  return chunks.map((text, i) => ({ index: i + 1, text }));
}
