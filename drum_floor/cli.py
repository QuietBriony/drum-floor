from __future__ import annotations

import argparse
from pathlib import Path

from .generator import GenerateRequest, generate_candidate
from .inspector import inspect_candidate
from .live_log import write_live_log
from .scoring import SCORE_KEYS, ScoreRequest, score_candidate
from .suggestions import SuggestionRequest, suggest_evolution


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m drum_floor",
        description="Generate safe drum-floor live candidates for future OpenClaw control.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    generate = subparsers.add_parser(
        "generate",
        help="Generate pattern.json, drums.mid, preview.txt, and meta.json into an output directory.",
    )
    generate.add_argument("--style", required=True, help="Style profile id from profiles/groove-profiles.json.")
    generate.add_argument("--bpm", required=True, type=int, help="Tempo in BPM, 40-240.")
    generate.add_argument("--bars", required=True, type=int, help="Number of 4/4 bars, 1-128.")
    generate.add_argument("--energy", required=True, type=int, help="Energy amount, 0-100.")
    generate.add_argument("--seed", required=True, type=int, help="Deterministic generation seed.")
    generate.add_argument("--frame", help="Optional drum pattern frame id from patterns/drum-pattern-frames.json.")
    generate.add_argument("--out", required=True, type=Path, help="Output directory for the fixed candidate files.")
    inspect = subparsers.add_parser(
        "inspect",
        help="Inspect a generated candidate directory without arming or modifying it.",
    )
    inspect.add_argument("candidate", type=Path, help="Candidate directory containing the fixed generated files.")

    score = subparsers.add_parser(
        "score",
        help="Store a metadata-only listening score for a generated candidate.",
    )
    score.add_argument("candidate", type=Path, help="Candidate directory to score after listening.")
    score.add_argument("--target", required=True, choices=("browser", "ableton", "ep133_preview"), help="Listening target used for the review.")
    score.add_argument("--reviewer", required=True, help="Human reviewer or gate name.")
    for key in SCORE_KEYS:
        score.add_argument(f"--{key.replace('_', '-')}", required=True, type=int, help=f"{key} score, 1-5.")
    score.add_argument("--what-worked", required=True, help="Short note about what worked.")
    score.add_argument("--what-failed", required=True, help="Short note about what failed.")
    score.add_argument("--next-hint", required=True, help="Short hint for the next evolution suggestion.")
    score.add_argument("--out", type=Path, help="Output directory for listening score JSON. Defaults to evolution/listening-notes.")

    suggest = subparsers.add_parser(
        "suggest-evolution",
        help="Create a metadata-only Pocket Director evolution suggestion from listening scores.",
    )
    suggest.add_argument("--scores-dir", type=Path, default=Path("evolution/listening-notes"), help="Directory containing listening score JSON files.")
    suggest.add_argument("--frame", help="Optional pattern frame id filter.")
    suggest.add_argument("--agent", default="pocket-director-agent", help="Suggestion agent label.")
    suggest.add_argument("--out", type=Path, default=Path("evolution/suggestions"), help="Output directory for suggestion JSON.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "generate":
        request = GenerateRequest(
            style=args.style,
            bpm=args.bpm,
            bars=args.bars,
            energy=args.energy,
            seed=args.seed,
            frame=args.frame,
            out=args.out,
        )
        try:
            result = generate_candidate(request)
        except Exception as error:
            log_path = write_live_log("generate-failed", {
                "style": request.style,
                "bpm": request.bpm,
                "bars": request.bars,
                "energy": request.energy,
                "seed": request.seed,
                "frame": request.frame,
                "out": str(request.out),
                "error": str(error),
            })
            print(f"error: {error}")
            print(f"log: {log_path}")
            return 1
        log_path = write_live_log("generate-ok", {
            "candidate_id": result.candidate_id,
            "style": request.style,
            "bpm": request.bpm,
            "bars": request.bars,
            "energy": request.energy,
            "seed": request.seed,
            "frame": result.frame_id,
            "out": str(result.out_dir),
            "outputs": [path.name for path in result.files],
        })
        print(f"generated: {result.out_dir}")
        print(f"candidate: {result.candidate_id}")
        print(f"frame: {result.frame_id}")
        for path in result.files:
            print(f"- {path.name}")
        print(f"log: {log_path}")
        return 0
    if args.command == "inspect":
        result = inspect_candidate(args.candidate)
        print(f"candidate: {result.summary.get('candidate_id') or '-'}")
        print(f"directory: {result.candidate_dir}")
        print(f"ok: {str(result.ok).lower()}")
        for key in ("style", "frame", "bpm", "bars", "energy", "seed", "event_count"):
            if key in result.summary:
                print(f"{key}: {result.summary[key]}")
        for warning in result.warnings:
            print(f"warning: {warning}")
        for error in result.errors:
            print(f"error: {error}")
        return 0 if result.ok else 1
    if args.command == "score":
        scores = {key: getattr(args, key) for key in SCORE_KEYS}
        notes = {
            "what_worked": args.what_worked,
            "what_failed": args.what_failed,
            "next_hint": args.next_hint,
        }
        try:
            result = score_candidate(ScoreRequest(
                candidate=args.candidate,
                target=args.target,
                reviewer=args.reviewer,
                scores=scores,
                notes=notes,
                out=args.out,
            ))
        except Exception as error:
            print(f"error: {error}")
            return 1
        print(f"score: {result.out_path}")
        print(f"candidate: {result.candidate_id}")
        print(f"target: {result.target}")
        return 0
    if args.command == "suggest-evolution":
        try:
            result = suggest_evolution(SuggestionRequest(
                scores_dir=args.scores_dir,
                out=args.out,
                frame=args.frame,
                agent=args.agent,
            ))
        except Exception as error:
            print(f"error: {error}")
            return 1
        print(f"suggestion: {result.out_path}")
        print(f"frame: {result.frame}")
        print(f"score_count: {result.score_count}")
        return 0
    parser.error("unknown command")
    return 2
