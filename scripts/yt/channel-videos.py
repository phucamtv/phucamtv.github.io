#!/usr/bin/env python3
"""Fetch all videos from a YouTube channel using yt-dlp. Streams NDJSON to stdout."""

import subprocess
import sys


def fetch_channel_videos(channel_id):
    if channel_id.startswith("@"):
        url = f"https://www.youtube.com/{channel_id}/videos"
    elif channel_id.startswith("UC"):
        url = f"https://www.youtube.com/channel/{channel_id}/videos"
    else:
        url = f"https://www.youtube.com/@{channel_id}/videos"
    cmd = [
        "yt-dlp",
        "--flat-playlist",
        "--dump-json",
        "--quiet",
        url,
    ]
    with subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True) as proc:
        for line in proc.stdout:
            print(line, end="")
            sys.stdout.flush()

        proc.wait()
        if proc.returncode != 0:
            print(f"yt-dlp exited with code {proc.returncode}", file=sys.stderr)
            sys.exit(proc.returncode)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} CHANNEL_ID", file=sys.stderr)
        sys.exit(1)

    fetch_channel_videos(sys.argv[1])
