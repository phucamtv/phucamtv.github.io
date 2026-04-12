from scripts.yt.validate_content import violations


def test_detects_jesus_variants() -> None:
    v = violations("Chúa Giê-su đã phán.")
    assert any("Chúa Giê-su" in x for x in v)


def test_detects_sabat() -> None:
    v = violations("Ngày Sabát.")
    assert any("Sabát" in x for x in v)


def test_detects_jesus_english() -> None:
    assert violations("Jesus is Lord")


def test_detects_co_doc_variant() -> None:
    assert violations("người Cơ Đốc")


def test_detects_lowercase_divine_names() -> None:
    assert violations("Đức chúa trời đã phán.")
    assert violations("Đức thánh linh hành động.")
    assert violations("Kinh thánh dạy rằng.")


def test_accepts_correct_text() -> None:
    assert violations("Đức Chúa Giê-su giữ ngày Sa-bát.") == []
    assert violations("Đức Chúa Trời ban phước cho Đức Thánh Linh. Kinh Thánh là Cơ-đốc.") == []
