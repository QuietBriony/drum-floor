# drum-floor docs

`drum-floor` is the Music Stack's band groove generator and live rhythm
safety reference. It is not a submodule of `Music`, and it should not be
flattened into Music's generative rig. Its strongest edge is playable pocket,
stage-safe preview, and human-gated movement from idea to live candidate.

## Current role

- `drum-floor standalone`: browser Pages UI for synthetic drum preview and
  manual listening.
- `chill DRUMS`: soft pocket adapter for `chill/session.html`; `chill` owns
  piano, bass, flow, START, and PANIC.
- `OpenClaw raw candidate`: local CLI path for generating and inspecting MIDI
  candidates before a human arms anything.

Music `SYNC` is metadata-only. It may shape kit, pocket, energy, space, BPM, or
mic-follow hints, but it must not start playback, record audio, send MIDI, arm
Ableton, touch EP-133, operate VCV, upload audio, or bypass human review.

## Current docs map

- [Root README](../README.md): operational overview, safety posture, Music
  SYNC roles, browser session adapter, and CLI examples.
- [OpenClaw live contract](./openclaw-live-contract.md): writable directories,
  forbidden writes, candidate outputs, browser trio surface, and human-armed
  workflow.
- [Drum pattern frame contract](./drum-pattern-frame-contract.md): Pocket
  Director frame contract and no-samples boundary.
- [Groove profile schema](./groove-profile-schema.md): band groove profile
  vocabulary and profile validation expectations.
- [Probability interpolation from test](./probability-interpolation-from-test.md):
  docs-only translation of archived 16-step probability blend into deterministic
  groove grammar vocabulary.
- [Input/output example](./input-output-example.md): profile-to-drum-output
  example.
- [Ableton preview checklist](./ableton-preview-checklist.md): listening check
  before any EP-133 or live-rig routing.
- [EP-133 MIDI map](./ep133-midi-map.md): optional performance routing notes
  after Ableton preview and human review.
- [Evolution scorecard](./evolution-scorecard.md): metadata-only listening
  score axes.
- [Pocket Director evolution loop](./evolution-pocket-director-loop.md):
  score-to-suggestion loop and human-gated evolution.
- [Human promotion workflow](./evolution-promotion-workflow.md): final gate
  before pattern-frame changes.

## Groove and runtime docs

- [Band Groove Generator v1 research plan](./groove/band-groove-research-plan-v1.md)
- [Groove decision model](./groove/groove-decision-model.md)
- [Groove grammar v1](./groove/groove-grammar-v1.md)
- [Fill and transition policy](./groove/fill-and-transition-policy.md)
- [Evaluation rubric v1](./groove/evaluation-rubric-v1.md)
- [Future runtime contract](./groove/future-runtime-contract.md)
- [Browser groove engine roadmap](./runtime/browser-groove-engine.md)
- [Audio input groove prediction](./runtime/audio-input-groove-prediction.md)
- [VCV and Live bridge roadmap](./runtime/vcv-and-live-bridge.md)
- [Live AI audio interface roadmap](./runtime/live-ai-audio-interface-roadmap.md)

## Boundaries to keep sharp

- Keep the repo centered on rhythm operation: pocket, space, fill policy,
  human feel, deterministic preview, and stage recovery.
- Keep browser preview synthetic and local unless a later reviewed contract
  changes the source policy.
- Keep JSON/profile/pattern-frame data as source of truth; MIDI is a compiled
  artifact for preview or optional routing.
- Keep `live/armed/`, Ableton projects, EP-133 state, VCV operation, audio
  recordings, samples, dependencies, and workflow automation behind explicit
  human review.
- Do not turn every Music Stack integration into a drum-floor runtime feature.
  `Music` conducts metadata, `chill` owns the quiet trio surface, and
  `drum-floor` owns groove grammar and safe rhythm audition.

## Non-goals for docs-only passes

- No runtime implementation.
- No audio files or samples.
- No dependency changes.
- No schema churn unless separately reviewed.
- No automatic device, DAW, VCV, or live-slot operation.
- No Music Stack unification that erases drum-floor's band-groove role.
