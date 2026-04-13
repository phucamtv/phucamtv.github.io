"""Load and format the theological glossary for prompt injection."""
from __future__ import annotations

from pathlib import Path

import yaml

from scripts.gc_translation.paths import GLOSSARY_PATH


def load_glossary(path: Path = GLOSSARY_PATH) -> dict[str, str]:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    flat: dict[str, str] = {}
    for _group, entries in raw.items():
        flat.update(entries)
    return flat


def format_glossary_for_prompt(glossary: dict[str, str]) -> str:
    lines = ["| English | Vietnamese |", "|---------|------------|"]
    for en, vi in sorted(glossary.items(), key=lambda kv: kv[0].lower()):
        lines.append(f"| {en} | {vi} |")
    return "\n".join(lines)
