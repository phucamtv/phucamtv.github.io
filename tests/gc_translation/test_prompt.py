from scripts.gc_translation.prompt import build_system_prompt


def test_system_prompt_includes_glossary(sample_glossary):
    sp = build_system_prompt(sample_glossary)
    assert "| sanctuary | đền thánh |" in sp


def test_system_prompt_includes_terminology_rules():
    sp = build_system_prompt({})
    assert "Đức Chúa Giê-su" in sp
    assert "Sa-bát" in sp
    assert "Cơ-đốc" in sp


def test_system_prompt_includes_bible_sentinel_instruction():
    sp = build_system_prompt({})
    assert "[[BIBLE:" in sp
    assert "do not translate" in sp.lower()


def test_system_prompt_requires_pure_markdown_output():
    sp = build_system_prompt({})
    assert "markdown" in sp.lower()
    assert "no preamble" in sp.lower() or "no explanation" in sp.lower()
