# EP-133 MIDI Map

This map reserves simple drum note ranges for preview and optional performance routing. Ableton remains the preview target first; EP-133 is an optional performance target after human review.

## Note groups

- Group A: notes 36-47
- Group B: notes 48-59
- Group C: notes 60-71
- Group D: notes 72-83

## Default drum-floor preview mapping

The CLI writes General MIDI-style drum notes in the Group A range by default:

- Kick: 36
- Ghost / side-stick style hit: 37
- Snare: 38
- Fill / alternate snare: 40
- Closed hat: 42
- Crash: 49

## Ableton preview to EP-133 optional target

1. Generate a candidate with `python -m drum_floor generate ...`.
2. Open `drums.mid` in Ableton for preview.
3. Check timing, density, fill placement, and energy against `preview.txt` and `pattern.json`.
4. If the candidate works, route or remap the MIDI clip toward EP-133 as an optional target.
5. A human arms the selected candidate before live use.

## Safety boundary

- `pattern.json` is the source of truth.
- `drums.mid` is a compiled artifact.
- Ableton is the preview target.
- EP-133 is an optional performance target.
- OpenClaw must not modify EP-133 device state directly.
