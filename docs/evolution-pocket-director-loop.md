# Pocket Director Evolution Loop

`drum-floor` evolves by listening, scoring, and proposing small changes. It does not copy recordings, songs, samples, or artist performances.

The "deep pocket director" is an internal decision role: it learns how to leave space, lock to bass, place ghost notes, delay the snare feel, and keep fills meaningful.

## Multi-agent roles

- Builder Agent: adds small docs/json/test slices.
- Reviewer Agent: checks scope, safety, and repo fit.
- Gatekeeper Agent: confirms validation, mergeability, and Return Packet quality.
- Pocket Director Agent: grows the listening vocabulary and suggestion language.

## Human-gated evolution loop

1. Generate a candidate with `python -m drum_floor generate`.
2. Listen in the browser preview or Ableton preview.
3. Score the candidate with the scorecard vocabulary.
4. Store the score as metadata only.
5. Produce an evolution suggestion JSON.
6. Review the suggestion manually.
7. Promote only accepted changes into pattern frames through a separate reviewed PR.

## Non-goals

- Do not auto-overwrite `patterns/drum-pattern-frames.json`.
- Do not write to `live/armed/`.
- Do not store audio, samples, recordings, or waveforms.
- Do not call external AI APIs for this loop.
- Do not operate Ableton, EP-133, or VCV directly.

## Evolution targets

The first evolution targets are Pocket Director fields:

- `space`
- `snare_lag_ms`
- `kick_push_ms`
- `ghost_glue`
- `hat_swing`
- `bass_lock`
- `mix_hints`

The loop can also suggest fill policy language, but it must not change fill policy automatically.

## Score-to-suggestion mapping

- Low `pocket`: reduce grid stiffness, tune snare lag, and review ghost placement.
- Low `space`: increase rest density, reduce hats, or reduce fill demand.
- Low `bass_lock`: adjust kick answers and avoid doubling every bass note.
- Low `ghost_glue`: adjust ghost note density and velocity softness.
- Low `snare_lag_feel`: adjust `snare_lag_ms` in small steps.
- Low `fill_naturalness`: lower fill frequency or shorten fill length.
- Low `mix_weight`: revise kick/snare/hat/crash mix hints.
- Low `repeatability`: reduce randomness or make phrase memory stricter.
- Low `surprise`: add small variation without increasing constant density.

## Promotion workflow

Evolution suggestions are not authoritative.

A human reviews the suggestion, listens again if needed, and decides whether to create a separate pattern-frame update PR.

Promotion must preserve:

- JSON as source of truth
- MIDI as compiled artifact
- Ableton as preview target
- EP-133 as optional performance target
- human arming before live use

## Score CLI

The first implementation slice stores listening scores only.

```bash
python -m drum_floor score live/candidates/ableton-ep133-seed-42 --target ableton --reviewer human-gate --pocket 4 --space 5 --bass-lock 4 --ghost-glue 4 --snare-lag-feel 4 --fill-naturalness 3 --mix-weight 4 --surprise 3 --repeatability 4 --what-worked "Pocket sits well" --what-failed "Fill can be rarer" --next-hint "Reduce fill pressure"
```

By default, score JSON is written under `evolution/listening-notes/`.

This command does not modify candidates, pattern frames, `live/armed/`, Ableton, EP-133, or audio files.

## Suggestion CLI

The next implementation slice reads listening scores and writes a metadata-only suggestion.

```bash
python -m drum_floor suggest-evolution --scores-dir evolution/listening-notes --frame deep_neo_soul_pocket --out evolution/suggestions
```

Suggestions are not promotions.

They must be reviewed by a human before any separate PR updates `patterns/drum-pattern-frames.json`.

See `docs/evolution-promotion-workflow.md` for the human promotion gate.

