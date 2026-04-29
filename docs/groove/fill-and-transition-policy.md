# Fill and Transition Policy v1

`fill` は通常パターンの飾りではなく、sectionの意味を変えるための独立した判断対象とする。
fills は出現頻度が低く文脈依存が強いため、明示的に制御する。

## Fill fields

| Field | Meaning |
| --- | --- |
| `location` | bar end, pre-entry, bridge exit などの発火位置 |
| `rarity` | 低頻度/中頻度/高頻度 |
| `length` | short/long/roll |
| `energy_delta` | 次sectionへ入る前後のエネルギー差 |
| `section_reason` | なぜfillが必要か |

## Safety limits

| Style | Max per 8 bars | Default length | Rarity | Notes |
| --- | --- | --- | --- | --- |
| `mixture_shout` | 2 | short/roll | medium | shout前だけ強める |
| `rock_heavy` | 1 | short | low | stable backbeat を優先 |
| `nerdy_jazzy_hiphop` | 1 | short | low | comping feel を崩さない |
| `breakbeat_live` | 3 | short/long/roll | medium-high | live感は許可するが上限を置く |
| `dubby_half_time` | 1 | short | low | 空白と低域の距離を優先 |

## Allowed sections

| Section | Fill use |
| --- | --- |
| `intro` | identity cue only |
| `verse` | rare, vocal-safe |
| `chorus` | lift or phrase end |
| `bridge` | contrast and re-entry setup |
| `end` | closure, not constant decoration |

## Transition templates

### `verse -> chorus`

- `location`: final half bar
- `energy_delta`: up
- `entry`: crash or snare accent allowed
- `exit`: return to kick anchor immediately

### `chorus -> bridge`

- `location`: final bar
- `energy_delta`: down or sideways
- `entry`: reduce crash count
- `exit`: leave space for contrast

### `bridge -> chorus`

- `location`: final half bar or one-beat gap
- `energy_delta`: up
- `entry`: kick re-entry guard
- `exit`: restore backbeat clarity

### `bridge -> end`

- `location`: phrase end
- `energy_delta`: down or final lift
- `entry`: style-dependent crash
- `exit`: avoid extra fill after closure

## Anti-patterns

- fill without a section reason
- fill that masks vocal entry
- fill density increasing while every band input is already high
- crash used as the only transition cue
- long fills in `dubby_half_time` without a deliberate drop
