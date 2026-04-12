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
