# AGENTS.md — drum-floor repo operating contract

## 通常の改善は検証後に本番へ（2026-10-28・本人指示）

本人が任せたMusic関連の改善は、公開前の人間レビュー・試聴承認を必須にしない。
PWAは既存の本番へ出してから本人が聴く運用とし、実装 → 必須検証 → 自分の差分確認 →
merge / main push → 既存の本番へdeploy → 公開版とPWAの更新確認 → 本人の感想で調整、まで進める。
通常の全件検査経路では、別担当の独立レビューも公開の必須条件にしない。
同じ最終HEADのstack-check（FAIL 0 / SKIP 0 / 0 BAD）、各repoの必須検査、cache同期、
担当scope・clean状態・変更履歴・公開反映の証拠・ロールバック手段は維持する。
実iPhoneの聴感が未確認でも公開を止めず、未確認と明記して本番での試聴へ渡す。
新しい公開先、未承認の音源追加、認証や権限の変更、外部機器のarm・record・MIDI送信などは
この通常公開ルールへ含めない。各アプリ自身の手動開始・metadata-onlyの境界も維持する。

このリポを触る agent (claude code / codex / 他) が **最初に読む** drum-floor 固有ルール。
music-stack 全体の自走開発エンジンは `Music/docs/autonomy/` にある。

---

## この repo の役割

drum-floor は music-stack の **active な rhythm / groove / VCV / stage-safety reference**。

- groove grammar・pocket frames を持ち、drum feel の正本を所有する。
- candidate promotion は **human-gated**（score → suggestion → promotion request → PR）。
  raw candidate は `live/candidates/` 止まり、`live/armed/` との境界は人間が越える。
- 所有範囲: drum feel / stage safety 運用 / browser drum preview (Web Audio 合成音) /
  candidate CLI (`drum_floor`) / Music SYNC receiver behavior。
- Music が conductor。drum-floor は SYNC を **受けて preview を形作るだけ**。

---

## Hard rules（絶対守る）

drum-floor 固有の境界:

1. Music `SYNC` / session packet は **metadata only**。読んでも auto-start playback /
   record audio / MIDI send / Ableton arm / EP-133 操作 / upload は **しない**。
   再生は常に人間の `再生` ボタンに戻す。
2. **candidate promotion は human-gated**。無人で `patterns/drum-pattern-frames.json` を
   書き換えない・promote しない。CLI は `live/candidates/` `live/logs/` 明示 `--out` のみ書き込み、
   `live/armed/` は自動上書きしない。

共通:

3. 音源 / サンプル / audio file / 歌詞を repo に追加しない（合成音・JSON・MIDI のみ）。
4. dependency を勝手に足さない（標準 Python + 依存なし JS が前提）。
5. GitHub Actions を勝手に足さない（user 承認必須）。
6. archive / delete / repo settings を触らない。

main runtime ファイル（変更は慎重に）:

- Python package: `drum_floor/generator.py` `cli.py` `scoring.py` `promotion*.py` `midi.py`
- JS web UI: `app.js` / `src/*.js`（特に `groove-engine.js` `audio-engine.js` `music-session-adapter.js`）
- データ正本: `patterns/drum-pattern-frames.json` `profiles/groove-profiles.json`

---

## Integrity gate

commit 前に repo root で必ず通す:

```bash
python -m pytest tests/ -q
```

**0 終了 / 全 pass が commit の前提**（9 test file）。
`conftest.py` が repo root を `sys.path` に追加するので、この環境の `safe_path` mode でも
`tests/test_*.py` が `drum_floor` package を import できる。これがないと collection error になる。

5 repo 一括検証は Music repo root で `node scripts/stack-check.mjs`（`0 BAD` が前提）。

---

## Cache buster discipline

PWA shell の cache version は `sw.js` の `const VERSION`（現在 `drum-floor-pwa-v6`、
`CACHE_PREFIX = "drum-floor-pwa"` 由来）。

UI（`index.html` / `style.css` / `app.js` / `src/*.js`）を変えたら **同期 bump**:

1. `sw.js` の `CACHE_PREFIX` 連番 — 例 `drum-floor-pwa` の `v4` → `v5`。
2. `index.html` / `sw.js` の query string `?v=pwa-4` → `?v=pwa-5`（`style.css` / `app.js`）。
3. `sw.js` `PRECACHE_URLS` に追加 module があれば登録する。

precache list の網羅は `python tests/test_pwa_static_contract.py` が検証する。

---

## Branch & PR convention

| 状況 | 推奨 |
|---|---|
| docs only (`docs/` / `README.md`) | main 直 push 可 |
| 非 runtime コード（test 追加・補助 script 等） | `feature/<topic>` branch → PR |
| runtime / groove / promotion を変える（上記 main runtime ファイル・データ正本） | feature branch → PR → 必須検証・差分確認 → agent merge・既存本番へdeploy（live候補の昇格・armは上記の運用境界に従う） |

`git pull --ff-only origin main` を **作業前に必ず実行**してから新作業。

---

## Autonomous development

自律ランの入口 / 待ち行列 / 記録は `Music/docs/autonomy/`:
`STACK-INDEX.md`（repo 構造マップ・最初に読む）/ `BACKLOG.md`（作業待ち行列）/
`SESSION-LEDGER.md`（追記専用台帳）/ `AUTONOMOUS-RUN.md`（1 session の定型手順）。

自律ランの安全上限（drum-floor）:

- ✅ docs / BACKLOG / SESSION-LEDGER — main 直 push 可
- ✅ 非 runtime コード — feature branch + PR、検証後にagent merge・既存本番へdeploy
- ✅ 通常のruntime / groove修正 — 必須検証後にagent merge・既存本番へdeployし、PWAでの本人試聴を受けて調整。live候補の昇格・armを自動化する許可にはしない
- ❌ live arm / MIDI send / DAW (Ableton) / EP-133 操作 / GitHub Actions 追加 /
  dependency 追加 / archive 操作 は不可

詳細は `Music/docs/autonomy/AUTONOMOUS-RUN.md`。
