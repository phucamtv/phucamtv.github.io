# Creating a new `/nghien-cuu` series from a YouTube playlist

End-to-end workflow validated against existing series (`khai-huyen-stefanovic`, `khi-gioi-tron-ven`). For schema details on series and episode front matter, see [`nghien-cuu.md`](./nghien-cuu.md).

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

## 7. Run the translation pipeline

```bash
python3 scripts/yt/nc-translate.py --series <slug> --author "<Speaker Name>" [--only 1,3]
```

The script: fetches the EN transcript via yt-dlp (caches at `.claude/data/transcripts/<videoId>.txt`) → calls `claude --print` with `scripts/yt/prompts/translate-rewrite.md` → validates against `scripts/yt/validate_content.py` → writes the body, preserving frontmatter.

**Multi-speaker series**: `--author` is per-invocation. Group episodes by speaker and run each group as a background process in parallel:

```bash
python3 scripts/yt/nc-translate.py --series <slug> --author "Speaker A" --only 1,3 > /tmp/nc-a.log 2>&1 &
python3 scripts/yt/nc-translate.py --series <slug> --author "Speaker B" --only 2,5,7 > /tmp/nc-b.log 2>&1 &
```

Wallclock for 9 episodes across 4 parallel groups: ~10–15 min vs. ~1 hour serial.

For **unidentified speakers**, peek the first ~50 transcript segments via `yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format json3` and parse the JSON — voice and cadence usually identify the speaker against another known episode.

## 8. Verify

```bash
hugo --quiet --renderToMemory
```

Build is the smoke test — malformed frontmatter or missing dataKey fails fast. Spot-read at least one article for editorial quality and terminology compliance before committing.

## Gotchas

- `nc-translate.py` skips episodes whose body is non-empty unless `--force` is passed
- Episode titles in frontmatter are author-supplied, not generated — pre-pick Vietnamese titles before step 7
- The prompt enforces project terminology, but spot-check anyway: divine-name capitalization, `Đức Chúa Giê-su`, `Cơ-đốc`, `Sa-bát`, `Hội Thánh`
- Don't run `nc-translate.py` against a series whose JSON is missing — it errors on `data/yt/nghien-cuu/<slug>.json` not found
