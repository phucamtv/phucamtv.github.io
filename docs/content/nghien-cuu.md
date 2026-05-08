# Nghiên Cứu — `content/nghien-cuu/`

In-depth multi-part Bible study series (e.g. a verse-by-verse walk through Khải Huyền). Each series is a directory of episodes.

## Layout

- Path: `content/nghien-cuu/<series-slug>/`
- Each series directory contains:
  - `_index.md` — series landing page (`layout: nc-series`)
  - `bai-01.md`, `bai-02.md`, … — one file per episode (`layout: nc-episode`)
- The section root `content/nghien-cuu/_index.md` uses `layout: nc` and a `verse` front-matter field for the section banner.

## Series `_index.md` front matter

- `title` — series title
- `titleEn` — original-language title (when applicable)
- `author` — display string for the primary teacher
- `authors` — array of author slugs (matches `content/authors/`)
- `language` — original language of the source material (e.g. `English`)
- `layout: nc-series`
- `seriesSlug` — series slug, must match the directory name
- `playlistId` — optional YouTube playlist ID
- `dataKey` — key into the site `data/` files holding episode metadata (typically equal to `seriesSlug`)
- `description` — series blurb used in listings and SEO

Body: prose introducing the series — what it covers, who it is for, why it matters.

## Episode front matter

- `title` — full episode title (e.g. `"Bài 1: Chủ Đề Trung Tâm của Sách Khải Huyền"`)
- `shortTitle` — title without the `"Bài N:"` prefix, for compact listings
- `layout: nc-episode`
- `seriesSlug` — must match the series
- `dataKey` — must match the series
- `index` — integer episode number
- `weight` — integer for ordering (typically equals `index`)

Body: the lesson content. Apply site-wide terminology and capitalization rules.

For multi-speaker conference series (e.g. a Summit playlist), add `speaker:` per episode and set the series-level `author:` to the org name (e.g. `"Secrets Unsealed Summit"`). Layouts currently render `author` as a string only — `speaker:` is informational until wired into `nc-episode.html`.

## See also

- [`nghien-cuu.create-from-yt-playlist.md`](./nghien-cuu.create-from-yt-playlist.md) — end-to-end workflow for scaffolding and translating a new series from a YouTube playlist via `scripts/yt/nc-translate.py`.
