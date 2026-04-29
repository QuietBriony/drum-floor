# Drum profile I/O example (v1)

## Input

- `style_profile`: `mixture_shout`
- `section_profile.section`: `chorus`
- `instrument_profile`:
  - `vocal`: `intensity=high`, `attack=hard`, `syncopation=high`
  - `bass`: `intensity=high`, `attack=normal`, `syncopation=medium`
  - `guitar`: `intensity=high`, `attack=hard`, `syncopation=low`
- `feel_profile`:
  - `groove_push_pull`: `forward`
  - `swing`: `8`
  - `humanize`: `medium`
  - `density`: `high`
  - `articulation`: `firm`

## Output

### structure

- `kick`: floor_anchor, pre-chorus double-hit for lift
- `snare`: stable backbeat + short pre-transition ghost
- `hat`: tight 8th + short 16th stabs
- `ghost_notes`: sparse between-beat placements
- `fill`: short, pre_transition
- `crash`: verse→chorus entry accents
- `transition`: bar-end lift cue

### expression

- `velocity_curve`: firm_front_mid_tail
- `microtiming_deviation`: snare_late, kick_forward
- `humanize_range`: `ms[-7,+5]`
- `density_profile`: `high`
- `swing_profile`: `8th 6%`
