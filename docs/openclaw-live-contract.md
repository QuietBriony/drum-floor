# OpenClaw Live Contract

`drum-floor` exposes a future-safe live candidate generation boundary for OpenClaw. OpenClaw is a control plane, not the performer. It may request candidates, inspect outputs, and ask a human to arm one, but it must not directly control Ableton, EP-133, or the live armed slot.

## Command contract

Preferred command:

```bash
python -m drum_floor generate --style mixture_shout --frame riff_shout_floor --bpm 126 --bars 4 --energy 72 --seed 42 --out live/candidates/seed-42
```

Read-only candidate inspection:

```bash
python -m drum_floor inspect live/candidates/seed-42
```

The command is deterministic for the same input arguments and profile JSON. It creates exactly these files in `--out`:

- `pattern.json`
- `drums.mid`
- `preview.txt`
- `meta.json`

It also writes a structured operation log under `live/logs/`.

## Inputs

- `--style`: style profile id from `profiles/groove-profiles.json`
- `--frame`: optional drum pattern frame id from `patterns/drum-pattern-frames.json`; when omitted, the generator selects one by style affinity
- `--bpm`: tempo in BPM, 40-240
- `--bars`: number of 4/4 bars, 1-128
- `--energy`: performance energy, 0-100
- `--seed`: deterministic generation seed
- `--out`: generated candidate output directory

`inspect` takes one positional candidate directory and performs no writes.

`profiles/groove-profiles.json` and `patterns/drum-pattern-frames.json` are the JSON sources of truth. MIDI is a compiled artifact.

## Outputs

- `pattern.json`: source-of-truth candidate pattern with note events and reasons
- `drums.mid`: MIDI rendering of `pattern.json`
- `preview.txt`: human-readable step preview
- `meta.json`: generator metadata and safety flags
- `live/logs/*.json`: operation result log for future OpenClaw inspection

## Writable directories

CLI/OpenClaw may write only to:

- `live/candidates/`
- `live/logs/`
- the explicit generated `--out` directory

## Forbidden writes

CLI/OpenClaw must not:

- overwrite or modify `live/armed/` automatically
- modify Ableton project files
- modify EP-133 device state directly
- write audio recordings or samples
- change `.github/workflows`
- treat MIDI output as the source of truth

## Failure behavior

The generator must fail without partial live arming when:

- required inputs are invalid
- `--style` is unknown
- `--out` points under `live/armed` or `live/archive`
- any fixed output file already exists in `--out`
- profile JSON cannot be read or parsed

On failure, OpenClaw should leave the current live state untouched and report the error to a human.

The CLI returns a non-zero exit code and writes a `generate-failed` log in `live/logs/` when it can safely do so.

## Human-armed workflow

1. OpenClaw requests a candidate under `live/candidates/<candidate-id>/`.
2. A human reviews `preview.txt`, `pattern.json`, and optionally previews `drums.mid` in Ableton.
3. OpenClaw may run `python -m drum_floor inspect <candidate>` to verify fixed outputs and safety metadata.
4. If accepted, a human copies or moves the candidate into `live/armed/`.
5. Rejected candidates may be moved to `live/archive/rejected/` by a human or separate reviewed tooling.
6. OpenClaw never arms a candidate by itself.
