# Trường Sa-bát — `content/truong-sabat/`

Bài Học Trường Sa-bát (Sabbath School lessons), organized by year and quarter.

## Layout

- Path: `content/truong-sabat/<year>/<quarter>/<lesson>/`
  - `<year>` — e.g. `2026`
  - `<quarter>` — `q1` … `q4`
  - `<lesson>` — e.g. `bai-1`

## Front page (`/truong-sabat/`)

The list page renders the active (latest) quarter in full — heading + all lesson cards — followed by a "Các bài học trước" section that lists every other quarter as a single link to its quarter index page (e.g. `/truong-sabat/2026/q1/`). Active = highest year, then highest `weight` within that year, computed from quarter front matter.

## Authoring

Sabbath School content has its own format, source-attribution rules, and fetch pipeline. **Do not author these files freehand.** Use the dedicated skills:

- `sabat-school` — structure, front matter, file organization
- `fetch-sabat-school-lesson` — fetching and populating from Adventech sources

Defer to those skills for any creation, editing, or restructuring of files under `content/truong-sabat/`.
