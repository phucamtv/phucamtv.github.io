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
