# Future Runtime Contract v1

This document defines the future runtime boundary without implementing it.
`drum-floor` remains docs/schema-first until the profile vocabulary is stable, but the target runtime now includes browser playback, audio input analysis, and optional live bridges.

## Runtime boundary

Future runtime work may consume:

- `style_profile`
- `section_profile`
- `instrument_profile`
- `feel_profile`
- `fill_policy`
- `ghost_notes_policy`
- `section_transition_rules`

Future runtime work should produce:

- `structure`
- `expression`
- `browser_preview_events`
- `audio_input_features`
- `prediction_hints`
- `evaluation_notes`
- `safety_flags`

## Deferred integrations

The following are not implemented in this phase, but they are valid future directions:

- browser groove playback using Web Audio synthesis
- audio input analysis using microphone or line input
- rule-based groove prediction from onset, density, and section hints
- optional VCV / DAW / MIDI / audio interface bridges
- later small-model or AI-assisted groove prediction

Still excluded unless a later PR explicitly changes scope:

- audio file storage
- sample pack management
- dependency changes without a clear runtime need
- `.github/workflows` edits

## Contract shape

```json
{
  "input": {
    "style_profile": "mixture_shout",
    "section": "chorus",
    "instrument_profile": {},
    "feel_profile": {},
    "audio_input_features": {
      "rms": 0,
      "onset_density": "unknown",
      "section_hint": "unknown"
    }
  },
  "output": {
    "structure": {},
    "expression": {},
    "browser_preview_events": [],
    "prediction_hints": [],
    "evaluation_notes": [],
    "safety_flags": []
  }
}
```

## Safety flags

| Flag | Meaning |
| --- | --- |
| `density_over_cap` | section/styleの上限を超えた |
| `fill_over_cap` | `max_per_8_bars` を超えた |
| `missing_anchor` | kick/snareの床が弱い |
| `flat_velocity` | velocity_curveが人格を持たない |
| `timing_overfit` | microtimingだけでhuman feelを作ろうとしている |
| `input_signal_unsafe` | 音入力が大きすぎる、または不安定 |
| `prediction_uncertain` | 推定したgroove候補の信頼度が低い |

## Runtime default

When runtime implementation begins, the first target should be deterministic profile translation and browser preview.
Audio input prediction comes next, then optional live bridges.
