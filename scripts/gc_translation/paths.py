"""Central path constants for the GC translation pipeline."""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = REPO_ROOT / "data"
SOURCE_DIR = DATA_DIR / "gc-source"
CHUNK_DIR = SOURCE_DIR / "chunks"
TRANSLATED_DIR = DATA_DIR / "gc-translated"

GLOSSARY_PATH = DATA_DIR / "gc-translation" / "glossary.yaml"
BIBLE_REFS_PATH = DATA_DIR / "gc-translation" / "bible-refs.yaml"
VI1934_PATH = DATA_DIR / "bible" / "vi1934.json"

HUGO_BOOK_DIR = REPO_ROOT / "content" / "sach" / "egw" / "thien-ac-dau-tranh"

CHAPTERS = 42
BOOK_ID = 132  # egwwritings book id


def chapter_source_html(n: int) -> Path:
    return SOURCE_DIR / f"ch{n:02d}.html"


def chapter_source_text(n: int) -> Path:
    return SOURCE_DIR / f"ch{n:02d}.txt"


def chunk_path(chapter: int, chunk: int) -> Path:
    return CHUNK_DIR / f"ch{chapter:02d}-{chunk:02d}.txt"


def translated_path(chapter: int, chunk: int) -> Path:
    return TRANSLATED_DIR / f"ch{chapter:02d}-{chunk:02d}.md"


def error_path(chapter: int, chunk: int) -> Path:
    return TRANSLATED_DIR / f"ch{chapter:02d}-{chunk:02d}.err"


def hugo_chapter_path(n: int) -> Path:
    return HUGO_BOOK_DIR / f"chuong-{n:02d}.md"
