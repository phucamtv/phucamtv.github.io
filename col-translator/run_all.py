"""Master runner for the COL Vietnamese translation pipeline.

Usage:
  python run_all.py                 # run all phases
  python run_all.py --phase 1       # run only phase 1
  python run_all.py --phase 2       # run only phase 2
  python run_all.py --from-phase 3  # run phase 3 onwards
  python run_all.py --chapter 5     # re-translate only chapter 5
  python run_all.py --test          # run phases 1+2 on first 2 chapters (fast sanity check)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import crawler
import build_glossary
import orchestrator
import hugo_gen

BASE_DIR = Path(__file__).parent
MANIFEST_PATH = BASE_DIR / "chapters" / "manifest.json"
GLOSSARY_PATH = BASE_DIR / "glossary" / "glossary.json"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="COL translation pipeline runner")
    p.add_argument("--phase", type=int, choices=[1, 2, 3, 4], help="run only this phase")
    p.add_argument("--from-phase", type=int, choices=[1, 2, 3, 4], default=1)
    p.add_argument("--chapter", type=int, help="retranslate only this chapter (implies phases 3+4)")
    p.add_argument("--rebuild-glossary", action="store_true")
    p.add_argument("--retranslate", action="store_true")
    p.add_argument("--parallel", action="store_true", help="phase 3 parallel mode")
    p.add_argument("--test", action="store_true", help="only first 2 chapters, phases 1+2 only")
    return p.parse_args(argv)


def _phase1() -> None:
    t0 = time.time()
    print("\n=== Phase 1: crawl ===")
    if crawler.already_crawled():
        print("Phase 1 skip: chapters already crawled.")
    else:
        asyncio.run(crawler.crawl())
    print(f"Phase 1 duration: {time.time() - t0:.1f}s")


def _truncate_manifest_for_test() -> list[dict] | None:
    """In --test mode, back up the manifest and keep only first 2 entries on disk."""
    if not MANIFEST_PATH.exists():
        return None
    full = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if len(full) <= 2:
        return None
    short = full[:2]
    MANIFEST_PATH.write_text(json.dumps(short, ensure_ascii=False, indent=2), encoding="utf-8")
    return full


def _restore_manifest(full: list[dict] | None) -> None:
    if full is None:
        return
    MANIFEST_PATH.write_text(json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")


def _phase2(rebuild: bool, test_mode: bool = False) -> None:
    t0 = time.time()
    print("\n=== Phase 2: glossary ===")
    if GLOSSARY_PATH.exists() and not rebuild:
        print(f"Phase 2 skip: glossary exists at {GLOSSARY_PATH}.")
    else:
        backup = _truncate_manifest_for_test() if test_mode else None
        try:
            build_glossary.build()
        finally:
            _restore_manifest(backup)
    print(f"Phase 2 duration: {time.time() - t0:.1f}s")


def _phase3(args: argparse.Namespace) -> None:
    t0 = time.time()
    print("\n=== Phase 3: translate ===")
    argv: list[str] = []
    if args.parallel:
        argv.append("--parallel")
    if args.retranslate:
        argv.append("--retranslate")
    if args.chapter is not None:
        argv.extend(["--chapter", str(args.chapter)])
    orchestrator.main(argv)
    print(f"Phase 3 duration: {time.time() - t0:.1f}s")


def _phase4() -> None:
    t0 = time.time()
    print("\n=== Phase 4: hugo gen ===")
    hugo_gen.main()
    print(f"Phase 4 duration: {time.time() - t0:.1f}s")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    if not os.environ.get("ANTHROPIC_API_KEY") and (
        args.phase in (2, 3) or args.from_phase <= 3 or args.chapter is not None
    ):
        print("WARNING: ANTHROPIC_API_KEY not set — phases 2 and 3 will fail.")

    if args.chapter is not None:
        # Targeted re-translate of a single chapter, then regenerate Hugo.
        _phase3(args)
        _phase4()
        return 0

    if args.test:
        _phase1()
        _phase2(rebuild=args.rebuild_glossary, test_mode=True)
        print("\nTest mode done (phases 1+2 on first 2 chapters).")
        return 0

    run = set()
    if args.phase is not None:
        run = {args.phase}
    else:
        run = {p for p in (1, 2, 3, 4) if p >= args.from_phase}

    if 1 in run:
        _phase1()
    if 2 in run:
        _phase2(rebuild=args.rebuild_glossary)
    if 3 in run:
        _phase3(args)
    if 4 in run:
        _phase4()
    return 0


if __name__ == "__main__":
    sys.exit(main())
