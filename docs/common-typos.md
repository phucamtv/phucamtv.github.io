# Common Vietnamese Typos & Substitutions

Patterns to fix when editing or importing Vietnamese Christian content (especially Sabbath School material from Adventech). These supplement the canonical terminology list in the project root [CLAUDE.md](../CLAUDE.md).

## Divine names — capitalization

Divine names are **always** capitalized regardless of position in the sentence. The leading `Đ` (or `đ`) is often lowercased by automated Title Case tools; normalize them all back.

| Wrong | Correct |
| --- | --- |
| `đức chúa Trời`, `Đức chúa trời`, `đức Chúa Trời` | `Đức Chúa Trời` |
| `đức chúa Giê-su`, `Đức chúa Giê-su` | `Đức Chúa Giê-su` |
| `đức Thánh Linh`, `Đức thánh linh` | `Đức Thánh Linh` |
| `đức chúa`, `Đức chúa` (bare, mid-sentence) | `Đức Chúa` |
| `Kinh thánh`, `kinh thánh` | `Kinh Thánh` |
| `Hội thánh`, `hội thánh` | `Hội Thánh` |
| `Thi thiên`, `thi thiên` | `Thi Thiên` |

## Jesus — canonical form

Always use `Đức Chúa Giê-su`. Never `Chúa Giê-xu`, `Chúa Giê-su`, `Jesus`, or `Giê-xu`.

| Wrong | Correct |
| --- | --- |
| `Chúa Giê-xu`, `Chúa Giê-su` | `Đức Chúa Giê-su` |
| `Đức Chúa Giê-xu` | `Đức Chúa Giê-su` |
| `Đức Chúa Đức Chúa Giê-su` (double-prefix) | `Đức Chúa Giê-su` |
| bare `Giê-xu` | `Giê-su` |
| `Jesus` | `Đức Chúa Giê-su` |

## Christ → Cơ-đốc

The English transliteration `Christ` should be the Vietnamese `Cơ-đốc`. Note the hyphen and lowercase `đ`.

| Wrong | Correct |
| --- | --- |
| `Christ` | `Cơ-đốc` |
| `Đấng Christ` | `Đấng Cơ-đốc` |
| `Đức Chúa Giê-su Christ` | `Đức Chúa Giê-su Cơ-đốc` |
| `Cơ Đốc` (capital Đ, no hyphen) | `Cơ-đốc` |

## Proper nouns — hyphenation

Vietnamese transliterations of Hebrew/Greek proper nouns are hyphenated, with **only the first segment capitalized**. Title-case automation often breaks this:

| Wrong (spaced/Title Case) | Correct |
| --- | --- |
| `Đa Ni Ên`, `Đa-Ni-Ên` | `Đa-ni-ên` |
| `Giê Su` | `Giê-su` |
| `Ba By Lôn`, `Ba Bi Lôn`, `Ba-By-Lôn` | `Ba-by-lôn` |
| `Giê Ru Sa Lem`, `Giê-Ru-Sa-Lem` | `Giê-ru-sa-lem` |
| `Nê Bu Cát Nết Sa` | `Nê-bu-cát-nết-sa` |
| `Mi Ca Ên` | `Mi-ca-ên` |
| `Bên Xát Sa` | `Bên-xát-sa` |
| `Ma Thi Ơ` | `Ma-thi-ơ` |
| `Mê Si` | `Mê-si` |
| `Đa Ri Út` | `Đa-ri-út` |
| `Sy Ri` | `Sy-ri` |
| `Phi E Rơ` | `Phi-e-rơ` |
| `Ê Sai` | `Ê-sai` |
| `Ê Xê Chi Ên` | `Ê-xê-chi-ên` |
| `Ê Díp Tô` | `Ê-díp-tô` |

## Unicode pitfalls

### Decomposed (NFD) vs precomposed (NFC) Vietnamese characters

Adventech JSON sometimes returns decomposed characters (e.g. `ố` as `ô` + combining U+0301 instead of single U+1ED1). Regex patterns written with precomposed characters will silently fail to match. **Normalize all input to NFC before regex operations.**

```python
import unicodedata
text = unicodedata.normalize("NFC", text)
```

### `Ð` (U+00D0 LATIN ETH) vs `Đ` (U+0110 D WITH STROKE)

These look identical but are different code points. Adventech occasionally emits the ETH form. Always replace `Ð` → `Đ`.

### Broken char splits in Title Case

Some Adventech day titles are corrupted, e.g. `Cuô N Sách Đươ C Đo Ng Â N` instead of `Cuộn Sách Được Đóng Ấn`. The Title-Case algorithm split words mid-character when it encountered combining tone marks. These cannot be regex-fixed reliably — curate manually via `DAY_TITLE_OVERRIDES` in the import script.

## Punctuation & spacing

| Wrong | Correct |
| --- | --- |
| `của chúng ta(Đa-ni-ên 2:44)` (missing space before paren) | `của chúng ta (Đa-ni-ên 2:44)` |

The rule: insert a space when an alphabetic character is followed directly by `(`.

## Terminology aliases (from CLAUDE.md)

| Wrong | Correct |
| --- | --- |
| `Sabát` | `Sa-bát` |
| `Giu-đa-izt` | `Do Thái Giáo` |
| `Hạt-ma-ghê-đôn` | `Ha-ma-ghê-đôn` |
| `Chủ nhật` | `Chủ Nhật` |
| `chúc phước` (subject = God) | `ban phước` |

## Import script

The Sabbath School import script `/tmp/import_sabat.py` encodes all the regex rules above. When importing a new quarter:

1. Add the quarter's lesson titles to `LESSON_TITLE_OVERRIDES` (sentence case).
2. If Adventech delivers day titles in Title Case, audit them and add a `DAY_TITLE_OVERRIDES` block. Pay special attention to lessons with broken Unicode splits.
3. Run `python3 import_sabat.py YEAR Q` and verify with `grep` for residuals.
