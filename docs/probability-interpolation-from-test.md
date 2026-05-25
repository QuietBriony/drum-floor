# Probability interpolation from test

Status: docs-only / reference-only / no runtime change

## Purpose

This note translates the archived `test/engine.js` probability-blend idea into
drum-floor's groove grammar language.

The goal is to preserve a useful pattern-design concept without copying runtime
code, adding stochastic playback, changing pattern frames, promoting a live
candidate, or weakening drum-floor's deterministic and human-gated safety model.

## Source posture

- source repo: `test`
- source file: `test/engine.js`
- related Music delivery: Music PR #249 translated the four style archetypes as
  Music reference metadata
- adopted here: interpolation vocabulary and future deterministic grammar shape
- not adopted here: direct JavaScript code, runtime wiring, sample mix values,
  random playback, new schema, or pattern-frame data changes

## Source concept

The archive source combines two ideas:

- choose the adjacent archetype pair from a normalized style value
- linearly interpolate each parameter and each 16-step probability vector

In source terms:

| Source element | Meaning | drum-floor translation |
|---|---|---|
| `State.style / 100` | normalized blend position | future groove macro position |
| `seg = 1 / 3` | four archetypes create three adjacent blend lanes | segment-linear groove family transition |
| `lerp(A.pKick[i], B.pKick[i], t)` | per-step probability interpolation | interpolate structure-intent weights per step |
| `Math.random() < prob` | stochastic per-step gate | rejected for runtime unless replaced by deterministic seeded choice |
| BPM / swing lerp | continuous tempo/feel transition | adopted as concept, bounded by drum-floor contracts |

## Why it fits drum-floor

drum-floor already separates `structure` from `expression`.

Probability interpolation belongs on the structure-planning side: it can describe
how strongly a step wants to carry kick, snare, hat, bass-lock, ghost note, fill,
or release intent while leaving expression to velocity, microtiming, swing, and
humanize rules.

The useful part is not "make playback random." The useful part is "represent a
smooth middle point between two groove identities."

## Determinism boundary

drum-floor must keep the same seed producing the same bar. Music SYNC metadata
must not auto-start playback, arm output, send MIDI, touch Ableton/EP-133, or
promote candidates without human review.

That means the archive source's raw per-step random gate is not suitable as a
runtime rule.

Acceptable future shapes:

- interpolate per-step weights inside a deterministic generator
- use a seeded RNG where the seed is explicit and tested
- compile a probability-weighted plan into stable `structure` and `expression`
  outputs before preview
- keep generated candidates in `live/candidates/` until a human promotes them

Unacceptable shapes:

- unseeded `Math.random()` inside browser playback
- stochastic changes that make the same seed produce different bars
- automatic promotion into `patterns/drum-pattern-frames.json`
- Music SYNC triggering playback or live output

## Adopted / Deferred / Rejected

| Element | Status | Reason |
|---|---|---|
| Adjacent two-archetype segment blend | Adopted concept | Smooth transitions are useful for groove-family planning |
| 16-step probability-vector interpolation | Adopted concept | Good representation for step-level structure pressure |
| BPM / swing interpolation | Adopted concept | Compatible with bounded feel-profile translation |
| Raw `Math.random() < prob` gate | Rejected | Violates deterministic preview unless explicitly seeded |
| Seeded per-step gate | Deferred | Could fit future generator work if covered by tests |
| Four-archetype global style fader | Deferred | drum-floor may not need the same public macro shape |
| Pattern-frame mutation | Rejected for this pass | Human-gated promotion is required |
| Runtime implementation | Rejected for this pass | This is a docs-only harvest translation |

## Future contract sketch

If this becomes a future implementation, the contract should look like a stable
compiler step rather than live randomness:

```json
{
  "input": {
    "from_frame": "deep_neo_soul_pocket",
    "to_frame": "breakbeat_live",
    "blend": 0.42,
    "seed": 42,
    "bars": 4
  },
  "output": {
    "structure": {
      "steps": [],
      "step_weights": []
    },
    "expression": {
      "velocity_curve": {},
      "microtiming": {},
      "swing": 0
    },
    "safety_flags": []
  }
}
```

Required future tests:

- same seed and input produce byte-identical bars
- unseeded randomness is not used
- no auto-start / auto-arm / MIDI send path is introduced
- generated outputs stay in candidate or preview surfaces until human promotion

## Human gate

Before any runtime work, a human should decide:

- which existing drum-floor frame families can be blended safely
- whether a seeded stochastic gate is useful or whether interpolation should
  compile directly into deterministic step choices
- whether this belongs in generator internals, schema docs, or a separate
  review-only groove planning layer

Until then, this document is only a reference shelf item.
