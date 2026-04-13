from scripts.gc_translation.chunk import chunk_text


def test_chunk_by_h2():
    text = "# Chapter\n\nIntro paragraph.\n\n## Section A\n\nBody A.\n\n## Section B\n\nBody B."
    chunks = chunk_text(text, target_words=1000)
    assert len(chunks) == 3
    assert "Intro paragraph" in chunks[0]
    assert chunks[1].startswith("## Section A")
    assert chunks[2].startswith("## Section B")


def test_chunk_no_headings_single_chunk():
    text = "# Chapter\n\nJust one paragraph of body text.\n\nAnd another."
    chunks = chunk_text(text, target_words=1000)
    assert len(chunks) == 1
    assert "Just one paragraph" in chunks[0]


def test_chunk_oversized_section_splits_on_paragraphs():
    big = "\n\n".join([f"Paragraph {i} " + ("word " * 200) for i in range(10)])
    text = f"## Big Section\n\n{big}"
    chunks = chunk_text(text, target_words=500)
    assert len(chunks) > 1
    assert chunks[0].startswith("## Big Section")
    for c in chunks:
        assert len(c.split()) <= 700


def test_chunk_preserves_total_content():
    text = "# C\n\nA.\n\n## S1\n\nB.\n\n## S2\n\nC."
    chunks = chunk_text(text, target_words=1000)
    joined = "\n\n".join(chunks)
    for token in ["A.", "B.", "C.", "S1", "S2"]:
        assert token in joined
