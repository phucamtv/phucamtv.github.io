Create or manage Sabbath School lesson content for phucam.tv.

## Content Structure

Each lesson is a Hugo page bundle under `content/sabat-school/{year}/q{quarter}/bai-{n}/`:

```
bai-{n}/
  _index.md        # Lesson metadata (layout: lesson)
  sa-bat.md        # Sa-bát (weight: 1)
  thu-nhat.md      # Thứ Nhất (weight: 2)
  thu-hai.md       # Thứ Hai (weight: 3)
  thu-ba.md        # Thứ Ba (weight: 4)
  thu-tu.md        # Thứ Tư (weight: 5)
  thu-nam.md       # Thứ Năm (weight: 6)
  thu-sau.md       # Thứ Sáu (weight: 7)
```

## Lesson `_index.md` frontmatter

```yaml
---
title: "Lesson Title"
layout: lesson
lesson: 1          # Lesson number in quarter
weight: 1          # Same as lesson number for ordering
dateRange: "28 Tháng 3 – 3 Tháng 4"
scriptures: "Scripture references separated by semicolons"
memoryVerse: '"Full verse text in Vietnamese"'
memoryVerseRef: "Book chapter:verse"
---
```

## Daily file frontmatter

```yaml
---
_build: { render: never }
title: "Day Title"
dayLabel: "Thứ Nhất"    # Sa-bát | Thứ Nhất | Thứ Hai | Thứ Ba | Thứ Tư | Thứ Năm | Thứ Sáu
weight: 2                # 1-7 matching day order
---
```

## Quarter `_index.md`

```yaml
---
title: "Quý {n}, {year} – Quarter Theme Title"
---
```

## Year `_index.md`

```yaml
---
title: "{year}"
---
```

## Content Guidelines (from CLAUDE.md)

- Use "Đức Chúa Giê-su" (not "Chúa Giê-su", "Jesus", "Giê-xu")
- God "ban phước" (has authority); humans "chúc phước" (wish blessings)
- Use "Sa-bát" (not "Sabát")
- Use "Do Thái Giáo" (not "Giu-đa-izt")
- Use "Cơ-đốc" (not "Cơ Đốc")

## Task

When the user asks to create a new lesson:
1. Ask for: quarter, lesson number, title, date range, scriptures, memory verse, and daily titles
2. Create the full page bundle with `_index.md` + 7 daily files
3. If the quarter/year directories don't exist yet, create their `_index.md` files too
4. Verify with `hugo server` that the page renders correctly

When adding content to daily files, write substantive theological/educational content appropriate for Sabbath School study. The Thứ Sáu file should always contain "NGHIÊN CỨU BỔ TÚC" (Further Study) with discussion questions.

$ARGUMENTS
