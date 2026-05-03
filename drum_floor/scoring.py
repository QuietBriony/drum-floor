from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .inspector import inspect_candidate

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCORE_DIR = REPO_ROOT / "evolution" / "listening-notes"
VALID_TARGETS = {"browser", "ableton", "ep133_preview"}
SCORE_KEYS = (
    "pocket",
    "space",
    "bass_lock",
    "ghost_glue",
    "snare_lag_feel",
    "fill_naturalness",
    "mix_weight",
    "surprise",
    "repeatability",
)


@dataclass(frozen=True)
class ScoreRequest:
    candidate: Path
    target: str
    reviewer: str
    scores: dict[str, int]
    notes: dict[str, str]
    out: Path | None = None


@dataclass(frozen=True)
class ScoreResult:
    out_path: Path
    candidate_id: str
    target: str


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-") or "score"


def _validate_scores(scores: dict[str, int]) -> None:
    missing = [key for key in SCORE_KEYS if key not in scores]
    if missing:
        raise ValueError(f"missing score fields: {', '.join(missing)}")
    for key in SCORE_KEYS:
        value = int(scores[key])
        if not 1 <= value <= 5:
            raise ValueError(f"--{key.replace('_', '-')} must be between 1 and 5")


def _validate_request(request: ScoreRequest) -> None:
    if request.target not in VALID_TARGETS:
        raise ValueError(f"--target must be one of: {', '.join(sorted(VALID_TARGETS))}")
    if not request.reviewer.strip():
        raise ValueError("--reviewer is required")
    _validate_scores(request.scores)
    for key in ("what_worked", "what_failed", "next_hint"):
        if key not in request.notes:
            raise ValueError(f"missing note field: {key}")


def _safe_score_dir(out: Path | None) -> Path:
    directory = (out or DEFAULT_SCORE_DIR).expanduser().resolve()
    armed = (REPO_ROOT / "live" / "armed").resolve()
    if directory == armed or armed in directory.parents:
        raise ValueError("refusing to write listening scores under live/armed")
    return directory


def score_candidate(request: ScoreRequest) -> ScoreResult:
    _validate_request(request)
    candidate_dir = request.candidate.expanduser().resolve()
    inspection = inspect_candidate(candidate_dir)
    if not inspection.ok:
        errors = "; ".join(inspection.errors) or "candidate inspect failed"
        raise ValueError(errors)

    pattern = _read_json(candidate_dir / "pattern.json")
    inputs = pattern.get("inputs", {})
    candidate_id = str(pattern.get("candidate_id") or inspection.summary.get("candidate_id"))
    now = datetime.now(timezone.utc)
    created_at = now.isoformat().replace("+00:00", "Z")
    score = {
        "schema": "drum-floor.evolution.listening-score.v1",
        "candidate": {
            "candidate_id": candidate_id,
            "style": str(inputs.get("style")),
            "frame": str(inputs.get("frame") or pattern.get("pattern_frame", {}).get("id")),
            "bpm": int(inputs.get("bpm")),
            "bars": int(inputs.get("bars")),
            "seed": int(inputs.get("seed")),
        },
        "listening": {
            "target": request.target,
            "reviewer": request.reviewer,
            "created_at": created_at,
        },
        "scores": {key: int(request.scores[key]) for key in SCORE_KEYS},
        "notes": {
            "what_worked": request.notes["what_worked"],
            "what_failed": request.notes["what_failed"],
            "next_hint": request.notes["next_hint"],
        },
        "safety": {
            "stores_audio": False,
            "stores_samples": False,
            "metadata_only": True,
            "auto_promotes_pattern_frame": False,
            "writes_live_armed": False,
        },
    }

    out_dir = _safe_score_dir(request.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = now.strftime("%Y%m%dT%H%M%SZ")
    out_path = out_dir / f"{_slug(candidate_id)}-{request.target}-{timestamp}.json"
    if out_path.exists():
        raise FileExistsError(f"refusing to overwrite existing score: {out_path}")
    out_path.write_text(json.dumps(score, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return ScoreResult(out_path=out_path, candidate_id=candidate_id, target=request.target)
