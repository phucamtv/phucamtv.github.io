from scripts.gc_translation.assemble import build_front_matter, assemble_chapter_text


def test_front_matter_keys():
    fm = build_front_matter(
        chapter=1,
        vi_title="Sự Tàn Phá Giê-ru-sa-lem",
        summary="Đức Chúa Giê-su báo trước về sự tàn phá.",
        date="2026-04-13",
    )
    assert 'title: "Chương 1: Sự Tàn Phá Giê-ru-sa-lem"' in fm
    assert 'slug: "chuong-01"' in fm
    assert 'author: "ellen-g-white"' in fm
    assert 'book: "thien-ac-dau-tranh"' in fm
    assert "chapter: 1" in fm
    assert "date: 2026-04-13" in fm
    assert 'summary: "Đức Chúa Giê-su báo trước về sự tàn phá."' in fm
    assert fm.startswith("---\n") and fm.endswith("---\n")


def test_assemble_applies_lint():
    chunks = ["Ngày Sabát là thánh.", "Cơ Đốc nhân giữ luật pháp."]
    fm = "---\ntitle: test\n---\n"
    out = assemble_chapter_text(fm, chunks)
    assert "Sa-bát" in out
    assert "Cơ-đốc" in out
    assert "Sabát" not in out
    assert "Cơ Đốc" not in out
    assert out.startswith(fm)


def test_assemble_preserves_chunk_order():
    chunks = ["First.", "Second.", "Third."]
    out = assemble_chapter_text("---\n---\n", chunks)
    assert out.index("First") < out.index("Second") < out.index("Third")
