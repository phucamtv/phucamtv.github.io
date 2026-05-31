---
description: Import a full Sabbath School quarter from Adventech into content/truong-sabat/
argument-hint: <year> <quarter> | <adventech-url>
allowed-tools: Bash(curl:*), Bash(python3:*), Bash(grep:*), Bash(find:*), Bash(ls:*), Bash(hugo:*), Bash(rm:*), Bash(mkdir:*), Read, Write, Edit
---

Import a Sabbath School quarter from Adventech into `content/truong-sabat/<year>/q<n>/` using the persisted import script at `scripts/import_sabat.py`.

Input: `$ARGUMENTS`

Accept either `YEAR Q` (e.g. `2025 3`) or an Adventech URL (e.g. `https://sabbath-school.adventech.io/vi/2025-03`). Extract `YEAR` and `Q` from whichever form is given.

## Workflow

1. **Fetch quarter metadata** to learn the title, date range, and all 13 lesson titles:
   ```
   curl -s "https://sabbath-school.adventech.io/api/v2/vi/quarterlies/<YEAR>-<QQ>/index.json"
   ```
   (where `<QQ>` is the zero-padded quarter.) Print quarter title + lesson titles.

2. **Dump all 91 day titles** by hitting every lesson's `index.json` and listing `day.title` for `day.id` in `01..07`. This is critical: Adventech often delivers Title Case with spaced proper nouns (`Đa Ni Ên`), all-caps titles (`LỄ ĐĂNG QUANG`), Unicode-broken splits (`Cuô N Sách Đươ C Đo Ng Â N`), or lowercase divine names (`đức Giê-Hô-Va`). Audit the output before writing overrides.

3. **Add lesson title overrides** to `scripts/import_sabat.py` in the `LESSON_TITLE_OVERRIDES` dict. Convert source Title Case to **Vietnamese sentence case**: only first word + proper nouns capitalized. Example: `Từ Giê-Ru-Sa-Lem Đến Ba-By-Lôn` → `Từ Giê-ru-sa-lem đến Ba-by-lôn`.

4. **If needed, add day title overrides** to `DAY_TITLE_OVERRIDES` in the same dict, keyed by `(lesson, day)` tuples. Add overrides for:
   - All-caps titles → convert to Title Case
   - Unicode-broken titles → reconstruct manually (`Tư Bu I Đâ T Đê N Ca C Vi Sao` → `Từ Bụi Đất Đến Các Vì Sao`)
   - Quote-wrapped titles → strip outer quotes
   - Anything else the auto-rules can't fix

5. **If most day titles have lowercase đ/ơ/ă/ấ at word starts** (the "đọc/đức/đến/đời" issue from systematic Title Case bugs), add the year-quarter string to `FIX_DAY_TITLE_CASE`. This activates the `smart_title_vi` helper for day titles only.

6. **Run the import:**
   ```
   python3 scripts/import_sabat.py <YEAR> <Q>
   ```
   Expected output: 13 lines like `bai-N: <title> (<dateRange>)`.

7. **Verify** with greps for residual issues:
   ```
   grep -rEn "Đa Ni Ên|Giê Su |\bChrist\b|Cơ Đốc|Y-Sơ-Ra-Ên|đức [Cc]húa|thi thiên" content/truong-sabat/<YEAR>/q<Q>/
   ```
   Should return no matches. If matches appear, extend the auto-rules in `apply_terminology()` or add manual overrides.

8. **Hugo build check:**
   ```
   hugo --quiet -d /tmp/hugotest && grep -oE 'lib-day-label">[^<]+' /tmp/hugotest/truong-sabat/<YEAR>/q<Q>/bai-1/index.html
   ```
   Should print all 7 day labels (`Sa-bát` through `Thứ Sáu`).

9. **File count sanity:** `find content/truong-sabat/<YEAR>/q<Q> -name "*.md" | wc -l` should equal **105** (13 lesson dirs × 8 files + 1 quarter `_index.md`).

10. **Report to the user**: quarter title, date range, file count, and remind them to restart `hugo server` to pick up the new bundles.

## Content rules

The script applies all rules from `docs/common-typos.md` and `CLAUDE.md` automatically — divine-name capitalization, Jesus canonical form, `Christ` → `Cơ-đốc`, proper-noun hyphenation, `Ð` → `Đ`, NFC normalization, missing-space-before-paren fix, etc.

If you discover a **new** systematic pattern not yet in the script, add it to `apply_terminology()` and update `docs/common-typos.md`.

## Do not

- Don't import the `inside-story` entry. The script only iterates the 7 day files (`01..07`); inside-story is ignored automatically.
- Don't hand-edit individual day files after import — fix the rule in the script and re-run instead, so future quarters benefit too.
- Don't import a quarter that already exists under `content/truong-sabat/<YEAR>/q<Q>/` without first confirming with the user (the script overwrites).
