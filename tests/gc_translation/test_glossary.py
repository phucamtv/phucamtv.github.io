from scripts.gc_translation.glossary import load_glossary, format_glossary_for_prompt


def test_load_glossary_flattens_groups():
    glossary = load_glossary()
    assert glossary["Sabbath"] == "Sa-bát"
    assert glossary["Jesus Christ"] == "Đức Chúa Giê-su"
    assert glossary["sanctuary"] == "đền thánh"
    assert glossary["remnant"] == "dân sót"


def test_format_glossary_for_prompt():
    out = format_glossary_for_prompt({"sanctuary": "đền thánh", "Sabbath": "Sa-bát"})
    assert "| sanctuary | đền thánh |" in out
    assert "| Sabbath | Sa-bát |" in out
    assert "| English | Vietnamese |" in out
