# Loạt Bài — `content/series/`

Thin index entries that register a series in the site's series taxonomy. The actual series content lives elsewhere (e.g. `content/truong-sabat/`, `content/nghien-cuu/`).

## Layout

- Path: `content/series/<slug>.md`
- Section root `_index.md` is a near-empty stub (`title: "Loạt bài"`).

## Front matter

- `title` — display name of the series
- `seriesID` — stable identifier used to associate content elsewhere with this series
- `url` — the public path the series resolves to (e.g. `/series/<slug>/`)

## Body

No body — these files are pointers, not content.
