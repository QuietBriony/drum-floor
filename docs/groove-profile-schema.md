# Groove Profile Schema (Band Groove Generator)

`drum-floor` は music-stack の実験実装ではなく、**human band groove generator** として運用する。

## 目的

- `vocal`, `bass`, `guitar`, `section`, `style_profile` から drum feel を合成する。
- 初期リリースは **手入力 profile** のみを入力として採用する。
- 将来的に `audio analysis` / `DAW` / `Ableton` 連携を検討する。

## Input profile

- `bpm`
- `time_signature`
- `section`
- `vocal_intensity`
- `vocal_style`
- `bass_density`
- `bass_syncopation`
- `guitar_chop`
- `guitar_distortion`
- `groove_push_pull`
- `humanize`
- `style_profile`

### 入力の例（型）

```json
{
  "bpm": 120,
  "time_signature": "4/4",
  "section": "chorus",
  "vocal_intensity": "high",
  "vocal_style": "shout",
  "bass_density": "medium",
  "bass_syncopation": "moderate",
  "guitar_chop": "high",
  "guitar_distortion": "medium",
  "groove_push_pull": "forward",
  "humanize": "medium",
  "style_profile": "mixture_shout"
}
```

## Output drum feel

- `kick`
- `snare`
- `hat`
- `ghost_notes`
- `fill`
- `crash`
- `transition`
- `density`
- `swing`
- `velocity_curve`

### 出力の例（語彙）

```json
{
  "kick": ["anchored", "accented on 1 and 3"],
  "snare": ["backbeat emphasis", "occasional flam"],
  "hat": ["tight 8th", "microtiming shift"],
  "ghost_notes": ["occasional", "between-beat placement"],
  "fill": ["short", "transition-aware"],
  "crash": ["section transitions"],
  "transition": ["bar-end cue"],
  "density": "medium",
  "swing": "8th 3%",
  "velocity_curve": "humanized"
}
```

## 安全/方針

- `no audio files`
- `no samples`
- `no dependencies`
- `no runtime code in this PR`