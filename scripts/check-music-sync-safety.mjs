// JS-side domain-logic check for drum-floor.
//
// drum-floor's commit gate (pytest tests/) only exercises the Python
// `drum_floor` package and the PWA shell (test_pwa_static_contract.py). The
// browser groove engine in src/*.js had no automated logic verification. This
// check fills that gap. It is auto-discovered by Music/scripts/stack-check.mjs
// (any scripts/check-*.mjs) and run from the drum-floor repo root.
//
// Unlike check-pwa-static.mjs, this does NOT inspect manifest/sw.js. It loads
// the real ESM modules (they are pure modules with no browser globals at load
// time) and exercises their runtime to assert drum-floor's core JS contracts:
//
//   1. SYNC safety invariant -- a packet handed over from Music must NEVER
//      auto-start / arm / go live / send MIDI. Drum Floor is human-gated:
//      translateMusicSessionPacket() and the session adapter must keep
//      transport-affecting controls inert and review_only.
//   2. music-session-adapter translation contract -- shape, normalization,
//      clamping, and profile/frame/kit selection produce valid known ids.
//   3. groove-engine determinism -- the same seed + controls yield a
//      byte-identical event stream, and every event is structurally valid.
//   4. contracts.js sanitizeControls hard-coerces the safety booleans.
//
// Node built-ins only. Exits 0 on success, throws (non-zero) on any failure.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const importRepo = (rel) => import(pathToFileURL(join(root, rel)).href);

const { translateMusicSessionPacket } = await importRepo("src/music-session-adapter.js");
const { createDrumFloorSessionAdapter } = await importRepo("src/session-adapter.js");
const { generateGrooveBar, buildGenerationStats } = await importRepo("src/groove-engine.js");
const { createGrooveDecision, createManualIntent } = await importRepo("src/coplayer.js");
const {
  sanitizeControls,
  defaultControls,
  defaultBandInputFrame,
  kitPresets,
} = await importRepo("src/contracts.js");

const profiles = JSON.parse(readFileSync(join(root, "profiles/groove-profiles.json"), "utf8")).profiles || [];
const frames = JSON.parse(readFileSync(join(root, "patterns/drum-pattern-frames.json"), "utf8")).frames || [];
assert.ok(profiles.length > 0, "groove-profiles.json should list profiles");
assert.ok(frames.length > 0, "drum-pattern-frames.json should list pattern frames");
const profileIds = new Set(profiles.map((p) => p.id));
const frameIds = new Set(frames.map((f) => f.id));
const kitIds = new Set(Object.keys(kitPresets));

// ---- 1. SYNC safety invariant ----------------------------------------------
// Drum Floor's hard rule: a Music handoff is metadata-only and human-gated. The
// translated controls must keep aiMode "follow", inputLock on, liveMode off,
// midiEnabled off; safety must mark review_only / no auto_arm. We probe a range
// of packets (idle, high pressure, mic-driven, band-room) so a regression that
// flips an invariant under *some* input is still caught.

const baseMusicPacket = {
  version: 1,
  source_repo: "Music",
  session_id: "sync-safety-check",
  ucm_state: { energy: 44, body: 30, void: 20, resource: 24 },
  reference_gradient: { weights: { micro: 0.4, ghost: 0.3, haze: 0.35, organic: 0.3 } },
  performance_state: { mic_follow: { enabled: false } },
  routing: {
    drum_floor: { enabled: true, section: "chorus", density: 0.5, pressure: 0.4, intent: "soft pocket" },
    openclaw: { enabled: true, intent: "promote", next_action: "review" },
  },
};

const safetyProbes = [
  { label: "idle packet", packet: baseMusicPacket },
  {
    label: "high-pressure dry-grid packet",
    packet: {
      ...baseMusicPacket,
      mode: "techno",
      routing: {
        ...baseMusicPacket.routing,
        drum_floor: { enabled: true, section: "punch", density: 0.92, pressure: 0.95, intent: "dry grid" },
      },
    },
  },
  {
    label: "mic-driven live packet",
    packet: {
      ...baseMusicPacket,
      performance_state: {
        mic_follow: { enabled: true, gesture: "clap", confidence: 0.9, pulse: 0.8, clap: 0.7, drive: 0.6, bpm_lock: 128 },
      },
    },
  },
];

for (const { label, packet } of safetyProbes) {
  const t = translateMusicSessionPacket(packet);
  assert.equal(t.schema, "drum-floor.music-session-groove-adapter.v1", `${label}: translation should declare its schema`);
  assert.equal(t.review_only, true, `${label}: translation must be review_only`);
  const c = t.controls;
  assert.equal(c.aiMode, "follow", `${label}: SYNC must keep aiMode 'follow' (never lead/lock-driven start)`);
  assert.equal(c.inputLock, true, `${label}: SYNC must keep inputLock on (no live audio input)`);
  assert.equal(c.liveMode, false, `${label}: SYNC must NEVER enable liveMode`);
  assert.equal(c.midiEnabled, false, `${label}: SYNC must NEVER enable MIDI output`);
  assert.equal(t.safety.auto_arm, false, `${label}: SYNC safety must report auto_arm false`);
  assert.equal(t.safety.human_review_required, true, `${label}: SYNC safety must require human review`);
  assert.equal(t.safety.metadata_only, true, `${label}: SYNC handoff must be metadata-only`);
  assert.equal(t.safety.stores_audio, false, `${label}: SYNC must not store audio`);
}

// The adapter source itself must not statically wire a transport auto-start
// into the Music handoff path: applyMusicSessionPacket must not call start().
const sessionAdapterSrc = readFileSync(join(root, "src/session-adapter.js"), "utf8");
const applyBody = sessionAdapterSrc.match(/function applyMusicSessionPacket\([\s\S]*?\n {2}\}/)?.[0] || "";
assert.ok(applyBody.length > 0, "session-adapter.js should define applyMusicSessionPacket");
assert.doesNotMatch(applyBody, /\bstart\s*\(/, "applyMusicSessionPacket must not auto-start playback");
assert.doesNotMatch(applyBody, /\.resume\s*\(/, "applyMusicSessionPacket must not resume the audio engine");

// And exercise it at runtime: applying a Music packet only stages session
// state -- it must leave status non-playing and never flip the live flags.
const adapter = createDrumFloorSessionAdapter({ profiles, frames });
const applied = adapter.applyMusicSessionPacket(baseMusicPacket);
assert.equal(applied.applied, true, "applyMusicSessionPacket should report applied");
assert.equal(applied.review_only, true, "applyMusicSessionPacket result must stay review_only");
assert.equal(applied.snapshot.status, "music-packet-applied", "applying a packet must not move status to 'started'");
assert.notEqual(applied.snapshot.status, "started", "applying a Music packet must never auto-start the session");

// ---- 2. music-session-adapter translation contract -------------------------
// Every selection must land on a real, known id, and numeric controls must be
// clamped into their documented ranges regardless of how extreme the input is.

const extremePacket = {
  version: 1,
  source_repo: "Music",
  session_id: "extreme",
  ucm_state: { energy: 9999, body: -50, void: 9999, resource: 9999 },
  reference_gradient: { weights: { micro: 9, ghost: 9, haze: 9, organic: 9 } },
  performance_state: { mic_follow: { enabled: false } },
  routing: { drum_floor: { enabled: true, section: "punch", density: 9, pressure: 9 } },
};
const extreme = translateMusicSessionPacket(extremePacket);
assert.ok(profileIds.has(extreme.profileId), `adapter must pick a known profile, got '${extreme.profileId}'`);
assert.ok(frameIds.has(extreme.frameId), `adapter must pick a known frame, got '${extreme.frameId}'`);
assert.ok(kitIds.has(extreme.controls.kit), `adapter must pick a known kit, got '${extreme.controls.kit}'`);
const ec = extreme.controls;
assert.ok(ec.bpm >= 54 && ec.bpm <= 190, `bpm must clamp to 54..190, got ${ec.bpm}`);
assert.ok(ec.energy >= 0 && ec.energy <= 100, `energy must clamp to 0..100, got ${ec.energy}`);
assert.ok(ec.density >= 8 && ec.density <= 92, `density must clamp to 8..92, got ${ec.density}`);
assert.ok(ec.swing >= 0 && ec.swing <= 18, `swing must clamp to 0..18, got ${ec.swing}`);
assert.ok(ec.humanize >= 18 && ec.humanize <= 92, `humanize must clamp to 18..92, got ${ec.humanize}`);
assert.ok(ec.space >= 12 && ec.space <= 86, `space must clamp to 12..86, got ${ec.space}`);
assert.ok(["chorus", "verse", "bridge", "end"].includes(ec.section), `section must normalize, got '${ec.section}'`);
assert.equal(typeof extreme.fingerprint, "string", "translation should carry a fingerprint string");

// A disabled drum_floor route must surface enabled:false (Band Room handoff).
const disabled = translateMusicSessionPacket({
  ...baseMusicPacket,
  routing: { ...baseMusicPacket.routing, drum_floor: { enabled: false, section: "verse" } },
});
assert.equal(disabled.enabled, false, "a disabled drum_floor route must translate to enabled:false");

// Translation must be deterministic for a fixed packet.
const tA = translateMusicSessionPacket(baseMusicPacket);
const tB = translateMusicSessionPacket(baseMusicPacket);
assert.equal(tA.fingerprint, tB.fingerprint, "translating the same packet twice must yield the same fingerprint");
assert.deepEqual(tA.controls, tB.controls, "translating the same packet twice must yield identical controls");

// ---- 3. groove-engine determinism + event validity ------------------------
// drum-floor's preview promise: identical profile + controls + memory produce a
// byte-identical bar. Verify against the live engine, and check every event.

const profile = profiles.find((p) => p.id === "nerdy_jazzy_hiphop") || profiles[0];
const frame = frames.find((f) => f.id === "jazzy_ghost_glue") || frames[0];
const controls = sanitizeControls({ ...defaultControls, variationSeed: 240424, section: "chorus" }, profile);
const memory = { barIndex: 4, lastPhraseAction: "lock", lastDecision: null, explodeCount: 0 };
const decision = createGrooveDecision(profile, createManualIntent(controls), { ...defaultBandInputFrame }, memory);

const barA = generateGrooveBar(profile, controls, decision, memory, frame);
const barB = generateGrooveBar(profile, controls, decision, memory, frame);
assert.ok(barA.events.length > 0, "a generated bar should contain at least one event");
assert.equal(barA.events.length, barB.events.length, "repeated generation should emit the same event count");
assert.deepEqual(barA.events, barB.events, "repeated generation with the same seed must be byte-identical");

const knownParts = new Set(["kick", "snare", "hat", "ghost", "fill", "crash"]);
let prevStep = -1;
for (const ev of barA.events) {
  assert.ok(knownParts.has(ev.part), `event part '${ev.part}' should be a known drum part`);
  assert.ok(Number.isInteger(ev.step) && ev.step >= 0 && ev.step <= 15, `event step must be a 0..15 grid index, got ${ev.step}`);
  assert.ok(ev.velocity >= 0.04 && ev.velocity <= 1.22, `event velocity must be in the clamp range, got ${ev.velocity}`);
  assert.equal(typeof ev.reason, "string", "every event should carry a reason string");
  assert.ok(ev.step >= prevStep, "events should be sorted by step ascending");
  prevStep = ev.step;
}

// A different variationSeed must change the bar -- otherwise the seed is dead.
const seededAway = sanitizeControls({ ...defaultControls, variationSeed: 777777, section: "chorus" }, profile);
const barSeededAway = generateGrooveBar(profile, seededAway, decision, memory, frame);
const fp = (bar) => JSON.stringify(bar.events);
assert.notEqual(fp(barSeededAway), fp(barA), "a different variationSeed must produce a different bar");

// Generation stats must stay in their normalized ranges.
const stats = buildGenerationStats(profile, controls, decision);
assert.ok(stats.densityScore >= 0.05 && stats.densityScore <= 1, `densityScore must be 0.05..1, got ${stats.densityScore}`);
assert.ok(stats.ghostScore >= 0 && stats.ghostScore <= 1, `ghostScore must be 0..1, got ${stats.ghostScore}`);
assert.ok(stats.fillBudget >= 0 && stats.fillBudget <= stats.maxFills, "fillBudget must not exceed maxFills");

// crashGate off must suppress crash events -- the gate must be a real control.
const noCrash = sanitizeControls({ ...defaultControls, variationSeed: 240424, section: "chorus", crashGate: false }, profile);
const barNoCrash = generateGrooveBar(profile, noCrash, decision, memory, frame);
assert.ok(
  barNoCrash.events.every((ev) => ev.part !== "crash"),
  "crashGate:false must suppress all crash events"
);

// ---- 4. contracts.js sanitizeControls coerces the safety booleans ----------
// Even if a caller hands sanitizeControls truthy junk for the live flags, the
// session path expects real booleans; verify the coercion holds.
const coerced = sanitizeControls(
  { ...defaultControls, crashGate: "yes", inputLock: 0, liveMode: 1, midiEnabled: "" },
  profile
);
assert.equal(coerced.crashGate, true, "sanitizeControls should coerce crashGate to a boolean");
assert.equal(coerced.inputLock, false, "sanitizeControls should coerce inputLock to a boolean");
assert.equal(coerced.liveMode, true, "sanitizeControls should coerce liveMode to a boolean");
assert.equal(coerced.midiEnabled, false, "sanitizeControls should coerce midiEnabled to a boolean");
assert.ok(["follow", "lead", "lock"].includes(coerced.aiMode), "sanitizeControls should keep aiMode within the allowed set");

console.log("drum-floor music-sync safety + groove-engine logic check passed");
