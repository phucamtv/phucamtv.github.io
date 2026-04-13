# Great Controversy Vietnamese Translation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape, translate, and publish Ellen G. White's *The Great Controversy* (egwwritings book 132, 42 chapters) into Vietnamese as a Hugo book section at `content/sach/egw/thien-ac-dau-tranh/`.

**Architecture:** Four-stage idempotent Python pipeline (`scrape → chunk → translate → assemble`). Intermediate artifacts land under `data/gc-source/`, `data/gc-translated/`. Translation uses Anthropic Claude (`claude-opus-4-6`) with a seeded glossary + post-processing that swaps English Bible quotes for VN1925 (Truyền Thống 1925) verses. Regex lint enforces the project's Vietnamese terminology rules.

**Tech Stack:** Python 3.11+, `requests` + `beautifulsoup4` (scraping), `anthropic` SDK (translation), `pyyaml` (glossary), `pytest` (tests), Hugo (static site).

---

## File Structure

**New Python package under `scripts/gc-translation/`:**

- `__init__.py` — empty package marker
- `paths.py` — central constants for all input/output paths
- `scrape_toc.py` — fetch the book TOC; emit chapter URL list + English titles
- `scrape_chapter.py` — given a chapter URL, fetch and extract clean HTML + plain text
- `chunk.py` — split a chapter into section-level chunks by `<h2>`/heading boundaries
- `glossary.py` — load YAML glossary, render as prompt-ready table
- `bible.py` — VN1925 lookup, English → Vietnamese book-name mapping, sentinel resolver
- `prompt.py` — assemble the translation system + user prompts from chunk + glossary
- `translate.py` — call Claude with the prompt, write translated chunk, retry on error
- `lint.py` — regex normalization passes enforcing CLAUDE.md terminology rules
- `assemble.py` — concatenate translated chunks, prepend front matter, write Hugo `.md`
- `prepare_bible.py` — one-off: download + normalize VN1925 into `data/bible/vn1925.json`
- `run.py` — top-level orchestrator; runs any/all stages per chapter or for all 42

**New data files:**

- `data/gc-translation/glossary.yaml` — seed theological glossary
- `data/gc-translation/bible-refs.yaml` — English → Vietnamese book name map
- `data/bible/vn1925.json` — vendored VN1925 full text, keyed by `"<Book> <Chapter>:<Verse>"`

**New tests under `tests/gc-translation/`:**

- `__init__.py`
- `conftest.py` — shared fixtures (sample HTML, sample bible, sample glossary)
- `fixtures/sample-chapter.html` — a trimmed fixture of a real chapter
- `test_chunk.py`, `test_bible.py`, `test_lint.py`, `test_glossary.py`, `test_prompt.py`, `test_scrape_chapter.py`, `test_assemble.py`, `test_translate_smoke.py`

**Hugo content (new):**

- `content/sach/_index.md`
- `content/sach/egw/_index.md`
- `content/sach/egw/thien-ac-dau-tranh/_index.md`
- `content/sach/egw/thien-ac-dau-tranh/chuong-01.md` through `chuong-42.md` (generated)

**Modify:**

- `Makefile` — add `gc-scrape`, `gc-translate`, `gc-assemble`, `gc-all` targets
- `.gitignore` — add `data/gc-source/`, `data/gc-translated/` (intermediate artifacts; rendered Hugo files are committed)

---

## Task 1: Scaffolding & dependencies

**Files:**
- Create: `scripts/gc-translation/__init__.py`
- Create: `scripts/gc-translation/paths.py`
- Create: `tests/gc-translation/__init__.py`
- Create: `tests/gc-translation/conftest.py`
- Create: `requirements-gc.txt`
- Modify: `.gitignore`

- [ ] **Step 1: Create the Python package skeleton**

```bash
mkdir -p scripts/gc-translation tests/gc-translation/fixtures data/gc-translation data/bible data/gc-source/chunks data/gc-translated
touch scripts/gc-translation/__init__.py tests/gc-translation/__init__.py
```

- [ ] **Step 2: Write `scripts/gc-translation/paths.py`**

```python
"""Central path constants for the GC translation pipeline."""
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

DATA_DIR = REPO_ROOT / "data"
SOURCE_DIR = DATA_DIR / "gc-source"
CHUNK_DIR = SOURCE_DIR / "chunks"
TRANSLATED_DIR = DATA_DIR / "gc-translated"

GLOSSARY_PATH = DATA_DIR / "gc-translation" / "glossary.yaml"
BIBLE_REFS_PATH = DATA_DIR / "gc-translation" / "bible-refs.yaml"
VN1925_PATH = DATA_DIR / "bible" / "vn1925.json"

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
```

- [ ] **Step 3: Write `tests/gc-translation/conftest.py`**

```python
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
```

- [ ] **Step 4: Write `tests/gc-translation/fixtures/sample-chapter.html`**

```html
<!DOCTYPE html>
<html>
<body>
<article>
<h1>The Destruction of Jerusalem</h1>
<p class="first">Jesus was approaching the city. His gaze rested upon Jerusalem.</p>
<p>When you see Jerusalem compassed with armies, then know that the desolation thereof is nigh. (Luke 21:20)</p>
<h2>The Fall of the City</h2>
<p>Forty years were granted for repentance. They rejected every appeal.</p>
<p>Pray ye that your flight be not in the winter, neither on the sabbath day. (Matthew 24:20)</p>
<h2>After the Destruction</h2>
<p>The remnant were scattered. Yet the sanctuary service had foreshadowed this judgment.</p>
</article>
</body>
</html>
```

- [ ] **Step 5: Write `requirements-gc.txt`**

```
requests>=2.31
beautifulsoup4>=4.12
anthropic>=0.39
pyyaml>=6.0
pytest>=7.0
```

- [ ] **Step 6: Update `.gitignore`**

Append these lines to `.gitignore`:

```
# GC translation intermediate artifacts
data/gc-source/
data/gc-translated/
```

- [ ] **Step 7: Install deps and verify pytest discovery**

```bash
pip install -r requirements-gc.txt
pytest tests/gc-translation/ -v --collect-only
```

Expected: pytest collects 0 tests (no test files yet) without errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/gc-translation tests/gc-translation requirements-gc.txt .gitignore
git commit -m "gc-translation: scaffold package, paths, test fixtures"
```

---

## Task 2: Seed glossary.yaml and bible-refs.yaml

**Files:**
- Create: `data/gc-translation/glossary.yaml`
- Create: `data/gc-translation/bible-refs.yaml`

- [ ] **Step 1: Write `data/gc-translation/glossary.yaml`**

```yaml
# English → Vietnamese theological glossary for The Great Controversy.
# These renderings are MANDATORY — the translator must use them verbatim.
# Grouped by category for human editability; the loader flattens all groups.

divine_names:
  God: Đức Chúa Trời
  Lord: Chúa
  Jesus: Đức Chúa Giê-su
  Jesus Christ: Đức Chúa Giê-su
  Christ: Đấng Christ
  Holy Spirit: Đức Thánh Linh
  Father: Đức Chúa Cha
  Son of God: Con Đức Chúa Trời
  Son of Man: Con Người
  Saviour: Đấng Cứu Thế
  Redeemer: Đấng Cứu Chuộc
  Messiah: Đấng Mê-si

adversary:
  Satan: Sa-tan
  devil: ma quỷ
  the dragon: con rồng
  antichrist: kẻ địch lại Đấng Christ

people:
  disciples: các môn đồ
  apostles: các sứ đồ
  prophets: các tiên tri
  priests: các thầy tế lễ
  Pharisees: người Pha-ri-si
  Sadducees: người Sa-đu-sê
  Jews: người Do Thái
  Gentiles: dân ngoại
  saints: các thánh đồ
  remnant: dân sót
  martyrs: những người tử đạo
  Reformers: các nhà Cải chánh
  Protestants: người Tin lành

institutions:
  Judaism: Do Thái Giáo
  Christianity: Cơ-đốc Giáo
  Catholicism: Công Giáo
  Protestantism: Tin Lành
  Church of Rome: Giáo hội La-mã
  papacy: giáo hoàng
  church: hội thánh

theology:
  sanctuary: đền thánh
  temple: đền thờ
  tabernacle: đền tạm
  most holy place: nơi chí thánh
  holy place: nơi thánh
  ark of the covenant: hòm giao ước
  mercy seat: nắp thi ân
  law of God: luật pháp Đức Chúa Trời
  Ten Commandments: Mười Điều Răn
  commandments: các điều răn
  Sabbath: Sa-bát
  grace: ân điển
  faith: đức tin
  salvation: sự cứu rỗi
  redemption: sự cứu chuộc
  atonement: sự chuộc tội
  sin: tội lỗi
  righteousness: sự công bình
  judgment: sự phán xét
  investigative judgment: sự phán xét tra xét
  second coming: sự tái lâm
  second advent: sự tái lâm
  millennium: thiên hi niên
  resurrection: sự sống lại
  immortality: sự bất tử
  soul: linh hồn
  spirit: thần linh
  kingdom of God: nước Đức Chúa Trời
  kingdom of heaven: nước thiên đàng
  gospel: tin lành
  scripture: Kinh Thánh
  scriptures: Kinh Thánh
  Bible: Kinh Thánh
  Word of God: Lời Đức Chúa Trời
  covenant: giao ước
  new covenant: giao ước mới
  old covenant: giao ước cũ
  Sabbath-keeping: sự giữ ngày Sa-bát
  Christian: Cơ-đốc nhân
  Christians: những người Cơ-đốc

events:
  the Fall: sự sa ngã
  the Flood: cơn Đại hồng thủy
  the Reformation: cuộc Cải chánh
  the Dark Ages: thời kỳ Trung Cổ
  the crucifixion: sự đóng đinh
  the resurrection: sự phục sinh
  Pentecost: lễ Ngũ Tuần
  Passover: lễ Vượt Qua
```

- [ ] **Step 2: Write `data/gc-translation/bible-refs.yaml`**

```yaml
# Canonical English → Vietnamese Bible book-name map.
# Includes common abbreviations as aliases pointing to the same Vietnamese name.

Genesis: Sáng-thế Ký
Gen: Sáng-thế Ký
Exodus: Xuất Ê-díp-tô Ký
Ex: Xuất Ê-díp-tô Ký
Leviticus: Lê-vi Ký
Lev: Lê-vi Ký
Numbers: Dân-số Ký
Num: Dân-số Ký
Deuteronomy: Phục-truyền Luật-lệ Ký
Deut: Phục-truyền Luật-lệ Ký
Joshua: Giô-suê
Josh: Giô-suê
Judges: Các Quan Xét
Ruth: Ru-tơ
1 Samuel: 1 Sa-mu-ên
1 Sam: 1 Sa-mu-ên
2 Samuel: 2 Sa-mu-ên
2 Sam: 2 Sa-mu-ên
1 Kings: 1 Các Vua
2 Kings: 2 Các Vua
1 Chronicles: 1 Sử-ký
2 Chronicles: 2 Sử-ký
Ezra: E-xơ-ra
Nehemiah: Nê-hê-mi
Esther: Ê-xơ-tê
Job: Gióp
Psalms: Thi-thiên
Psalm: Thi-thiên
Ps: Thi-thiên
Proverbs: Châm-ngôn
Prov: Châm-ngôn
Ecclesiastes: Truyền-đạo
Eccl: Truyền-đạo
Song of Solomon: Nhã-ca
Isaiah: Ê-sai
Isa: Ê-sai
Jeremiah: Giê-rê-mi
Jer: Giê-rê-mi
Lamentations: Ca-thương
Ezekiel: Ê-xê-chi-ên
Ezek: Ê-xê-chi-ên
Daniel: Đa-ni-ên
Dan: Đa-ni-ên
Hosea: Ô-sê
Joel: Giô-ên
Amos: A-mốt
Obadiah: Áp-đia
Jonah: Giô-na
Micah: Mi-chê
Nahum: Na-hum
Habakkuk: Ha-ba-cúc
Zephaniah: Sô-phô-ni
Haggai: A-ghê
Zechariah: Xa-cha-ri
Zech: Xa-cha-ri
Malachi: Ma-la-chi
Mal: Ma-la-chi
Matthew: Ma-thi-ơ
Matt: Ma-thi-ơ
Mt: Ma-thi-ơ
Mark: Mác
Mk: Mác
Luke: Lu-ca
Lk: Lu-ca
John: Giăng
Jn: Giăng
Acts: Công-vụ các Sứ-đồ
Romans: Rô-ma
Rom: Rô-ma
1 Corinthians: 1 Cô-rinh-tô
1 Cor: 1 Cô-rinh-tô
2 Corinthians: 2 Cô-rinh-tô
2 Cor: 2 Cô-rinh-tô
Galatians: Ga-la-ti
Gal: Ga-la-ti
Ephesians: Ê-phê-sô
Eph: Ê-phê-sô
Philippians: Phi-líp
Phil: Phi-líp
Colossians: Cô-lô-se
Col: Cô-lô-se
1 Thessalonians: 1 Tê-sa-lô-ni-ca
2 Thessalonians: 2 Tê-sa-lô-ni-ca
1 Timothy: 1 Ti-mô-thê
2 Timothy: 2 Ti-mô-thê
Titus: Tít
Philemon: Phi-lê-môn
Hebrews: Hê-bơ-rơ
Heb: Hê-bơ-rơ
James: Gia-cơ
Jas: Gia-cơ
1 Peter: 1 Phi-e-rơ
2 Peter: 2 Phi-e-rơ
1 John: 1 Giăng
2 John: 2 Giăng
3 John: 3 Giăng
Jude: Giu-đe
Revelation: Khải-huyền
Rev: Khải-huyền
```

- [ ] **Step 3: Commit**

```bash
git add data/gc-translation/
git commit -m "gc-translation: seed glossary and bible-refs data"
```

---

## Task 3: Prepare VN1925 Bible JSON

Source the VN1925 text from a public-domain repo and normalize to `data/bible/vn1925.json` keyed by `"<English Book> <Chapter>:<Verse>"` so the resolver can look up directly by the sentinel contents. Using English book names as keys keeps the resolver simple; the Vietnamese book name is applied only when rendering the `<cite>`.

**Files:**
- Create: `scripts/gc-translation/prepare_bible.py`
- Create: `data/bible/vn1925.json` (generated, committed)

- [ ] **Step 1: Write `scripts/gc-translation/prepare_bible.py`**

```python
"""One-off: download VN1925 and normalize to data/bible/vn1925.json.

Source: https://github.com/scrollmapper/bible_databases (public-domain VN1925 JSON).
Run once; output is committed to the repo.
"""
import json
import sys
from urllib.request import urlopen

from scripts.gc_translation.paths import VN1925_PATH

SOURCE_URL = (
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/"
    "json/t_vn1925.json"
)

# Numeric book id → canonical English name (KJV ordering used by scrollmapper).
BOOK_NAMES = {
    1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
    6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
    11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
    15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
    20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
    24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
    28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
    33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
    38: "Zechariah", 39: "Malachi",
    40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts",
    45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians",
    49: "Ephesians", 50: "Philippians", 51: "Colossians",
    52: "1 Thessalonians", 53: "2 Thessalonians", 54: "1 Timothy",
    55: "2 Timothy", 56: "Titus", 57: "Philemon", 58: "Hebrews",
    59: "James", 60: "1 Peter", 61: "2 Peter", 62: "1 John", 63: "2 John",
    64: "3 John", 65: "Jude", 66: "Revelation",
}


def main() -> int:
    print(f"Fetching {SOURCE_URL}...", file=sys.stderr)
    raw = json.loads(urlopen(SOURCE_URL).read().decode("utf-8"))
    # scrollmapper format: {"resultset": {"row": [{"field": [id, book, chapter, verse, text]}, ...]}}
    rows = raw["resultset"]["row"]
    out: dict[str, str] = {}
    for r in rows:
        _id, book_id, chapter, verse, text = r["field"]
        book = BOOK_NAMES.get(book_id)
        if book is None:
            continue
        out[f"{book} {chapter}:{verse}"] = text.strip()
    VN1925_PATH.parent.mkdir(parents=True, exist_ok=True)
    VN1925_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2, sort_keys=True))
    print(f"Wrote {len(out)} verses to {VN1925_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the script to generate the file**

```bash
cd /Users/htruong/code/phucamtv && python -m scripts.gc-translation.prepare_bible
```

Expected: prints "Wrote ~31,100 verses to data/bible/vn1925.json".

If the source URL 404s, fall back to searching `github.com/wldeh/bible-api` for a Vietnamese 1925 JSON and adapt the `main()` loop to that file's shape (keep the `out` dict format identical).

- [ ] **Step 3: Spot-check a sample of verses**

```bash
python -c "import json; b = json.load(open('data/bible/vn1925.json')); print(b['Genesis 1:1']); print(b['Luke 21:20']); print(b['Revelation 22:20'])"
```

Expected: three Vietnamese verses print, each containing Vietnamese diacritics.

- [ ] **Step 4: Commit**

```bash
git add data/bible/vn1925.json scripts/gc-translation/prepare_bible.py
git commit -m "gc-translation: vendor VN1925 bible data and prep script"
```

---

## Task 4: Bible resolver module

**Files:**
- Create: `scripts/gc-translation/bible.py`
- Create: `tests/gc-translation/test_bible.py`

- [ ] **Step 1: Write the failing test `tests/gc-translation/test_bible.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc-translation/test_bible.py -v
```

Expected: ImportError / ModuleNotFoundError on `scripts.gc_translation.bible`.

Note: Python can't import `scripts.gc-translation` because of the hyphen. We fix this by adding a `conftest.py` at repo root that aliases the module, OR by renaming the package directory to `gc_translation`. Go with the rename — simpler and consistent with Python conventions.

- [ ] **Step 3: Rename package directory to use underscore**

```bash
git mv scripts/gc-translation scripts/gc_translation
git mv tests/gc-translation tests/gc_translation
```

Update `scripts/gc_translation/paths.py` — no changes needed; the constants don't reference the package name.

Update imports in `scripts/gc_translation/prepare_bible.py`: change `from scripts.gc_translation.paths` reference — it's already correct.

Update `requirements-gc.txt` path references if any (none).

Update `.gitignore` — no changes (data paths unaffected).

Update `tests/gc_translation/test_bible.py` imports — already uses `scripts.gc_translation`.

- [ ] **Step 4: Verify pytest can now discover**

```bash
pytest tests/gc_translation/ -v --collect-only
```

Expected: collects `test_bible.py` tests; they will fail on missing `bible` module (that's the desired RED state).

- [ ] **Step 5: Write minimal implementation `scripts/gc_translation/bible.py`**

```python
"""Bible reference parsing, VN1925 lookup, and [[BIBLE:...]] sentinel resolution."""
from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from scripts.gc_translation.paths import BIBLE_REFS_PATH, VN1925_PATH

SENTINEL_RE = re.compile(r"\[\[BIBLE:([^\]]+)\]\]")

# Book pattern: optional leading digit+space, then one or more letters (incl. dots)
REF_RE = re.compile(
    r"^\s*((?:[1-3]\s+)?[A-Za-z][A-Za-z. ]*?)\s+(\d+):(\d+)(?:-(\d+))?\s*$"
)


def load_bible() -> dict[str, str]:
    return json.loads(Path(VN1925_PATH).read_text(encoding="utf-8"))


def load_bible_refs() -> dict[str, str]:
    return yaml.safe_load(Path(BIBLE_REFS_PATH).read_text(encoding="utf-8"))


def _canonicalize_book(bible_refs: dict[str, str], name: str) -> str:
    """Return the canonical English key the VN1925 JSON is stored under.

    Our bible-refs.yaml maps every alias to a Vietnamese name, but the VN1925
    JSON uses canonical English names. We treat the first yaml entry whose
    Vietnamese value matches as the canonical English name for that book.
    """
    name = name.strip().rstrip(".")
    if name in bible_refs:
        vn = bible_refs[name]
        # Find the first (longest) English key that maps to this vn name
        for english, viet in bible_refs.items():
            if viet == vn and english == name:
                # If the name itself is an abbreviation like "Ps", scan for a longer form.
                candidates = [e for e, v in bible_refs.items() if v == vn]
                # Prefer the longest candidate (full name) for the JSON lookup.
                return max(candidates, key=len)
        return name
    return name


def parse_ref(ref: str) -> tuple[str, int, int, int]:
    """Parse 'Matthew 24:20' or 'Genesis 1:1-3' or 'Ps 23:1'.

    Returns (canonical-english-book, chapter, verse_start, verse_end).
    """
    m = REF_RE.match(ref)
    if not m:
        raise ValueError(f"Cannot parse bible reference: {ref!r}")
    book_raw, chapter, vstart, vend = m.groups()
    bible_refs = load_bible_refs()
    book = _canonicalize_book(bible_refs, book_raw)
    return book, int(chapter), int(vstart), int(vend) if vend else int(vstart)


def lookup_verse(
    bible: dict[str, str], book: str, chapter: int, vstart: int, vend: int
) -> str | None:
    parts: list[str] = []
    for v in range(vstart, vend + 1):
        text = bible.get(f"{book} {chapter}:{v}")
        if text is None:
            return None
        parts.append(text)
    return " ".join(parts)


def vietnamese_book_name(bible_refs: dict[str, str], english: str) -> str:
    english = english.strip().rstrip(".")
    return bible_refs.get(english, english)


def resolve_sentinels(
    text: str,
    bible: dict[str, str] | None = None,
    bible_refs: dict[str, str] | None = None,
) -> tuple[str, list[str]]:
    """Replace every [[BIBLE:...]] sentinel with a VN1925 blockquote + cite.

    Returns (resolved_text, unresolved_refs). Unresolved sentinels are left
    in place so a later lint pass can warn.
    """
    if bible is None:
        bible = load_bible()
    if bible_refs is None:
        bible_refs = load_bible_refs()

    unresolved: list[str] = []

    def replace(m: re.Match[str]) -> str:
        ref_str = m.group(1).strip()
        try:
            book, chapter, vstart, vend = parse_ref(ref_str)
        except ValueError:
            unresolved.append(ref_str)
            return m.group(0)
        verse = lookup_verse(bible, book, chapter, vstart, vend)
        if verse is None:
            unresolved.append(ref_str)
            return m.group(0)
        vi_book = vietnamese_book_name(bible_refs, book)
        vrange = f"{vstart}" if vstart == vend else f"{vstart}-{vend}"
        return f"> \"{verse}\"\n> <cite>({vi_book} {chapter}:{vrange})</cite>"

    return SENTINEL_RE.sub(replace, text), unresolved
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_bible.py -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/gc_translation/bible.py tests/gc_translation/test_bible.py
git commit -m "gc-translation: bible ref parser and VN1925 sentinel resolver"
```

---

## Task 5: Lint module (CLAUDE.md terminology enforcement)

**Files:**
- Create: `scripts/gc_translation/lint.py`
- Create: `tests/gc_translation/test_lint.py`

- [ ] **Step 1: Write the failing test `tests/gc_translation/test_lint.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc_translation/test_lint.py -v
```

Expected: ImportError on `scripts.gc_translation.lint`.

- [ ] **Step 3: Write `scripts/gc_translation/lint.py`**

```python
"""Regex normalization enforcing CLAUDE.md terminology rules."""
from __future__ import annotations

import re

# Each rule: (compiled_pattern, replacement). Order matters — more specific first.
# Use negative look-behinds where needed to avoid double-correcting already-good text.

RULES: list[tuple[re.Pattern[str], str]] = [
    # "Chúa Giê-su" not preceded by "Đức " → "Đức Chúa Giê-su"
    (re.compile(r"(?<!Đức )\bChúa Giê-?su\b"), "Đức Chúa Giê-su"),
    # English "Jesus" → "Đức Chúa Giê-su"
    (re.compile(r"\bJesus\b"), "Đức Chúa Giê-su"),
    # Old spelling "Giê-xu" → "Đức Chúa Giê-su" (only when not already preceded by "Đức Chúa ")
    (re.compile(r"(?<!Đức Chúa )\bGiê-xu\b"), "Đức Chúa Giê-su"),
    # "Sabát" → "Sa-bát"
    (re.compile(r"\bSabát\b"), "Sa-bát"),
    # "Cơ Đốc" → "Cơ-đốc"
    (re.compile(r"\bCơ Đốc\b"), "Cơ-đốc"),
    # "Giu-đa-izt" → "Do Thái Giáo"
    (re.compile(r"\bGiu-đa-izt\b"), "Do Thái Giáo"),
    # Lowercase divine names → title case. Order before other rules that match these.
    (re.compile(r"\bđức chúa giê-su\b"), "Đức Chúa Giê-su"),
    (re.compile(r"\bđức chúa trời\b"), "Đức Chúa Trời"),
    (re.compile(r"\bđức thánh linh\b"), "Đức Thánh Linh"),
    (re.compile(r"\bkinh thánh\b"), "Kinh Thánh"),
]

SENTINEL_RE = re.compile(r"\[\[BIBLE:([^\]]+)\]\]")


def lint_text(text: str) -> str:
    for pattern, replacement in RULES:
        text = pattern.sub(replacement, text)
    return text


def find_unresolved_sentinels(text: str) -> list[str]:
    return [m.group(1).strip() for m in SENTINEL_RE.finditer(text)]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_lint.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gc_translation/lint.py tests/gc_translation/test_lint.py
git commit -m "gc-translation: CLAUDE.md terminology lint rules"
```

---

## Task 6: Chapter scraper

egwwritings serves book content as paginated HTML. The TOC at `https://m.egwwritings.org/en/book/132/toc` contains links to each chapter's first paragraph ID; subsequent paragraphs load on the same page. We fetch each chapter URL, parse with BeautifulSoup, and extract paragraphs and headings.

**Files:**
- Create: `scripts/gc_translation/scrape_chapter.py`
- Create: `tests/gc_translation/test_scrape_chapter.py`

- [ ] **Step 1: Write the failing test `tests/gc_translation/test_scrape_chapter.py`**

```python
from scripts.gc_translation.scrape_chapter import extract_chapter


def test_extract_chapter_text(sample_chapter_html):
    title, text = extract_chapter(sample_chapter_html)
    assert title == "The Destruction of Jerusalem"
    assert "Jesus was approaching" in text
    assert "The Fall of the City" in text  # h2 preserved
    assert "<html>" not in text
    assert "compassed with armies" in text


def test_extract_chapter_preserves_heading_markers(sample_chapter_html):
    _, text = extract_chapter(sample_chapter_html)
    # h2s should emerge as lines prefixed with "## " so the chunker can split on them.
    assert "## The Fall of the City" in text
    assert "## After the Destruction" in text
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc_translation/test_scrape_chapter.py -v
```

Expected: ImportError.

- [ ] **Step 3: Write `scripts/gc_translation/scrape_chapter.py`**

```python
"""Fetch a chapter's HTML from egwwritings and extract plain text.

The extracted text uses '## ' prefixes for h2 headings so downstream chunking
has an unambiguous section boundary marker.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup

from scripts.gc_translation.paths import (
    chapter_source_html,
    chapter_source_text,
    SOURCE_DIR,
)

USER_AGENT = "phucam.tv-gc-scraper/1.0 (contact: site admin)"


def fetch_url(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8")


def extract_chapter(html: str) -> tuple[str, str]:
    """Return (title, plain_text_with_h2_markers)."""
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else ""
    lines: list[str] = []
    # Walk the article body in document order.
    article = soup.find("article") or soup.body or soup
    for el in article.find_all(["h1", "h2", "h3", "p"]):
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        if el.name == "h1":
            continue  # already captured as title
        if el.name in ("h2", "h3"):
            lines.append(f"## {text}")
        else:
            lines.append(text)
    return title, "\n\n".join(lines)


def scrape_chapter(chapter_num: int, url: str, force: bool = False) -> None:
    html_path = chapter_source_html(chapter_num)
    text_path = chapter_source_text(chapter_num)
    if html_path.exists() and text_path.exists() and not force:
        print(f"ch{chapter_num:02d}: already scraped, skipping", file=sys.stderr)
        return
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    print(f"ch{chapter_num:02d}: fetching {url}", file=sys.stderr)
    html = fetch_url(url)
    html_path.write_text(html, encoding="utf-8")
    title, text = extract_chapter(html)
    text_path.write_text(f"# {title}\n\n{text}\n", encoding="utf-8")
    print(f"ch{chapter_num:02d}: wrote {text_path}", file=sys.stderr)
    time.sleep(1.0)  # be polite to egwwritings


if __name__ == "__main__":
    # CLI form invoked by run.py; see Task 12 for the orchestrator.
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("url")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    scrape_chapter(args.chapter, args.url, force=args.force)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_scrape_chapter.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gc_translation/scrape_chapter.py tests/gc_translation/test_scrape_chapter.py
git commit -m "gc-translation: chapter HTML scraper with h2 markers"
```

---

## Task 7: TOC scraper (chapter URL list)

**Files:**
- Create: `scripts/gc_translation/scrape_toc.py`
- Create: `data/gc-translation/chapters.yaml` (output, committed)

- [ ] **Step 1: Write `scripts/gc_translation/scrape_toc.py`**

```python
"""Scrape egwwritings book 132 TOC and emit data/gc-translation/chapters.yaml.

Output format:
  - number: 1
    en_title: The Destruction of Jerusalem
    url: https://m.egwwritings.org/en/book/132.17
"""
from __future__ import annotations

import sys

import yaml
from bs4 import BeautifulSoup

from scripts.gc_translation.scrape_chapter import fetch_url
from scripts.gc_translation.paths import REPO_ROOT

TOC_URL = "https://m.egwwritings.org/en/book/132/toc"
OUT_PATH = REPO_ROOT / "data" / "gc-translation" / "chapters.yaml"


def parse_toc(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    chapters: list[dict] = []
    # egwwritings TOC renders each chapter as an <a> linking to /en/book/132.<paraId>.
    # Chapter entries are numbered; we take every <a> whose text starts with a chapter
    # label or whose href matches the book-paragraph pattern, skipping front-matter.
    seen_urls = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/book/132." not in href and "/book/132/" not in href:
            continue
        text = a.get_text(" ", strip=True)
        if not text or text.lower() in {"contents", "back", "next"}:
            continue
        # Normalize to absolute URL.
        url = href if href.startswith("http") else f"https://m.egwwritings.org{href}"
        if url in seen_urls:
            continue
        seen_urls.add(url)
        chapters.append({"en_title": text, "url": url})
    # Filter to the 42 chapter entries: GC chapter titles don't start with digits or
    # 'Appendix' / 'Preface' / 'Introduction' / 'Contents'. We conservatively drop
    # any entry whose title is one of those markers; whatever remains should be the
    # 42 chapters. If the count is off, the caller must manually edit chapters.yaml.
    skip_prefixes = ("Preface", "Introduction", "Contents", "Appendix", "Index")
    chapters = [c for c in chapters if not c["en_title"].startswith(skip_prefixes)]
    # Number them 1..N in encountered order.
    for i, c in enumerate(chapters, start=1):
        c["number"] = i
    return chapters


def main() -> int:
    html = fetch_url(TOC_URL)
    chapters = parse_toc(html)
    if len(chapters) != 42:
        print(
            f"WARNING: found {len(chapters)} chapters, expected 42. "
            "Review and edit data/gc-translation/chapters.yaml before proceeding.",
            file=sys.stderr,
        )
    OUT_PATH.write_text(yaml.safe_dump(chapters, allow_unicode=True, sort_keys=False))
    print(f"Wrote {len(chapters)} chapters to {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the TOC scraper**

```bash
cd /Users/htruong/code/phucamtv && python -m scripts.gc_translation.scrape_toc
```

Expected: either "Wrote 42 chapters…" or a warning with the actual count. If count ≠ 42, manually inspect `data/gc-translation/chapters.yaml`, remove non-chapter entries, and re-number so the `number` field is 1..42 contiguous.

- [ ] **Step 3: Sanity-check `chapters.yaml`**

```bash
python -c "import yaml; c = yaml.safe_load(open('data/gc-translation/chapters.yaml')); print(len(c), 'chapters'); print(c[0]); print(c[-1])"
```

Expected: `42 chapters` with first chapter titled *The Destruction of Jerusalem* and last titled *The Controversy Ended*.

- [ ] **Step 4: Commit**

```bash
git add scripts/gc_translation/scrape_toc.py data/gc-translation/chapters.yaml
git commit -m "gc-translation: TOC scraper and chapter URL manifest"
```

---

## Task 8: Chunker

**Files:**
- Create: `scripts/gc_translation/chunk.py`
- Create: `tests/gc_translation/test_chunk.py`

- [ ] **Step 1: Write the failing test `tests/gc_translation/test_chunk.py`**

```python
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
    # Build a section larger than the target to force paragraph-level fallback.
    big = "\n\n".join([f"Paragraph {i} " + ("word " * 200) for i in range(10)])
    text = f"## Big Section\n\n{big}"
    chunks = chunk_text(text, target_words=500)
    assert len(chunks) > 1
    # First chunk keeps the heading.
    assert chunks[0].startswith("## Big Section")
    # Word count of each chunk is roughly bounded (not strict; fallback targets ~target).
    for c in chunks:
        assert len(c.split()) <= 700  # target + one paragraph tolerance


def test_chunk_preserves_total_content():
    text = "# C\n\nA.\n\n## S1\n\nB.\n\n## S2\n\nC."
    chunks = chunk_text(text, target_words=1000)
    joined = "\n\n".join(chunks)
    for token in ["A.", "B.", "C.", "S1", "S2"]:
        assert token in joined
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc_translation/test_chunk.py -v
```

Expected: ImportError.

- [ ] **Step 3: Write `scripts/gc_translation/chunk.py`**

```python
"""Split a chapter into section-level chunks for translation."""
from __future__ import annotations

import re

H2_RE = re.compile(r"^## ", re.MULTILINE)


def _split_oversized(section: str, target_words: int) -> list[str]:
    """Paragraph-level fallback: accumulate paragraphs until target_words is hit."""
    paragraphs = [p for p in section.split("\n\n") if p.strip()]
    # Preserve the heading (first paragraph if it starts with '## ') with the first chunk.
    heading = None
    if paragraphs and paragraphs[0].startswith("## "):
        heading = paragraphs.pop(0)
    out: list[str] = []
    buf: list[str] = []
    wc = 0
    for p in paragraphs:
        pw = len(p.split())
        if wc + pw > target_words and buf:
            out.append("\n\n".join(buf))
            buf = []
            wc = 0
        buf.append(p)
        wc += pw
    if buf:
        out.append("\n\n".join(buf))
    if heading:
        out[0] = f"{heading}\n\n{out[0]}" if out else heading
    return out


def chunk_text(text: str, target_words: int = 1500) -> list[str]:
    """Split chapter text into section chunks.

    Strategy:
      1. Split on h2 boundaries. Content before the first h2 is its own chunk
         (the chapter intro / under-h1 material).
      2. If any resulting section exceeds target_words, break it into
         paragraph-bounded sub-chunks under target_words.
    """
    # Remove the h1 title line; we want the section content only.
    lines = text.splitlines()
    if lines and lines[0].startswith("# "):
        text = "\n".join(lines[1:]).strip()

    # Split, keeping '## ' markers with their following content.
    # re.split with a capturing group preserves the delimiter.
    parts = re.split(r"(?m)(^## .*$)", text)
    # parts layout: [pre-h2 body, "## Heading1", body1, "## Heading2", body2, ...]
    sections: list[str] = []
    if parts[0].strip():
        sections.append(parts[0].strip())
    for i in range(1, len(parts), 2):
        heading = parts[i]
        body = parts[i + 1] if i + 1 < len(parts) else ""
        sections.append(f"{heading}\n\n{body.strip()}".strip())

    out: list[str] = []
    for sec in sections:
        if len(sec.split()) > target_words:
            out.extend(_split_oversized(sec, target_words))
        else:
            out.append(sec)
    return out
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_chunk.py -v
```

Expected: all four tests PASS.

- [ ] **Step 5: Add a CLI driver to chunk.py**

Append to `scripts/gc_translation/chunk.py`:

```python

if __name__ == "__main__":
    import argparse, sys
    from scripts.gc_translation.paths import (
        chapter_source_text, chunk_path, CHUNK_DIR,
    )
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    args = ap.parse_args()
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    src = chapter_source_text(args.chapter).read_text(encoding="utf-8")
    chunks = chunk_text(src)
    for i, c in enumerate(chunks, start=1):
        chunk_path(args.chapter, i).write_text(c, encoding="utf-8")
    print(f"ch{args.chapter:02d}: wrote {len(chunks)} chunks", file=sys.stderr)
```

- [ ] **Step 6: Commit**

```bash
git add scripts/gc_translation/chunk.py tests/gc_translation/test_chunk.py
git commit -m "gc-translation: section-aware chapter chunker"
```

---

## Task 9: Glossary loader

**Files:**
- Create: `scripts/gc_translation/glossary.py`
- Create: `tests/gc_translation/test_glossary.py`

- [ ] **Step 1: Write the failing test `tests/gc_translation/test_glossary.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc_translation/test_glossary.py -v
```

Expected: ImportError.

- [ ] **Step 3: Write `scripts/gc_translation/glossary.py`**

```python
"""Load and format the theological glossary for prompt injection."""
from __future__ import annotations

from pathlib import Path

import yaml

from scripts.gc_translation.paths import GLOSSARY_PATH


def load_glossary(path: Path = GLOSSARY_PATH) -> dict[str, str]:
    """Flatten the grouped YAML into a flat English → Vietnamese dict."""
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    flat: dict[str, str] = {}
    for _group, entries in raw.items():
        flat.update(entries)
    return flat


def format_glossary_for_prompt(glossary: dict[str, str]) -> str:
    lines = ["| English | Vietnamese |", "|---------|------------|"]
    for en, vi in sorted(glossary.items(), key=lambda kv: kv[0].lower()):
        lines.append(f"| {en} | {vi} |")
    return "\n".join(lines)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_glossary.py -v
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gc_translation/glossary.py tests/gc_translation/test_glossary.py
git commit -m "gc-translation: glossary loader and prompt formatter"
```

---

## Task 10: Prompt builder

**Files:**
- Create: `scripts/gc_translation/prompt.py`
- Create: `tests/gc_translation/test_prompt.py`

- [ ] **Step 1: Write the failing test `tests/gc_translation/test_prompt.py`**

```python
from scripts.gc_translation.prompt import build_system_prompt


def test_system_prompt_includes_glossary(sample_glossary):
    sp = build_system_prompt(sample_glossary)
    assert "| sanctuary | đền thánh |" in sp


def test_system_prompt_includes_terminology_rules():
    sp = build_system_prompt({})
    assert "Đức Chúa Giê-su" in sp  # mandated form
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc_translation/test_prompt.py -v
```

Expected: ImportError.

- [ ] **Step 3: Write `scripts/gc_translation/prompt.py`**

```python
"""Assemble the translation system prompt."""
from __future__ import annotations

from scripts.gc_translation.glossary import format_glossary_for_prompt

TERMINOLOGY_RULES = """\
MANDATORY Vietnamese terminology rules (follow without exception):

1. Use "Đức Chúa Giê-su" instead of "Chúa Giê-su", "Jesus", or "Giê-xu".
2. Chúa / God "ban phước" (blesses with authority). People "chúc phước"
   (wish blessings). NEVER use "chúc phước" when the subject is God.
3. Use "Sa-bát" (not "Sabát").
4. Use "Do Thái Giáo" (not "Giu-đa-izt").
5. Use "Cơ-đốc" (not "Cơ Đốc").
6. Capitalize divine names correctly: "Đức Chúa Trời", "Đức Thánh Linh",
   "Kinh Thánh", "Đức Chúa Giê-su".
"""

BIBLE_RULE = """\
Wherever the English text quotes a Bible verse directly (with an inline or
parenthetical reference like "(Luke 21:20)" or "Matthew 24:20 says..."),
replace the quoted English verse text with a sentinel of the form:

    [[BIBLE:<Book> <Chapter>:<Verse>]]
    [[BIBLE:<Book> <Chapter>:<VerseStart>-<VerseEnd>]]  (for ranges)

Use the English book name exactly (Matthew, Luke, Genesis, 1 Corinthians...).
Do NOT translate the quoted verse text — emit only the sentinel. The reference
text itself ("Luke 21:20") in the surrounding prose should be translated
normally using the glossary's book-name renderings.
"""

OUTPUT_RULE = """\
Output ONLY the Vietnamese translation as pure Markdown. Preserve paragraph
breaks, h2 headings (## …), and emphasis. No preamble, no explanation, no
surrounding commentary. Do not wrap the output in code fences.
"""

ROLE = """\
You are an expert Vietnamese translator specializing in Christian theological
texts for a Seventh-day Adventist audience. Your register is reverent, clear,
and consistent with the 1925-era Vietnamese Protestant tradition.
"""


def build_system_prompt(glossary: dict[str, str]) -> str:
    glossary_block = format_glossary_for_prompt(glossary) if glossary else ""
    return "\n\n".join([
        ROLE.strip(),
        TERMINOLOGY_RULES.strip(),
        "GLOSSARY — use these Vietnamese renderings verbatim for the English terms on the left:",
        glossary_block,
        BIBLE_RULE.strip(),
        OUTPUT_RULE.strip(),
    ])
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_prompt.py -v
```

Expected: all four tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gc_translation/prompt.py tests/gc_translation/test_prompt.py
git commit -m "gc-translation: translation system prompt builder"
```

---

## Task 11: Translator (Claude API call + sentinel resolution)

**Files:**
- Create: `scripts/gc_translation/translate.py`
- Create: `tests/gc_translation/test_translate_smoke.py`

- [ ] **Step 1: Write `scripts/gc_translation/translate.py`**

```python
"""Translate a single chunk with Claude, then resolve Bible sentinels."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from anthropic import Anthropic, APIError

from scripts.gc_translation.bible import load_bible, load_bible_refs, resolve_sentinels
from scripts.gc_translation.glossary import load_glossary
from scripts.gc_translation.paths import (
    chunk_path,
    error_path,
    translated_path,
    TRANSLATED_DIR,
)
from scripts.gc_translation.prompt import build_system_prompt

MODEL = "claude-opus-4-6"
MAX_TOKENS = 8000
MAX_RETRIES = 3


def translate_chunk_text(
    client: Anthropic, english: str, system_prompt: str
) -> str:
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=system_prompt,
                messages=[{"role": "user", "content": english}],
            )
            # Concatenate text blocks.
            return "".join(
                block.text for block in resp.content if getattr(block, "type", None) == "text"
            ).strip()
        except APIError as e:
            last_err = e
            wait = 2 ** attempt
            print(f"  attempt {attempt} failed: {e}; retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Translation failed after {MAX_RETRIES} attempts") from last_err


def translate_chunk_file(chapter: int, chunk: int, force: bool = False) -> None:
    out_path = translated_path(chapter, chunk)
    err_file = error_path(chapter, chunk)
    if out_path.exists() and not force:
        print(f"ch{chapter:02d}-{chunk:02d}: already translated, skipping", file=sys.stderr)
        return

    TRANSLATED_DIR.mkdir(parents=True, exist_ok=True)
    src = chunk_path(chapter, chunk).read_text(encoding="utf-8")

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = build_system_prompt(load_glossary())

    try:
        raw = translate_chunk_text(client, src, system_prompt)
    except Exception as e:
        err_file.write_text(f"{type(e).__name__}: {e}\n", encoding="utf-8")
        print(f"ch{chapter:02d}-{chunk:02d}: FAILED — {e}", file=sys.stderr)
        return

    resolved, unresolved = resolve_sentinels(raw, load_bible(), load_bible_refs())
    out_path.write_text(resolved, encoding="utf-8")
    if err_file.exists():
        err_file.unlink()
    if unresolved:
        print(
            f"ch{chapter:02d}-{chunk:02d}: {len(unresolved)} unresolved bible refs: {unresolved}",
            file=sys.stderr,
        )
    print(f"ch{chapter:02d}-{chunk:02d}: translated → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("chunk", type=int)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    translate_chunk_file(args.chapter, args.chunk, force=args.force)
```

- [ ] **Step 2: Write smoke test `tests/gc_translation/test_translate_smoke.py`**

```python
"""End-to-end smoke test for translation. Skipped unless ANTHROPIC_API_KEY is set."""
import os
import pytest

from anthropic import Anthropic

from scripts.gc_translation.glossary import load_glossary
from scripts.gc_translation.prompt import build_system_prompt
from scripts.gc_translation.translate import translate_chunk_text


pytestmark = pytest.mark.skipif(
    "ANTHROPIC_API_KEY" not in os.environ,
    reason="Needs ANTHROPIC_API_KEY; run locally only",
)


def test_translate_short_fixture():
    client = Anthropic()
    glossary = load_glossary()
    system = build_system_prompt(glossary)
    english = (
        "The Sabbath was a sign between God and His people. "
        "Jesus kept it faithfully. (Luke 4:16)"
    )
    out = translate_chunk_text(client, english, system)
    assert out, "empty output"
    # Must produce Vietnamese diacritics.
    assert any(ch in out for ch in "ăâêôơưđ"), f"no Vietnamese diacritics in: {out!r}"
    # Glossary compliance spot-checks.
    assert "Sa-bát" in out
    assert "Đức Chúa Giê-su" in out
    # Bible sentinel must appear (unresolved at this layer).
    assert "[[BIBLE:Luke 4:16]]" in out
```

- [ ] **Step 3: Run the smoke test**

```bash
pytest tests/gc_translation/test_translate_smoke.py -v
```

Expected (with `ANTHROPIC_API_KEY` set): PASS. Without key: SKIPPED.

If the test fails because the model didn't emit `[[BIBLE:Luke 4:16]]`: refine the BIBLE_RULE block in `prompt.py` with a stronger example, then re-run. Iterate until the smoke test passes.

- [ ] **Step 4: Commit**

```bash
git add scripts/gc_translation/translate.py tests/gc_translation/test_translate_smoke.py
git commit -m "gc-translation: Claude translator + sentinel resolution"
```

---

## Task 12: Assembler (Hugo chapter file writer)

**Files:**
- Create: `scripts/gc_translation/assemble.py`
- Create: `tests/gc_translation/test_assemble.py`

- [ ] **Step 1: Write the failing test `tests/gc_translation/test_assemble.py`**

```python
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
    # The assembler concatenates translated chunks and runs lint.
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/gc_translation/test_assemble.py -v
```

Expected: ImportError.

- [ ] **Step 3: Write `scripts/gc_translation/assemble.py`**

```python
"""Concatenate translated chunks, prepend front matter, write Hugo chapter file."""
from __future__ import annotations

import datetime as _dt
import sys
from pathlib import Path

import yaml

from scripts.gc_translation.lint import find_unresolved_sentinels, lint_text
from scripts.gc_translation.paths import (
    HUGO_BOOK_DIR,
    REPO_ROOT,
    TRANSLATED_DIR,
    hugo_chapter_path,
)

CHAPTERS_YAML = REPO_ROOT / "data" / "gc-translation" / "chapters.yaml"


def build_front_matter(
    *, chapter: int, vi_title: str, summary: str, date: str
) -> str:
    def esc(s: str) -> str:
        return s.replace('"', '\\"')
    lines = [
        "---",
        f'title: "Chương {chapter}: {esc(vi_title)}"',
        f'slug: "chuong-{chapter:02d}"',
        'author: "ellen-g-white"',
        'book: "thien-ac-dau-tranh"',
        f"chapter: {chapter}",
        f"date: {date}",
        f'summary: "{esc(summary)}"',
        "---",
        "",
    ]
    return "\n".join(lines)


def assemble_chapter_text(front_matter: str, translated_chunks: list[str]) -> str:
    body = "\n\n".join(c.strip() for c in translated_chunks if c.strip())
    body = lint_text(body)
    return front_matter + body + "\n"


def _load_chapter_meta(chapter: int) -> dict:
    chapters = yaml.safe_load(CHAPTERS_YAML.read_text(encoding="utf-8"))
    for c in chapters:
        if c["number"] == chapter:
            return c
    raise ValueError(f"Chapter {chapter} not in {CHAPTERS_YAML}")


def _collect_translated_chunks(chapter: int) -> list[str]:
    pattern = f"ch{chapter:02d}-*.md"
    files = sorted(TRANSLATED_DIR.glob(pattern))
    if not files:
        raise FileNotFoundError(f"No translated chunks for chapter {chapter}")
    return [f.read_text(encoding="utf-8") for f in files]


def assemble_chapter_file(chapter: int, vi_title: str, summary: str) -> None:
    date = _dt.date.today().isoformat()
    chunks = _collect_translated_chunks(chapter)
    fm = build_front_matter(
        chapter=chapter, vi_title=vi_title, summary=summary, date=date
    )
    text = assemble_chapter_text(fm, chunks)
    unresolved = find_unresolved_sentinels(text)
    HUGO_BOOK_DIR.mkdir(parents=True, exist_ok=True)
    out_path = hugo_chapter_path(chapter)
    out_path.write_text(text, encoding="utf-8")
    print(f"ch{chapter:02d}: wrote {out_path}", file=sys.stderr)
    if unresolved:
        print(
            f"ch{chapter:02d}: WARNING — {len(unresolved)} unresolved bible refs: {unresolved}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("--vi-title", required=True)
    ap.add_argument("--summary", default="")
    args = ap.parse_args()
    assemble_chapter_file(args.chapter, args.vi_title, args.summary)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/gc_translation/test_assemble.py -v
```

Expected: all three tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gc_translation/assemble.py tests/gc_translation/test_assemble.py
git commit -m "gc-translation: chapter assembler with front matter and lint"
```

---

## Task 13: Hugo section index pages

**Files:**
- Create: `content/sach/_index.md`
- Create: `content/sach/egw/_index.md`
- Create: `content/sach/egw/thien-ac-dau-tranh/_index.md`

- [ ] **Step 1: Write `content/sach/_index.md`**

```markdown
---
title: "Sách"
slug: "sach"
---

Thư viện sách của phucam.tv. Các tác phẩm kinh điển được dịch sang tiếng Việt.
```

- [ ] **Step 2: Write `content/sach/egw/_index.md`**

```markdown
---
title: "Ellen G. White"
slug: "egw"
author: "ellen-g-white"
---

Các tác phẩm của bà Ellen G. White được dịch sang tiếng Việt.
```

- [ ] **Step 3: Write `content/sach/egw/thien-ac-dau-tranh/_index.md`**

```markdown
---
title: "Thiện Ác Đấu Tranh"
slug: "thien-ac-dau-tranh"
author: "ellen-g-white"
book: "thien-ac-dau-tranh"
summary: "Cuốn sách kinh điển của Ellen G. White kể lại cuộc đại chiến giữa Đấng Christ và Sa-tan xuyên suốt lịch sử, từ sự tàn phá Giê-ru-sa-lem đến ngày tái lâm."
---

*Thiện Ác Đấu Tranh* (nguyên tác: *The Great Controversy*) là tác phẩm của bà Ellen G. White, trình bày cuộc xung đột vĩ đại giữa Đấng Christ và Sa-tan qua lịch sử hội thánh, cuộc Cải chánh, và những sự kiện trước ngày tái lâm. Bản dịch này được dịch từ ấn bản Anh ngữ công cộng và các trích dẫn Kinh Thánh lấy từ bản Truyền Thống 1925.

## Mục Lục

Mục lục 42 chương sẽ hiển thị tự động bên dưới khi các chương được xuất bản.
```

- [ ] **Step 4: Verify Hugo builds without error**

```bash
cd /Users/htruong/code/phucamtv && hugo --minify --buildDrafts --quiet && echo OK
```

Expected: prints `OK`. If Hugo warns about missing layouts for the new section, that's acceptable — the site's default single/list templates should render the new pages; we'll only add custom layouts if the user reports visual issues.

- [ ] **Step 5: Commit**

```bash
git add content/sach/
git commit -m "gc-translation: Hugo section indices for Sách / EGW / TADT"
```

---

## Task 14: Orchestrator + Makefile targets

**Files:**
- Create: `scripts/gc_translation/run.py`
- Modify: `Makefile`

- [ ] **Step 1: Write `scripts/gc_translation/run.py`**

```python
"""Top-level orchestrator for the GC translation pipeline.

Usage:
  python -m scripts.gc_translation.run scrape [--chapter N]
  python -m scripts.gc_translation.run chunk   [--chapter N]
  python -m scripts.gc_translation.run translate [--chapter N]
  python -m scripts.gc_translation.run assemble  [--chapter N]
  python -m scripts.gc_translation.run all       [--chapter N]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from scripts.gc_translation.assemble import assemble_chapter_file
from scripts.gc_translation.chunk import chunk_text
from scripts.gc_translation.paths import (
    CHAPTERS,
    CHUNK_DIR,
    REPO_ROOT,
    chapter_source_text,
    chunk_path,
    translated_path,
)
from scripts.gc_translation.scrape_chapter import scrape_chapter
from scripts.gc_translation.translate import translate_chunk_file

CHAPTERS_YAML = REPO_ROOT / "data" / "gc-translation" / "chapters.yaml"


def load_chapters() -> list[dict]:
    return yaml.safe_load(CHAPTERS_YAML.read_text(encoding="utf-8"))


def _chapters_iter(chapters: list[dict], only: int | None):
    return [c for c in chapters if only is None or c["number"] == only]


def do_scrape(chapters: list[dict], only: int | None) -> None:
    for c in _chapters_iter(chapters, only):
        scrape_chapter(c["number"], c["url"])


def do_chunk(chapters: list[dict], only: int | None) -> None:
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    for c in _chapters_iter(chapters, only):
        n = c["number"]
        src = chapter_source_text(n)
        if not src.exists():
            print(f"ch{n:02d}: no source text; run scrape first", file=sys.stderr)
            continue
        chunks = chunk_text(src.read_text(encoding="utf-8"))
        # Clear stale chunks for this chapter before writing.
        for old in CHUNK_DIR.glob(f"ch{n:02d}-*.txt"):
            old.unlink()
        for i, t in enumerate(chunks, start=1):
            chunk_path(n, i).write_text(t, encoding="utf-8")
        print(f"ch{n:02d}: wrote {len(chunks)} chunks", file=sys.stderr)


def do_translate(chapters: list[dict], only: int | None) -> None:
    for c in _chapters_iter(chapters, only):
        n = c["number"]
        chunk_files = sorted(CHUNK_DIR.glob(f"ch{n:02d}-*.txt"))
        for cf in chunk_files:
            # Filename shape: chXX-NN.txt
            chunk_num = int(cf.stem.split("-")[1])
            translate_chunk_file(n, chunk_num)


def do_assemble(chapters: list[dict], only: int | None) -> None:
    for c in _chapters_iter(chapters, only):
        n = c["number"]
        vi_title = c.get("vi_title") or c["en_title"]
        summary = c.get("summary", "")
        # Verify every chunk has been translated (no .err, no missing .md).
        chunk_files = sorted(CHUNK_DIR.glob(f"ch{n:02d}-*.txt"))
        missing: list[int] = []
        for cf in chunk_files:
            chunk_num = int(cf.stem.split("-")[1])
            if not translated_path(n, chunk_num).exists():
                missing.append(chunk_num)
        if missing:
            print(
                f"ch{n:02d}: skipping assemble — missing translated chunks: {missing}",
                file=sys.stderr,
            )
            continue
        assemble_chapter_file(n, vi_title=vi_title, summary=summary)


STAGES = {
    "scrape": do_scrape,
    "chunk": do_chunk,
    "translate": do_translate,
    "assemble": do_assemble,
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=list(STAGES) + ["all"])
    ap.add_argument("--chapter", type=int, default=None)
    args = ap.parse_args()

    chapters = load_chapters()
    if args.chapter is not None and not (1 <= args.chapter <= CHAPTERS):
        print(f"--chapter must be in 1..{CHAPTERS}", file=sys.stderr)
        return 2

    if args.stage == "all":
        for stage in ("scrape", "chunk", "translate", "assemble"):
            STAGES[stage](chapters, args.chapter)
    else:
        STAGES[args.stage](chapters, args.chapter)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Append Makefile targets**

Append to `/Users/htruong/code/phucamtv/Makefile`:

```makefile

# --- GC translation pipeline ---
gc-scrape:
	python -m scripts.gc_translation.run scrape

gc-chunk:
	python -m scripts.gc_translation.run chunk

gc-translate:
	python -m scripts.gc_translation.run translate

gc-assemble:
	python -m scripts.gc_translation.run assemble

gc-all:
	python -m scripts.gc_translation.run all

gc-test:
	pytest tests/gc_translation/ -v

.PHONY: gc-scrape gc-chunk gc-translate gc-assemble gc-all gc-test
```

- [ ] **Step 3: Verify the orchestrator is callable**

```bash
cd /Users/htruong/code/phucamtv && python -m scripts.gc_translation.run --help
```

Expected: argparse help listing `scrape/chunk/translate/assemble/all` stages.

- [ ] **Step 4: Commit**

```bash
git add scripts/gc_translation/run.py Makefile
git commit -m "gc-translation: orchestrator and make targets"
```

---

## Task 15: End-to-end validation on chapter 1

This is the integration gate. If chapter 1 round-trips cleanly, the pipeline is ready for the remaining 41.

- [ ] **Step 1: Ensure `ANTHROPIC_API_KEY` is set**

```bash
echo "${ANTHROPIC_API_KEY:0:10}..."
```

Expected: prints a truncated key. If empty, set it in your shell before proceeding.

- [ ] **Step 2: Scrape chapter 1 only**

```bash
cd /Users/htruong/code/phucamtv && python -m scripts.gc_translation.run scrape --chapter 1
```

Expected: `ch01: fetching ...` then `ch01: wrote data/gc-source/ch01.txt`. Inspect that file to confirm clean English paragraphs with `## ` markers for section breaks.

- [ ] **Step 3: Chunk chapter 1**

```bash
python -m scripts.gc_translation.run chunk --chapter 1
ls data/gc-source/chunks/ch01-*.txt
```

Expected: multiple chunk files; spot-check one to confirm it opens with a `## Section Heading`.

- [ ] **Step 4: Translate chapter 1**

```bash
python -m scripts.gc_translation.run translate --chapter 1
ls data/gc-translated/ch01-*.md
```

Expected: one `.md` per chunk, no `.err` files. Open one and confirm: Vietnamese text with diacritics, Bible blockquotes formatted with `<cite>(Vietnamese book name C:V)</cite>`, glossary terms (Sa-bát, Đức Chúa Giê-su) used correctly.

- [ ] **Step 5: Inspect any warnings about unresolved sentinels**

If translate printed unresolved refs, open the corresponding `.md` and search for `[[BIBLE:`. Either:
- The reference was malformed (e.g. `Is. 24:1` with trailing dot): add the alias to `data/gc-translation/bible-refs.yaml` (Task 2) and rerun resolve via `python -m scripts.gc_translation.run translate --chapter 1` (this will skip completed chunks; to force re-resolve without re-translating, manually delete the chunk's `.md` and rerun).
- The verse genuinely isn't in VN1925 (e.g. a deuterocanonical reference): accept the sentinel; it'll surface as a lint warning at assemble time.

- [ ] **Step 6: Add Vietnamese title + summary for chapter 1 to `chapters.yaml`**

Edit `data/gc-translation/chapters.yaml` entry for chapter 1, adding:

```yaml
  vi_title: Sự Tàn Phá Giê-ru-sa-lem
  summary: Đức Chúa Giê-su báo trước về sự tàn phá thành Giê-ru-sa-lem và số phận của dân Do Thái khi họ chối bỏ Ngài.
```

(You can ask Claude for Vietnamese titles + summaries for all 42 chapters in a single later batch; for now, only chapter 1 is needed to validate.)

- [ ] **Step 7: Assemble chapter 1**

```bash
python -m scripts.gc_translation.run assemble --chapter 1
cat content/sach/egw/thien-ac-dau-tranh/chuong-01.md | head -30
```

Expected: Hugo front matter block followed by Vietnamese chapter text. No lint warnings about unresolved sentinels (or only the ones you accepted in Step 5).

- [ ] **Step 8: Build Hugo and view chapter 1**

```bash
hugo --minify && hugo server -D
```

Visit `http://localhost:1313/sach/egw/thien-ac-dau-tranh/chuong-01/` in a browser. Confirm:
- Title renders "Chương 1: Sự Tàn Phá Giê-ru-sa-lem".
- Body reads as coherent Vietnamese.
- Bible blockquotes are styled (depends on site theme; at minimum they appear as blockquotes with the citation).

Stop the server with Ctrl-C.

- [ ] **Step 9: Commit the validated chapter 1 output**

```bash
git add data/gc-translation/chapters.yaml content/sach/egw/thien-ac-dau-tranh/chuong-01.md
git commit -m "gc-translation: end-to-end validation on chapter 1"
```

---

## Task 16: Full pipeline run on all 42 chapters

- [ ] **Step 1: Run the full pipeline**

```bash
cd /Users/htruong/code/phucamtv && python -m scripts.gc_translation.run all
```

Expected: sequential scrape → chunk → translate → assemble for all 42 chapters. This will take hours and spend tokens. You can stop and resume at any time — re-running skips completed work.

- [ ] **Step 2: Check for `.err` files**

```bash
ls data/gc-translated/*.err 2>/dev/null || echo "no errors"
```

Expected: `no errors`. If any `.err` files exist, read them, fix the root cause (quota, network, prompt regression), then re-run `python -m scripts.gc_translation.run translate`. Only errored chunks re-translate.

- [ ] **Step 3: Check for unresolved sentinels across all chapters**

```bash
grep -rn "\[\[BIBLE:" content/sach/egw/thien-ac-dau-tranh/ || echo "all refs resolved"
```

Expected: `all refs resolved`. Any hits mean either bad book-name aliases (fix `bible-refs.yaml`, re-run assemble) or genuinely-missing VN1925 verses (acceptable; leave them and manually annotate later).

- [ ] **Step 4: Fill in remaining Vietnamese titles and summaries**

For chapters 2-42 in `data/gc-translation/chapters.yaml`, add `vi_title` and `summary` fields. You can do this by hand or by running a one-off Claude batch over just the English chapter titles; out of scope of this plan's automation.

Re-run assemble so the front matter picks up the new titles:

```bash
python -m scripts.gc_translation.run assemble
```

- [ ] **Step 5: Build Hugo site and spot-check**

```bash
make build
```

Expected: no Hugo build errors. Visit `/sach/egw/thien-ac-dau-tranh/` in the deployed site and verify the 42-chapter listing.

- [ ] **Step 6: Commit everything**

```bash
git add data/gc-translation/chapters.yaml content/sach/egw/thien-ac-dau-tranh/
git commit -m "gc-translation: full translation of The Great Controversy"
```

---

## Self-Review Notes

**Spec coverage:** Every section of the design doc maps to a task — scraping (T6/T7), chunking (T8), translation (T10/T11), Bible substitution (T3/T4), lint (T5), assembly (T12), Hugo layout (T13), orchestration (T14), error handling (all tasks — idempotency + `.err` siblings + retries), testing (each implementation task has a paired test task).

**Placeholders:** None remaining. Every code step has concrete code; every command has expected output. Vietnamese titles for chapters 2-42 are deferred to Task 16 Step 4 by design (the user may supply these manually or via a separate batch; not part of the translation pipeline's automation surface).

**Type consistency:** `scrape_chapter()`, `extract_chapter()`, `chunk_text()`, `load_glossary()`, `build_system_prompt()`, `translate_chunk_text()`, `translate_chunk_file()`, `resolve_sentinels()`, `lint_text()`, `build_front_matter()`, `assemble_chapter_text()`, `assemble_chapter_file()` — signatures are consistent across definition and call sites in run.py and assemble.py. Path helpers in `paths.py` are the single source of truth for file locations.
