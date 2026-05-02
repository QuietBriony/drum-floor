# Drum Pattern Frame Contract

`drum-floor` uses drum pattern frames as a reusable layer between style profiles and generated bars.

This keeps the system focused on original groove behavior rather than copying recordings, songs, samples, or artist performances.

## Purpose

- Define reusable pattern shapes before runtime implementation grows.
- Give the generator a pocket-aware layer for space, lag, push, ghost glue, bass lock, and mix intent.
- Keep JSON as the source of truth.
- Keep MIDI as a compiled artifact.
- Keep browser sound as Web Audio synthesis first.
- Keep normal audio source playback as a later, optional contract.

## Generation flow

1. `style_profile` selects the broad vocabulary.
2. `manual_intent` sets current section, energy, risk, space, fill demand, and live controls.
3. `pocket_director` decides how the drummer should sit inside the band.
4. `pattern_frame` provides a reusable bar-level skeleton and behavior hints.
5. `generated_bar` compiles actual kick, snare, hat, ghost, fill, and crash events.

## Pocket Director fields

- `space`: how much room the drummer leaves for vocal, bass, guitar, and section drama.
- `snare_lag_ms`: how late the snare feels against the grid.
- `kick_push_ms`: how much the kick leans forward when supporting bass pressure.
- `ghost_glue`: how much ghost-note texture connects the groove without increasing obvious density.
- `hat_swing`: how strongly hats imply pocket and subdivision feel.
- `bass_lock`: text rule for kick/bass relationship.
- `mix_hints`: renderer-facing suggestions for synthesized tone and balance.

## Frame behavior

Pattern frames are not final drum loops.

They are decision templates that can be stretched by section, energy, manual controls, phrase memory, and future audio input features.

A generated bar may add, remove, delay, soften, or mute events from the frame when the co-player decides to wait, answer, lift, drop, or recover.

## Audio direction

The first playback target remains Web Audio synthesis and MIDI.

The repository must not add committed audio files or samples for this layer.

Future normal audio source playback should be defined through an `audio_source_profile` contract that references user-provided or local-only kits without committing the audio assets.

## Safety

- Do not copy a living artist's songs, grooves, samples, recordings, or performance data.
- Use influence-level vocabulary only, such as pocket, space, lag, ghost glue, and mix intent.
- Do not add samples or audio files.
- Do not add dependencies for this layer.
- Do not write to `live/armed/` automatically.
- Do not modify Ableton project files or EP-133 device state directly.

## CLI contract

Generate with an explicit pattern frame:

```bash
python -m drum_floor generate --style nerdy_jazzy_hiphop --frame deep_neo_soul_pocket --bpm 84 --bars 8 --energy 55 --seed 42 --out live/candidates/pocket-seed-42
```

Generated metadata includes:

- `frame_id`
- `pocket_director`
- `mix_hints`
- `frame_reason`

If `--frame` is omitted, the generator selects the first frame whose `style_affinity` includes the requested style.

## Future UI contract

The browser UI may expose:

- pattern frame selector
- pocket director summary
- space / ghost glue / bass lock meters
- mix hints for synthesized kick, snare, hat, room, and crash distance
- explanation of why the current bar waited, answered, lifted, dropped, or recovered
