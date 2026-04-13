"""Translate a single chunk via the `claude` CLI, then resolve Bible sentinels.

Uses the local Claude Code CLI in bare print mode — no ANTHROPIC_API_KEY
required. Billing is the user's Claude subscription.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import time

from scripts.gc_translation.bible import load_bible, load_bible_refs, resolve_sentinels
from scripts.gc_translation.glossary import load_glossary
from scripts.gc_translation.paths import (
    chunk_path,
    error_path,
    translated_path,
    TRANSLATED_DIR,
)
from scripts.gc_translation.prompt import build_system_prompt

MODEL = "claude-opus-4-6"
MAX_RETRIES = 3
TIMEOUT_SECONDS = 600


def translate_chunk_text(english: str, system_prompt: str) -> str:
    claude = shutil.which("claude")
    if not claude:
        raise RuntimeError("`claude` CLI not found on PATH")

    cmd = [
        claude,
        "-p",
        "--model", MODEL,
        "--system-prompt", system_prompt,
        "--output-format", "text",
        "--setting-sources", "",
        "--disable-slash-commands",
    ]

    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = subprocess.run(
                cmd,
                input=english,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SECONDS,
                check=False,
            )
            if result.returncode != 0:
                raise RuntimeError(
                    f"claude exit {result.returncode}: {result.stderr.strip()[:500]}"
                )
            out = result.stdout.strip()
            if not out:
                raise RuntimeError("claude returned empty output")
            return out
        except (subprocess.TimeoutExpired, RuntimeError) as e:
            last_err = e
            wait = 2 ** attempt
            print(f"  attempt {attempt} failed: {e}; retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Translation failed after {MAX_RETRIES} attempts") from last_err


def translate_chunk_file(chapter: int, chunk: int, force: bool = False) -> None:
    out_path = translated_path(chapter, chunk)
    err_file = error_path(chapter, chunk)
    if out_path.exists() and not force:
        print(f"ch{chapter:02d}-{chunk:02d}: already translated, skipping", file=sys.stderr)
        return

    TRANSLATED_DIR.mkdir(parents=True, exist_ok=True)
    src = chunk_path(chapter, chunk).read_text(encoding="utf-8")
    system_prompt = build_system_prompt(load_glossary())

    try:
        raw = translate_chunk_text(src, system_prompt)
    except Exception as e:
        err_file.write_text(f"{type(e).__name__}: {e}\n", encoding="utf-8")
        print(f"ch{chapter:02d}-{chunk:02d}: FAILED — {e}", file=sys.stderr)
        return

    resolved, unresolved = resolve_sentinels(raw, load_bible(), load_bible_refs())
    out_path.write_text(resolved, encoding="utf-8")
    if err_file.exists():
        err_file.unlink()
    if unresolved:
        print(
            f"ch{chapter:02d}-{chunk:02d}: {len(unresolved)} unresolved bible refs: {unresolved}",
            file=sys.stderr,
        )
    print(f"ch{chapter:02d}-{chunk:02d}: translated → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("chapter", type=int)
    ap.add_argument("chunk", type=int)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    translate_chunk_file(args.chapter, args.chunk, force=args.force)
