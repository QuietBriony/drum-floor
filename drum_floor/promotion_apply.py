from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .promotion_plan import FRAMES_PATH, plan_promotion_request


@dataclass(frozen=True)
class PromotionApplyDryRunResult:
    request_path: Path
    ok: bool
    errors: list[str]
    warnings: list[str]
    summary: dict[str, Any]
    patch_preview: list[str]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _format_value(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def dry_run_apply_promotion_request(request_path: Path, require_sources: bool = False) -> PromotionApplyDryRunResult:
    plan = plan_promotion_request(request_path, require_sources=require_sources)
    if not plan.ok:
        return PromotionApplyDryRunResult(
            request_path=plan.request_path,
            ok=False,
            errors=list(plan.errors),
            warnings=list(plan.warnings),
            summary=plan.summary,
            patch_preview=[],
        )

    request = _load_json(plan.request_path)
    field = str(request["target"]["field"])
    frame_id = str(request["target"]["pattern_frame"])
    from_value = request["proposed_change"]["from"]
    to_value = request["proposed_change"]["to"]
    reason = str(request["proposed_change"]["reason"])

    patch_preview = [
        f"file: {FRAMES_PATH.as_posix()}",
        f"frame: {frame_id}",
        f"field: {field}",
        f"reason: {reason}",
        f"- {field}: {_format_value(from_value)}",
        f"+ {field}: {_format_value(to_value)}",
    ]
    summary = {
        **plan.summary,
        "dry_run": True,
        "would_write": False,
        "would_promote": False,
        "requires_human_pr": True,
        "patch_line_count": len(patch_preview),
    }
    return PromotionApplyDryRunResult(
        request_path=plan.request_path,
        ok=True,
        errors=[],
        warnings=list(plan.warnings),
        summary=summary,
        patch_preview=patch_preview,
    )
