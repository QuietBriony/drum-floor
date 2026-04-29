# Groove Decision Model v1

`drum-floor` は band context から drum feel を作るため、入力値を単純に足し算しない。
最終判断は「どの入力を優先し、どこで引き算するか」を明示して決める。

## Decision order

1. `section`
2. `style_profile`
3. `feel_profile`
4. `instrument_profile`

この順番は「曲構造を壊さず、styleの人格を残し、feelで調整し、楽器入力で反応する」ためのもの。

## Section limits

| Section | Density cap | Fill cap | Crash policy | Notes |
| --- | --- | --- | --- | --- |
| `intro` | medium | low | selective | groove identity を示すが、最初から詰めすぎない |
| `verse` | medium | low | rare | vocal/bass の余白を優先する |
| `chorus` | high | medium | allowed | lift と backbeat を優先する |
| `bridge` | high | high | selective | contrast と transition を優先する |
| `end` | high | medium | allowed | closure を作るが、fill過多にしない |

## Conflict rules

- `section` が low density を要求する場合、`instrument_profile` が high でもhat/fill密度を上げすぎない。
- `style_profile` が sparse を要求する場合、vocal/bass/guitar が同時に high でもkick/snareの基礎だけを太くする。
- `feel_profile.swing` はhatとghost notesに優先適用し、kick anchorは過度に揺らさない。
- `humanize` は velocity と microtiming の両方へ分散し、timingだけで生っぽさを作らない。

## Band subtraction

vocal/bass/guitar がすべて high の場合、drum-floor は全パートを増やすのではなく、以下の順で引き算する。

1. hat の16分密度を抑える
2. ghost notes を backbeat 周辺へ限定する
3. fill を section boundary のみに寄せる
4. crash を entry cue と phrase end に限定する

## Style-specific overrides

- `mixture_shout`: shout直前の短いfillは許可し、hat密度は上げすぎない。
- `rock_heavy`: stable backbeat を最優先し、syncopation過多を避ける。
- `nerdy_jazzy_hiphop`: swing/ghost/velocity を優先し、crashを少なくする。
- `breakbeat_live`: fill variation を許可するが、8小節内の上限で制御する。
- `dubby_half_time`: 空白を優先し、kick/snare間の距離を詰めすぎない。

## Research anchors

- GrooVAE and PocketVAE support the split between pattern structure and expressive timing/velocity.
- E-GMD emphasizes velocity as a first-class expressive signal.
- Witek et al. suggests that maximum syncopation is not always the most groove-effective choice.
