from scripts.gc_translation.lint import lint_text, find_unresolved_sentinels


def test_chua_giesu_gets_duc_prefix():
    assert lint_text("Chúa Giê-su phán") == "Đức Chúa Giê-su phán"


def test_already_correct_duc_chua_giesu_untouched():
    assert lint_text("Đức Chúa Giê-su phán") == "Đức Chúa Giê-su phán"


def test_jesus_english_replaced():
    assert lint_text("Jesus loves") == "Đức Chúa Giê-su loves"


def test_giexu_old_spelling_replaced():
    assert lint_text("Giê-xu là Chúa") == "Đức Chúa Giê-su là Chúa"


def test_sabat_hyphen_added():
    assert lint_text("ngày Sabát") == "ngày Sa-bát"


def test_already_correct_sabat_untouched():
    assert lint_text("ngày Sa-bát") == "ngày Sa-bát"


def test_co_doc_hyphenated():
    assert lint_text("Cơ Đốc nhân") == "Cơ-đốc nhân"


def test_giudaizt_replaced():
    assert lint_text("Giu-đa-izt") == "Do Thái Giáo"


def test_lowercase_divine_names_capitalized():
    assert lint_text("đức chúa trời yêu") == "Đức Chúa Trời yêu"
    assert lint_text("đức thánh linh ngự") == "Đức Thánh Linh ngự"
    assert lint_text("kinh thánh dạy") == "Kinh Thánh dạy"
    assert lint_text("đức chúa giê-su") == "Đức Chúa Giê-su"


def test_case_correct_divine_names_untouched():
    assert lint_text("Đức Chúa Trời") == "Đức Chúa Trời"
    assert lint_text("Kinh Thánh") == "Kinh Thánh"


def test_find_unresolved_sentinels_empty():
    assert find_unresolved_sentinels("no sentinels here") == []


def test_find_unresolved_sentinels_present():
    assert find_unresolved_sentinels("text [[BIBLE:Matt 99:1]] more") == ["Matt 99:1"]
