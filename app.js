import { AudioInputAnalyzer } from "./src/audio-analysis.js";
import { AudioEngine } from "./src/audio-engine.js";
import { createGrooveDecision, createManualIntent, updatePhraseMemory } from "./src/coplayer.js";
import { defaultBandInputFrame, defaultControls, sanitizeControls } from "./src/contracts.js";
import { generateGrooveBar } from "./src/groove-engine.js";
import { createControlState, randomizeVariation, tapTempo, updateControl } from "./src/manual-controls.js";
import { MidiOutput } from "./src/midi-output.js";
import { renderAll, renderLoadError } from "./src/ui-render.js";

const refs = {
  profileList: document.querySelector("#profile-list"),
  profileCount: document.querySelector("#profile-count"),
  profileId: document.querySelector("#profile-id"),
  profileLabel: document.querySelector("#profile-label"),
  profileDescription: document.querySelector("#profile-description"),
  tabs: [...document.querySelectorAll(".tab-button")],
  views: {
    profile: document.querySelector("#view-profile"),
    translation: document.querySelector("#view-translation"),
    preview: document.querySelector("#view-preview"),
    policy: document.querySelector("#view-policy"),
    manual: document.querySelector("#view-manual"),
    status: document.querySelector("#view-status"),
    roadmap: document.querySelector("#view-roadmap")
  }
};

const audioEngine = new AudioEngine();
const audioInput = new AudioInputAnalyzer();
const midiOutput = new MidiOutput();

const state = {
  profiles: [],
  patternFrames: [],
  policy: null,
  patternPolicy: null,
  version: null,
  patternVersion: null,
  activeId: null,
  activeView: "profile",
  loadStatus: "読み込み中",
  controlState: createControlState(defaultControls, null),
  bandFrame: { ...defaultBandInputFrame },
  memory: {
    barIndex: 0,
    lastPhraseAction: "lock",
    lastDecision: null,
    explodeCount: 0
  },
  playback: {
    isPlaying: false,
    timeoutId: null
  },
  currentDecision: null,
  currentFrame: null,
  currentBar: null,
  midiStatus: midiOutput.snapshot(),
  scores: []
};

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeId) || state.profiles[0];
}

function frameForProfile(profile, requestedId = state.controlState.controls.frame) {
  if (!state.patternFrames.length) return null;
  if (requestedId && requestedId !== "auto") {
    const requested = state.patternFrames.find((frame) => frame.id === requestedId);
    if (requested) return requested;
  }
  return state.patternFrames.find((frame) => frame.style_affinity?.includes(profile?.id)) || state.patternFrames[0];
}

function syncFrameControl(profile) {
  const frame = frameForProfile(profile);
  if (frame && (!state.controlState.controls.frame || state.controlState.controls.frame === "auto")) {
    state.controlState.controls.frame = frame.id;
  }
  return frame;
}

function updateCurrentBar() {
  const profile = activeProfile();
  if (!profile) return;
  state.controlState.controls = sanitizeControls(state.controlState.controls, profile);
  state.currentFrame = syncFrameControl(profile);
  state.bandFrame = audioInput.update();
  const manualIntent = createManualIntent(state.controlState.controls);
  state.currentDecision = createGrooveDecision(profile, manualIntent, state.bandFrame, state.memory);
  state.currentBar = generateGrooveBar(profile, state.controlState.controls, state.currentDecision, state.memory, state.currentFrame);
}

function render() {
  updateCurrentBar();
  renderAll(refs, state);
}

function clearPlaybackTimer() {
  if (state.playback.timeoutId) {
    clearTimeout(state.playback.timeoutId);
    state.playback.timeoutId = null;
  }
}

function scheduleNextBar(delayMs = 0) {
  if (!state.playback.isPlaying) return;
  clearPlaybackTimer();
  state.playback.timeoutId = setTimeout(() => {
    const profile = activeProfile();
    if (!profile || !state.playback.isPlaying) return;
    updateCurrentBar();
    const context = audioEngine.ensure();
    audioEngine.scheduleBar(state.currentBar, state.controlState.controls, context.currentTime + 0.05);
    if (state.controlState.controls.midiEnabled) midiOutput.sendBar(state.currentBar, state.controlState.controls);
    renderAll(refs, state);
    state.memory = updatePhraseMemory(state.memory, state.currentDecision);
    const barDuration = 60 / state.controlState.controls.bpm * 4;
    scheduleNextBar(barDuration * 1000);
  }, delayMs);
}

async function startPlayback() {
  await audioEngine.resume();
  state.playback.isPlaying = true;
  scheduleNextBar(0);
  render();
}

function stopPlayback() {
  clearPlaybackTimer();
  state.playback.isPlaying = false;
  render();
}

function panicStop() {
  clearPlaybackTimer();
  state.playback.isPlaying = false;
  audioEngine.panic();
  render();
}

async function enableInput() {
  try {
    state.bandFrame = await audioInput.start();
  } catch (error) {
    state.bandFrame = { ...defaultBandInputFrame, status: `permission denied: ${error.message}` };
  }
  render();
}

function disableInput() {
  state.bandFrame = audioInput.stop();
  render();
}

async function connectMidi() {
  try {
    state.midiStatus = await midiOutput.connect();
  } catch (error) {
    state.midiStatus = { connected: false, outputs: [], status: `MIDI unavailable: ${error.message}` };
  }
  render();
}

function setActiveView(view) {
  state.activeView = view;
  renderAll(refs, state);
}

async function loadProfiles() {
  try {
    const [profileResponse, frameResponse] = await Promise.all([
      fetch("profiles/groove-profiles.json", { cache: "no-store" }),
      fetch("patterns/drum-pattern-frames.json", { cache: "no-store" })
    ]);
    if (!profileResponse.ok) throw new Error(`profile JSONの取得に失敗しました: ${profileResponse.status}`);
    if (!frameResponse.ok) throw new Error(`pattern frame JSONの取得に失敗しました: ${frameResponse.status}`);
    const data = await profileResponse.json();
    const frameData = await frameResponse.json();
    state.profiles = data.profiles;
    state.patternFrames = frameData.frames || [];
    state.policy = data.policy;
    state.patternPolicy = frameData.policy;
    state.version = data.version;
    state.patternVersion = frameData.version;
    state.activeId = state.profiles[0]?.id;
    state.loadStatus = "読み込み成功";
    state.controlState.controls = sanitizeControls(state.controlState.controls, activeProfile());
    state.currentFrame = syncFrameControl(activeProfile());
    render();
  } catch (error) {
    state.loadStatus = "読み込み失敗";
    renderLoadError(refs, state, error);
  }
}

refs.profileList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-id]");
  if (!button) return;
  state.activeId = button.dataset.profileId;
  state.controlState.controls.frame = "auto";
  state.memory = { ...state.memory, barIndex: 0, lastPhraseAction: "lock" };
  render();
});

refs.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveView(tab.dataset.view));
});

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "start") startPlayback();
  if (action === "stop") stopPlayback();
  if (action === "panic") panicStop();
  if (action === "tap") {
    tapTempo(state.controlState, activeProfile());
    render();
  }
  if (action === "variation") {
    randomizeVariation(state.controlState, activeProfile());
    render();
  }
  if (action === "live-toggle") {
    updateControl(state.controlState, "liveMode", !state.controlState.controls.liveMode, activeProfile());
    render();
  }
  if (action === "enable-input") enableInput();
  if (action === "disable-input") disableInput();
  if (action === "connect-midi") connectMidi();
});

document.addEventListener("click", (event) => {
  const score = event.target.closest("[data-score]")?.dataset.score;
  if (!score) return;
  state.scores.push({ score, barIndex: state.currentBar?.barIndex ?? 0, at: new Date().toISOString() });
  event.target.classList.add("is-scored");
});

document.addEventListener("input", (event) => {
  const control = event.target.closest("[data-control]");
  if (!control) return;
  updateControl(state.controlState, control.dataset.control, control.type === "checkbox" ? control.checked : control.value, activeProfile());
  render();
});

document.addEventListener("change", (event) => {
  const control = event.target.closest("[data-control]");
  if (!control) return;
  updateControl(state.controlState, control.dataset.control, control.type === "checkbox" ? control.checked : control.value, activeProfile());
  render();
});

window.addEventListener("pagehide", () => {
  clearPlaybackTimer();
  audioInput.stop();
});

loadProfiles();
