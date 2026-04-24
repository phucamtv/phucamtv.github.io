/**
 * Minimal YAML loader for our 2-level glossary and flat Bible-ref files.
 * Supports: top-level string keys; values are either strings or nested 2-space-indented
 * string maps. Does NOT support lists, flow style, multi-line strings, anchors, or
 * comments inside values. Sufficient for our data files.
 */
export function parseYaml(text: string): Record<string, string | Record<string, string>> {
  const out: Record<string, string | Record<string, string>> = {};
  let currentGroup: Record<string, string> | null = null;
  let currentGroupKey: string | null = null;

  const lines = text.split("\n");
  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimEnd();
    if (!line.trim()) continue;

    const indent = line.match(/^ */)![0].length;

    if (indent === 0) {
      if (currentGroupKey && currentGroup) {
        out[currentGroupKey] = currentGroup;
        currentGroup = null;
        currentGroupKey = null;
      }
      const m = line.match(/^([^:]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1].trim();
      const val = stripQuotes(m[2].trim());
      if (val === "") {
        currentGroupKey = key;
        currentGroup = {};
      } else {
        out[key] = val;
      }
    } else if (indent === 2 && currentGroup) {
      const m = line.match(/^\s+([^:]+):\s*(.*)$/);
      if (!m) continue;
      currentGroup[m[1].trim()] = stripQuotes(m[2].trim());
    }
  }
  if (currentGroupKey && currentGroup) {
    out[currentGroupKey] = currentGroup;
  }
  return out;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}
