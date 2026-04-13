from scripts.gc_translation.scrape_chapter import extract_chapter


def test_extract_chapter_text(sample_chapter_html):
    title, text = extract_chapter(sample_chapter_html)
    assert title == "The Destruction of Jerusalem"
    assert "Jesus was approaching" in text
    assert "The Fall of the City" in text
    assert "<html>" not in text
    assert "compassed with armies" in text


def test_extract_chapter_preserves_heading_markers(sample_chapter_html):
    _, text = extract_chapter(sample_chapter_html)
    assert "## The Fall of the City" in text
    assert "## After the Destruction" in text
