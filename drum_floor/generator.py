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


@dataclass(frozen=True)
class GenerateResult:
    out_dir: Path
    files: tuple[Path, Path, Path, Path]


def _load_profiles() -> dict[str, Any]:
    with PROFILES_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _profile_by_id(data: dict[str, Any], style: str) -> dict[str, Any]:
    for profile in data.get("profiles", []):
        if profile.get("id") == style:
            return profile
    known = ", ".join(profile.get("id", "?") for profile in data.get("profiles", []))
    raise ValueError(f"unknown style '{style}'. known styles: {known}")


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


def _add_event(events: list[dict[str, Any]], bar: int, step: int, part: str, velocity: int, reason: str) -> None:
    step = max(0, min(15, int(step)))
    velocity = max(1, min(127, int(velocity)))
    if any(event["bar"] == bar and event["step"] == step and event["part"] == part for event in events):
        return
    events.append({
        "bar": bar,
        "step": step,
        "part": part,
        "note": NOTE_MAP[part],
        "velocity": velocity,
        "duration_steps": 1 if part in {"hat", "ghost"} else 2,
        "reason": reason,
    })


def _generate_events(profile: dict[str, Any], request: GenerateRequest) -> list[dict[str, Any]]:
    rng = random.Random(f"{request.style}:{request.seed}:{request.bpm}:{request.bars}:{request.energy}")
    events: list[dict[str, Any]] = []
    style_density = _density_value(profile.get("feel_profile", {}).get("density"))
    energy = request.energy / 100
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
        half_time = request.style == "dubby_half_time" or (section == "bridge" and energy < 0.45)
        fill_now = bar in fill_bars
        phrase_end = bar % 8 == 7 or bar == request.bars - 1
        pre_lift_gap = phrase_end and energy >= 0.62 and not fill_now

        _add_event(events, bar, 0, "kick", 86 + round(energy * 26), "downbeat anchor")
        _add_event(events, bar, 8 if half_time else 4, "snare", 82 + round(energy * 24), "half-time backbeat" if half_time else "backbeat")
        if not half_time and not pre_lift_gap:
            _add_event(events, bar, 12, "snare", 80 + round(energy * 24), "backbeat return")
        if density > 0.38 and not pre_lift_gap:
            _add_event(events, bar, 8, "kick", 66 + round(energy * 18), "mid-bar anchor")
        if density > 0.58 and rng.random() < density:
            _add_event(events, bar, rng.choice([3, 7, 10, 11, 15]), "kick", 54 + round(energy * 20), "density response")

        hat_steps = [0, 4, 8, 12] if density < 0.36 or pre_lift_gap else [0, 2, 4, 6, 8, 10, 12, 14]
        if density > 0.72 and request.style in {"mixture_shout", "breakbeat_live", "rock_heavy"}:
            hat_steps = list(range(16))
        for step in hat_steps:
            _add_event(events, bar, step, "hat", 42 + round(density * 32) + (10 if step % 4 == 0 else 0), "timekeeper")

        ghost_density = _density_value(profile.get("ghost_notes_policy", {}).get("section_density", {}).get(section))
        for step in [3, 5, 7, 11, 13, 14]:
            if rng.random() < ghost_density * density * 0.42 and not pre_lift_gap:
                _add_event(events, bar, step, "ghost", 24 + round(rng.random() * 28), "human ghost texture")

        if fill_now:
            fill_steps = [12, 13, 14, 15] if energy > 0.62 and "long" in profile.get("fill_policy", {}).get("types", []) else [14, 15]
            for index, step in enumerate(fill_steps):
                _add_event(events, bar, step, "fill", 62 + round(energy * 36) + index * 3, "rare transition fill")
        if bar == 0 or fill_now and phrase_end or section in {"chorus", "end"} and rng.random() < energy * 0.18:
            _add_event(events, bar, 0 if not fill_now else 15, "crash", 70 + round(energy * 28), "section release")

    return sorted(events, key=lambda event: (event["bar"], event["step"], event["part"]))


def _preview_text(pattern: dict[str, Any]) -> str:
    lines = [
        "drum-floor live candidate preview",
        f"style={pattern['inputs']['style']} bpm={pattern['inputs']['bpm']} bars={pattern['inputs']['bars']} energy={pattern['inputs']['energy']} seed={pattern['inputs']['seed']}",
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
    profile = _profile_by_id(data, request.style)
    out_dir.mkdir(parents=True, exist_ok=True)
    _ensure_output_is_new(out_dir)

    events = _generate_events(profile, request)
    created_at = datetime.now(timezone.utc).isoformat()
    pattern = {
        "schema": "drum-floor.live.pattern.v1",
        "source_of_truth": "profiles/groove-profiles.json",
        "inputs": {
            "style": request.style,
            "bpm": request.bpm,
            "bars": request.bars,
            "energy": request.energy,
            "seed": request.seed,
        },
        "profile": {
            "id": profile.get("id"),
            "label": profile.get("label"),
        },
        "events": events,
    }
    meta = {
        "schema": "drum-floor.live.meta.v1",
        "created_at": created_at,
        "generator": "python -m drum_floor generate",
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
    return GenerateResult(out_dir=out_dir, files=(pattern_path, midi_path, preview_path, meta_path))
