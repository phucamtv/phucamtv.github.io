#!/usr/bin/env python3
"""Fetch transcript for a YouTube video using yt-dlp. Streams NDJSON to stdout."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def fetch_transcript(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"

    with tempfile.TemporaryDirectory() as tmpdir:
        cmd = [
            "yt-dlp",
            "--skip-download",
            "--write-auto-subs",
            "--sub-langs", "vi,en",
            "--sub-format", "json3",
            "--output", os.path.join(tmpdir, "%(id)s"),
            "--quiet",
            url,
        ]
        subprocess.run(cmd, stderr=sys.stderr)

        # Find the downloaded subtitle file
        files = list(Path(tmpdir).glob("*.json3"))
        if not files:
            print("No transcript found for this video.", file=sys.stderr)
            sys.exit(1)

        # Prefer vi, fall back to whatever is available
        sub_file = next((f for f in files if ".vi." in f.name), files[0])
        print(f"Using: {sub_file.name}", file=sys.stderr)

        data = json.loads(sub_file.read_text())
        for event in data.get("events", []):
            segs = event.get("segs")
            if not segs:
                continue
            text = "".join(s.get("utf8", "") for s in segs).strip()
            if not text or text == "\n":
                continue
            segment = {
                "start": event["tStartMs"] / 1000,
                "duration": event.get("dDurMs", 0) / 1000,
                "text": text,
            }
            print(json.dumps(segment, ensure_ascii=False))
            sys.stdout.flush()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} VIDEO_ID", file=sys.stderr)
        sys.exit(1)

    fetch_transcript(sys.argv[1])
