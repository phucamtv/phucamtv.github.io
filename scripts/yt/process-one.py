#!/usr/bin/env python3
"""Pick one TODO task, fetch its transcript, move task to done/ or failed/."""

import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
TODO_DIR = Path(".claude/tasks/todo")
DONE_DIR = Path(".claude/tasks/done")
FAILED_DIR = Path(".claude/tasks/failed")
TRANSCRIPTS_DIR = Path(".claude/data/transcripts")


def main():
    tasks = sorted(TODO_DIR.glob("*.json"))
    if not tasks:
        print("No tasks left in todo.", file=sys.stderr)
        sys.exit(0)

    task_file = tasks[0]
    task = json.loads(task_file.read_text())
    video_id = task["id"]

    print(f"Processing: {video_id} — {task.get('title', '')}", file=sys.stderr)

    DONE_DIR.mkdir(parents=True, exist_ok=True)
    FAILED_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        [SCRIPT_DIR / "transcript.py", video_id],
        capture_output=True,
        text=True,
    )

    lines = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            segment = json.loads(line)
            lines.append(segment["text"])
        except (json.JSONDecodeError, KeyError):
            pass

    if not lines:
        print(f"Failed: no transcript for {video_id}", file=sys.stderr)
        task_file.rename(FAILED_DIR / task_file.name)
        sys.exit(0)  # expected failure — loop should continue

    transcript_file = TRANSCRIPTS_DIR / f"{video_id}.txt"
    transcript_file.write_text("\n".join(lines), encoding="utf-8")

    task_file.rename(DONE_DIR / task_file.name)
    print(f"Done: {transcript_file} ({len(lines)} segments)", file=sys.stderr)


if __name__ == "__main__":
    main()
