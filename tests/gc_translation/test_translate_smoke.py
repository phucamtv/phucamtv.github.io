"""End-to-end smoke test for translation. Skipped unless ANTHROPIC_API_KEY is set."""
import os
import pytest

from anthropic import Anthropic

from scripts.gc_translation.glossary import load_glossary
from scripts.gc_translation.prompt import build_system_prompt
from scripts.gc_translation.translate import translate_chunk_text


pytestmark = pytest.mark.skipif(
    "ANTHROPIC_API_KEY" not in os.environ,
    reason="Needs ANTHROPIC_API_KEY; run locally only",
)


def test_translate_short_fixture():
    client = Anthropic()
    glossary = load_glossary()
    system = build_system_prompt(glossary)
    english = (
        "The Sabbath was a sign between God and His people. "
        "Jesus kept it faithfully. (Luke 4:16)"
    )
    out = translate_chunk_text(client, english, system)
    assert out, "empty output"
    assert any(ch in out for ch in "ăâêôơưđ"), f"no Vietnamese diacritics in: {out!r}"
    assert "Sa-bát" in out
    assert "Đức Chúa Giê-su" in out
    assert "[[BIBLE:Luke 4:16]]" in out
