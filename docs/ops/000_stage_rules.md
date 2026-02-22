# Stage Rules (v0.1)

## 絶対ルール
- 最終段に Limiter（クリップ/爆音防止）
- 音が止まった時は「Audio再接続→再ロード」を優先
- CPUが上がったら Reverb/Delay を切る（床は残す）

## 本番チェック（5分）
1. Audio I/F確認（UR44 or KA2）
2. サンプルレート固定（48k推奨）
3. Buffer 256〜512（安定優先）
4. Limiter ON
5. 10分放置して落ちないこと確認

## リカバリ手順（30秒）
- 音割れ/無音 → Audio Module の Deviceを選び直す
- それでもダメ → パッチ再読み込み
