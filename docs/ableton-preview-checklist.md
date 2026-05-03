# Ableton Preview Checklist

Use this checklist before sending a generated `drums.mid` candidate toward EP-133 or any live rig.

`pattern.json` remains the source of truth. `drums.mid` is a compiled listening artifact.

## Generate candidate

Representative command:

```bash
python -m drum_floor generate --style nerdy_jazzy_hiphop --frame deep_neo_soul_pocket --bpm 84 --bars 8 --energy 55 --seed 42 --out live/candidates/ableton-ep133-seed-42
```

Inspect without arming:

```bash
python -m drum_floor inspect live/candidates/ableton-ep133-seed-42
```

## Import into Ableton

1. Open Ableton Live.
2. Create a MIDI track with Drum Rack.
3. Drag `live/candidates/<candidate>/drums.mid` onto the MIDI track.
4. Confirm the clip starts at bar 1 and loops cleanly for the generated length.
5. Set the project BPM to match the candidate BPM in `meta.json` and `pattern.json`.

## Drum Rack pad check

Confirm these preview notes:

- 36: kick
- 37: ghost / side-stick style hit
- 38: snare
- 40: fill / alternate snare
- 42: closed hat
- 49: crash

`crash=49` is intentionally cross-group for Ableton preview. It is not Group A-safe for an EP-133 Group A-only target.

## Musical check

Compare Ableton playback against:

- `preview.txt` for 16-step placement
- `pattern.json` for note, velocity, reason, and micro offset
- `meta.json` for candidate id, style, frame, BPM, bars, energy, and seed

Listen for:

- BPM matches the candidate
- clip length matches generated bars
- kick/snare/hat land as expected
- fill does not over-fire
- crash is intentional
- velocity curve is playable
- microtiming feels like pocket, not accidental flam

## EP-133 pre-send check

Before routing to EP-133:

- confirm the EP-133 receiving channel
- confirm the Ableton track output channel
- confirm pad mapping for Group A `36-47`
- remap or mute `crash=49` before Group A-only use
- do not write to `live/armed/` automatically
- do not modify EP-133 device state directly from OpenClaw or the CLI

## Accept or reject

If the candidate works, a human can arm it manually.

If it does not work, move or copy it to `live/archive/rejected/` through a reviewed human workflow.

The generator and OpenClaw control plane must not arm candidates by themselves.
