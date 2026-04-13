"""Shared fixtures for GC translation tests."""
import json
import pytest
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_bible():
    return {
        "Matthew 24:20": "Hãy cầu-nguyện cho các ngươi khỏi trốn-tránh nhằm lúc mùa đông hay là ngày Sa-bát;",
        "Luke 21:20": "Vả, khi các ngươi sẽ thấy thành Giê-ru-sa-lem bị một đạo binh vây chung-quanh, thì hãy biết sự tàn-phá thành ấy gần đến.",
        "Genesis 1:1": "Ban đầu Đức Chúa Trời dựng nên trời đất.",
        "Genesis 1:2": "Vả, đất là vô-hình và trống-không, sự mờ-tối ở trên mặt vực; Thần Đức Chúa Trời vận-hành trên mặt nước.",
        "Genesis 1:3": "Đức Chúa Trời phán rằng: Phải có sự sáng; thì có sự sáng.",
    }


@pytest.fixture
def sample_glossary():
    return {
        "sanctuary": "đền thánh",
        "remnant": "dân sót",
        "investigative judgment": "sự phán xét tra xét",
        "Sabbath": "Sa-bát",
        "Jesus Christ": "Đức Chúa Giê-su",
    }


@pytest.fixture
def sample_bible_refs():
    return {
        "Matthew": "Ma-thi-ơ",
        "Luke": "Lu-ca",
        "Genesis": "Sáng-thế Ký",
        "1 Corinthians": "1 Cô-rinh-tô",
        "Psalms": "Thi-thiên",
        "Ps": "Thi-thiên",
        "Revelation": "Khải-huyền",
    }


@pytest.fixture
def sample_chapter_html():
    return (FIXTURES / "sample-chapter.html").read_text(encoding="utf-8")
