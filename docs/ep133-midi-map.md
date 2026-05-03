# EP-133 MIDI Map

This map reserves simple drum note ranges for preview and optional performance routing. Ableton remains the preview target first; EP-133 is an optional performance target after human review.

## Note groups

- Group A: notes 36-47
- Group B: notes 48-59
- Group C: notes 60-71
- Group D: notes 72-83

## Current generator note map

The CLI currently writes these MIDI notes into `drums.mid`:

- `kick=36`
- `ghost=37`
- `snare=38`
- `fill=40`
- `hat=42`
- `crash=49`

`kick`, `ghost`, `snare`, `fill`, and `hat` are inside EP-133 Group A `36-47`.

`crash=49` is intentionally cross-group. It stays on the General MIDI crash note for Ableton Drum Rack preview, then should be remapped before sending to an EP-133 Group A-only target.

## Ableton Drum Rack preview

Ableton preview should treat `drums.mid` as a compiled artifact for listening, not as the source of truth.

Recommended Drum Rack preview pads:

- 36: kick
- 37: ghost / side-stick style hit
- 38: snare
- 40: fill / alternate snare
- 42: closed hat
- 49: crash

Check that the clip length, BPM, velocities, and microtiming offsets match the musical intent in `pattern.json` and `preview.txt`.

## EP-133 Group A target

For an EP-133 Group A-only target, keep performance notes in `36-47`.

Before sending from Ableton to EP-133:

- keep `kick=36`
- keep `ghost=37`
- keep `snare=38`
- keep `fill=40`
- keep `hat=42`
- remap `crash=49` to an unused Group A pad if crash is needed
- mute or remove `crash=49` if Group A should stay strictly closed

## Ableton preview to EP-133 optional target

1. Generate a candidate with `python -m drum_floor generate ...`.
2. Open `drums.mid` in Ableton for preview.
3. Check timing, density, fill placement, and energy against `preview.txt` and `pattern.json`.
4. If the candidate works, route or remap the MIDI clip toward EP-133 as an optional target.
5. A human arms the selected candidate before live use.

## Channel notes

The generated MIDI file uses channel 10 drum note messages.

Ableton Drum Rack preview usually handles channel 10 naturally after import, but external routing can depend on track and device settings.

When targeting EP-133, confirm the receiving device channel and pad mapping before live use. Do not assume channel 10 will always be the EP-133 performance channel.

## Safety boundary

- `pattern.json` is the source of truth.
- `drums.mid` is a compiled artifact.
- Ableton is the preview target.
- EP-133 is an optional performance target.
- OpenClaw must not modify EP-133 device state directly.
