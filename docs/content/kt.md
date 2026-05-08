# Kinh Thánh — `content/kt/`

The Bible: one Markdown file per book, plus a section index. Rendered with the `kt` / `kt-book` layouts.

## Layout

- Path: `content/kt/<file>.md`
- Old Testament: `cu01.md` … `cu39.md` (Cựu Ước)
- New Testament: `nt01.md` … `nt27.md` (Tân Ước)
- Section root: `content/kt/_index.md` — uses `layout: kt`, declares site-wide section metadata (title, verse, etc.).

## Book front matter

- `title` — Vietnamese book name (e.g. `"Ma-thi-ơ"`)
- `titleEn` — English book name (e.g. `"Matthew"`)
- `slug` — file basename without extension (e.g. `"nt01"`)
- `layout: kt-book`
- `testament` — `old` or `new`
- `group` — Vietnamese group label (e.g. `"Các Sách Tin Lành"`)
- `groupEn` — English group label (e.g. `"Gospels"`)
- `weight` — integer for ordering across books
- `description` — one-line description used in listings

Optional `audio` array. Each entry:

- `type` — e.g. `youtube-video`
- `id` — provider ID
- `lang` — language code (`vi`)
- `translation` — translation code (e.g. `VN1925`)
- `voiceGender` — `male` / `female`
- `scope` — `book` (one recording covers the whole book) or other granularity

## Body

Free-form Markdown commentary: typically `## Tổng Quan` (overview), `## Bố Cục` (outline), and other thematic sections. The body is editorial framing, **not** the verse text itself.
