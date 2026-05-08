# Tín Lý — `content/doctrines/`

Statements of Cơ-đốc doctrine. Stored under `content/doctrines/` but **served at `/tin-ly/`** — the `_index.md` overrides the URL.

## Layout

- Path: `content/doctrines/<slug>.md`
- Section root `_index.md` sets:
  - `title: "Tín Lý Cơ-đốc"`
  - `url: /tin-ly/` — every doctrine inherits this base path
  - body opens with the Great Commission quote (Ma-thi-ơ 28:19,20)

## Front matter

- `slug` — doctrine slug (matches filename)
- `title` — Vietnamese doctrine title
- `weight` — integer for ordering across doctrines

## Body structure

Each doctrine follows a consistent shape:

1. `## Câu gốc` — a foundational Bible quote with reference in parentheses
2. One or more paragraphs of doctrinal exposition
3. A closing emphasis line in **bold** summarizing the doctrine

Apply terminology and divine-name capitalization rules strictly — these are creedal texts.
