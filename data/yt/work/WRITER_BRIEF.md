# Writer Brief — Sermon Transcript → phucam.tv Article

You are writing ONE Vietnamese article for the phucam.tv static site (Hugo) from an auto-generated sermon transcript. Your per-video assignment (transcript path, video ID, speaker, author slug, date, output path) is given in the dispatch message.

## Read first (REQUIRED, in this order)
1. `/Users/htruong/code/phucamtv/CLAUDE.md` — content guidelines (terminology + divine-name capitalization). MANDATORY.
2. `/Users/htruong/code/phucamtv/docs/content/articles.md` — article format spec.
3. `/Users/htruong/code/phucamtv/docs/content/cross-cutting-rules.md` — URL/author/language rules.
4. `/Users/htruong/code/phucamtv/content/articles/2026/05/23/baigiang--dieu-duy-nhat-chung-ta-can-biet.md` — GOLD-STANDARD example. Match its depth, structure, tone, scripture-quoting style, `##` headings, `>` blockquotes, and tables where helpful.

## Task
Write a faithful, well-organized Vietnamese article retelling what the preacher actually said. NOT a verbatim dump, NOT a thin summary — a rich, readable article like the example.

Rules:
- FAITHFULNESS: Use only ideas, scriptures, illustrations, and points actually in the transcript. Never invent content, quotes, or references. Where the transcript is unclear, render the clear meaning conservatively; do not fabricate.
- The transcript is auto-generated (Whisper) with errors. Fix obvious transcription errors and normalize per CLAUDE.md:
  - "Giê-xu"/"Chúa Giê-xu"/"Jesus" → "Đức Chúa Giê-su"
  - "Phó-lô"/"Paulo"/"Phaolô" → "Phao-lô"
  - "sưu gặm"/"sưu gẫm" → "suy gẫm"
  - Fix garbled Bible book names / verse refs to standard Vietnamese (e.g. "Cô-rinh-tô thứ nhất đoạn 2" → "1 Cô-rinh-tô 2"). Keep references internally consistent with the words being quoted.
  - Apply ALL divine-name capitalization and terminology rules from CLAUDE.md (Đức Chúa Trời, Đức Thánh Linh, Kinh Thánh, Hội Thánh, Sa-bát, Cơ-đốc, Ha-ma-ghê-đôn, Do Thái Giáo, "ban phước" for God, etc.).
- IGNORE Whisper boilerplate hallucinations not part of the sermon (e.g. "Hãy subscribe/đăng ký kênh", "Ghiền Mì Gõ", channel promos, intro/outro music garble). Do not include them.
- Scripture quotes: use `>` blockquotes with the reference in parentheses, matching the Vietnamese Bible wording the preacher uses (Truyền Thống/1926 style).
- Structure: open with a short thematic intro (NOT a repeat of the title), embed the video with `{{< youtube "VIDEO_ID" >}}` right after the intro, then develop the sermon's points under `##`/`###` headings. End with a brief closing/application section.
- Root-relative paths only; never hard-code phucam.tv URLs.
- Do NOT create or edit author profiles (they already exist). Do NOT edit any file other than the single article you create.

## Front matter (required)
```
title: "<descriptive Vietnamese title derived from the sermon topic>"
date: <YYYY-MM-DD from assignment>
url: /baigiang/<slug>/
description: "<one rich paragraph summarizing the sermon for SEO/listings>"
tags: [<array of relevant Vietnamese tags>]
authors: ["<author slug from assignment>"]
plugins: [youtube]
youtubeIDs: ["<VIDEO_ID>"]
draft: false
```
- `<slug>`: ASCII kebab-case, no diacritics, derived from the topic. The `url` slug and the filename slug MUST match.

## Output
Write to the exact path given in the assignment (create the dir if needed). The filename is `baigiang--<slug>.md`.

## Return
A short summary: file path written, final title, slug, Bible passage(s) covered, and any transcription ambiguities you resolved.
