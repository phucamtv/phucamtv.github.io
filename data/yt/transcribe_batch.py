#!/usr/bin/env python3
"""Batch: download (f18) -> 16k mono wav -> mlx-whisper (vi) -> transcripts/<id>.txt"""
import subprocess, os, sys, time
import mlx_whisper

ROOT = "/Users/htruong/code/phucamtv/data/yt"
WORK = os.path.join(ROOT, "work")
TRANS = os.path.join(ROOT, "transcripts")
YTDLP = "/tmp/whisper-venv/bin/yt-dlp"
MODEL = "mlx-community/whisper-large-v3-turbo"

os.makedirs(WORK, exist_ok=True)
os.makedirs(TRANS, exist_ok=True)

rows = [l for l in open(os.path.join(ROOT, "manifest.tsv")).read().strip().split("\n") if l]
total = len(rows)
print(f"[start] {total} videos", flush=True)

for i, line in enumerate(rows, 1):
    parts = line.split("\\t")
    vid, dur, date, channel, title = (parts + [""] * 5)[:5]
    out = os.path.join(TRANS, f"{vid}.txt")
    if os.path.exists(out) and os.path.getsize(out) > 200:
        print(f"[{i}/{total}] skip {vid} (exists)", flush=True)
        continue
    url = f"https://www.youtube.com/watch?v={vid}"
    mp4 = os.path.join(WORK, f"{vid}.mp4")
    wav = os.path.join(WORK, f"{vid}.wav")
    t0 = time.time()
    try:
        # download (one retry)
        for attempt in (1, 2):
            r = subprocess.run([YTDLP, "-q", "--no-warnings", "-f", "18",
                                "--force-overwrites", "-o", mp4, url])
            if r.returncode == 0 and os.path.exists(mp4):
                break
            print(f"[{i}/{total}] {vid} download retry {attempt}", flush=True)
            time.sleep(5)
        else:
            print(f"[{i}/{total}] FAIL download {vid}", flush=True)
            continue
        subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
                        "-i", mp4, "-ar", "16000", "-ac", "1", wav], check=True)
        res = mlx_whisper.transcribe(wav, path_or_hf_repo=MODEL, language="vi")
        header = (f"# {title}\n# video_id: {vid}\n# upload_date: {date}\n"
                  f"# channel: {channel}\n# duration_s: {dur}\n\n")
        with open(out, "w") as f:
            f.write(header + res["text"].strip() + "\n")
        print(f"[{i}/{total}] DONE {vid} ({time.time()-t0:.0f}s, {len(res['text'])} chars)", flush=True)
    except Exception as e:
        print(f"[{i}/{total}] ERROR {vid}: {e}", flush=True)
    finally:
        for f in (mp4, wav):
            if os.path.exists(f):
                os.remove(f)

print("[done] all videos processed", flush=True)
