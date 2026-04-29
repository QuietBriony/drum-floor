# Future Runtime Contract v1

This document defines the future runtime boundary without implementing it.
`drum-floor` remains docs/schema-first until the profile vocabulary is stable.

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
- `evaluation_notes`
- `safety_flags`

## Non-goals for this phase

- no audio analysis
- no DAW integration implementation
- no MIDI rendering implementation
- no sample selection
- no machine learning model integration
- no dependency changes

## Contract shape

```json
{
  "input": {
    "style_profile": "mixture_shout",
    "section": "chorus",
    "instrument_profile": {},
    "feel_profile": {}
  },
  "output": {
    "structure": {},
    "expression": {},
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

## Runtime default

When runtime implementation begins, the first target should be deterministic profile translation, not audio analysis.
Audio analysis and DAW sync remain later integration topics.
