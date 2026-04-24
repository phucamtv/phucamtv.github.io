const RULES: Array<[RegExp, string]> = [
  // "Chúa Giê-su" without leading "Đức" → "Đức Chúa Giê-su"
  [/(?<!Đức\s)Chúa Giê-su/g, "Đức Chúa Giê-su"],
  // Any residual English "Jesus" → "Đức Chúa Giê-su"
  [/\bJesus\b/g, "Đức Chúa Giê-su"],
  // Sabát → Sa-bát
  [/Sabát/g, "Sa-bát"],
  // Cơ Đốc → Cơ-đốc
  [/Cơ Đốc/g, "Cơ-đốc"],
  // Giu-đa-izt → Do Thái Giáo
  [/Giu-đa-izt/g, "Do Thái Giáo"],
  // Lowercase divine names → capitalized
  [/đức chúa trời/g, "Đức Chúa Trời"],
  [/đức thánh linh/g, "Đức Thánh Linh"],
  [/kinh thánh/g, "Kinh Thánh"],
  [/đức chúa giê-su/g, "Đức Chúa Giê-su"],
];

export function lintText(text: string): string {
  let out = text;
  for (const [re, repl] of RULES) {
    out = out.replace(re, repl);
  }
  return out;
}

export function findUnresolvedBibleSentinels(text: string): string[] {
  const matches = text.match(/\[\[BIBLE:[^\]]+\]\]/g);
  return matches ?? [];
}
