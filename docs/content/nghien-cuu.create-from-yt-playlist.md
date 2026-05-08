# Creating a new `/nghien-cuu` series from a YouTube playlist

End-to-end workflow validated against existing series (`khai-huyen-stefanovic`, `khi-gioi-tron-ven`). For schema details on series and episode front matter, see [`nghien-cuu.md`](./nghien-cuu.md).

## Hard requirement

**Every episode must ship with a full Vietnamese article body translated/rewritten from the video transcript.** Stub-only episodes (frontmatter with empty body) are not acceptable as a final state — they exist only as a transient scaffold between steps 6 and 7. The series is not done until step 7 has produced a non-empty body for every `bai-NN.md`, step 8 has built clean, and at least one article has been spot-read for editorial quality.

## 1. Inspect the playlist

```bash
yt-dlp --flat-playlist --dump-single-json "https://www.youtube.com/playlist?list=<ID>"
```

Surface title, channel, video count, IDs. Note any `[Private video]` or unavailable entries — they cannot be transcribed.

## 2. Decisions to confirm with the user (don't guess)

- **Slug** — kebab-case, will become the URL segment under `/nghien-cuu/`
- **Private/unlisted handling** — skip them or stub with a placeholder body
- **Author model** — single-author follows the existing pattern; multi-speaker conference: series-level `author:` = org/event name, per-episode `speaker:`

## 3. Verify English transcripts exist

```bash
yt-dlp --skip-download --list-subs "https://www.youtube.com/watch?v=<ID>"
```

Look for an `en` row with formats listed. Manual EN captions yield much cleaner translations than auto-generated.

## 4. Write the playlist data file

`data/yt/nghien-cuu/<slug>.json` — top-level: `playlistId`, `title`, `channel`, `totalVideos`, `videos`. Per video: `index`, `videoId`, `title`, `duration`, `description`, `thumbnail`. For multi-speaker, also `speaker`. Order videos chronologically by talk number — yt-dlp may return them in reverse playlist order.

## 5. Write the series page

`content/nghien-cuu/<slug>/_index.md` — frontmatter per the schema in [`nghien-cuu.md`](./nghien-cuu.md) (`layout: nc-series`, `seriesSlug`, `dataKey`, `playlistId`, `author`, `description`). Body: Vietnamese intro covering what the series is, methodology, and a "Về tác giả" (or "Về [diễn giả/sự kiện]") section. Apply CLAUDE.md terminology.

## 6. Write episode stubs (frontmatter only)

`content/nghien-cuu/<slug>/bai-NN.md` for each episode. Frontmatter must include `title`, `shortTitle`, `layout: nc-episode`, `seriesSlug`, `dataKey`, `index`, `weight`, plus `speaker:` for multi-speaker series. **Title must be Vietnamese and set before translation** — `nc-translate.py` preserves frontmatter byte-for-byte and feeds the title to the prompt as `<TITLE>`.

## 7. Run the translation pipeline (REQUIRED — produces the full article body for every episode)

This step is not optional. It generates the full Vietnamese article that each `bai-NN.md` ships with. Do not consider the series complete until this step has succeeded for every episode.

```bash
python3 scripts/yt/nc-translate.py --series <slug> --author "<Speaker Name>" [--only 1,3]
```

The script: fetches the EN transcript via yt-dlp (caches at `.claude/data/transcripts/<videoId>.txt`) → calls `claude --print` with `scripts/yt/prompts/translate-rewrite.md` → validates against `scripts/yt/validate_content.py` → writes the body, preserving frontmatter.

### 7a. Parallelize for speed

A single-speaker 19-episode series takes ~60–90 min serially. Split into 3–4 disjoint `--only` groups and run each as a background process. Even though `--author` is identical for single-speaker series, the parallelization still cuts wallclock 3–4×.

```bash
# Single-speaker, 4 parallel groups (example: 19 episodes)
python3 scripts/yt/nc-translate.py --series <slug> --author "<Name>" --only 1,5,9,13,17 > /tmp/nc-a.log 2>&1 &
python3 scripts/yt/nc-translate.py --series <slug> --author "<Name>" --only 2,6,10,14,18 > /tmp/nc-b.log 2>&1 &
python3 scripts/yt/nc-translate.py --series <slug> --author "<Name>" --only 3,7,11,15,19 > /tmp/nc-c.log 2>&1 &
python3 scripts/yt/nc-translate.py --series <slug> --author "<Name>" --only 4,8,12,16    > /tmp/nc-d.log 2>&1 &
```

For **multi-speaker** series, group episodes by speaker so `--author` matches the actual speaker per group:

```bash
python3 scripts/yt/nc-translate.py --series <slug> --author "Speaker A" --only 1,3 > /tmp/nc-a.log 2>&1 &
python3 scripts/yt/nc-translate.py --series <slug> --author "Speaker B" --only 2,5,7 > /tmp/nc-b.log 2>&1 &
```

Wallclock for 9 episodes across 4 parallel groups: ~10–15 min vs. ~1 hour serial.

For **unidentified speakers**, peek the first ~50 transcript segments via `yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format json3` and parse the JSON — voice and cadence usually identify the speaker against another known episode.

### 7b. Confirm every episode has a body

Before declaring step 7 done, sanity-check that no `bai-NN.md` is still a stub:

```bash
# Should print nothing — any output means an episode is still empty
for f in content/nghien-cuu/<slug>/bai-*.md; do
  body=$(awk '/^---$/{c++; next} c==2' "$f" | tr -d '[:space:]')
  [ -z "$body" ] && echo "EMPTY: $f"
done
```

If any episode failed (`failed-fetch`, `failed-rewrite`, `failed-validate`, `failed-empty-body` in the run summary), re-run that index with `--only` and `--force` after fixing the underlying cause (transcript fetch, validation violation, etc.). Don't move on with empty bodies.

### 7c. Whisper fallback when YouTube has no usable English captions

Some videos have no clean English auto-captions — typically because YouTube mis-detects the original language. Symptoms during step 7:

- `nc-translate.py` reports `failed-fetch` for the same index across multiple retries
- Direct `yt-dlp --write-auto-subs --sub-langs en` returns HTTP 429 on the timedtext URL even after rate-limit windows clear
- `youtube-transcript-api` reports the only available track is a non-English language (e.g. `ro` "auto-generated"), and the `en` track yt-dlp lists is actually a server-side translation of that broken track — heavily corrupted (mixed phonetic noise + English fragments)

In that case, transcribe the audio locally with `whisper-cpp`:

```bash
# 1. Download audio (one-off; ~50 MB for an hour-long lecture)
/opt/homebrew/bin/yt-dlp -f "bestaudio[ext=m4a]/bestaudio" -o "/tmp/yt8/audio.%(ext)s" "https://www.youtube.com/watch?v=<videoId>"

# 2. Convert to 16 kHz mono WAV (whisper-cli requirement)
ffmpeg -y -loglevel error -i /tmp/yt8/audio.m4a -ar 16000 -ac 1 -c:a pcm_s16le /tmp/yt8/audio.wav

# 3. Get a model (one-time, ~470 MB; cache anywhere stable)
mkdir -p /tmp/yt8/whisper && \
  curl -sSL -o /tmp/yt8/whisper/ggml-small.en.bin \
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin"

# 4. Transcribe — `small.en` runs in ~3–5 min on Apple Silicon for a 1 h lecture
whisper-cli -m /tmp/yt8/whisper/ggml-small.en.bin -f /tmp/yt8/audio.wav \
  -otxt -of /tmp/yt8/transcript -t 8 -nt --no-prints

# 5. Drop the transcript into nc-translate.py's cache so it skips the failing fetch
cp /tmp/yt8/transcript.txt .claude/data/transcripts/<videoId>.txt

# 6. Re-run translation for that index with --force
python3 scripts/yt/nc-translate.py --series <slug> --author "<Speaker>" --only <N> --force
```

Prereqs (`brew install whisper-cpp ffmpeg`). `small.en` is the right speed/quality default for English sermon audio; bump to `medium.en` only if `small.en` produces obvious garbling on a quick spot-read of the cached `.txt`.

This bypasses YouTube's caption layer entirely, so the Romanian-mis-tag / 429 issues don't apply. Quality is good enough that `nc-translate.py` validates without manual fixups.

## 8. Verify

```bash
hugo --quiet --renderToMemory
```

Build is the smoke test — malformed frontmatter or missing dataKey fails fast. Spot-read **at least one article per speaker** (not just one per series) for editorial quality and terminology compliance before committing. The translation prompt enforces project terminology, but auto-generated transcripts in particular leak garbled biblical names and SDA-specific jargon that pass validation but read poorly. Editorial review is a hard gate, not a nice-to-have.

## Gotchas

- `nc-translate.py` skips episodes whose body is non-empty unless `--force` is passed
- Episode titles in frontmatter are author-supplied, not generated — pre-pick Vietnamese titles before step 7
- The prompt enforces project terminology, but spot-check anyway: divine-name capitalization, `Đức Chúa Giê-su`, `Cơ-đốc`, `Sa-bát`, `Hội Thánh`
- Don't run `nc-translate.py` against a series whose JSON is missing — it errors on `data/yt/nghien-cuu/<slug>.json` not found
