# Audio Input Groove Prediction Roadmap

`drum-floor` should eventually listen to band input and predict a useful drum feel.
The first version should be lightweight and rule-based, not a black-box model.

## Input source

- browser microphone input
- line input from an audio interface
- later: DAW or VCV bridge input

## First features

| Feature | Meaning | Use |
| --- | --- | --- |
| `rms` | rough loudness | estimate energy |
| `onset_density` | how many attacks happen | estimate density |
| `peak_rate` | short-term transient frequency | distinguish sparse/heavy playing |
| `silence_ratio` | amount of space | detect drops or breaks |
| `section_hint` | manual or predicted section | constrain fills/transitions |

## Prediction target

The predictor should suggest:

- `style_profile`
- `section`
- `instrument_profile` bias
- `feel_profile` bias
- `fill_policy` pressure
- `safety_flags`

## First prediction rule

Start with deterministic mapping:

- loud + dense input -> increase `density`, but cap fills
- loud + sparse input -> keep kick/snare anchor, leave space
- quiet + syncopated input -> raise ghost notes and swing
- section boundary hint -> allow transition or fill

## Future model boundary

Later ML/AI work should replace only the prediction layer.
It should not rewrite the profile schema, browser playback contract, or live safety rules.

## Safety

- never store raw audio by default
- never upload audio by default
- expose whether prediction confidence is low
- allow manual override at all times
