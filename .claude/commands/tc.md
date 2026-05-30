---
description: Add a new Thánh Ca (hymn) to /tc/ from a YouTube URL
argument-hint: <youtube-url>
allowed-tools: Bash(curl:*), Write, Read
---

Add a new hymn to the **Thánh Ca** section (`content/tc/`) from this YouTube URL:

$ARGUMENTS

Follow these steps exactly:

1. **Extract the video ID** from the URL (the `v=` query param, or the path
   segment for `youtu.be/<id>` links).

2. **Fetch the title** via YouTube oEmbed (do not download the video):
   ```
   curl -s "https://www.youtube.com/oembed?url=<FULL_URL>&format=json"
   ```
   Read the `title` field.

3. **Parse the metadata** from the raw YouTube title:
   - `title` — the clean Vietnamese hymn name in Title Case. Strip trailing
     noise like `- Thánh Ca Cơ Đốc số N`, `(karaoke ...)`, `| ...`, performer
     credits, etc. Apply project terminology (e.g. "Cơ-đốc", correct divine-name
     capitalization).
   - `hymnNumber` — the hymnal number `N` if present (e.g. "số 188" → 188).
   - `performer` — the singer/artist if clearly credited; omit otherwise.
   - `titleEn` — the English hymn title ONLY if you are confident of the
     standard mapping (e.g. "Lên Chốn Cao Hơn" → "Higher Ground"); omit if unsure.

4. **Choose the slug** — kebab-case of the Vietnamese title with diacritics
   removed (e.g. "Lên Chốn Cao Hơn" → `len-chon-cao-hon`).

5. **Write** `content/tc/<slug>.md` with this front matter (omit any field you
   don't have; set `weight` to `hymnNumber`, or omit both if no number):
   ```yaml
   ---
   title: "<Vietnamese hymn name>"
   titleEn: "<English title>"
   youtube: "<video id>"
   performer: "<performer>"
   hymnNumber: <N>
   weight: <N>
   ---
   ```

6. If a file for this hymn already exists, report it instead of overwriting.

7. Report the created file path and the parsed title/number back to me — concise.
