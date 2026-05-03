import { createGrooveDecision, createManualIntent, updatePhraseMemory } from "./coplayer.js";
import { defaultBandInputFrame, defaultControls, hashString, sanitizeControls } from "./contracts.js";
import { generateGrooveBar } from "./groove-engine.js";
import { AudioEngine } from "./audio-engine.js";

const DEFAULT_SESSION = Object.freeze({
  bpm: 72,
  seed: 240424,
  profileId: "nerdy_jazzy_hiphop",
  frameId: "jazzy_ghost_glue",
  kit: "hard_bop_room",
  energy: 28,
  density: 24,
  swing: 9,
  humanize: 62,
  space: 72,
  section: "verse",
  fillDemand: 10,
  crashGate: false,
});

function withTrailingSlash(path) {
  return String(path || "").endsWith("/") ? String(path) : `${path}/`;
}

function defaultBasePath() {
  return withTrailingSlash(new URL("../", import.meta.url).href);
}

function normalizePercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 1) return Math.round(number * 100);
  return Math.round(number);
}

function normalizeSeed(seed) {
  const parsed = Number(seed);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION.seed;
  return Math.abs(Math.floor(parsed)) % 2147483647;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`drum-floor session fetch failed: ${response.status} ${url}`);
  return response.json();
}

function createMemory(barIndex = 0) {
  return {
    barIndex,
    lastPhraseAction: "lock",
    lastDecision: null,
    explodeCount: 0,
  };
}

function compactBar(bar) {
  return {
    barIndex: bar.barIndex,
    barInPhrase: bar.barInPhrase,
    phraseAction: bar.stats?.phraseAction,
    frameId: bar.stats?.frameId,
    densityScore: Number((bar.stats?.densityScore ?? 0).toFixed(4)),
    ghostScore: Number((bar.stats?.ghostScore ?? 0).toFixed(4)),
    events: bar.events.map((event) => ({
      step: event.step,
      part: event.part,
      velocity: Number(event.velocity.toFixed(4)),
      microOffsetMs: event.microOffsetMs,
      duration: event.duration,
      reason: event.reason,
    })),
  };
}

export function createDrumFloorSessionAdapter(options = {}) {
  const basePath = withTrailingSlash(options.basePath || defaultBasePath());
  const audioEngine = new AudioEngine({
    audioContext: options.audioContext || null,
    destination: options.destination || null,
    gain: Number.isFinite(options.gain) ? options.gain : 0.18,
  });

  const state = {
    loaded: false,
    profiles: options.profiles || [],
    frames: options.frames || [],
    session: { ...DEFAULT_SESSION },
    controls: null,
    memory: createMemory(),
    lastBar: null,
    status: "idle",
  };

  function activeProfile() {
    return state.profiles.find((profile) => profile.id === state.session.profileId) || state.profiles[0] || null;
  }

  function activeFrame(profile = activeProfile()) {
    if (!state.frames.length) return null;
    const requested = state.frames.find((frame) => frame.id === state.session.frameId);
    if (requested) return requested;
    return state.frames.find((frame) => frame.style_affinity?.includes(profile?.id)) || state.frames[0];
  }

  function buildControls(profile = activeProfile()) {
    const seed = normalizeSeed(state.session.seed);
    return sanitizeControls(
      {
        ...defaultControls,
        bpm: state.session.bpm,
        section: state.session.section,
        energy: normalizePercent(state.session.energy, DEFAULT_SESSION.energy),
        density: normalizePercent(state.session.density, DEFAULT_SESSION.density),
        swing: normalizePercent(state.session.swing, DEFAULT_SESSION.swing),
        humanize: normalizePercent(state.session.humanize, DEFAULT_SESSION.humanize),
        kit: state.session.kit,
        frame: state.session.frameId,
        variationSeed: seed,
        risk: 18,
        space: normalizePercent(state.session.space, DEFAULT_SESSION.space),
        lift: 24,
        fillDemand: normalizePercent(state.session.fillDemand, DEFAULT_SESSION.fillDemand),
        crashGate: Boolean(state.session.crashGate),
        aiMode: "follow",
        inputLock: true,
        liveMode: false,
        midiEnabled: false,
      },
      profile
    );
  }

  function buildBar(barIndex = state.memory.barIndex) {
    const profile = activeProfile();
    if (!profile) throw new Error("drum-floor session profiles are not loaded");
    const frame = activeFrame(profile);
    const controls = buildControls(profile);
    const memory = { ...state.memory, barIndex };
    const bandFrame = { ...defaultBandInputFrame, inputLock: true };
    const decision = createGrooveDecision(profile, createManualIntent(controls), bandFrame, memory);
    const bar = generateGrooveBar(profile, controls, decision, memory, frame);
    return { bar, controls, decision, memory };
  }

  async function load() {
    if (state.loaded) return snapshot();
    if (!state.profiles.length || !state.frames.length) {
      const [profileData, frameData] = await Promise.all([
        fetchJson(new URL("profiles/groove-profiles.json", basePath).href),
        fetchJson(new URL("patterns/drum-pattern-frames.json", basePath).href),
      ]);
      state.profiles = profileData.profiles || [];
      state.frames = frameData.frames || [];
    }
    state.loaded = true;
    state.controls = buildControls(activeProfile());
    state.status = "loaded";
    return snapshot();
  }

  async function start() {
    await load();
    await audioEngine.resume();
    state.status = "started";
    return snapshot();
  }

  function stop() {
    state.status = "stopped";
    return snapshot();
  }

  function panic() {
    audioEngine.panic();
    state.status = "panic";
    return snapshot();
  }

  function setSession(next = {}) {
    state.session = {
      ...state.session,
      ...next,
      seed: normalizeSeed(next.seed ?? state.session.seed),
    };
    if (Number.isFinite(Number(next.barIndex))) state.memory = createMemory(Number(next.barIndex));
    if (state.loaded) state.controls = buildControls(activeProfile());
    return snapshot();
  }

  function scheduleBar(options = {}) {
    if (!state.loaded) return { scheduled: false, bar: null, reason: "not-loaded" };
    const context = audioEngine.ensure();
    const startTime = Number.isFinite(options.startTime) ? options.startTime : context.currentTime + 0.05;
    const barIndex = Number.isFinite(options.barIndex) ? options.barIndex : state.memory.barIndex;
    try {
      const built = buildBar(barIndex);
      audioEngine.scheduleBar(built.bar, built.controls, startTime);
      state.memory = updatePhraseMemory(built.memory, built.decision);
      state.lastBar = built.bar;
      state.status = "scheduled";
      return { scheduled: true, bar: built.bar, reason: "scheduled" };
    } catch (error) {
      state.status = `schedule-failed: ${error.message}`;
      return { scheduled: false, bar: null, reason: error.message };
    }
  }

  function previewBar(options = {}) {
    if (!state.loaded && state.profiles.length) state.loaded = true;
    const barIndex = Number.isFinite(options.barIndex) ? options.barIndex : state.memory.barIndex;
    const built = buildBar(barIndex);
    const compact = compactBar(built.bar);
    return {
      bar: built.bar,
      compact,
      fingerprint: hashString(JSON.stringify(compact)).toString(16),
    };
  }

  function previewSession(options = {}) {
    const bars = Math.max(1, Math.min(32, Math.floor(options.bars ?? 8)));
    const previousMemory = { ...state.memory };
    const compact = [];
    state.memory = createMemory(Number.isFinite(options.barIndex) ? options.barIndex : 0);
    for (let index = 0; index < bars; index += 1) {
      const built = buildBar(state.memory.barIndex);
      compact.push(compactBar(built.bar));
      state.memory = updatePhraseMemory(built.memory, built.decision);
    }
    state.memory = previousMemory;
    return {
      bars,
      compact,
      fingerprint: hashString(JSON.stringify(compact)).toString(16),
    };
  }

  function snapshot() {
    return {
      loaded: state.loaded,
      status: state.status,
      session: { ...state.session },
      profileId: activeProfile()?.id || null,
      frameId: activeFrame()?.id || null,
      barIndex: state.memory.barIndex,
    };
  }

  return {
    load,
    start,
    stop,
    panic,
    setSession,
    scheduleBar,
    previewBar,
    snapshot,
    diagnostics: {
      previewSession,
    },
  };
}

if (typeof window !== "undefined") {
  window.createDrumFloorSessionAdapter = createDrumFloorSessionAdapter;
}
