"""Flag text that breaks project CLAUDE.md content guidelines."""

from __future__ import annotations

import re

FORBIDDEN_PATTERNS = [
    (re.compile(r"(?<!Đức )Chúa Giê-su"), "Use 'Đức Chúa Giê-su' not 'Chúa Giê-su'"),
    (re.compile(r"\bJesus\b"), "Use 'Đức Chúa Giê-su' not 'Jesus'"),
    (re.compile(r"Giê-xu"), "Use 'Đức Chúa Giê-su' not 'Giê-xu'"),
    (re.compile(r"\bSabát\b"), "Use 'Sa-bát' not 'Sabát'"),
    (re.compile(r"Giu-đa-izt"), "Use 'Do Thái Giáo'"),
    (re.compile(r"\bCơ Đốc\b"), "Use 'Cơ-đốc' not 'Cơ Đốc'"),
    (re.compile(r"Đức chúa trời"), "Capitalization: 'Đức Chúa Trời'"),
    (re.compile(r"Đức thánh linh"), "Capitalization: 'Đức Thánh Linh'"),
    (re.compile(r"Kinh thánh"), "Capitalization: 'Kinh Thánh'"),
]


def violations(text: str) -> list[str]:
    out: list[str] = []
    for pat, msg in FORBIDDEN_PATTERNS:
        for m in pat.finditer(text):
            snippet = text[max(0, m.start() - 20) : m.end() + 20]
            out.append(f"{msg} @ ...{snippet}...")
    return out
