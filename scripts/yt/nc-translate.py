#!/usr/bin/env python3
"""Batch translate-and-rewrite for the nghien-cuu/khai-huyen-stefanovic series.

For each bai-NN.md:
  1. Look up videoId in data/yt/nghien-cuu/khai-huyen-stefanovic.json
  2. Fetch English transcript via scripts/yt/transcript.py (cached)
  3. Call `claude --print` with prompts/translate-rewrite.md to produce
     {description, tags, body_markdown}
  4. Write body_markdown into bai-NN.md, preserving frontmatter byte-for-byte
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).parent
DEFAULT_SERIES_SLUG = "khai-huyen-stefanovic"
DEFAULT_AUTHOR = "Ranko Stefanovic"
TRANSCRIPTS_DIR = ROOT / ".claude" / "data" / "transcripts"
PROMPT_FILE = SCRIPT_DIR / "prompts" / "translate-rewrite.md"

# Make `from scripts.yt.validate_content import violations` resolvable.
sys.path.insert(0, str(ROOT))
from scripts.yt.validate_content import violations  # noqa: E402


FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)


def parse_frontmatter(text: str) -> tuple[str, dict, str]:
    """Return (raw_frontmatter_block_with_fences, parsed_dict, body)."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise ValueError("No YAML frontmatter found")
    raw_block = m.group(0)  # includes opening/closing ---
    body = text[m.end():]
    # Tiny YAML parser — only handles `key: "value"` / `key: value` lines.
    fm: dict = {}
    for line in m.group(1).splitlines():
        line = line.rstrip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip()
        if v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        fm[k.strip()] = v
    return raw_block, fm, body


def fetch_transcript(video_id: str) -> str | None:
    """Return cached or freshly fetched English transcript text. None on failure."""
    cache = TRANSCRIPTS_DIR / f"{video_id}.txt"
    if cache.exists() and cache.stat().st_size > 0:
        return cache.read_text(encoding="utf-8")

    TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  fetching transcript {video_id}…", file=sys.stderr)
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        cmd = [
            "yt-dlp",
            "--skip-download",
            "--write-auto-subs",
            "--sub-langs", "en",
            "--sub-format", "json3",
            "--extractor-args", "youtube:player_client=android_vr",
            "--output", f"{tmpdir}/%(id)s",
            "--quiet",
            url,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        files = list(Path(tmpdir).glob("*.json3"))
        if not files:
            err = (result.stderr or "").strip()[:300]
            print(f"  no transcript for {video_id}: {err}", file=sys.stderr)
            return None

        try:
            data = json.loads(files[0].read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"  bad json3 for {video_id}: {e}", file=sys.stderr)
            return None

    lines: list[str] = []
    for event in data.get("events", []):
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text or text == "\n":
            continue
        lines.append(text)

    if not lines:
        return None

    text = "\n".join(lines)
    cache.write_text(text, encoding="utf-8")
    return text


def render_prompt(template: str, *, title: str, author: str, transcript: str) -> str:
    return (
        template.replace("<TITLE>", title)
        .replace("<AUTHOR>", author)
        .replace("<TRANSCRIPT>", transcript)
    )


def call_claude(prompt: str) -> str:
    """Run `claude --print` with the prompt on stdin; return stdout."""
    result = subprocess.run(
        ["claude", "--print"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=900,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"claude exited {result.returncode}: {result.stderr.strip()[:400]}"
        )
    return result.stdout


def parse_claude_json(out: str) -> dict:
    """Parse the JSON object from claude's output, tolerating code fences."""
    s = out.strip()
    # Strip ```json fences if present.
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*\n", "", s)
        s = re.sub(r"\n```\s*$", "", s)
    # Find the first `{` and last `}` to be safe.
    first = s.find("{")
    last = s.rfind("}")
    if first == -1 or last == -1 or last <= first:
        raise ValueError(f"No JSON object in claude output: {s[:200]}")
    # strict=False allows literal control chars (e.g. unescaped \n) inside strings.
    return json.loads(s[first : last + 1], strict=False)


def process_episode(idx: int, video: dict, *, content_dir: Path, author: str, force: bool, dry_run: bool) -> str:
    bai_file = content_dir / f"bai-{idx:02d}.md"
    if not bai_file.exists():
        return "missing-file"

    raw_text = bai_file.read_text(encoding="utf-8")
    raw_block, fm, body = parse_frontmatter(raw_text)

    if body.strip() and not force:
        return "skipped-has-body"

    transcript = fetch_transcript(video["videoId"])
    if not transcript:
        return "failed-fetch"

    title = fm.get("title", "")
    template = PROMPT_FILE.read_text(encoding="utf-8")
    prompt = render_prompt(template, title=title, author=author, transcript=transcript)

    print(f"  invoking claude (transcript {len(transcript)} chars)…", file=sys.stderr)
    try:
        out = call_claude(prompt)
        data = parse_claude_json(out)
    except (RuntimeError, ValueError, json.JSONDecodeError) as e:
        print(f"  rewrite error: {e}", file=sys.stderr)
        return "failed-rewrite"

    body_md = (data.get("body_markdown") or "").strip()
    if not body_md:
        return "failed-empty-body"

    vio = violations(body_md)
    if vio:
        for v in vio[:5]:
            print(f"  violation: {v}", file=sys.stderr)
        return "failed-validate"

    if dry_run:
        print("---- DRY RUN OUTPUT ----")
        print(json.dumps(data, ensure_ascii=False, indent=2))
        print("------------------------")
        return "dry-run-ok"

    new_text = raw_block.rstrip() + "\n\n" + body_md.rstrip() + "\n"
    bai_file.write_text(new_text, encoding="utf-8")
    return "ok"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--series", default=DEFAULT_SERIES_SLUG, help="series slug under content/nghien-cuu/")
    p.add_argument("--author", default=DEFAULT_AUTHOR, help="author display name passed to the prompt")
    p.add_argument("--only", help="comma-separated indices, e.g. 1,5,12")
    p.add_argument("--force", action="store_true", help="overwrite existing bodies")
    p.add_argument("--dry-run", action="store_true", help="don't write files")
    args = p.parse_args()

    playlist_json = ROOT / "data" / "yt" / "nghien-cuu" / f"{args.series}.json"
    content_dir = ROOT / "content" / "nghien-cuu" / args.series

    data = json.loads(playlist_json.read_text(encoding="utf-8"))
    videos = data["videos"]

    if args.only:
        wanted = {int(x) for x in args.only.split(",") if x.strip()}
    else:
        wanted = {v["index"] for v in videos}

    summary: dict[str, list[int]] = {}
    for v in videos:
        idx = v["index"]
        if idx not in wanted:
            continue
        print(f"[{idx:02d}] {v['title']}", file=sys.stderr)
        status = process_episode(
            idx, v,
            content_dir=content_dir,
            author=args.author,
            force=args.force,
            dry_run=args.dry_run,
        )
        print(f"  → {status}", file=sys.stderr)
        summary.setdefault(status, []).append(idx)

    print("\n=== summary ===", file=sys.stderr)
    for status, idxs in sorted(summary.items()):
        print(f"  {status}: {len(idxs)}  {idxs}", file=sys.stderr)

    failed = sum(
        len(v) for k, v in summary.items() if k.startswith("failed") or k == "missing-file"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
