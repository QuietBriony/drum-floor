from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .scoring import SCORE_KEYS

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCORE_DIR = REPO_ROOT / "evolution" / "listening-notes"
DEFAULT_SUGGESTION_DIR = REPO_ROOT / "evolution" / "suggestions"


@dataclass(frozen=True)
class SuggestionRequest:
    scores_dir: Path = DEFAULT_SCORE_DIR
    out: Path = DEFAULT_SUGGESTION_DIR
    frame: str | None = None
    agent: str = "pocket-director-agent"


@dataclass(frozen=True)
class SuggestionResult:
    out_path: Path
    score_count: int
    frame: str


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _slug(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-") or "suggestion"


def _safe_out_dir(out: Path) -> Path:
    directory = out.expanduser().resolve()
    armed = (REPO_ROOT / "live" / "armed").resolve()
    if directory == armed or armed in directory.parents:
        raise ValueError("refusing to write evolution suggestions under live/armed")
    return directory


def _score_files(scores_dir: Path) -> list[Path]:
    root = scores_dir.expanduser().resolve()
    if not root.exists():
        raise ValueError(f"scores directory does not exist: {root}")
    if not root.is_dir():
        raise ValueError(f"scores path is not a directory: {root}")
    return sorted(path for path in root.glob("*.json") if path.is_file())


def _load_scores(scores_dir: Path, frame: str | None) -> list[dict[str, Any]]:
    scores: list[dict[str, Any]] = []
    for path in _score_files(scores_dir):
        data = _read_json(path)
        if data.get("schema") != "drum-floor.evolution.listening-score.v1":
            continue
        candidate_frame = data.get("candidate", {}).get("frame")
        if frame and candidate_frame != frame:
            continue
        scores.append(data)
    if not scores:
        frame_note = f" for frame {frame}" if frame else ""
        raise ValueError(f"no listening score JSON files found{frame_note}")
    return scores


def _average_scores(scores: list[dict[str, Any]]) -> dict[str, float]:
    averages: dict[str, float] = {}
    for key in SCORE_KEYS:
        values = [float(score["scores"][key]) for score in scores]
        averages[key] = round(sum(values) / len(values), 3)
    return averages


def _clamp_delta(value: float, minimum: float, maximum: float) -> float:
    return round(max(minimum, min(maximum, value)), 3)


def _build_suggestion(averages: dict[str, float]) -> dict[str, Any]:
    reasons: list[str] = []
    suggestion = {
        "space_delta": 0.0,
        "snare_lag_ms_delta": 0,
        "kick_push_ms_delta": 0,
        "ghost_glue_delta": 0.0,
        "hat_swing_delta": 0.0,
        "fill_policy_hint": "keep current fill policy",
        "mix_hint_change": "keep current mix hints",
        "reasons": reasons,
    }

    if averages["space"] < 3.5:
        suggestion["space_delta"] = 0.04
        reasons.append("space score is low; leave more air before adding density")
    elif averages["space"] > 4.5 and averages["repeatability"] >= 4:
        suggestion["space_delta"] = -0.02
        reasons.append("space is strong and repeatable; allow a little more movement")

    if averages["snare_lag_feel"] < 3.5:
        suggestion["snare_lag_ms_delta"] = 2 if averages["pocket"] < 4 else -1
        reasons.append("snare lag feel needs a small timing adjustment")

    if averages["bass_lock"] < 3.5:
        suggestion["kick_push_ms_delta"] = -1
        reasons.append("bass lock is weak; push kick answers slightly forward")

    if averages["ghost_glue"] < 3.5:
        suggestion["ghost_glue_delta"] = 0.05
        reasons.append("ghost glue is weak; add a little connective texture")
    elif averages["ghost_glue"] > 4.5 and averages["space"] < 3.5:
        suggestion["ghost_glue_delta"] = -0.04
        reasons.append("ghost glue is high but space is low; thin ghost density")

    if averages["surprise"] < 3.5 and averages["repeatability"] >= 3.5:
        suggestion["hat_swing_delta"] = 0.03
        reasons.append("surprise is low; add small hat movement without changing the frame")

    if averages["fill_naturalness"] < 3.5:
        suggestion["fill_policy_hint"] = "reduce fill frequency or shorten fills before section returns"
        reasons.append("fills need to be rarer or shorter")

    if averages["mix_weight"] < 3.5:
        suggestion["mix_hint_change"] = "rebalance kick/snare weight before changing pattern density"
        reasons.append("mix weight is weak; prefer tone/balance change before note density change")

    suggestion["space_delta"] = _clamp_delta(float(suggestion["space_delta"]), -0.08, 0.08)
    suggestion["ghost_glue_delta"] = _clamp_delta(float(suggestion["ghost_glue_delta"]), -0.08, 0.08)
    suggestion["hat_swing_delta"] = _clamp_delta(float(suggestion["hat_swing_delta"]), -0.08, 0.08)
    if not reasons:
        reasons.append("scores are stable; keep current frame and gather more listening notes")
    return suggestion


def suggest_evolution(request: SuggestionRequest) -> SuggestionResult:
    scores = _load_scores(request.scores_dir, request.frame)
    averages = _average_scores(scores)
    first_frame = str(scores[0].get("candidate", {}).get("frame") or "mixed-frames")
    frame = request.frame or first_frame
    now = datetime.now(timezone.utc)
    created_at = now.isoformat().replace("+00:00", "Z")
    suggestion = {
        "schema": "drum-floor.evolution.suggestion.v1",
        "created_at": created_at,
        "agent": request.agent,
        "source": {
            "scores_dir": str(request.scores_dir),
            "score_count": len(scores),
            "frame_filter": request.frame,
        },
        "target": {
            "frame": frame,
        },
        "averages": averages,
        "suggestion": _build_suggestion(averages),
        "safety": {
            "stores_audio": False,
            "stores_samples": False,
            "metadata_only": True,
            "auto_promotes_pattern_frame": False,
            "writes_live_armed": False,
            "requires_human_promotion": True,
        },
    }
    out_dir = _safe_out_dir(request.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{_slug(frame)}-{now.strftime('%Y%m%dT%H%M%SZ')}.json"
    if out_path.exists():
        raise FileExistsError(f"refusing to overwrite existing suggestion: {out_path}")
    out_path.write_text(json.dumps(suggestion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return SuggestionResult(out_path=out_path, score_count=len(scores), frame=frame)
