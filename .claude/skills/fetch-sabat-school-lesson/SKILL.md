---
name: fetch-sabat-school-lesson
description: Use when fetching Sabbath School lesson content from Adventech GitHub to populate phucam.tv lesson files. Triggers on "fetch lesson", "generate lesson", or any request to pull lesson data from Adventech.
---

# Fetch Sabbath School Lesson

Fetch Vietnamese Sabbath School lesson data from Adventech GitHub and output files.

**REQUIRED:** Follow sabat-school skill for output structure, front matter, and file organization.
**REQUIRED:** Follow CLAUDE.md for Vietnamese content guidelines.

## Input

Supply: **YEAR**, **Q** (quarter 1-4), **N** (lesson number 1-13)

## Data Source — Adventech GitHub

Day files (01.md–07.md):
```
https://raw.githubusercontent.com/Adventech/sabbath-school-lessons/master/src/vi/{YEAR}-{0Q}/{0N}/{DAY}.md
```

Quarterly info:
```
https://sabbath-school.adventech.io/api/v2/vi/quarterlies/{YEAR}-{0Q}/index.json
```

- `{0Q}` = zero-padded quarter (01–04)
- `{0N}` = zero-padded lesson (01–13)
- `{DAY}` = 01 (Sa-bát) through 07 (Thứ Sáu)

**Use `curl` over WebFetch** — WebFetch summarizes Vietnamese content instead of returning verbatim text.

## Day File → Output Mapping

| Source | Output file |
|--------|-------------|
| 01.md  | sa-bat.md   |
| 02.md  | thu-nhat.md |
| 03.md  | thu-hai.md  |
| 04.md  | thu-ba.md   |
| 05.md  | thu-tu.md   |
| 06.md  | thu-nam.md  |
| 07.md  | thu-sau.md  |

## Workflow

1. Parse YEAR, Q, N from user request
2. Fetch quarterly info JSON → extract quarter title
3. Fetch all 7 day files via `curl`
4. Strip source YAML front matter, extract title and body per day
5. Write files per sabat-school skill structure
6. Create year/quarter `_index.md` if missing

## Content Rules

- **Preserve all Vietnamese text exactly** — do not translate, paraphrase, or summarize
- Strip source front matter but keep all body content
- Do not add content not in source files

## Common Mistakes

- Forgetting zero-padding on quarter/lesson numbers
- 02.md = Thứ Nhất (Sunday), NOT Monday
- Using WebFetch instead of curl
