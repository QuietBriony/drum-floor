# VCV and Live Bridge Roadmap

VCV remains a valid live output target, but `drum-floor` should not become VCV-only.
The browser engine is the development surface; VCV is one possible stage surface.

## VCV role

- stable live floor
- long-running drum anchor
- manual recovery path
- output endpoint for generated groove decisions

## Browser role

- profile browsing
- groove preview
- audio input analysis
- prediction debugging
- quick iteration before stage setup

## Bridge candidates

| Bridge | Purpose | Timing |
| --- | --- | --- |
| MIDI | send kick/snare/hat/fill events | after browser preview |
| OSC | control VCV or DAW parameters | after event contract stabilizes |
| Audio interface | listen to band input | after input safety docs |
| DAW sync | section/grid sharing | later integration |
| MCP bridge | automate supported tools | only if a VCV/DAW MCP is available |

## MCP stance

Codex can operate repo files, GitHub, and Pages in this environment.
Direct VCV operation requires a dedicated VCV/DAW control surface or MCP server that exposes safe actions.
Until that exists, bridge work should be documented and implemented as explicit contracts.

## Live safety

- always keep a manual stop
- keep limiter/gain ceiling at output
- prefer deterministic fallback when prediction is uncertain
- do not let audio input directly trigger unbounded fills
- keep VCV patch recoverable without AI
