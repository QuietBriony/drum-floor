# Band Groove Generator 研究計画 v1（docs先行）

## 目標

`drum-floor` を「手入力 profile → ドラムフィール生成」に集中させた研究運用に固定し、
実装前に語彙・ルール・評価を決定する。

## 実施テーマ

### 1. 3層プロファイル語彙の定着
- `section_profile` / `instrument_profile` / `feel_profile` を優先順付きで運用
- セクション衝突時は `section_profile > feel_profile > instrument_profile` の順で解決

### 2. 構造/表現分離
- 構造: kick/snare/hat/ghost/fill/crash/transition イベントの有無と配置
- 表現: velocity, microtiming, humanize_range, density_profile, swing_profile

### 3. styleプロフィール拡張
- `fill_policy`（`short/long/roll` と上限）
- `ghost_notes_policy`（主音価とセクション別密度）
- `section_transition_rules`（from/to + 調整）
- `transition_cue_priority`（crash/transitionの起点優先）

### 4. セクション遷移を先に規約化
- `chorus -> bridge`: fill短縮＋クラッシュ削減
- `bridge -> chorus`: 空白増加→kick戻し
- `verse -> end`: エンド寄りで過剰fillを抑制

### 5. DAWノリパラメータ対応
- Ableton Groove Pool の `Base/Quantize/Timing/Random/Velocity` を
  `drum-floor` の feel語彙へ写像する
- 実装時の変換テーブルとして使える形で保存

## 受け入れシナリオ（実装なし）

1. 5style × 5section × 3intensity で、衝突規則と遷移規則が矛盾なく説明できること
2. `humanize`/`swing`/`density` を同時変更しても出力語彙が単調化しないこと
3. style別の fill 安全枠（上限/種類/優先セクション）が明確であること
4. 既存の方針 `vocal / bass / guitar / section / style` を壊さないこと

## 実行規則

- 1PRで1テーマを小さく追加する
- runtime実装、依存追加、audio/sample追加は行わない
- docs/schema + profilesのみ更新

## 安全ガード

- `no audio files`
- `no samples`
- `no dependencies`
- `no runtime code in this PR`
