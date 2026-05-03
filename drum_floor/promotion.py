from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROMOTION_SCHEMA = "drum-floor.evolution.promotion-request.v1"
LISTENING_SCORE_SCHEMA = "drum-floor.evolution.listening-score.v1"
SUGGESTION_SCHEMA = "drum-floor.evolution.suggestion.v1"
SAFE_SCORE_ROOT = Path("evolution/listening-notes")
SAFE_SUGGESTION_ROOT = Path("evolution/suggestions")
FORBIDDEN_PATH_PARTS = {
    "audio",
    "samples",
    "sample",
    ".github",
    "workflows",
    "live",
    "armed",
}
EXPECTED_SAFETY = {
    "metadata_only": True,
    "auto_promotes_pattern_frame": False,
    "writes_live_armed": False,
    "adds_audio": False,
    "adds_samples": False,
    "adds_dependencies": False,
    "touches_workflows": False,
}


@dataclass(frozen=True)
class PromotionValidationResult:
    request_path: Path
    ok: bool
    errors: list[str]
    warnings: list[str]
    summary: dict[str, Any]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _require_object(value: Any, label: str, errors: list[str]) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    errors.append(f"{label} must be an object")
    return {}


def _require_text(value: Any, label: str, errors: list[str]) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    errors.append(f"{label} must be a non-empty string")
    return ""


def _safe_relative_path(value: str, label: str, expected_root: Path, errors: list[str]) -> Path:
    path = Path(value)
    if path.is_absolute():
        errors.append(f"{label} must be repo-relative: {value}")
        return path
    parts = {part.lower() for part in path.parts}
    if parts & FORBIDDEN_PATH_PARTS:
        errors.append(f"{label} points at a forbidden path: {value}")
    normalized = Path(*path.parts) if path.parts else path
    expected_parts = tuple(expected_root.parts)
    if tuple(normalized.parts[:len(expected_parts)]) != expected_parts:
        errors.append(f"{label} must live under {expected_root.as_posix()}: {value}")
    return normalized


def _validate_source_file(path: Path, expected_schema: str, label: str, errors: list[str], warnings: list[str], require_sources: bool) -> None:
    if not path.exists():
        message = f"{label} not found: {path}"
        if require_sources:
            errors.append(message)
        else:
            warnings.append(message)
        return
    try:
        data = _load_json(path)
    except Exception as error:
        errors.append(f"{label} is not valid JSON: {path} ({error})")
        return
    if not isinstance(data, dict):
        errors.append(f"{label} must contain a JSON object: {path}")
        return
    if data.get("schema") != expected_schema:
        errors.append(f"{label} schema must be {expected_schema}: {path}")


def validate_promotion_request(request_path: Path, require_sources: bool = False) -> PromotionValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    path = request_path.expanduser()
    try:
        request = _load_json(path)
    except Exception as error:
        return PromotionValidationResult(
            request_path=path,
            ok=False,
            errors=[f"promotion request is not valid JSON: {error}"],
            warnings=[],
            summary={},
        )

    data = _require_object(request, "promotion request", errors)
    if data.get("schema") != PROMOTION_SCHEMA:
        errors.append(f"schema must be {PROMOTION_SCHEMA}")

    reviewer = _require_text(data.get("reviewer"), "reviewer", errors)
    source = _require_object(data.get("source"), "source", errors)
    target = _require_object(data.get("target"), "target", errors)
    proposed_change = _require_object(data.get("proposed_change"), "proposed_change", errors)
    human_review = _require_object(data.get("human_review"), "human_review", errors)
    safety = _require_object(data.get("safety"), "safety", errors)
    rollback = _require_object(data.get("rollback"), "rollback", errors)

    score_files = source.get("score_files")
    if not isinstance(score_files, list) or not score_files:
        errors.append("source.score_files must contain at least one score file")
        score_files = []
    suggestion_file = _require_text(source.get("suggestion_file"), "source.suggestion_file", errors)
    pattern_frame = _require_text(target.get("pattern_frame"), "target.pattern_frame", errors)
    target_field = _require_text(target.get("field"), "target.field", errors)
    reason = _require_text(proposed_change.get("reason"), "proposed_change.reason", errors)
    musical_intent = _require_text(human_review.get("musical_intent"), "human_review.musical_intent", errors)
    listening_summary = _require_text(human_review.get("listening_summary"), "human_review.listening_summary", errors)
    acceptance_condition = _require_text(human_review.get("acceptance_condition"), "human_review.acceptance_condition", errors)
    rollback_strategy = _require_text(rollback.get("strategy"), "rollback.strategy", errors)

    for key, expected in EXPECTED_SAFETY.items():
        if safety.get(key) is not expected:
            errors.append(f"safety.{key} must be {str(expected).lower()}")

    repo_root = Path(__file__).resolve().parents[1]
    safe_score_files: list[str] = []
    for index, score_file in enumerate(score_files):
        if not isinstance(score_file, str) or not score_file.strip():
            errors.append(f"source.score_files[{index}] must be a non-empty string")
            continue
        relative = _safe_relative_path(score_file.strip(), f"source.score_files[{index}]", SAFE_SCORE_ROOT, errors)
        safe_score_files.append(relative.as_posix())
        _validate_source_file(repo_root / relative, LISTENING_SCORE_SCHEMA, f"source.score_files[{index}]", errors, warnings, require_sources)

    safe_suggestion_file = ""
    if suggestion_file:
        relative = _safe_relative_path(suggestion_file, "source.suggestion_file", SAFE_SUGGESTION_ROOT, errors)
        safe_suggestion_file = relative.as_posix()
        _validate_source_file(repo_root / relative, SUGGESTION_SCHEMA, "source.suggestion_file", errors, warnings, require_sources)

    summary = {
        "reviewer": reviewer,
        "pattern_frame": pattern_frame,
        "target_field": target_field,
        "score_files": safe_score_files,
        "suggestion_file": safe_suggestion_file,
        "reason": reason,
        "musical_intent": musical_intent,
        "listening_summary": listening_summary,
        "acceptance_condition": acceptance_condition,
        "rollback_strategy": rollback_strategy,
        "metadata_only": safety.get("metadata_only") is True,
        "auto_promotes_pattern_frame": safety.get("auto_promotes_pattern_frame") is True,
        "writes_live_armed": safety.get("writes_live_armed") is True,
    }
    return PromotionValidationResult(
        request_path=path,
        ok=not errors,
        errors=errors,
        warnings=warnings,
        summary=summary,
    )
