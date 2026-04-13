"""Regex normalization enforcing CLAUDE.md terminology rules."""
from __future__ import annotations

import re

RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?<!Đức )\bChúa Giê-?su\b"), "Đức Chúa Giê-su"),
    (re.compile(r"\bJesus\b"), "Đức Chúa Giê-su"),
    (re.compile(r"(?<!Đức Chúa )\bGiê-xu\b"), "Đức Chúa Giê-su"),
    (re.compile(r"\bSabát\b"), "Sa-bát"),
    (re.compile(r"\bCơ Đốc\b"), "Cơ-đốc"),
    (re.compile(r"\bGiu-đa-izt\b"), "Do Thái Giáo"),
    (re.compile(r"\bđức chúa giê-su\b"), "Đức Chúa Giê-su"),
    (re.compile(r"\bđức chúa trời\b"), "Đức Chúa Trời"),
    (re.compile(r"\bđức thánh linh\b"), "Đức Thánh Linh"),
    (re.compile(r"\bkinh thánh\b"), "Kinh Thánh"),
]

SENTINEL_RE = re.compile(r"\[\[BIBLE:([^\]]+)\]\]")


def lint_text(text: str) -> str:
    for pattern, replacement in RULES:
        text = pattern.sub(replacement, text)
    return text


def find_unresolved_sentinels(text: str) -> list[str]:
    return [m.group(1).strip() for m in SENTINEL_RE.finditer(text)]
