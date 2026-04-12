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
