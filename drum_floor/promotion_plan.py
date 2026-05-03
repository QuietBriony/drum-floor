from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .promotion import validate_promotion_request


FRAMES_PATH = Path(__file__).resolve().parents[1] / "patterns" / "drum-pattern-frames.json"


@dataclass(frozen=True)
class PromotionPlanResult:
    request_path: Path
    ok: bool
    errors: list[str]
    warnings: list[str]
    summary: dict[str, Any]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _find_frame(frames_data: dict[str, Any], frame_id: str) -> dict[str, Any] | None:
    frames = frames_data.get("frames")
    if not isinstance(frames, list):
        return None
    for frame in frames:
        if isinstance(frame, dict) and frame.get("id") == frame_id:
            return frame
    return None


def _read_field(root: dict[str, Any], dotted_path: str) -> tuple[bool, Any]:
    current: Any = root
    for part in dotted_path.split("."):
        if not isinstance(current, dict) or part not in current:
            return False, None
        current = current[part]
    return True, current


def _same_value(left: Any, right: Any) -> bool:
    if isinstance(left, (int, float)) and isinstance(right, (int, float)):
        return abs(float(left) - float(right)) < 0.000001
    return left == right


def plan_promotion_request(request_path: Path, require_sources: bool = False) -> PromotionPlanResult:
    validation = validate_promotion_request(request_path, require_sources=require_sources)
    errors = list(validation.errors)
    warnings = list(validation.warnings)
    if not validation.ok:
        return PromotionPlanResult(
            request_path=validation.request_path,
            ok=False,
            errors=errors,
            warnings=warnings,
            summary=validation.summary,
        )

    request = _load_json(validation.request_path)
    frames_data = _load_json(FRAMES_PATH)
    frame_id = str(request["target"]["pattern_frame"])
    target_field = str(request["target"]["field"])
    proposed_from = request["proposed_change"]["from"]
    proposed_to = request["proposed_change"]["to"]

    frame = _find_frame(frames_data, frame_id)
    if frame is None:
        errors.append(f"pattern frame not found: {frame_id}")
        current_value = None
    else:
        found, current_value = _read_field(frame, target_field)
        if not found:
            errors.append(f"target field not found on frame {frame_id}: {target_field}")
            current_value = None
        elif not _same_value(current_value, proposed_from):
            errors.append(
                "promotion request is stale: "
                f"target current value is {current_value!r}, but proposed_change.from is {proposed_from!r}"
            )

    summary = {
        **validation.summary,
        "frames_path": FRAMES_PATH.as_posix(),
        "current_value": current_value,
        "proposed_from": proposed_from,
        "proposed_to": proposed_to,
        "would_write": False,
        "would_promote": False,
        "requires_human_pr": True,
    }
    return PromotionPlanResult(
        request_path=validation.request_path,
        ok=not errors,
        errors=errors,
        warnings=warnings,
        summary=summary,
    )
