# Tủ Sách — `content/sach/`

Book library: long-form works (e.g. EGW classics) translated into Vietnamese, served chapter-by-chapter.

## Layout

- Path: `content/sach/<author-slug>/<book-slug>/`
- Each book directory contains:
  - `_index.md` — book frontispiece (cover, table of contents, intro)
  - `chuong-01.md`, `chuong-02.md`, … — one file per chapter, zero-padded
- The section root `content/sach/_index.md` is the library landing page.

## Book `_index.md` front matter

- `title` — Vietnamese title
- `slug` — book slug (matches the directory name)
- `author` — author slug (matches `<author-slug>` directory; note: this is the book-author slug, which may differ from the `content/authors/` profile slug for older works like `ellen-g-white`)
- `book` — book slug, repeated
- `layout: "frontispiece"`
- `subtitle` — original-language title (e.g. "The Great Controversy")
- `cascade: { layout: "chapter" }` — makes every child file render with the chapter layout
- `summary` — short blurb for listings

## Chapter front matter

- `title` — e.g. `"Chương 1: Sự Hủy Diệt Thành Giê-ru-sa-lem"`
- `slug` — `"chuong-01"`
- `author` — same author slug as the book
- `book` — book slug
- `chapter` — integer chapter number
- `weight` — integer used for ordering (typically equals `chapter`)
- `date` — optional ISO date (publication or translation date)
- `summary` — optional; safe to leave as `""`

The chapter body opens with a `##` heading repeating the chapter title in the project's "Chương N—Title" style, then the translated text.
