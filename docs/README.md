# drum-floor: Band Groove Generator

`drum-floor` は Music リポジトリの下位モジュールではなく、**Band Groove Generator（人間演奏向けのグルーヴ生成エンジン）**として定義する。

## 変更方針

- 本体の音源パッチ実装は当面触らず、ドキュメント上で方向性を確定する。
- 既存の `patches/` / `docs/` 運用は維持しつつ、`drum-floor` の役割を再定義する。
- 最終成果物は「スタジオ/バンドセッションで使えるドラムグルーヴを安定供給する」こと。

## Music との関係

- `Music` は IDM / `field-murk` 系の実験的プロジェクトとして扱う。
- `drum-floor` は実験ではなく、**人が演奏するバンドで使いやすいグルーヴを優先**する。
- 共有するのは以下のみとする。
  - `docs/schema/` の「production translation」思想
  - ドキュメント設計で必要な運用・命名規約の抽象化
- 連携時に音源実装を同時に取り込む前提にはしない。

## drum feel の生成入力

- 音声解析は導入しない（v1時点）。
- 手入力のプロフィールを起点として feel を生成する。
- 入力プロフィールの最小セット:
  - `vocal profile`
  - `bass profile`
  - `guitar profile`
  - `section profile`
  - `style profile`
- これらからビート密度・アクセント・ノリの強弱・空白量・フィル発生条件を決定し、ドラムの表情へ反映する。

## 対象 style profile

- `mixture_shout`
- `rock_heavy`
- `nerdy_jazzy_hiphop`
- `breakbeat_live`
- `dubby_half_time`

## 生成対象（初期定義）

以下を主要生成ターゲットとして扱う。

- `kick`
- `snare`
- `hat`
- `ghost notes`
- `fill`
- `crash`
- `section transition`

## 将来ロードマップ（実装ではなく検討事項）

- 音声解析（vocal / bass / guitar の自動抽出）への拡張
- DAW 連携（セクション情報やグリッド解釈の共有）
- 生成結果を外部環境へ安全に渡すプロファイル出力仕様
- 既存 `docs/schema` と連携しやすい中間表現への標準化
