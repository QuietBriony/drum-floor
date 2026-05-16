# AGENTS.md — drum-floor repo operating contract

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

PWA shell の cache version は `sw.js` の `const VERSION`（現在 `drum-floor-pwa-v2`、
`CACHE_PREFIX = "drum-floor-pwa"` 由来）。

UI（`index.html` / `style.css` / `app.js` / `src/*.js`）を変えたら **同期 bump**:

1. `sw.js` の `CACHE_PREFIX` 連番 — 例 `drum-floor-pwa` の `v2` → `v3`。
2. `index.html` / `sw.js` の query string `?v=pwa-2` → `?v=pwa-3`（`style.css` / `app.js`）。
3. `sw.js` `PRECACHE_URLS` に追加 module があれば登録する。

precache list の網羅は `python tests/test_pwa_static_contract.py` が検証する。

---

## Branch & PR convention

| 状況 | 推奨 |
|---|---|
| docs only (`docs/` / `README.md`) | main 直 push 可 |
| 非 runtime コード（test 追加・補助 script 等） | `feature/<topic>` branch → PR |
| runtime / groove / promotion を変える（上記 main runtime ファイル・データ正本） | feature branch → PR → **人間レビュー** |

`git pull --ff-only origin main` を **作業前に必ず実行**してから新作業。

---

## Autonomous development

自律ランの入口 / 待ち行列 / 記録は `Music/docs/autonomy/`:
`STACK-INDEX.md`（repo 構造マップ・最初に読む）/ `BACKLOG.md`（作業待ち行列）/
`SESSION-LEDGER.md`（追記専用台帳）/ `AUTONOMOUS-RUN.md`（1 session の定型手順）。

自律ランの安全上限（drum-floor）:

- ✅ docs / BACKLOG / SESSION-LEDGER — main 直 push 可
- ✅ 非 runtime コード — feature branch + PR まで
- ❌ runtime / groove / promotion — **人間レビュー必須**、無人 merge は不可
- ❌ live arm / MIDI send / DAW (Ableton) / EP-133 操作 / GitHub Actions 追加 /
  dependency 追加 / archive 操作 は不可

詳細は `Music/docs/autonomy/AUTONOMOUS-RUN.md`。
