# Evolution Workspace

This directory holds metadata-only listening contracts for Pocket Director evolution.

It is for scorecards, schemas, examples, and future suggestions. It is not for audio, samples, recordings, exported stems, or live armed candidates.

## Safety

- Store metadata only.
- Do not store audio files.
- Do not store samples.
- Do not write to `live/armed/`.
- Do not auto-overwrite `patterns/drum-pattern-frames.json`.
- Do not operate Ableton, EP-133, VCV, or OpenClaw from this directory.

## Intended loop

1. Generate candidate.
2. Listen in browser or Ableton.
3. Score the candidate.
4. Save a score JSON.
5. Generate or write a suggestion JSON later.
6. Promote accepted changes through a reviewed PR.

## Score storage

The `score` command writes generated score JSON under `evolution/listening-notes/` by default.

Individual listening-note JSON files are ignored by git so local listening history does not accidentally become repo policy.

Schema and examples remain tracked.

