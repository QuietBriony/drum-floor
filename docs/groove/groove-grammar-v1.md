# Groove Grammar v1

`drum-floor` は drum part を音色名だけで扱わない。
各partは band groove 内の機能語彙として扱う。

## Function vocabulary

| Function | Meaning | Typical parts |
| --- | --- | --- |
| `anchor` | 曲の床を固定する | kick, snare |
| `response` | vocal/bass/guitar に返答する | kick, ghost_notes, fill |
| `lift` | section entry や chorus を持ち上げる | crash, fill, snare |
| `release` | density を抜いて次に渡す | hat, fill, transition |
| `space` | 音を足さずに隙間を作る | hat, ghost_notes, transition |
| `accent` | phrase の意味を示す | snare, crash, kick |
| `texture` | time feel を細かく提示する | hat, ghost_notes |

## Part grammar

| Part | Primary functions | Secondary functions | Avoid |
| --- | --- | --- | --- |
| `kick` | `anchor`, `response` | `accent` | bassと常に同じ動きにする |
| `snare` | `anchor`, `accent` | `lift` | backbeatを不必要に崩す |
| `hat` | `texture`, `space` | `release` | densityで全部を説明する |
| `ghost_notes` | `texture`, `response` | `space` | velocity差なしで増やす |
| `fill` | `lift`, `release` | `response`, `accent` | section理由なしに出す |
| `crash` | `lift`, `accent` | `release` | 連発してsection意味を薄める |
| `transition` | `release`, `lift` | `space` | fillだけに任せる |

## Structure and expression split

`structure` は「どこで鳴るか」を決める。
`expression` は「どう鳴るか」を決める。

| Layer | Owns | Should not own |
| --- | --- | --- |
| `structure` | onset, part, section role, fill location | velocity realism |
| `expression` | velocity, microtiming, swing, humanize, articulation | section intent |

## DAW vocabulary mapping

| DAW-like term | drum-floor term | Notes |
| --- | --- | --- |
| `base` | grid unit | 8th/16th/32ndの基準 |
| `quantize` | structure strength | onsetをどれだけgridへ寄せるか |
| `timing` | microtiming_deviation | timingだけでhuman feelを担わせない |
| `random` | humanize_range | 制御されたばらつきとして扱う |
| `velocity` | velocity_curve | groove identityの主要因として扱う |

## Style examples

- `mixture_shout`: kick=`anchor`, snare=`accent`, fill=`lift`
- `rock_heavy`: kick=`anchor`, snare=`anchor`, crash=`accent`
- `nerdy_jazzy_hiphop`: hat=`texture`, ghost_notes=`response`, kick=`space-aware anchor`
- `breakbeat_live`: fill=`response/lift`, ghost_notes=`texture`, transition=`release`
- `dubby_half_time`: kick=`anchor`, snare=`space`, hat=`release`
