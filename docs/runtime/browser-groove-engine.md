# Browser Groove Engine Roadmap

`drum-floor` should be able to make a rough groove in the browser before it talks to VCV, DAWs, or audio interfaces.
The browser engine is the development and audition surface, not the final stage rig.

## Purpose

- play quick drum feel previews from `profiles/groove-profiles.json`
- keep structure and expression separate
- use Web Audio synthesis only at first
- avoid samples and audio files
- make profile changes audible during development

## Phase 1: Browser preview

- synthesize simple `kick`, `snare`, and `hat`
- map `density`, `swing`, and `humanize` to timing/velocity-like changes
- keep output short and loop-safe
- add a clear start/stop control in Pages UI

Status: initial Pages UI preview implemented with Web Audio synthesis only.

## Phase 2: Manual groove generator

- translate `drum_translation.structure` into bar-level events
- translate `drum_translation.expression` into velocity and microtiming ranges
- expose the generated events as JSON for debugging

## Phase 3: Profile-aware browser groove

- make each style profile audibly distinct
- keep `mixture_shout` tight and forward
- keep `nerdy_jazzy_hiphop` swung and ghost-heavy
- keep `dubby_half_time` spacious

## Safety

- use generated synthesis only
- do not load samples
- keep volume capped
- add a limiter or gain ceiling before output
- keep playback easy to stop

## Out of scope for the first runtime PR

- audio input
- ML/AI generation
- DAW sync
- VCV control
- file export
