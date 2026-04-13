# GC Translation Pipeline — Progress Log

Branch: `worktree-gc-translation` at `/Users/htruong/code/phucamtv/.claude/worktrees/gc-translation`.

Plan: `docs/superpowers/plans/2026-04-13-gc-vietnamese-translation.md`.

Execution model: subagent-driven (one implementer per task, one combined spec+quality reviewer per task).

## Status

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Scaffolding & dependencies | ✅ done | `eb7f596` + `a8384c3` |
| 2 | Seed glossary + bible-refs | ✅ done | `c1f0aac` |
| 3 | VI1934 Bible JSON | ✅ done | `d6fb69e` |
| 4 | Bible resolver module | ✅ done | `124c366` |
| 5 | Lint module | ✅ done | `575bd44` |
| 6 | Chapter scraper | ✅ done | `9adce27` |
| 7 | TOC scraper | ✅ done | `36e5591` + `30e7b37` |
| 8 | Chunker | ✅ done | `4d61014` |
| 9 | Glossary loader | ✅ done | `3d7f608` |
| 10 | Prompt builder | ✅ done | `18e693a` |
| 11 | Translator (Claude CLI) | ✅ done | `7b71903` + `2f2675a` |
| 12 | Assembler | ✅ done | `0d85b78` |
| 13 | Hugo section indices | ✅ done | `e26b061` |
| 14 | Orchestrator + Makefile | ✅ done | `61c2a1f` |
| 15 | End-to-end on ch1 | 🟦 out of scope (user runs) | — |
| 16 | Full pipeline on 42 chapters | 🟦 out of scope (user runs) | — |

## Key Decisions / Deviations from Plan

- **Python package name**: Plan shows `scripts/gc-translation/` (hyphen). Python can't import hyphens, so the actual package is `scripts/gc_translation/` (underscore). Plan's Task 4 Step 3 rename is moot — we started with underscores.
- **Bible source**: Plan's Task 3 was rewritten during brainstorming. We parse local Docusaurus markdown at `/Users/htruong/code/kt-static/VI1934/`, not a remote JSON dump.
- **Numbered books**: VI1934 source uses Roman numerals ("I Sa-mu-ên", "II Cô-rinh-tô", "III Giăng"). `bible-refs.yaml` updated accordingly for all numbered books (Samuel, Kings, Chronicles, Corinthians, Thessalonians, Timothy, Peter, John — abbreviations too).
- **Python interpreter**: `python3` on this machine; `python` not on PATH.
- **T1 paths.py naming tweak**: helpers now all use `chapter` (not mixed `n`/`chapter`).
- **T2 data-file tasks**: written directly by controller (no subagent), since plan contained the verbatim YAML.

## Data Produced

- `data/bible/vi1934.json` — 31,081 verses across 1,189 chapters, 66 books, keyed by `"<English Book> <C>:<V>"`.
- `data/gc-translation/glossary.yaml` — 84 theological terms in 6 groups.
- `data/gc-translation/bible-refs.yaml` — 99 English→Vietnamese book-name entries.

## Out of Scope (handed back to user)

- **T15**: End-to-end validation on chapter 1. Requires live `m.egwwritings.org` fetch + `claude` CLI. User will run `python3 -m scripts.gc_translation.run all --chapter 1` after merge.
- **T16**: Full 42-chapter run. Hours of wall time via `claude` CLI (billed against Claude subscription, not API tokens). User will run `make gc-all` when ready.
- **Translator backend**: Uses `claude -p` subprocess (not Anthropic SDK). Smoke test verified live on 2026-04-13.
