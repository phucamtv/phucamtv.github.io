import pytest
from scripts.gc_translation.bible import (
    parse_ref,
    lookup_verse,
    resolve_sentinels,
    vietnamese_book_name,
)


def test_parse_ref_single_verse():
    assert parse_ref("Matthew 24:20") == ("Matthew", 24, 20, 20)


def test_parse_ref_range():
    assert parse_ref("Genesis 1:1-3") == ("Genesis", 1, 1, 3)


def test_parse_ref_abbrev():
    assert parse_ref("Ps 23:1") == ("Psalms", 23, 1, 1)


def test_parse_ref_numeric_book():
    assert parse_ref("1 Corinthians 13:4") == ("1 Corinthians", 13, 4, 4)


def test_parse_ref_bad_input():
    with pytest.raises(ValueError):
        parse_ref("not a reference")


def test_lookup_single_verse(sample_bible):
    assert lookup_verse(sample_bible, "Matthew", 24, 20, 20).startswith("Hãy cầu-nguyện")


def test_lookup_range(sample_bible):
    out = lookup_verse(sample_bible, "Genesis", 1, 1, 3)
    assert "Ban đầu" in out
    assert "Phải có sự sáng" in out


def test_lookup_missing_returns_none(sample_bible):
    assert lookup_verse(sample_bible, "Matthew", 99, 1, 1) is None


def test_vietnamese_book_name(sample_bible_refs):
    assert vietnamese_book_name(sample_bible_refs, "Matthew") == "Ma-thi-ơ"
    assert vietnamese_book_name(sample_bible_refs, "Ps") == "Thi-thiên"


def test_resolve_sentinels_single(sample_bible, sample_bible_refs):
    text = "Jesus said: [[BIBLE:Luke 21:20]] This was the warning."
    out, unresolved = resolve_sentinels(text, sample_bible, sample_bible_refs)
    assert "Vả, khi các ngươi" in out
    assert "Lu-ca 21:20" in out
    assert unresolved == []


def test_resolve_sentinels_range(sample_bible, sample_bible_refs):
    text = "[[BIBLE:Genesis 1:1-3]]"
    out, unresolved = resolve_sentinels(text, sample_bible, sample_bible_refs)
    assert "Ban đầu" in out
    assert "Phải có sự sáng" in out
    assert "Sáng-thế Ký 1:1-3" in out


def test_resolve_sentinels_unresolved(sample_bible, sample_bible_refs):
    text = "[[BIBLE:Matthew 99:1]]"
    out, unresolved = resolve_sentinels(text, sample_bible, sample_bible_refs)
    assert "[[BIBLE:Matthew 99:1]]" in out
    assert unresolved == ["Matthew 99:1"]
