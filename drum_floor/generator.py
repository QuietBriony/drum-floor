from __future__ import annotations

import json
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .midi import write_midi

REPO_ROOT = Path(__file__).resolve().parents[1]
PROFILES_PATH = REPO_ROOT / "profiles" / "groove-profiles.json"
PATTERN_FRAMES_PATH = REPO_ROOT / "patterns" / "drum-pattern-frames.json"
LIVE_ROOT = REPO_ROOT / "live"
FIXED_OUTPUTS = ("pattern.json", "drums.mid", "preview.txt", "meta.json")
NOTE_MAP = {
    "kick": 36,
    "snare": 38,
    "hat": 42,
    "ghost": 37,
    "fill": 40,
    "crash": 49,
}


@dataclass(frozen=True)
class GenerateRequest:
    style: str
    bpm: int
    bars: int
    energy: int
    seed: int
    out: Path
    frame: str | None = None


@dataclass(frozen=True)
class GenerateResult:
    out_dir: Path
    files: tuple[Path, Path, Path, Path]
    candidate_id: str
    frame_id: str


def _load_profiles() -> dict[str, Any]:
    with PROFILES_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _load_pattern_frames() -> dict[str, Any]:
    with PATTERN_FRAMES_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _profile_by_id(data: dict[str, Any], style: str) -> dict[str, Any]:
    for profile in data.get("profiles", []):
        if profile.get("id") == style:
            return profile
    known = ", ".join(profile.get("id", "?") for profile in data.get("profiles", []))
    raise ValueError(f"unknown style '{style}'. known styles: {known}")


def _select_frame(data: dict[str, Any], style: str, frame_id: str | None) -> tuple[dict[str, Any], str]:
    frames = data.get("frames", [])
    if frame_id:
        for frame in frames:
            if frame.get("id") == frame_id:
                return frame, "requested"
        known = ", ".join(frame.get("id", "?") for frame in frames)
        raise ValueError(f"unknown frame '{frame_id}'. known frames: {known}")
    for frame in frames:
        if style in frame.get("style_affinity", []):
            return frame, f"auto style_affinity:{style}"
    if frames:
        return frames[0], "auto fallback:first_frame"
    raise ValueError("no drum pattern frames are defined")


def _validate_request(request: GenerateRequest) -> None:
    if not 40 <= request.bpm <= 240:
        raise ValueError("--bpm must be between 40 and 240")
    if not 1 <= request.bars <= 128:
        raise ValueError("--bars must be between 1 and 128")
    if not 0 <= request.energy <= 100:
        raise ValueError("--energy must be between 0 and 100")


def _safe_out_dir(out: Path) -> Path:
    resolved = out.expanduser().resolve()
    armed = (LIVE_ROOT / "armed").resolve()
    archive = (LIVE_ROOT / "archive").resolve()
    if resolved == armed or armed in resolved.parents:
        raise ValueError("refusing to write under live/armed; humans must arm candidates manually")
    if resolved == archive or archive in resolved.parents:
        raise ValueError("refusing to write under live/archive; use live/candidates or another generated out dir")
    return resolved


def _candidate_id(request: GenerateRequest, out_dir: Path) -> str:
    out_name = out_dir.name or "candidate"
    return f"{out_name}-{request.style}-{request.bpm}bpm-{request.bars}bars-seed{request.seed}"


def _ensure_output_is_new(out_dir: Path) -> None:
    collisions = [name for name in FIXED_OUTPUTS if (out_dir / name).exists()]
    if collisions:
        raise FileExistsError(f"refusing to overwrite existing generated files: {', '.join(collisions)}")


def _density_value(value: str | int | float | None) -> float:
    mapping = {
        "low": 0.25,
        "low_to_mid": 0.4,
        "medium": 0.58,
        "high_to_mid": 0.72,
        "high": 0.88,
    }
    if isinstance(value, (int, float)):
        return max(0.0, min(1.0, float(value)))
    return mapping.get(str(value), 0.55)


def _clamp01(value: Any, default: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _section_for_bar(bar_index: int, bars: int) -> str:
    if bars <= 2:
        return "chorus"
    position = bar_index / max(1, bars - 1)
    if position < 0.28:
        return "verse"
    if position < 0.68:
        return "chorus"
    if position < 0.9:
        return "bridge"
    return "end"


def _add_event(
    events: list[dict[str, Any]],
    bar: int,
    step: int,
    part: str,
    velocity: int,
    reason: str,
    micro_offset_ms: int = 0,
    frame_role: str | None = None,
) -> None:
    step = max(0, min(15, int(step)))
    velocity = max(1, min(127, int(velocity)))
    if any(event["bar"] == bar and event["step"] == step and event["part"] == part for event in events):
        return
    event = {
        "bar": bar,
        "step": step,
        "part": part,
        "note": NOTE_MAP[part],
        "velocity": velocity,
        "duration_steps": 1 if part in {"hat", "ghost"} else 2,
        "reason": reason,
    }
    if micro_offset_ms:
        event["micro_offset_ms"] = int(micro_offset_ms)
    if frame_role:
        event["frame_role"] = frame_role
    events.append(event)


def _template_steps(step_value: Any) -> list[int]:
    if isinstance(step_value, int):
        return [step_value]
    mapping = {
        "even_8ths": [0, 4, 8, 12],
        "steady_8ths": [0, 4, 8, 12],
        "sparse_8ths": [0, 8, 12],
        "broken_16ths": [0, 3, 4, 7, 10, 12, 14],
        "swung_8ths_with_16th_pickups": [0, 3, 4, 7, 8, 11, 12, 15],
    }
    return mapping.get(str(step_value), [])


def _frame_offset(part: str, step: int, director: dict[str, Any]) -> int:
    snare_lag = int(director.get("snare_lag_ms") or 0)
    kick_push = int(director.get("kick_push_ms") or 0)
    hat_swing = _clamp01(director.get("hat_swing"), 0.0)
    if part == "kick":
        return kick_push
    if part in {"snare", "fill"}:
        return snare_lag
    if part == "ghost":
        return round(snare_lag * 0.7)
    if part == "hat" and step % 4:
        return round(hat_swing * 8)
    return 0


def _frame_velocity(part: str, energy: float, density: float) -> int:
    base = {
        "kick": 78,
        "snare": 76,
        "hat": 42,
        "ghost": 24,
        "fill": 62,
        "crash": 70,
    }.get(part, 60)
    return base + round(energy * 26) + round(density * 10)


def _apply_frame_template(
    events: list[dict[str, Any]],
    frame: dict[str, Any],
    bar: int,
    section: str,
    energy: float,
    density: float,
    fill_now: bool,
    phrase_end: bool,
) -> None:
    director = frame.get("pocket_director", {})
    frame_id = frame.get("id", "frame")
    for part, entries in frame.get("structure_template", {}).items():
        if part not in NOTE_MAP or not isinstance(entries, list):
            continue
        if part == "fill" and not fill_now:
            continue
        if part == "crash" and not (bar == 0 or fill_now and phrase_end or section == "end" and phrase_end):
            continue
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            role = str(entry.get("role") or "frame")
            for step in _template_steps(entry.get("step")):
                _add_event(
                    events,
                    bar,
                    step,
                    part,
                    _frame_velocity(part, energy, density),
                    f"frame:{frame_id}:{role}",
                    micro_offset_ms=_frame_offset(part, step, director),
                    frame_role=role,
                )


def _generate_events(profile: dict[str, Any], frame: dict[str, Any], request: GenerateRequest) -> list[dict[str, Any]]:
    frame_id = frame.get("id", "frame")
    rng = random.Random(f"{request.style}:{frame_id}:{request.seed}:{request.bpm}:{request.bars}:{request.energy}")
    events: list[dict[str, Any]] = []
    style_density = _density_value(profile.get("feel_profile", {}).get("density"))
    energy = request.energy / 100
    director = frame.get("pocket_director", {})
    space = _clamp01(director.get("space"), 0.5)
    ghost_glue = _clamp01(director.get("ghost_glue"), 0.0)
    kick_push = int(director.get("kick_push_ms") or 0)
    snare_lag = int(director.get("snare_lag_ms") or 0)
    hat_swing = _clamp01(director.get("hat_swing"), 0.0)
    max_fills = int(profile.get("fill_policy", {}).get("max_per_8_bars", 1))
    fill_budget = max(0, min(max_fills, round(max_fills * (0.25 + energy * 0.6))))
    fill_bars = set()
    if fill_budget:
        candidates = sorted(range(request.bars), key=lambda bar: (bar % 8 == 7, bar == request.bars - 1, rng.random()), reverse=True)
        fill_bars = set(candidates[: max(1, min(fill_budget, request.bars))])

    for bar in range(request.bars):
        section = _section_for_bar(bar, request.bars)
        section_profile = profile.get("section_profile", {}).get(section, {})
        section_density = _density_value(section_profile.get("density"))
        density = max(0.1, min(1.0, style_density * 0.45 + section_density * 0.25 + energy * 0.3))
        density = max(0.1, min(1.0, density * (1.0 - space * 0.18) + (1.0 - space) * 0.08))
        half_time = request.style == "dubby_half_time" or (section == "bridge" and energy < 0.45)
        fill_now = bar in fill_bars
        phrase_end = bar % 8 == 7 or bar == request.bars - 1
        pre_lift_gap = phrase_end and energy >= 0.62 and not fill_now

        _apply_frame_template(events, frame, bar, section, energy, density, fill_now, phrase_end)

        _add_event(events, bar, 0, "kick", 86 + round(energy * 26), "downbeat anchor", micro_offset_ms=kick_push)
        _add_event(events, bar, 8 if half_time else 4, "snare", 82 + round(energy * 24), "half-time backbeat" if half_time else "backbeat", micro_offset_ms=snare_lag)
        if not half_time and not pre_lift_gap:
            _add_event(events, bar, 12, "snare", 80 + round(energy * 24), "backbeat return", micro_offset_ms=snare_lag)
        if density > 0.38 and not pre_lift_gap:
            _add_event(events, bar, 8, "kick", 66 + round(energy * 18), "mid-bar anchor", micro_offset_ms=kick_push)
        if density > 0.58 and rng.random() < density:
            _add_event(events, bar, rng.choice([3, 7, 10, 11, 15]), "kick", 54 + round(energy * 20), "density response", micro_offset_ms=kick_push)

        hat_steps = [0, 4, 8, 12] if density < 0.36 or pre_lift_gap else [0, 2, 4, 6, 8, 10, 12, 14]
        if density > 0.72 and request.style in {"mixture_shout", "breakbeat_live", "rock_heavy"}:
            hat_steps = list(range(16))
        for step in hat_steps:
            hat_offset = round(hat_swing * 8) if step % 4 else 0
            _add_event(events, bar, step, "hat", 42 + round(density * 32) + (10 if step % 4 == 0 else 0), "timekeeper", micro_offset_ms=hat_offset)

        ghost_density = _density_value(profile.get("ghost_notes_policy", {}).get("section_density", {}).get(section))
        ghost_density = max(ghost_density, ghost_glue * 0.9)
        for step in [3, 5, 7, 11, 13, 14]:
            if rng.random() < ghost_density * density * 0.42 and not pre_lift_gap:
                _add_event(events, bar, step, "ghost", 24 + round(rng.random() * 28), "human ghost texture", micro_offset_ms=round(snare_lag * 0.7))

        if fill_now:
            fill_steps = [12, 13, 14, 15] if energy > 0.62 and "long" in profile.get("fill_policy", {}).get("types", []) else [14, 15]
            for index, step in enumerate(fill_steps):
                _add_event(events, bar, step, "fill", 62 + round(energy * 36) + index * 3, "rare transition fill", micro_offset_ms=snare_lag)
        if bar == 0 or fill_now and phrase_end or section in {"chorus", "end"} and rng.random() < energy * 0.18:
            _add_event(events, bar, 0 if not fill_now else 15, "crash", 70 + round(energy * 28), "section release")

    return sorted(events, key=lambda event: (event["bar"], event["step"], event["part"]))


def _preview_text(pattern: dict[str, Any]) -> str:
    lines = [
        "drum-floor live candidate preview",
        f"style={pattern['inputs']['style']} frame={pattern['inputs'].get('frame', '-')} bpm={pattern['inputs']['bpm']} bars={pattern['inputs']['bars']} energy={pattern['inputs']['energy']} seed={pattern['inputs']['seed']}",
        "legend: K=kick S=snare H=hat G=ghost F=fill C=crash",
        "",
    ]
    for bar in range(pattern["inputs"]["bars"]):
        cells: list[str] = []
        for step in range(16):
            parts = [event["part"][0].upper() for event in pattern["events"] if event["bar"] == bar and event["step"] == step]
            cells.append("".join(parts) or ".")
        lines.append(f"bar {bar + 1:02d}: " + " ".join(f"{cell:2s}" for cell in cells))
    return "\n".join(lines) + "\n"


def generate_candidate(request: GenerateRequest) -> GenerateResult:
    _validate_request(request)
    out_dir = _safe_out_dir(request.out)
    data = _load_profiles()
    frames_data = _load_pattern_frames()
    profile = _profile_by_id(data, request.style)
    frame, frame_reason = _select_frame(frames_data, request.style, request.frame)
    frame_id = str(frame.get("id"))
    out_dir.mkdir(parents=True, exist_ok=True)
    _ensure_output_is_new(out_dir)
    candidate_id = _candidate_id(request, out_dir)

    events = _generate_events(profile, frame, request)
    created_at = datetime.now(timezone.utc).isoformat()
    pattern = {
        "schema": "drum-floor.live.pattern.v1",
        "candidate_id": candidate_id,
        "source_of_truth": "profiles/groove-profiles.json",
        "sources": {
            "style_profiles": "profiles/groove-profiles.json",
            "pattern_frames": "patterns/drum-pattern-frames.json",
        },
        "inputs": {
            "style": request.style,
            "frame": frame_id,
            "bpm": request.bpm,
            "bars": request.bars,
            "energy": request.energy,
            "seed": request.seed,
        },
        "profile": {
            "id": profile.get("id"),
            "label": profile.get("label"),
        },
        "pattern_frame": {
            "id": frame_id,
            "label": frame.get("label"),
            "description": frame.get("description"),
            "feel_tags": frame.get("feel_tags", []),
        },
        "pocket_director": frame.get("pocket_director", {}),
        "mix_hints": frame.get("pocket_director", {}).get("mix_hints", {}),
        "frame_reason": frame_reason,
        "events": events,
    }
    meta = {
        "schema": "drum-floor.live.meta.v1",
        "candidate_id": candidate_id,
        "created_at": created_at,
        "generator": "python -m drum_floor generate",
        "inputs": pattern["inputs"],
        "pattern_frame": pattern["pattern_frame"],
        "frame_reason": frame_reason,
        "outputs": list(FIXED_OUTPUTS),
        "safety": {
            "stores_audio": False,
            "stores_samples": False,
            "writes_armed": False,
            "modifies_ableton_project": False,
            "modifies_ep133_device": False,
        },
    }

    pattern_path = out_dir / "pattern.json"
    midi_path = out_dir / "drums.mid"
    preview_path = out_dir / "preview.txt"
    meta_path = out_dir / "meta.json"
    pattern_path.write_text(json.dumps(pattern, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_midi(midi_path, events, bpm=request.bpm)
    preview_path.write_text(_preview_text(pattern), encoding="utf-8")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return GenerateResult(out_dir=out_dir, files=(pattern_path, midi_path, preview_path, meta_path), candidate_id=candidate_id, frame_id=frame_id)
