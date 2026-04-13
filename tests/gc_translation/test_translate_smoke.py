"""End-to-end smoke test for translation via `claude` CLI."""
import shutil
import pytest

from scripts.gc_translation.glossary import load_glossary
from scripts.gc_translation.prompt import build_system_prompt
from scripts.gc_translation.translate import translate_chunk_text


pytestmark = pytest.mark.skipif(
    shutil.which("claude") is None,
    reason="Needs `claude` CLI on PATH; run locally only",
)


def test_translate_short_fixture():
    glossary = load_glossary()
    system = build_system_prompt(glossary)
    english = (
        "The Sabbath was a sign between God and His people. "
        "Jesus kept it faithfully. (Luke 4:16)"
    )
    out = translate_chunk_text(english, system)
    assert out, "empty output"
    assert any(ch in out for ch in "ăâêôơưđ"), f"no Vietnamese diacritics in: {out!r}"
    assert "Sa-bát" in out
    assert "Đức Chúa Giê-su" in out
    assert "[[BIBLE:Luke 4:16]]" in out
