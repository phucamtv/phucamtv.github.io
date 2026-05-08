# Cross-Cutting Content Rules

Rules that apply to every content type under `content/`.

## URLs

- Never hard-code absolute `phucam.tv` URLs in content.
- Always use root-relative paths: `/baigiang/...`, `/tin-ly/...`, `/series/...`, etc.

## Author references

- `authors: [<slug>]` arrays must reference slugs that exist as files in `content/authors/`.
- Add the author profile **before** publishing content that references the new slug.

## Language and terminology

- All site content is Vietnamese.
- Apply the Content Guidelines from the project root `CLAUDE.md` to every front-matter field and every body paragraph (terminology choices, divine-name capitalization, "Sa-bát" vs "Sabát", etc.).
