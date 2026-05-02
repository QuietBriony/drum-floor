# Drum Floor (VCV) — Band-ready loop engine

**目的**
- バンド用に「1時間鳴り続けるドラム床」を作る
- 事故らない運用（CPU/音量/同期/復帰）を固定する
- v0.2で自動グルーヴ生成（ゆらぎ/フィル）を導入できる構造にする

## Quick Start
1. VCV Rack を起動
2. `patches/v0.1_drum_floor.vcv` を開く
3. Audio I/F（UR44 or KA2）を選択
4. BPM を設定 → START

## Versioning
- v0.1: 安定4つ/床（人間が触る余地あり）
- v0.2: 自動グルーヴ生成（確率・揺れ・フィル）
- v0.3: Live同期/録音テンプレ + ステージ運用

## Files
- `index.html` : GitHub Pages 用の profile UI
- `style.css` / `app.js` / `src/` : 依存なしの日本語静的 UI と native ES modules
- `drum_floor/` : OpenClawから将来呼ぶための live candidate CLI
- `live/` : candidates / armed / archive / logs の安全なlive作業境界
- `docs/ops/` : ライブ運用・事故対応
- `docs/patches/` : パッチ仕様（モジュール表/配線図）
- `docs/groove/` : グルーヴ理論/生成ルール
- `docs/runtime/` : ブラウザ音生成、音入力予測、VCV/Live連携の将来設計
- `patches/` : VCVパッチ本体（.vcv）
- `docs/groove-profile-schema.md` : drum-floor の band groove profile スキーマ
- `docs/input-output-example.md` : profile 入力→ドラム出力の例
- `profiles/groove-profiles.json` : 初期 style profiles 定義

## Safety
- mainブランチは常に「鳴る」状態を維持
- 1PR = 1目的（小さく改修）
- GitHub Pages は `main` + `/(root)` を公開元にする
- Pages UI は profile確認、使い方確認、開発状況把握のための入口として使う
- ブラウザ音生成と音入力予測は将来実装対象だが、最初は合成音・ルールベース・手動停止を前提にする
- Pages UI の自動生成プレビューは Web Audio 合成音のみを使い、BPM/tap/section/kit/energy/density/swing/humanize を手動操作できる
- AI co-player はまず rule-based。外部AI API、音声送信、録音保存はしない
- 音入力は `getUserMedia` のローカルfeatures解析のみ。permission拒否時はmanual modeへ戻る
- CLI/OpenClaw は `live/candidates/`, `live/logs/`, 明示した生成 `--out` のみへ書き込む
- CLI/OpenClaw は `live/armed/` を自動上書きせず、Ableton project files や EP-133 device state を直接変更しない
- サンプル/audio filesは保存・追加しない

## Live candidate CLI

Preferred command name:

```bash
python -m drum_floor generate --style mixture_shout --bpm 126 --bars 4 --energy 72 --seed 42 --out live/candidates/seed-42
```

The command writes exactly:

- `pattern.json`
- `drums.mid`
- `preview.txt`
- `meta.json`

It also writes a structured operation log under `live/logs/` so future OpenClaw runs can inspect success/failure without touching `live/armed/`.

Inspect a generated candidate without arming it:

```bash
python -m drum_floor inspect live/candidates/seed-42
```

Design boundary:

- JSON is source of truth.
- MIDI is a compiled artifact.
- Ableton is the preview target.
- EP-133 is an optional performance target.
- OpenClaw is the future control plane, not the performer.
- Human arms candidates before live use.
