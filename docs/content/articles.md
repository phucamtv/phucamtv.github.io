# Articles — `content/articles/`

Single articles (sermons, devotionals, news, opinion pieces). Each article is a standalone page; there is no series structure here.

## Layout

- Path: `content/articles/<YYYY>/<MM>/<DD>/<slug>.md`
- Filename slug uses a kind prefix + `--` + topic, e.g. `baigiang--vi-sao-rua-chan-tro-thanh-nghi-le.md`
  - `baigiang--…` for sermons
  - other prefixes follow the same `<kind>--<topic>` pattern
- The section root `_index.md` is a redirect stub (`type: redirect`, `redirect_to: /`) — do not put article content there.

## Front matter

Required:

- `title` — display title in Vietnamese
- `date` — ISO date matching the directory (`YYYY-MM-DD`)
- `url` — clean public path, e.g. `/baigiang/<slug>/`
- `description` — one-paragraph summary used for SEO and listings
- `tags` — array of Vietnamese tag strings
- `authors` — array of author slugs that exist as files under `content/authors/`
- `draft` — `true`/`false`

Optional (per embed kind):

- `plugins: [youtube]` + `youtubeIDs: ["<id>", ...]` when the body embeds YouTube videos.

## Body

- Embeds use Hugo shortcodes. For YouTube: `{{< youtube "VAIGWZaHyoA" >}}`.
- Use `##` headings for sections. The first heading is typically a thematic intro, not a repeat of `title`.
- Apply the site-wide content guidelines (terminology, divine-name capitalization) in both front matter and body.
