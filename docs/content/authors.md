# Authors — `content/authors/`

One Markdown file per author profile. The filename (without `.md`) is the canonical author slug used everywhere else in the repo.

## Layout

- Path: `content/authors/<slug>.md`
- Section root `_index.md` is a near-empty stub (`title: "Tác giả"`).

## Front matter

Profile is **front-matter only** — the body is empty.

- `title` — display name with honorific (e.g. `"Mục Sư Dương Quang Thoại"`, `"Tiến sĩ …"`); this is what shows up in author listings
- `slug` — must match the filename
- `country` — country of residence
- `phone` — contact phone (optional)
- `address` — postal address (optional)
- `avatar` — filename of the avatar image in the avatar assets directory (e.g. `"thoai-duong.webp"`)
- `facebook` — Facebook username/handle (optional)
- `youtube` — YouTube handle including `@` (optional)

Other social/contact fields can be added per author as needed; keep keys consistent with existing files.

## Adding a new author

When an article, series, or book references an `authors: [<slug>]` value, the corresponding `content/authors/<slug>.md` file **must** already exist. Create the profile first, then reference it.
