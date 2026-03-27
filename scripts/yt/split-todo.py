#!/usr/bin/env python3
"""Split TODO.jsonl into individual .claude/tasks/todo/<videoID>.json files."""

import json
import sys
from pathlib import Path

TODO_FILE = Path("TODO.jsonl")
OUT_DIR = Path(".claude/tasks/todo")

OUT_DIR.mkdir(parents=True, exist_ok=True)

count = 0
with open(TODO_FILE) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)
        out = OUT_DIR / f"{item['id']}.json"
        out.write_text(json.dumps(item, ensure_ascii=False, indent=2))
        count += 1

print(f"Written {count} files to {OUT_DIR}/", file=sys.stderr)
