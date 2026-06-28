# EGW translation pipeline — lessons learned

A running record of design decisions, surprises, bugs, and fixes encountered while building and operating the TypeScript/Bun translation pipeline at `scripts/egw_translate/`. Add to this doc whenever something non-obvious happens; future-you (or the next book) benefits.

The Python reference pipeline at `scripts/gc_translation/` (used for *The Great Controversy*) inspired this one. When something looks wrong here, check there first — most edge cases were already solved in Python.

## Pipeline shape

Five stages, each resumable by file existence on disk:

```
scrape    egwwritings → data/<book>-source/chNN.{html,txt}              (egw_scrape/)
chunk     chNN.txt    → data/<book>-source/chunks/chNN-MM.txt            (egw_translate/)
translate chNN-MM.txt → data/<book>-translated/chNN-MM.{md,err}          (egw_translate/)
assemble  chNN-MM.md  → content/sach/egw/<slug>/chuong-NN.md             (egw_translate/)
lint      regex pass during assemble                                     (egw_translate/)
```

Source data and intermediate artifacts (`data/<book>-{source,translated}/`) are gitignored. Shared reference data (`data/egw-translation/{glossary,bible-refs}.yaml`, `data/bible/vi1934.json`) is committed.

## What worked well

- **Per-book `BookConfig`** kept the pipeline reusable. Adding the next book is a config object in `scripts/egw_translate/books/`, not a code change.
- **Bible sentinel approach** (`[[BIBLE:Book Ch:Vs]]` emitted by the translator, expanded post-hoc to a VI1934 blockquote) keeps Scripture rendering canonical and consistent across all chapters and books. The model never has to translate verse text.
- **Resume by file existence.** Skipping `chNN-MM.md` if it already exists made multi-hour runs survivable across interruptions. Errors land in `.err` files; re-running translates only the failed/missing chunks.
- **Section-aware chunker** (split first by `## ` h2, then by ~1500-word paragraph boundaries) produced healthy chunk distributions on real chapters (max 1477 words on the longest chapter, well under 1800-word ceiling).
- **Frontmatter-preserving assembler.** The Hugo `chuong-NN.md` files have authored Vietnamese titles + `draft: true` flags. Splitting on `^(---\n.*?\n---\n)` (the same regex used by `seed_chapters.ts`) and rewriting only the body keeps the frontmatter byte-identical across runs.
- **Bun's `HTMLRewriter`** for the scrape stage worked without any npm deps — single binary, single language for the whole pipeline.

## Surprises and fixes

### 1. The book had 29 chapters, not 30

The initial Hugo stub directory had `chuong-01.md` … `chuong-30.md` and `_index.md` claimed "Sách gồm 30 chương." The real egwwritings TOC for book 15 has 29 numbered chapters plus a Preface (which we skip via `skipPrefixes`). Discovered during the first scrape smoke run.

**Fix:** dropped `chuong-30.md`, updated `colp.ts` to `chapters: 29`. Follow-up: `_index.md` text still needs the "30 → 29" edit.

**Lesson:** Always verify expected chapter count against the live TOC before generating stubs. The expected count is a *sanity check*, not a contract.

### 2. egwwritings.org HTML doesn't use `<article>`

The scraper's chapter extractor was originally scoped to `<article>`, which is what the GC pipeline assumed. The live pages use `<main id="main_content">` with content blocks marked `class="egw_content_wrapper"`. Long chapters paginate via `<li class="next">` links; ch02 spans 7 pages, ch25 spans 15.

**Fix in `scripts/egw_scrape/lib/parse.ts`:** scope by `<main id="main_content">`, filter elements by `egw_content_wrapper` class, walk Next links until `nextParaId >= nextChapterStartId`. Multi-page HTML concatenated in `chNN.html` with `<!-- PAGE BREAK -->` markers.

**Lesson:** Don't assume markup; inspect the live page once before trusting any selector. Synthetic HTML fixtures verify parser logic but can't catch site-specific layout assumptions.

### 3. Worktree git operations need `GIT_DIR` unset

The harness sets `GIT_DIR=/workspace/.git` globally. Inside `/workspace/.worktrees/<branch>/`, every `git` command must be prefixed with `unset GIT_DIR && ...` (or `env -u GIT_DIR git ...`) — otherwise git operates on the *main* checkout's branch, not the worktree's.

This bit us when an early commit accidentally bundled the user's pre-staged work along with a `.gitignore` change because git wasn't actually committing inside the worktree. Symptom: `git status` shows the wrong branch's state.

**Fix:** every dispatched subagent gets explicit instruction to `unset GIT_DIR` before any git call, and to verify `git branch --show-current` returns the worktree branch first.

**Lesson:** When working in worktrees, treat `GIT_DIR` env-var hygiene as a first-class concern. Documented in `~/.claude/projects/.../memory/feedback_git_worktrees.md`.

### 4. Inline blockquote bug (Bible sentinel mid-sentence)

The model often emits `[[BIBLE:...]]` mid-sentence, e.g., `Kinh Thánh chép: [[BIBLE:Matt 13:31]] Đó là...`. The original resolver replaced the sentinel inline, producing `Kinh Thánh chép: > "..." ...`. Markdown only renders `>` as a blockquote when it starts a line — so the verse text became literal `>` text, not a blockquote.

**Fix in `scripts/egw_translate/lib/bible.ts`:** wrap the replacement with `\n\n…\n\n` so the blockquote always becomes its own paragraph. Post-collapse runs of 3+ newlines back to a paragraph break.

```ts
return `\n\n> "${verseText}"\n> <cite>(${ref.viBook} ${ref.display})</cite>\n\n`;
// then: replaced.replace(/\n{3,}/g, "\n\n").trim()
```

**Lesson:** Markdown's blockquote rule is "must be at start of line." Any post-processor that rewrites text to a blockquote MUST also force a paragraph break. Verify with the Hugo render, not just the raw Markdown.

### 5. Orphan punctuation around Bible sentinels

Side effect of fix #4: when the translator emits chained sentinels like `[[BIBLE:A]]; [[BIBLE:B]]. COL 421.2`, the resolver wraps each sentinel with `\n\n`, leaving the connecting `;` and trailing `. COL 421.2` orphaned on their own lines.

**Fix:** mirror the GC pipeline's `SENTINEL_RE` — extend the regex to optionally consume one trailing punctuation char and a wrapping paren pair:

```ts
// Before:  /[ \t]*\[\[BIBLE:([^\]]+)\]\][ \t]*/g
// After:   /[ \t]*\(?\[\[BIBLE:([^\]]+)\]\]\)?[.,;:!?]?[ \t]*/g
```

Plus a one-off `cleanup_orphan_punct.ts` to retro-fix the chapters translated under the buggy resolver:
- Drop pure-punctuation paragraphs (`;`, `.`, `,` alone between blockquotes)
- Strip leading `. `/`, `/`; ` from any paragraph
- Attach a bare `COL N.M` paragraph to the previous `<cite>` line, matching GC's `> <cite>(…)</cite> COL 17.1` convention

**Lesson:** Whenever you isolate a span of text into its own paragraph via post-processing, also consume one char of surrounding punctuation. Otherwise the punctuation that was glued to the original span gets orphaned. The GC team had already learned this — always check the reference pipeline first.

### 6. Bun's `claude` CLI flags drifted from the spec

The plan called for `claude --bare -p --system-prompt ... --tools "" --model opus`. The `--bare` flag explicitly says "Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper" — incompatible with our OAuth (Max subscription) auth. Symptom: "Not logged in · Please run /login".

**Fix in `scripts/egw_translate/lib/claude.ts`:** drop `--bare`, add `--setting-sources ""` (skips loading user/project/local settings — the main hygiene benefit `--bare` was supposed to give us). Combined with `--tools ""`, `--system-prompt`, and `--permission-mode bypassPermissions`, we get a clean batch context that still authenticates via OAuth.

**Lesson:** When the plan says "use flag X", validate against the live CLI before committing. Especially flags that interact with auth.

### 7. Translation throughput

End-to-end metrics from the COLP run:
- **Chunks per chapter:** range 1–16, median ~3
- **Total chunks for 29 chapters:** ~92
- **Wall time per chunk on opus:** ~30–60s (mean ~46s)
- **Total wall time for full book:** ~2 hours sequential
- **Failure rate:** zero `.err` files across the full run

This is fast enough that parallelism (Promise.all over chunks within a chapter) is not yet worth the complexity. Defer until a multi-book run forces the issue.

### 8. Background subagent timeouts

A 2-hour single subagent dispatch is at the edge of practical reliability. The agent stalled in the verify/commit step after writing all 29 chapters; we ran the verification + commit manually. Translation work was not lost (cached on disk), but the agent never sent a completion notification.

**Lesson:** For multi-hour runs, split the work across multiple background agents (e.g., chapters 1–10, 11–20, 21–29 + verify/commit) so each is bounded to ~30–60 min. Or have the orchestrator log progress to a polling file the parent can check without reading the agent's output stream.

## Reusable data

| File | Scope | Reusable across books? |
|---|---|---|
| `data/bible/vi1934.json` | All EGW books | ✅ as-is |
| `data/egw-translation/bible-refs.yaml` | All EGW books | ✅ as-is |
| `data/egw-translation/glossary.yaml` | All EGW books, mostly | ⚠️ Review per book — most theological terms carry over, but some (e.g., Reformers, papacy, Dark Ages from GC) won't appear in COLP. Add COLP-specific terms (parable vocabulary) on demand. |
| `data/<book>-source/chapters.json` | Per book | ❌ regenerate |
| `data/<book>-{source,translated}/` | Per book | ❌ regenerate |

## Things still on the follow-up list

- `_index.md` line 29: change "Sách gồm 30 chương" to "Sách gồm 29 chương".
- Flip `draft: true` → `false` per chapter as the human review pass approves each one.
- Cleanup of dead code in `scripts/egw_scrape/lib/parse.ts`: `Block.isBibleRef` is captured but never used; `inNextLi` boolean is set but never read; `extractChapterLegacy` and `chapter-sample.html` exist only to keep the synthetic article-based test alive (now redundant with the real-site fixture).
- Glossary comment in `data/egw-translation/glossary.yaml` still says "for The Great Controversy" — should be "for Ellen G. White writings" now that it's shared.
- Move blockquote/Bible resolution out of the translate stage into a dedicated post-process stage, so retroactive fixes (like #5 above) don't require re-running translate against the API.

## The Desire of Ages run (book 130, "Khát Vọng Muôn Đời", 87 chapters)

### 9. egwwritings.org is now behind Cloudflare — scrape from the EPUB instead

The live chapter pages (`m.egwwritings.org/en/book/130...`) now return a Cloudflare
"Just a moment..." JS challenge (HTTP 403) to plain `fetch`, regardless of User-Agent.
The content API at `a.egwwritings.org` exists but needs auth (401). WebFetch is also
403'd.

**Fix:** the White Estate media host `media2.egwwritings.org` is NOT Cloudflare-protected
and serves the official EPUB directly (`/epub/en_<CODE>.epub`, e.g. `en_DA.epub`). Added
`scripts/egw_scrape/extract_epub.ts` to download + parse the EPUB into the same
`chNN.txt` + `chapters.json` the downstream pipeline expects. `content01.xhtml` =
chapter 1, etc. No code changes needed downstream.

**Copyright note:** the underlying 1898 DA text is US public domain (pre-1923) and freely
translatable. The EPUB's `aboutbook.xhtml` carries a White Estate EULA on *that file's*
distribution — use the EPUB only to obtain the PD text, don't treat its EULA as granting
rights. Consistent with how the site already describes its translations ("dịch từ ấn bản
Anh ngữ công cộng"). NB: LDE (1992) is NOT public domain; DA (1898) is on firmer ground.

### 10. Reconstructing `DA N.M` citations from the EPUB

The EPUB has NO `DA N.M` paragraph citations (those are a web-reader feature). But each
paragraph has an `id="pN"` anchor and the text contains `<span class="pagebreak"
title="N">[N]</span>` markers whose `title` is the print page number. The canonical
citation is `<page>.<ordinal-on-page>` where the page is the one in effect when the
paragraph *begins* — a paragraph containing a `[N]` break still belongs to the page
*before* it. The chapter's opening page is implicit (`firstMarkerPage − 1`). Verified
against egwwritings ground truth: ch1 para 1 = DA 19.1, the para after `[20]` = DA 20.1.

Two gotchas, both caught only by checking against ground truth (always do this before
translating a single chapter):
- The pagebreak span has `title="N"` BEFORE `class="pagebreak"` — order-independent
  regex required.
- The visible `[N]` text inside the span must be stripped from the reading text (the
  other books have zero `[NN]` markers); the page number comes from the `title` attr.

### 11. Resolver edge cases the model emits (fixed in `bible.ts`, all TDD)

- **Multi-chapter comma lists**: the model batches refs like `[[BIBLE:John 8:28,6:57,8:50,7:18]]`
  (= John 8:28, 6:57, 8:50, 7:18). Each comma group may carry its own `chapter:`; bare
  groups inherit the prior chapter. `parseRef` now walks segments.
- **Verses omitted from VI1934**: e.g. Mark 9:44 is genuinely absent (like Matt 17:21).
  A range `9:43-45` must resolve from 43 + 45, skipping the gap. `lookupVerses` now skips
  individually-missing verses, returning null only if NOTHING in the ref resolves.
- **Bare whole-chapter ref** (`[[BIBLE:Psalm 117]]`, no verse): rare (1 in 2,692 paras).
  Not worth whole-chapter expansion; fixed as a one-off content edit. If it recurs often,
  expand `parseRef` to handle bare chapters for short psalms.
- **`assembleBody` now runs a final resolver pass** (pass a `BibleLookup`). This means a
  resolver fix can be applied to already-translated chapters by re-running *assemble*
  only — no model re-call. (This was the "move resolution to a post-process stage"
  follow-up; partially done — translate still resolves per-chunk too.)

### 12. Ellipsis normalization (lint)

The model emits ASCII `...` and spaced `. . .` inside verse quotes and prose. CLAUDE.md
mandates `…`. `lint.ts` now collapses both to `…` (spaced form first so its dots aren't
half-consumed).

### 13. Parallel batch translation (`scripts/egw_translate/batch.ts`)

87 chapters ≈ 3× the largest prior book. Ran 4 parallel `batch.ts` processes over disjoint
chapter ranges (each runs chunk→translate→assemble per chapter sequentially, logs to
`data/<book>-translated/batch-logs/`). ~210 chunks, full book in ~2h wall with 4-way
parallelism, 0 `.err` files. Resume-by-file-existence makes this safe to interrupt/restart.
Watch the coarse "DONE" counter lag behind in-flight large chapters — count fresh `claude`
proc ages to confirm liveness, not just the DONE count.

## Pattern: when the next book starts

1. Add `scripts/egw_scrape/books/<slug>.ts` and `scripts/egw_translate/books/<slug>.ts`.
   Include `epubUrl` + `paragraphCitationPrefix` if scraping from the EPUB.
2. Add the slug to the `BOOKS` registry in `scrape.ts`, `extract_epub.ts`, `egw_translate/run.ts`, and `seed_chapters.ts`.
3. Add `data/<slug>-source/` and `data/<slug>-translated/` to `.gitignore`.
4. Acquire source: `bun scripts/egw_scrape/extract_epub.ts <slug>` (EPUB) OR `scrape.ts <slug> all` (if live pages reachable).
   **Verify reconstructed citations against egwwritings ground truth before translating anything.**
5. Hugo stub directory: 1 frontmatter-only `chuong-NN.md` per chapter (authored VN titles, `draft: true`).
6. Translate: `bun scripts/egw_translate/batch.ts --book <slug> --from 1 --to N` (split into parallel batches for big books).
7. Verify: 0 bare `[NN]` markers, 0 unresolved sentinels, 0 ASCII `...`, citation count == source paragraph count, citations ascend across chapters, Hugo builds.
8. Flip `draft: false`, confirm the book lists on `/sach/` and `/sach/egw/`, commit.
