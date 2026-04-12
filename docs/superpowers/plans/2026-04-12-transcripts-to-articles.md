# Transcripts-to-Articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 104 video-only sermon articles listed in `TODO.md` into full written articles by fetching YouTube transcripts with `yt-dlp` and rewriting them into structured markdown matching the `/baigiang/toi-nao-khong-duoc-chua-tha/` reference article.

**Architecture:** Four-stage pipeline: (1) extract `(article_path, video_id)` pairs from `TODO.md`; (2) reuse the existing `scripts/yt/transcript.py` → `scripts/yt/process-one.py` flow to fetch any missing transcripts into `.claude/data/transcripts/{video_id}.txt`; (3) an AI-rewrite script calls the Claude API to transform each transcript into sectioned Vietnamese prose following project content guidelines; (4) a writer script rewrites each source `.md` in place, preserving frontmatter (adding `description` if missing) and appending the structured body after the `{{< youtube >}}` shortcode. TDD throughout for pure helpers; AI calls live behind a thin interface that can be stubbed in tests.

**Tech Stack:** Python 3 (frontmatter parsing, orchestration), `yt-dlp` (installed at `/opt/homebrew/bin/yt-dlp`), Anthropic Python SDK with prompt caching, Hugo (content target), `ruamel.yaml` or `python-frontmatter` for safe YAML round-tripping.

**Reference example (target state):** `content/articles/2026/03/26/baigiang--toi-nao-khong-duoc-chua-tha.md`

**Reference source (typical before state):**
```yaml
---
title: "..."
date: 2020-06-02
tags: ["..."]
authors: ["..."]
plugins: [youtube]
youtubeIDs: ["X5BAdYsjq_Q"]
url: /baigiang/.../index.html
draft: false
---

{{< youtube "X5BAdYsjq_Q" >}}
```

**Content rules (from `CLAUDE.md` — MUST be enforced in AI prompt and validated post-hoc):**
- "Đức Chúa Giê-su" (not "Chúa Giê-su"/"Jesus"/"Giê-xu")
- "ban phước" when subject is God; "chúc phước" only when subject is human
- "Sa-bát" (not "Sabát")
- "Do Thái Giáo" (not "Giu-đa-izt")
- "Cơ-đốc" (not "Cơ Đốc")
- Capitalization: "Đức Chúa Trời", "Đức Thánh Linh", "Kinh Thánh", "Đức Chúa Giê-su"

---

## File Structure

New files (all under `scripts/yt/`):
- `scripts/yt/todo_parse.py` — pure function: parse `TODO.md` → list of `{title, path, video_id}` dicts. Reads the first `youtubeIDs` entry from each referenced markdown file.
- `scripts/yt/enqueue_todo.py` — CLI: calls `todo_parse`, writes one JSON task per missing transcript to `.claude/tasks/todo/{video_id}.json`. Skips video IDs that already have a transcript.
- `scripts/yt/rewrite_transcript.py` — CLI + library: loads a transcript, calls Claude API with the rewrite prompt, returns structured markdown + suggested description. Has a `--dry-run` mode that writes to stdout instead of touching files.
- `scripts/yt/apply_article.py` — CLI: given `(article_path, body_markdown, description)`, rewrite the `.md` file: parse frontmatter, inject/update `description`, preserve all other fields, keep the existing `{{< youtube "ID" >}}` shortcode as the first body line, then append the new prose.
- `scripts/yt/run_batch.py` — top-level orchestrator: for each TODO entry, ensure transcript exists, call rewrite, call apply, log result. Idempotent.
- `scripts/yt/prompts/rewrite.md` — the Claude prompt (checked in so edits are reviewable).
- `tests/yt/test_todo_parse.py`, `tests/yt/test_apply_article.py` — pytest tests.
- `scripts/yt/__init__.py`, `tests/__init__.py`, `tests/yt/__init__.py` — package markers.

No changes to existing `transcript.py` or `process-one.py` — they are reused as-is.

---

### Task 1: Parse TODO.md into structured entries

**Files:**
- Create: `scripts/yt/todo_parse.py`
- Create: `tests/yt/test_todo_parse.py`
- Create: `scripts/yt/__init__.py` (empty)
- Create: `tests/__init__.py` (empty)
- Create: `tests/yt/__init__.py` (empty)

- [ ] **Step 1: Write the failing test**

Create `tests/yt/test_todo_parse.py`:

```python
from pathlib import Path
from textwrap import dedent

from scripts.yt.todo_parse import parse_todo, TodoEntry


def test_parse_todo_extracts_entries(tmp_path: Path) -> None:
    article_rel = "articles/2020/06/02/baigiang--ra-hap.md"
    article_file = tmp_path / "content" / article_rel
    article_file.parent.mkdir(parents=True)
    article_file.write_text(dedent('''\
        ---
        title: "Ra-háp"
        youtubeIDs: ["X5BAdYsjq_Q"]
        ---

        {{< youtube "X5BAdYsjq_Q" >}}
    '''))

    todo = tmp_path / "TODO.md"
    todo.write_text(dedent(f'''\
        # header

        - [ ] Ra-háp (`{article_rel}`)
        - [x] already done (`articles/2020/07/01/other.md`)
    '''))

    entries = parse_todo(todo, content_root=tmp_path / "content")
    assert entries == [
        TodoEntry(
            title="Ra-háp",
            article_path=article_file,
            video_id="X5BAdYsjq_Q",
        )
    ]


def test_parse_todo_skips_missing_youtube_id(tmp_path: Path) -> None:
    article_rel = "articles/a.md"
    article_file = tmp_path / "content" / article_rel
    article_file.parent.mkdir(parents=True)
    article_file.write_text("---\ntitle: x\n---\n")

    todo = tmp_path / "TODO.md"
    todo.write_text(f"- [ ] x (`{article_rel}`)\n")

    entries = parse_todo(todo, content_root=tmp_path / "content")
    assert entries == []
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `cd /Users/htruong/code/phucamtv && python3 -m pytest tests/yt/test_todo_parse.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.yt.todo_parse'` (or equivalent).

- [ ] **Step 3: Implement `todo_parse.py`**

Create `scripts/yt/todo_parse.py`:

```python
"""Parse TODO.md into (title, article_path, video_id) entries."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


TODO_LINE_RE = re.compile(r"^- \[ \] (?P<title>.+?) \(`(?P<rel>[^`]+)`\)\s*$")
YT_ID_RE = re.compile(r'youtubeIDs:\s*\["([A-Za-z0-9_-]+)"')


@dataclass(frozen=True)
class TodoEntry:
    title: str
    article_path: Path
    video_id: str


def parse_todo(todo_file: Path, content_root: Path) -> list[TodoEntry]:
    entries: list[TodoEntry] = []
    for line in todo_file.read_text(encoding="utf-8").splitlines():
        m = TODO_LINE_RE.match(line)
        if not m:
            continue
        article_path = content_root / m.group("rel")
        if not article_path.exists():
            continue
        body = article_path.read_text(encoding="utf-8")
        ym = YT_ID_RE.search(body)
        if not ym:
            continue
        entries.append(
            TodoEntry(
                title=m.group("title").strip(),
                article_path=article_path,
                video_id=ym.group(1),
            )
        )
    return entries
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/htruong/code/phucamtv && python3 -m pytest tests/yt/test_todo_parse.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Sanity-check against real data**

Run: `cd /Users/htruong/code/phucamtv && python3 -c "from pathlib import Path; from scripts.yt.todo_parse import parse_todo; e = parse_todo(Path('TODO.md'), Path('content')); print(len(e)); [print(x.video_id, x.title) for x in e[:3]]"`
Expected: prints a count close to 104 and the first three entries have video IDs like `X5BAdYsjq_Q`.

- [ ] **Step 6: Commit**

```bash
git add scripts/yt/__init__.py scripts/yt/todo_parse.py tests/__init__.py tests/yt/__init__.py tests/yt/test_todo_parse.py
git commit -m "feat(yt): parse TODO.md into (title, path, video_id) entries"
```

---

### Task 2: Enqueue missing-transcript tasks

**Files:**
- Create: `scripts/yt/enqueue_todo.py`

- [ ] **Step 1: Implement the enqueue script**

Create `scripts/yt/enqueue_todo.py`:

```python
#!/usr/bin/env python3
"""Enqueue TODO entries that lack a transcript into .claude/tasks/todo/."""

from __future__ import annotations

import json
from pathlib import Path

from scripts.yt.todo_parse import parse_todo

ROOT = Path(__file__).resolve().parents[2]
TODO_FILE = ROOT / "TODO.md"
CONTENT_ROOT = ROOT / "content"
TRANSCRIPTS_DIR = ROOT / ".claude" / "data" / "transcripts"
TASK_TODO_DIR = ROOT / ".claude" / "tasks" / "todo"
TASK_DONE_DIR = ROOT / ".claude" / "tasks" / "done"
TASK_FAILED_DIR = ROOT / ".claude" / "tasks" / "failed"


def main() -> None:
    TASK_TODO_DIR.mkdir(parents=True, exist_ok=True)
    entries = parse_todo(TODO_FILE, CONTENT_ROOT)
    created = skipped_have_transcript = skipped_already_processed = 0

    for e in entries:
        if (TRANSCRIPTS_DIR / f"{e.video_id}.txt").exists():
            skipped_have_transcript += 1
            continue
        if any(
            (d / f"{e.video_id}.json").exists()
            for d in (TASK_TODO_DIR, TASK_DONE_DIR, TASK_FAILED_DIR)
        ):
            skipped_already_processed += 1
            continue
        task = {"id": e.video_id, "title": e.title}
        (TASK_TODO_DIR / f"{e.video_id}.json").write_text(
            json.dumps(task, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        created += 1

    print(
        f"enqueued={created} "
        f"skipped_have_transcript={skipped_have_transcript} "
        f"skipped_already_processed={skipped_already_processed} "
        f"total_todo={len(entries)}"
    )


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the enqueue script**

Run: `cd /Users/htruong/code/phucamtv && python3 -m scripts.yt.enqueue_todo`
Expected: prints counts, e.g. `enqueued=~88 skipped_have_transcript=~16 skipped_already_processed=... total_todo=104`.

- [ ] **Step 3: Spot-check one enqueued task**

Run: `ls .claude/tasks/todo/ | head -3`
Then read one: `cat .claude/tasks/todo/<one-of-them>.json`
Expected: valid JSON with `id` and `title`.

- [ ] **Step 4: Commit**

```bash
git add scripts/yt/enqueue_todo.py
git commit -m "feat(yt): enqueue TODO entries missing transcripts"
```

---

### Task 3: Fetch missing transcripts (reuse existing pipeline)

**Files:** (no code changes — operational task)

- [ ] **Step 1: Run the existing fetcher in a loop until the todo queue is drained**

Run:
```bash
cd /Users/htruong/code/phucamtv
while ls .claude/tasks/todo/*.json >/dev/null 2>&1; do
  python3 scripts/yt/process-one.py || break
done
echo "done: todo=$(ls .claude/tasks/todo/ 2>/dev/null | wc -l) failed=$(ls .claude/tasks/failed/ 2>/dev/null | wc -l)"
```
Expected: script runs until `.claude/tasks/todo/` is empty; prints final counts. Some may fail (video removed, no captions) — that's expected; failed tasks land in `.claude/tasks/failed/`.

- [ ] **Step 2: Verify transcripts landed**

Run: `ls .claude/data/transcripts/ | wc -l`
Expected: count grew by roughly the `enqueued` count from Task 2.

- [ ] **Step 3: Enumerate failures**

Run: `ls .claude/tasks/failed/ 2>/dev/null | head -20`
Expected: list of video IDs that failed. These are skipped by the rest of the pipeline — note the count, we'll surface them in the final report.

No commit (this task only produces data under `.claude/`, not source).

---

### Task 4: Author the rewrite prompt

**Files:**
- Create: `scripts/yt/prompts/rewrite.md`

- [ ] **Step 1: Write the prompt file**

Create `scripts/yt/prompts/rewrite.md`:

```markdown
Bạn là một biên tập viên Cơ-đốc, nhiệm vụ là chuyển đổi bản chép lời (transcript) tự động của một bài giảng YouTube tiếng Việt thành một bài viết có cấu trúc cho website phucam.tv. Bài viết phải đọc được như một bài báo thần học đã được biên tập, không phải là lời nói được chép lại.

## Đầu vào
- Tựa đề bài: <TITLE>
- Tác giả (nếu có): <AUTHOR>
- Bản chép lời thô (có thể chứa lỗi nhận dạng giọng nói, lặp từ, từ đệm):

<TRANSCRIPT>

## Yêu cầu đầu ra

Trả lời bằng JSON hợp lệ duy nhất (không có văn bản khác, không có code fence), cấu trúc:

```
{
  "description": "Một câu mô tả 1–2 câu cho SEO, tiếng Việt, dưới 300 ký tự. Nêu rõ diễn giả (nếu biết), đoạn Kinh Thánh chính, và luận điểm chính.",
  "tags": ["Tag1", "Tag2", "..."],
  "body_markdown": "Nội dung Markdown hoàn chỉnh, bắt đầu bằng `## <Tiêu đề phần đầu>` — không lặp lại tựa đề bài, không chứa shortcode youtube."
}
```

## Quy tắc biên tập (BẮT BUỘC)

- Ngôn ngữ: tiếng Việt, văn viết trang trọng, không dùng từ đệm như "ờ", "à", "thì"…
- Xưng danh: luôn dùng **"Đức Chúa Giê-su"** (không dùng "Chúa Giê-su", "Jesus", "Giê-xu").
- Khi chủ ngữ là Đức Chúa Trời: dùng **"ban phước"**, KHÔNG dùng "chúc phước". "chúc phước" chỉ dùng khi chủ ngữ là con người.
- Dùng **"Sa-bát"** (không "Sabát"), **"Do Thái Giáo"** (không "Giu-đa-izt"), **"Cơ-đốc"** (không "Cơ Đốc").
- Viết hoa đúng: **Đức Chúa Trời**, **Đức Thánh Linh**, **Kinh Thánh**, **Đức Chúa Giê-su**.
- Chia bài thành 4–7 phần, mỗi phần có tiêu đề `##` mô tả nội dung phần đó (không dùng "Phần 1", "Phần 2").
- Giữa các phần dùng dòng `---` (horizontal rule).
- Mỗi đoạn văn ngắn gọn, 2–5 câu, tập trung một ý.
- Không chép nguyên văn transcript — viết lại thành văn viết mạch lạc.
- Nếu transcript có tham khảo Kinh Thánh, trích dẫn đúng sách/chương/câu.
- KHÔNG thêm phần "Kết luận" nếu bản gốc không có — kết thúc tự nhiên.
- KHÔNG bịa thông tin không có trong transcript.

## Tags
- 3–7 tags, tiếng Việt, viết hoa chữ cái đầu mỗi từ quan trọng.
- Dùng các chủ đề chính, nhân vật Kinh Thánh, sách Kinh Thánh được đề cập.
```

- [ ] **Step 2: Commit the prompt**

```bash
git add scripts/yt/prompts/rewrite.md
git commit -m "feat(yt): add transcript-to-article rewrite prompt"
```

---

### Task 5: Transcript → article rewriter (Claude API)

**Files:**
- Create: `scripts/yt/rewrite_transcript.py`

- [ ] **Step 1: Install the Anthropic SDK if not present**

Run: `cd /Users/htruong/code/phucamtv && python3 -c "import anthropic" 2>&1 || python3 -m pip install --user anthropic`
Expected: either prints nothing (already installed) or installs the SDK.

- [ ] **Step 2: Implement the rewriter**

Create `scripts/yt/rewrite_transcript.py`:

```python
#!/usr/bin/env python3
"""Rewrite a YouTube transcript into a structured sermon article via Claude."""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parents[2]
PROMPT_FILE = ROOT / "scripts" / "yt" / "prompts" / "rewrite.md"
TRANSCRIPTS_DIR = ROOT / ".claude" / "data" / "transcripts"
MODEL = "claude-opus-4-6"


@dataclass
class Rewrite:
    description: str
    tags: list[str]
    body_markdown: str


def build_prompt(title: str, author: str, transcript: str) -> str:
    template = PROMPT_FILE.read_text(encoding="utf-8")
    return (
        template.replace("<TITLE>", title)
        .replace("<AUTHOR>", author or "(không xác định)")
        .replace("<TRANSCRIPT>", transcript)
    )


def rewrite(title: str, author: str, transcript: str, client: anthropic.Anthropic) -> Rewrite:
    msg = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": build_prompt(title, author, transcript)}],
    )
    text = "".join(block.text for block in msg.content if block.type == "text").strip()
    # tolerate accidental code fences
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    data = json.loads(text)
    return Rewrite(
        description=data["description"].strip(),
        tags=[t.strip() for t in data["tags"]],
        body_markdown=data["body_markdown"].strip(),
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video_id")
    ap.add_argument("--title", required=True)
    ap.add_argument("--author", default="")
    ap.add_argument("--out", help="Write JSON result here; otherwise stdout.")
    args = ap.parse_args()

    transcript_file = TRANSCRIPTS_DIR / f"{args.video_id}.txt"
    if not transcript_file.exists():
        print(f"No transcript: {transcript_file}", file=sys.stderr)
        return 2

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    result = rewrite(args.title, args.author, transcript_file.read_text(encoding="utf-8"), client)
    payload = json.dumps(
        {"description": result.description, "tags": result.tags, "body_markdown": result.body_markdown},
        ensure_ascii=False,
        indent=2,
    )
    if args.out:
        Path(args.out).write_text(payload, encoding="utf-8")
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Smoke-test on one real transcript**

Pick a video ID whose transcript already exists:
```bash
cd /Users/htruong/code/phucamtv
VID=$(ls .claude/data/transcripts/ | head -1 | sed 's/\.txt$//')
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY python3 -m scripts.yt.rewrite_transcript "$VID" --title "Smoke test" --out /tmp/rewrite-smoke.json
python3 -c "import json; d=json.load(open('/tmp/rewrite-smoke.json')); print('desc:', d['description'][:80]); print('tags:', d['tags']); print('body head:', d['body_markdown'][:200])"
```
Expected: JSON parses; `description` is a sensible Vietnamese sentence; `body_markdown` starts with `## `.

- [ ] **Step 4: Commit**

```bash
git add scripts/yt/rewrite_transcript.py
git commit -m "feat(yt): add Claude-powered transcript-to-article rewriter"
```

---

### Task 6: Apply rewritten body to the article file

**Files:**
- Create: `scripts/yt/apply_article.py`
- Create: `tests/yt/test_apply_article.py`

- [ ] **Step 1: Install python-frontmatter if not present**

Run: `python3 -c "import frontmatter" 2>&1 || python3 -m pip install --user python-frontmatter`
Expected: prints nothing or installs the library.

- [ ] **Step 2: Write the failing test**

Create `tests/yt/test_apply_article.py`:

```python
from pathlib import Path
from textwrap import dedent

from scripts.yt.apply_article import apply


def test_apply_preserves_frontmatter_and_replaces_body(tmp_path: Path) -> None:
    article = tmp_path / "a.md"
    article.write_text(dedent('''\
        ---
        title: "Ra-háp"
        date: 2020-06-02
        tags: ["Nhân Vật"]
        authors: ["dang-thanh-phong"]
        plugins: [youtube]
        youtubeIDs: ["X5BAdYsjq_Q"]
        url: /baigiang/dang-thanh-phong/ra-hap/index.html
        draft: false
        ---

        {{< youtube "X5BAdYsjq_Q" >}}
    '''))

    apply(
        article,
        description="Bài giảng về đức tin của Ra-háp.",
        body_markdown="## Bối cảnh\n\nRa-háp là...\n\n---\n\n## Đức tin\n\n...",
        extra_tags=["Đức Tin"],
    )

    txt = article.read_text(encoding="utf-8")
    assert 'title: Ra-háp' in txt or 'title: "Ra-háp"' in txt
    assert "description: " in txt
    assert "Bài giảng về đức tin của Ra-háp." in txt
    assert '{{< youtube "X5BAdYsjq_Q" >}}' in txt
    assert "## Bối cảnh" in txt
    # youtube shortcode comes before the prose
    assert txt.index('{{< youtube') < txt.index("## Bối cảnh")
    # original tag preserved, new tag merged
    assert "Nhân Vật" in txt
    assert "Đức Tin" in txt


def test_apply_is_idempotent_on_body(tmp_path: Path) -> None:
    article = tmp_path / "a.md"
    article.write_text(dedent('''\
        ---
        title: "x"
        youtubeIDs: ["VID"]
        ---

        {{< youtube "VID" >}}
    '''))

    apply(article, description="d", body_markdown="## A\n\nx", extra_tags=[])
    apply(article, description="d", body_markdown="## A\n\nx", extra_tags=[])
    txt = article.read_text(encoding="utf-8")
    assert txt.count('{{< youtube "VID" >}}') == 1
    assert txt.count("## A") == 1
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `cd /Users/htruong/code/phucamtv && python3 -m pytest tests/yt/test_apply_article.py -v`
Expected: FAIL with import error on `scripts.yt.apply_article`.

- [ ] **Step 4: Implement the applier**

Create `scripts/yt/apply_article.py`:

```python
#!/usr/bin/env python3
"""Rewrite a video-only sermon article with a generated article body."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import frontmatter

YOUTUBE_SHORTCODE_RE = re.compile(r'\{\{<\s*youtube\b[^}]*\}\}')


def apply(
    article_path: Path,
    *,
    description: str,
    body_markdown: str,
    extra_tags: list[str],
) -> None:
    post = frontmatter.loads(article_path.read_text(encoding="utf-8"))
    video_id = post.metadata["youtubeIDs"][0]

    if description and not post.metadata.get("description"):
        post.metadata["description"] = description

    if extra_tags:
        existing = list(post.metadata.get("tags") or [])
        for t in extra_tags:
            if t not in existing:
                existing.append(t)
        post.metadata["tags"] = existing

    shortcode = f'{{{{< youtube "{video_id}" >}}}}'
    new_body = f"{shortcode}\n\n{body_markdown.strip()}\n"
    post.content = new_body

    article_path.write_text(frontmatter.dumps(post) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("article")
    ap.add_argument("--description", required=True)
    ap.add_argument("--body-file", required=True, help="File containing body markdown.")
    ap.add_argument("--tag", action="append", default=[])
    args = ap.parse_args()

    body = Path(args.body_file).read_text(encoding="utf-8")
    apply(
        Path(args.article),
        description=args.description,
        body_markdown=body,
        extra_tags=args.tag,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/htruong/code/phucamtv && python3 -m pytest tests/yt/ -v`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/yt/apply_article.py tests/yt/test_apply_article.py
git commit -m "feat(yt): apply rewritten body to sermon article preserving frontmatter"
```

---

### Task 7: Batch orchestrator

**Files:**
- Create: `scripts/yt/run_batch.py`

- [ ] **Step 1: Implement the orchestrator**

Create `scripts/yt/run_batch.py`:

```python
#!/usr/bin/env python3
"""End-to-end: for each TODO entry with a transcript, rewrite and apply.

Skips entries that are already rewritten (body contains any `##` heading besides
the YouTube shortcode). Safe to re-run.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import anthropic
import frontmatter

from scripts.yt.apply_article import apply
from scripts.yt.rewrite_transcript import rewrite
from scripts.yt.todo_parse import parse_todo

ROOT = Path(__file__).resolve().parents[2]
TODO_FILE = ROOT / "TODO.md"
CONTENT_ROOT = ROOT / "content"
TRANSCRIPTS_DIR = ROOT / ".claude" / "data" / "transcripts"


def author_from_frontmatter(article_path: Path) -> str:
    post = frontmatter.loads(article_path.read_text(encoding="utf-8"))
    authors = post.metadata.get("authors") or []
    return authors[0] if authors else ""


def already_rewritten(article_path: Path) -> bool:
    post = frontmatter.loads(article_path.read_text(encoding="utf-8"))
    return "##" in post.content


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="Max entries to process (0 = all).")
    ap.add_argument("--only", help="Only process this video_id.")
    args = ap.parse_args()

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    entries = parse_todo(TODO_FILE, CONTENT_ROOT)
    processed = skipped_no_transcript = skipped_already = failed = 0

    for e in entries:
        if args.only and e.video_id != args.only:
            continue
        transcript = TRANSCRIPTS_DIR / f"{e.video_id}.txt"
        if not transcript.exists():
            skipped_no_transcript += 1
            continue
        if already_rewritten(e.article_path):
            skipped_already += 1
            continue

        print(f"-> {e.video_id}  {e.title}", file=sys.stderr)
        try:
            r = rewrite(
                title=e.title,
                author=author_from_frontmatter(e.article_path),
                transcript=transcript.read_text(encoding="utf-8"),
                client=client,
            )
            apply(
                e.article_path,
                description=r.description,
                body_markdown=r.body_markdown,
                extra_tags=r.tags,
            )
            processed += 1
        except Exception as exc:  # noqa: BLE001 — batch job, log & continue
            print(f"   FAILED: {exc}", file=sys.stderr)
            failed += 1

        if args.limit and processed >= args.limit:
            break

    print(
        f"processed={processed} "
        f"skipped_no_transcript={skipped_no_transcript} "
        f"skipped_already={skipped_already} "
        f"failed={failed}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Dry-run on a single entry**

Pick one entry whose transcript exists:
```bash
cd /Users/htruong/code/phucamtv
VID=$(python3 -c "
from pathlib import Path
from scripts.yt.todo_parse import parse_todo
for e in parse_todo(Path('TODO.md'), Path('content')):
    if (Path('.claude/data/transcripts') / f'{e.video_id}.txt').exists():
        print(e.video_id); break
")
echo "Testing with $VID"
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY python3 -m scripts.yt.run_batch --only "$VID"
```
Expected: prints `-> <VID> <title>` then `processed=1 ...`.

- [ ] **Step 3: Verify the article looks right**

Find the article file (the script logs the video_id — find its path in `TODO.md`) and:
```bash
cd /Users/htruong/code/phucamtv
git diff -- content/ | head -80
```
Expected: the diff shows:
- `description:` added to frontmatter
- `tags:` updated with new topic tags
- `{{< youtube "<VID>" >}}` preserved as first body line
- Several `## ` section headings with Vietnamese prose
- No `Chúa Giê-su`, `Jesus`, `Giê-xu` — only `Đức Chúa Giê-su`
- No `Sabát` — only `Sa-bát`

If the content rule checks fail, fix the prompt in `scripts/yt/prompts/rewrite.md` and re-run.

- [ ] **Step 4: Revert the test article if the first run had issues, otherwise keep**

If the output was bad: `git checkout -- content/` and iterate on the prompt.
If the output was good: commit it as the first example.

```bash
git add scripts/yt/run_batch.py
git commit -m "feat(yt): end-to-end batch rewriter for video-only articles"
```

---

### Task 8: Content-rule validator (defense in depth)

**Files:**
- Create: `scripts/yt/validate_content.py`
- Create: `tests/yt/test_validate_content.py`

- [ ] **Step 1: Write the failing test**

Create `tests/yt/test_validate_content.py`:

```python
from scripts.yt.validate_content import violations


def test_detects_jesus_variants() -> None:
    v = violations("Chúa Giê-su đã phán.")
    assert any("Chúa Giê-su" in x for x in v)


def test_detects_sabat() -> None:
    v = violations("Ngày Sabát.")
    assert any("Sabát" in x for x in v)


def test_accepts_correct_text() -> None:
    assert violations("Đức Chúa Giê-su giữ ngày Sa-bát.") == []
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd /Users/htruong/code/phucamtv && python3 -m pytest tests/yt/test_validate_content.py -v`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the validator**

Create `scripts/yt/validate_content.py`:

```python
"""Flag text that breaks project CLAUDE.md content guidelines."""

from __future__ import annotations

import re

FORBIDDEN_PATTERNS = [
    (re.compile(r"(?<!Đức\s)(?<!Đức )Chúa Giê-su"), "Use 'Đức Chúa Giê-su' not 'Chúa Giê-su'"),
    (re.compile(r"\bJesus\b"), "Use 'Đức Chúa Giê-su' not 'Jesus'"),
    (re.compile(r"Giê-xu"), "Use 'Đức Chúa Giê-su' not 'Giê-xu'"),
    (re.compile(r"\bSabát\b"), "Use 'Sa-bát' not 'Sabát'"),
    (re.compile(r"Giu-đa-izt"), "Use 'Do Thái Giáo'"),
    (re.compile(r"\bCơ Đốc\b"), "Use 'Cơ-đốc' not 'Cơ Đốc'"),
    (re.compile(r"Đức chúa trời"), "Capitalization: 'Đức Chúa Trời'"),
    (re.compile(r"Đức thánh linh"), "Capitalization: 'Đức Thánh Linh'"),
    (re.compile(r"Kinh thánh"), "Capitalization: 'Kinh Thánh'"),
]


def violations(text: str) -> list[str]:
    out: list[str] = []
    for pat, msg in FORBIDDEN_PATTERNS:
        for m in pat.finditer(text):
            out.append(f"{msg} @ ...{text[max(0, m.start()-20):m.end()+20]}...")
    return out
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/htruong/code/phucamtv && python3 -m pytest tests/yt/ -v`
Expected: all tests PASS.

- [ ] **Step 5: Wire the validator into `run_batch.py`**

Edit `scripts/yt/run_batch.py`, inside the `try` block after `r = rewrite(...)` and before `apply(...)`:

```python
            from scripts.yt.validate_content import violations
            v = violations(r.body_markdown) + violations(r.description)
            if v:
                print("   CONTENT-RULE VIOLATIONS — skipping:", file=sys.stderr)
                for line in v[:5]:
                    print(f"     - {line}", file=sys.stderr)
                failed += 1
                continue
```

- [ ] **Step 6: Commit**

```bash
git add scripts/yt/validate_content.py scripts/yt/run_batch.py tests/yt/test_validate_content.py
git commit -m "feat(yt): validate rewritten content against CLAUDE.md style rules"
```

---

### Task 9: Process a small batch and review

**Files:** (no code changes)

- [ ] **Step 1: Process 5 articles**

Run: `cd /Users/htruong/code/phucamtv && ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY python3 -m scripts.yt.run_batch --limit 5`
Expected: prints 5 `-> VID title` lines and final `processed=5 ...`.

- [ ] **Step 2: Build and preview**

Run: `cd /Users/htruong/code/phucamtv && make dev` (in a separate terminal).
Open each of the 5 modified article URLs in the browser (found via `git diff --name-only | grep content/`). Verify:
- YouTube video plays
- Body renders with headers
- No raw transcript-style repetition

- [ ] **Step 3: Spot-check content rules on all 5**

Run:
```bash
cd /Users/htruong/code/phucamtv
python3 -c "
from pathlib import Path
from scripts.yt.validate_content import violations
import subprocess
files = subprocess.check_output(['git','diff','--name-only']).decode().splitlines()
for f in files:
    if f.startswith('content/'):
        v = violations(Path(f).read_text())
        if v: print(f); [print('  ', x) for x in v[:3]]
"
```
Expected: no output (no violations).

- [ ] **Step 4: Commit the first batch**

If everything looks good:
```bash
git add content/
git commit -m "content(baigiang): convert 5 video-only articles to full articles"
```

If issues found: `git checkout -- content/`, iterate on the prompt (Task 4), recommit the prompt, and retry Task 9.

---

### Task 10: Process remaining articles in batches of 20

**Files:** (no code changes)

- [ ] **Step 1: Process next 20**

Run: `cd /Users/htruong/code/phucamtv && ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY python3 -m scripts.yt.run_batch --limit 20`
Expected: `processed=20 ...`.

- [ ] **Step 2: Skim a random sample of 3**

Run: `git diff --name-only | grep content/ | shuf -n 3` and read each file. Check the prose is coherent, has section headers, follows content rules.

- [ ] **Step 3: Commit the batch**

```bash
git add content/
git commit -m "content(baigiang): convert next 20 video-only articles to full articles"
```

- [ ] **Step 4: Repeat until TODO drained**

Re-run Steps 1–3 of this task until `python3 -m scripts.yt.run_batch` reports `processed=0 skipped_already=N` (all entries with transcripts are done).

- [ ] **Step 5: Update `TODO.md` to check off completed items**

Run:
```bash
cd /Users/htruong/code/phucamtv
python3 -c "
from pathlib import Path
import frontmatter
from scripts.yt.todo_parse import parse_todo, TODO_LINE_RE

todo = Path('TODO.md')
lines = todo.read_text().splitlines()
entries_by_rel = {}
for e in parse_todo(todo, Path('content')):
    rel = str(e.article_path.relative_to(Path('content').resolve()))
    entries_by_rel[rel] = e
new_lines = []
for line in lines:
    m = TODO_LINE_RE.match(line)
    if m:
        rel = m.group('rel')
        art = Path('content') / rel
        if art.exists():
            post = frontmatter.loads(art.read_text())
            if '##' in post.content:
                line = line.replace('- [ ]', '- [x]', 1)
    new_lines.append(line)
todo.write_text('\n'.join(new_lines) + '\n')
"
git add TODO.md
git commit -m "chore(todo): check off converted video-only articles"
```

---

## Self-Review

**Spec coverage:**
- TODO.md parsing → Task 1 ✓
- yt-dlp transcript fetch → Tasks 2–3 (reuses `scripts/yt/transcript.py` + `process-one.py`) ✓
- Transcript → article rewrite → Tasks 4–5 ✓
- Apply to content file matching example format → Task 6 ✓
- Content-rule enforcement → Tasks 4 (prompt) + 8 (validator) ✓
- Processing all 104 → Tasks 9–10 ✓

**Placeholder scan:** No TBDs. Every code step ships complete code. Every command has expected output.

**Type/name consistency:** `TodoEntry` is the single record type (Task 1), consumed unchanged by Tasks 2 and 7. `Rewrite` from Task 5 is consumed by Task 7. `apply(article_path, description=, body_markdown=, extra_tags=)` signature matches across Tasks 6 and 7. `TRANSCRIPTS_DIR` path is consistent across all scripts. `TASK_TODO_DIR` / `DONE_DIR` / `FAILED_DIR` match the names already used in the existing `scripts/yt/process-one.py`.

**Known risks flagged in the plan:**
- Some videos will lack captions → `process-one.py` routes to `failed/` → surfaced in Task 3 Step 3.
- AI may violate content rules → validator in Task 8 catches and skips.
- Re-run safety → `run_batch.py` skips articles that already contain `##` headings.
