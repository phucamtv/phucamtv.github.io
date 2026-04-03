---
name: sabat-school
description: Use when creating or managing Sabbath School lesson content for phucam.tv, including content structure, front matter format, and file organization under content/truong-sabat/.
---

# Sabbath School Content Structure

Reference for phucam.tv Sabbath School lesson content structure.

## Page Bundle

Each lesson is a Hugo page bundle under `content/truong-sabat/{year}/q{quarter}/bai-{n}/`:

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

## Quarter/Year `_index.md`

```yaml
# Quarter
---
title: "Quý {n}, {year} – Quarter Theme Title"
---

# Year
---
title: "{year}"
---
```

## Content Guidelines

See CLAUDE.md for Vietnamese content guidelines (Đức Chúa Giê-su, Sa-bát, Cơ-đốc, etc.).

Thứ Sáu file should always contain "NGHIÊN CỨU BỔ TÚC" (Further Study) with discussion questions.
