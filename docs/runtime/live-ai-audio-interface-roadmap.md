# Live AI Audio Interface Roadmap

The long-term target is an AI-assisted band drummer that can listen, predict, and play alongside humans.
This requires clear separation between listening, prediction, groove generation, and output.

## Target loop

1. Audio interface receives band input
2. Input analyzer extracts loudness, onset density, rough space, and section hints
3. Groove predictor proposes profile changes
4. Groove engine generates structure and expression
5. Browser, VCV, MIDI, or DAW output plays the result
6. Human can override or stop immediately

## Model evolution

| Stage | Method | Goal |
| --- | --- | --- |
| `rules` | deterministic mapping | predictable first behavior |
| `assisted` | small model or AI suggestion | better section/fill choices |
| `co-player` | live adaptive generation | follow band energy in real time |

## What must be stable first

- profile schema
- browser preview contract
- input feature contract
- safety flags
- manual override behavior
- no-audio-storage policy

## First live success definition

The first live version is successful if it can:

- listen without storing audio
- estimate rough band energy
- choose a conservative groove profile
- generate a short browser preview
- keep a stable fallback pattern
- avoid runaway fills or loud output

## Not yet

- replacing a human drummer
- uploading rehearsal audio
- training on private recordings by default
- automatic DAW/VCV operation without explicit bridge support
