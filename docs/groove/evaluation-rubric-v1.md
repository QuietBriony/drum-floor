# Evaluation Rubric v1

`drum-floor` の評価は、microtimingだけに寄せない。
人間らしさは velocity、density、accent、syncopation、band role の組み合わせで判断する。

## Score axes

| Axis | Question | Good signal |
| --- | --- | --- |
| `section_fit` | sectionの役割に合っているか | verseは余白、chorusはlift、bridgeはcontrast |
| `band_lock` | vocal/bass/guitar と噛み合うか | bassを支えつつ丸写ししない |
| `density_control` | 密度が破綻していないか | high入力でもhat/fillを引き算できる |
| `fill_naturalness` | fillに理由があるか | section boundary と energy_delta が説明できる |
| `human_feel` | 生っぽいか | velocity/microtiming/accentが分担されている |
| `repeatability` | 再生成しても人格が残るか | style identity が消えない |

## Bar-level checks

- kick anchor が消えていない
- snare/backbeat の意味が残っている
- hat/ghost notes がdensityだけの変化になっていない
- velocity_curve が flat になっていない
- microtiming_deviation がstyleの説明と矛盾していない

## Section-level checks

- `intro`: style identity が短く見える
- `verse`: vocalの余白が残る
- `chorus`: lift と backbeat が明確
- `bridge`: contrast がある
- `end`: closure がある

## Style checks

| Style | Must preserve | Watch for |
| --- | --- | --- |
| `mixture_shout` | shout前の短いlift | hat/fill過密 |
| `rock_heavy` | stable backbeat | syncopation過多 |
| `nerdy_jazzy_hiphop` | swung texture and ghosts | crash過多 |
| `breakbeat_live` | live variation | uniform velocity |
| `dubby_half_time` | space and half-time pressure | busy hats |

## Acceptance rule

Docs/schema changes pass when every style can be explained across `intro/verse/chorus/bridge/end` without runtime code, samples, audio files, dependencies, or workflow changes.
