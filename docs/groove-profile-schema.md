# Groove Profile Schema v1 (Band Groove Generator)

`drum-floor` は `music-stack` の実験実装ではなく、**人間演奏向け Band Groove Generator**として定義する。

## 目的

- `vocal / bass / guitar / section profile / style profile` を入れた手入力で、ドラムフィールを生成する。
- 実装前提として、入力語彙と出力語彙の衝突を避ける構造で設計する。
- 将来的な `audio analysis` / `DAW` / `Ableton` 連携を見越して、構造は拡張可能に保つ。

## プロフィール3層モデル（優先順位: section > feel > instrument）

### 1) section_profile

- `section`（`verse/chorus/bridge/end`）ごとの運び方を先に決める。
- 各セクションの `density / fill_tendency / ghost_preference / transition_style` を保持する。

### 2) instrument_profile

- `vocal / bass / guitar` の3軸を衝突解決可能な形で保持。
- 項目は `intensity / attack / syncopation` を共通キーとする。

### 3) feel_profile

- 全体のノリ寄与を決める。
- 項目は `groove_push_pull / swing / humanize / density / articulation` を持つ。

## 入力JSON（v1）

```json
{
  "bpm": 120,
  "time_signature": "4/4",
  "style_profile": "mixture_shout",
  "section_profile": {
    "verse": { "density": "high", "fill_tendency": "low", "ghost_preference": "low", "transition_style": "build" },
    "chorus": { "density": "high", "fill_tendency": "medium", "ghost_preference": "medium", "transition_style": "lift" },
    "bridge": { "density": "medium", "fill_tendency": "high", "ghost_preference": "medium", "transition_style": "open" },
    "end": { "density": "high", "fill_tendency": "low", "ghost_preference": "low", "transition_style": "drop" }
  },
  "instrument_profile": {
    "vocal": { "intensity": "high", "attack": "hard", "syncopation": "high" },
    "bass": { "intensity": "high", "attack": "normal", "syncopation": "medium" },
    "guitar": { "intensity": "high", "attack": "hard", "syncopation": "low" }
  },
  "feel_profile": {
    "groove_push_pull": "forward",
    "swing": 8,
    "humanize": "medium",
    "density": "high",
    "articulation": "firm"
  }
}
```

## 出力ドラムフィール（構造と表現）

### 構造
- `kick / snare / hat / ghost_notes / fill / crash / transition`
- 各楽器は「いつ、どこで、どんな意図で鳴るか」をイベント化。

### 表現
- `velocity_curve / microtiming_deviation / humanize_range / density_profile / swing_profile`
- 各イベントが持つ抑揚・揺れ・空白感の調整で「生っぽさ」を担保する。

### 出力例（構造 + 表現）

```json
{
  "structure": {
    "kick": ["floor_anchor_1_and_3", "tight_chapter_re-entry"],
    "snare": ["accented_backbeat", "lifted_pre_chorus_fill_seed"],
    "hat": ["tight_8th", "ghosted_offbeat_16th"],
    "ghost_notes": ["between_beat_variants", "small_gap_maintenance"],
    "fill": ["short_pre_transition", "type:short"],
    "crash": ["transition_entry"],
    "transition": ["bar_end_lift"]
  },
  "expression": {
    "velocity_curve": "firm_low_mid_high",
    "microtiming_deviation": "late_snare_ghosts_and_forward_kick",
    "humanize_range": "ms[-8,+6]",
    "density_profile": "high",
    "swing_profile": "8th swing 6%"
  }
}
```

## セクション遷移ルール（先に決める）

- `chorus -> bridge`: fillを短縮し、クラッシュを薄める。
- `bridge -> chorus`: 空白を1小節程度増やし、キックの戻しで収束する。
- `verse -> end`: 過密なfillsを避け、終端のクラッシュで収束する。

## style_profile拡張フィールド（v1運用で固定）

- `fill_policy.types`（`short/long/roll`）
- `fill_policy.max_per_8_bars`（上限）
- `ghost_notes_policy.unit`（主に16分）
- `ghost_notes_policy.section_density`
- `transition_cue_priority`（`low / medium / high`）
- `section_transition_rules`（from/to + adjustments）

## 受け入れシナリオ（実装なし）

1. 5style × 5section × 3intensity で衝突解決規則と遷移規則が一意に説明できること
2. `humanize`/`swing`/`density`の同時変更でも、出力語彙が単調化しないこと
3. style別に `fill_policy` の過不足が安全枠で説明できること
4. 既存方針の `vocal / bass / guitar / section / style` 起点を維持できること

## 安全/方針

- `no audio files`
- `no samples`
- `no dependencies`
- `no runtime code in this PR`
