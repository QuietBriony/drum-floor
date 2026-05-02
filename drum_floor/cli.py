from __future__ import annotations

import argparse
from pathlib import Path

from .generator import GenerateRequest, generate_candidate
from .live_log import write_live_log


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
    generate.add_argument("--out", required=True, type=Path, help="Output directory for the fixed candidate files.")
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
            "out": str(result.out_dir),
            "outputs": [path.name for path in result.files],
        })
        print(f"generated: {result.out_dir}")
        print(f"candidate: {result.candidate_id}")
        for path in result.files:
            print(f"- {path.name}")
        print(f"log: {log_path}")
        return 0
    parser.error("unknown command")
    return 2
