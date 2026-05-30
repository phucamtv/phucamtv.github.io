# Goal-Driven System: Strong's Dictionary Vietnamese Translation

You are the master agent of a goal-driven system. Your job is to spawn 
a subagent that will translate the entire STEPBible Strong's lexicon 
(TBESH + TBESG) into Vietnamese, and verify the work against strict 
criteria. Do not perform translation yourself; only orchestrate and 
verify.

## Goal

[[[[[
Produce a complete Vietnamese translation of the STEPBible TBESH 
(Hebrew, ~9,300 extended-Strongs entries) and TBESG (Greek, 
~6,000 extended-Strongs entries) lexicons, suitable for publication 
on PhucAm.tv and consumption by Bible study tools.

For each Strong's entry in the source TSV files, produce a Vietnamese 
translation as a JSONL record with these fields:

- `strongs_extended` (preserved verbatim, e.g. "H0001", "H0001A", 
  "G0001")
- `strongs_unified` (preserved verbatim from source)
- `lemma` (preserved verbatim, Hebrew/Greek Unicode, NFC normalized)
- `transliteration` (preserved verbatim, e.g. "ʾāb", "angelos")
- `morphology` (preserved verbatim, e.g. "H:N-M")
- `gloss_en` (preserved verbatim from source for traceability)
- `definition_en` (preserved verbatim from source for traceability)
- `gloss_vi` (NEW: Vietnamese gloss, 1-5 words, no English mixed in 
  except proper nouns)
- `definition_vi` (NEW: Vietnamese definition, 1-3 sentences, 
  consistent with glossary.json)
- `glossary_terms_used` (NEW: list of canonical theological terms 
  from glossary.json that appear in this entry's translation)

Source data:
- TBESH: https://github.com/STEPBible/STEPBible-Data/raw/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt
- TBESG: https://github.com/STEPBible/STEPBible-Data/raw/master/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt

License: CC BY 4.0 — attribution required in all output files.

Output structure (under `./output/`):
- `output/hebrew.jsonl` — one entry per line, sorted by 
  strongs_extended
- `output/greek.jsonl` — same structure
- `output/glossary.json` — growing canonical Vietnamese rendering 
  for theological key terms (covenant, righteousness, holy, grace, 
  salvation, redemption, atonement, soul, spirit, sin, faith, 
  kingdom, sabbath, etc. — minimum 30 terms)
- `output/hugo/content/strongs/h/{id}.md` and 
  `output/hugo/content/strongs/g/{id}.md` — Hugo content files with 
  proper front-matter
- `output/ATTRIBUTION.md` — CC BY attribution to STEPBible / Tyndale 
  House
- `output/RUN_LOG.md` — append-only log of subagent attempts, 
  failures, and resolutions (used for resumability)
- `output/STATE.json` — persistent checkpoint: last completed batch 
  index per language, glossary version, total cost so far

Translation method: Use Anthropic Claude API with model 
`claude-sonnet-4-6` at temperature=0, batched 25 entries per call. 
Maintain a growing `glossary.json` that the translator reads at the 
start of each batch to ensure consistent rendering across all 
~15,000 entries.
]]]]]

## Criteria for Success

[[[[[
Master agent runs ALL of the following verifications. ALL must pass 
on a single uninterrupted verification pass for the goal to be 
declared complete.

### 1. Source Integrity
1.1. Source TSV files downloaded under `./source/` and SHA-256 logged 
     in `output/SOURCE_HASHES.txt`.
1.2. Total entry count in source counted programmatically (do NOT 
     hardcode — STEPBible adds entries over time). Save as 
     `output/EXPECTED_COUNTS.json` with keys `hebrew_count` and 
     `greek_count`.

### 2. Completeness
2.1. `wc -l output/hebrew.jsonl` matches `hebrew_count` exactly.
2.2. `wc -l output/greek.jsonl` matches `greek_count` exactly.
2.3. Zero entries with empty `gloss_vi` or `definition_vi`:
     `jq -c 'select(.gloss_vi == "" or .definition_vi == "")' 
     output/*.jsonl | wc -l` must equal 0.
2.4. Set of `strongs_extended` values in output equals set in source 
     (verified by sort + diff, exit 0).

### 3. Structural Validity
3.1. All JSONL lines parse as valid JSON: 
     `jq -c . output/hebrew.jsonl > /dev/null && 
      jq -c . output/greek.jsonl > /dev/null` exits 0.
3.2. All required fields present in every record (validated by 
     `tools/validate_schema.py` against `schema.json`, exit 0).
3.3. `lemma` byte-equal to source after NFC normalization (verified 
     by `tools/check_lemma_preservation.py`, exit 0).
3.4. `strongs_extended` values match regex `^[HG]\d{4}[A-Za-z]?$` 
     and are unique within each file.

### 4. Translation Quality (Sampled)
Sample 200 entries (100 Hebrew + 100 Greek) using `random.seed(42)` 
in `tools/sample_quality.py`. For each sampled entry:
4.1. `len(gloss_vi) <= 60` characters.
4.2. No English words >3 chars in `definition_vi` except proper 
     nouns from a whitelist (Yahweh, Jehovah, Israel, Egypt, etc.) — 
     verified by mixed-language detector script.
4.3. `definition_vi` segments cleanly with `underthesea.word_tokenize` 
     (no segmentation errors raised).
4.4. ALL 200 must pass all 3 sub-criteria.

### 5. Glossary Consistency
5.1. `glossary.json` contains at minimum these 30 theological terms 
     with canonical Vietnamese renderings:
     covenant, righteousness, holy, holiness, grace, salvation, 
     redemption, atonement, soul, spirit, sin, faith, kingdom, 
     sabbath, prophet, messiah, christ, lord, god, father, son, 
     temple, sacrifice, priest, prayer, worship, blessing, curse, 
     resurrection, judgment.
5.2. For each glossary term, run grep across all `definition_vi` 
     fields. The chosen Vietnamese rendering must appear in 
     ≥95% of entries where the English equivalent appears in 
     `definition_en`. Verified by `tools/check_glossary_consistency.py`.

### 6. Hugo Build
6.1. `cd output/hugo && hugo --gc --minify --logLevel warn` builds 
     without errors or warnings.
6.2. All ~15,000 generated pages produce valid HTML 
     (`htmlproofer ./public --disable-external --no-enforce-https` 
     exits 0).
6.3. Sitemap contains all entry URLs (count match against output 
     entries).

### 7. Idempotency
7.1. Re-run the pipeline using `--resume-from-checkpoint`. SHA-256 of 
     sorted `hebrew.jsonl` and `greek.jsonl` must be byte-identical 
     to the first run. Logged in `output/IDEMPOTENCY_PROOF.txt`.

### 8. Cost Budget
8.1. Total Anthropic API spend ≤ $200 USD across the full run, 
     verified against running cost log in `output/COST_LOG.jsonl` 
     (each API call appends `{timestamp, model, input_tokens, 
     output_tokens, cost_usd}`).
8.2. Master agent halts subagent and declares failure if 
     `sum(cost_usd) > $250` at any point (hard cap).

### 9. Attribution
9.1. `output/ATTRIBUTION.md` contains correct CC BY 4.0 attribution 
     with link to https://github.com/STEPBible/STEPBible-Data and 
     mention of Tyndale House, Cambridge.
9.2. Hugo front-matter on every entry page includes a `source` field 
     pointing to STEPBible.

ALL 9 criteria must pass on a single uninterrupted verification run. 
Partial completion does not count. Any failure → master agent 
restarts subagent with instructions to fix the specific failures.
]]]]]

## System Roles

### Subagent
- Reads `output/STATE.json` on startup. If it exists, resume from 
  the last completed batch. If not, start fresh.
- Downloads source TSVs if not present in `./source/`.
- Builds the translation pipeline:
  1. Parse TSV → list of entries
  2. For each batch of 25: load current glossary.json, call Claude 
     API, parse response, validate JSON structure, append to output 
     JSONL, update glossary.json with any new canonical terms, 
     update STATE.json, append to COST_LOG.jsonl
  3. After all batches complete: generate Hugo content files from 
     JSONL, run validation tools, fix any structural issues
- Writes progress to `output/RUN_LOG.md` every 50 batches.
- On crash or restart, resumes from STATE.json checkpoint.

### Master Agent (you)
1. Spawn one subagent with the goal above.
2. Every 5 minutes (or on subagent claim of completion), do:
   a. Check `output/COST_LOG.jsonl`. If total > $250, kill subagent, 
      report budget breach, halt.
   b. Check `output/STATE.json` last-update timestamp. If stale 
      >15 minutes AND no completion claim, treat as inactive → 
      restart subagent (it will resume from checkpoint).
   c. If subagent claims completion: run ALL 9 criteria. If any 
      fail, write specific failures to `output/FAILURES.md` and 
      restart subagent with instructions to address those specific 
      failures only — do not start over.
3. Loop until all 9 criteria pass on a clean verification run.
4. DO NOT STOP until criteria are met or budget hard cap is hit, 
   unless the user manually intervenes.

## Pseudocode

```
download source TSVs if missing
spawn subagent

while (criteria not all passing):
  sleep 5 minutes
  check cost log → if > $250, halt with budget failure
  check STATE.json freshness → if stale, restart subagent
  if subagent claims done:
    run all 9 criteria
    if all pass: declare success, end
    else: write failures to FAILURES.md, restart subagent with 
          targeted fix instructions
```

## Notes

- Use Sonnet 4.6 (`claude-sonnet-4-6`) for the translation calls. Do 
  not use Opus — cost-prohibitive at this scale.
- Temperature MUST be 0 for translation calls (idempotency requirement).
- Glossary growth: when subagent encounters a new theological term not 
  in glossary.json, it must add a canonical Vietnamese rendering 
  immediately and use that consistently for all subsequent entries.
- If subagent has burned >$50 with <25% progress, master should 
  inspect COST_LOG.jsonl and consider whether the prompt is producing 
  oversized outputs.
