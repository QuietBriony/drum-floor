from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

FIXED_OUTPUTS = ("pattern.json", "drums.mid", "preview.txt", "meta.json")


@dataclass(frozen=True)
class InspectResult:
    candidate_dir: Path
    ok: bool
    errors: tuple[str, ...]
    warnings: tuple[str, ...]
    summary: dict[str, Any]


def _read_json(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except Exception as error:
        return None, str(error)


def inspect_candidate(candidate_dir: Path) -> InspectResult:
    root = candidate_dir.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []
    if not root.exists():
        return InspectResult(root, False, ("candidate directory does not exist",), (), {})
    if not root.is_dir():
        return InspectResult(root, False, ("candidate path is not a directory",), (), {})

    for name in FIXED_OUTPUTS:
        path = root / name
        if not path.exists():
            errors.append(f"missing {name}")
        elif not path.is_file():
            errors.append(f"{name} is not a file")

    pattern, pattern_error = _read_json(root / "pattern.json") if (root / "pattern.json").exists() else (None, None)
    meta, meta_error = _read_json(root / "meta.json") if (root / "meta.json").exists() else (None, None)
    if pattern_error:
        errors.append(f"pattern.json parse failed: {pattern_error}")
    if meta_error:
        errors.append(f"meta.json parse failed: {meta_error}")

    if pattern:
        if pattern.get("schema") != "drum-floor.live.pattern.v1":
            errors.append("pattern.json schema mismatch")
        if not isinstance(pattern.get("events"), list):
            errors.append("pattern.json events must be a list")
        if pattern.get("source_of_truth") != "profiles/groove-profiles.json":
            warnings.append("pattern source_of_truth is unexpected")
    if meta:
        if meta.get("schema") != "drum-floor.live.meta.v1":
            errors.append("meta.json schema mismatch")
        safety = meta.get("safety", {})
        if safety.get("writes_armed") is not False:
            errors.append("meta safety writes_armed must be false")
        if safety.get("modifies_ableton_project") is not False:
            errors.append("meta safety modifies_ableton_project must be false")
        if safety.get("modifies_ep133_device") is not False:
            errors.append("meta safety modifies_ep133_device must be false")
        if safety.get("stores_audio") is not False or safety.get("stores_samples") is not False:
            errors.append("meta safety must not store audio or samples")

    pattern_candidate = pattern.get("candidate_id") if pattern else None
    meta_candidate = meta.get("candidate_id") if meta else None
    if pattern_candidate and meta_candidate and pattern_candidate != meta_candidate:
        errors.append("candidate_id mismatch between pattern.json and meta.json")

    midi_path = root / "drums.mid"
    if midi_path.exists() and midi_path.is_file():
        header = midi_path.read_bytes()[:4]
        if header != b"MThd":
            errors.append("drums.mid is not a Standard MIDI file")
        if midi_path.stat().st_size == 0:
            errors.append("drums.mid is empty")

    preview_path = root / "preview.txt"
    if preview_path.exists() and preview_path.is_file() and preview_path.stat().st_size == 0:
        warnings.append("preview.txt is empty")

    summary = {
        "candidate_dir": str(root),
        "candidate_id": pattern_candidate or meta_candidate,
        "style": pattern.get("inputs", {}).get("style") if pattern else None,
        "bpm": pattern.get("inputs", {}).get("bpm") if pattern else None,
        "bars": pattern.get("inputs", {}).get("bars") if pattern else None,
        "energy": pattern.get("inputs", {}).get("energy") if pattern else None,
        "seed": pattern.get("inputs", {}).get("seed") if pattern else None,
        "event_count": len(pattern.get("events", [])) if pattern and isinstance(pattern.get("events"), list) else 0,
        "outputs": list(FIXED_OUTPUTS),
    }
    return InspectResult(root, not errors, tuple(errors), tuple(warnings), summary)
