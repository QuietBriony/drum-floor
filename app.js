import { AudioInputAnalyzer } from "./src/audio-analysis.js";
import { AudioEngine } from "./src/audio-engine.js";
import { createGrooveDecision, createManualIntent, updatePhraseMemory } from "./src/coplayer.js";
import { defaultBandInputFrame, defaultControls, sanitizeControls } from "./src/contracts.js";
import { generateGrooveBar } from "./src/groove-engine.js";
import { createControlState, randomizeVariation, tapTempo, updateControl } from "./src/manual-controls.js";
import { MidiOutput } from "./src/midi-output.js";
import { translateMusicSessionPacket } from "./src/music-session-adapter.js?v=band-room-bpm-1";
import { renderAll, renderLoadError } from "./src/ui-render.js?v=organic-flow-v1";

const MUSIC_STACK_PACKET_STORAGE_KEY = "qb:music-stack:latest-packet:v1";
const MUSIC_STACK_CHANNEL_NAME = "qb:music-stack:v1";
const MUSIC_ORCHESTRA_PACKET_STORAGE_KEY = "qb:music-stack:latest-orchestra-packet:v1";
const MUSIC_ORCHESTRA_CHANNEL_NAME = "qb:music-stack:orchestra:v1";
const MUSIC_APP_BASE_URL = "https://quietbriony.github.io/Music/";
const FM_GENRE_HINTS = Object.freeze({
  ambient: { style: "soft_pocket", section: "bridge", energy: 30, body: 24, resource: 42, void: 64, ghost: 0.28, micro: 0.18, organic: 0.44, haze: 0.72 },
  techno: { style: "dry_grid", section: "chorus", energy: 78, body: 82, resource: 70, void: 8, ghost: 0.36, micro: 0.58, organic: 0.22, haze: 0.18 },
  lofi: { style: "broken_organic", section: "verse", energy: 42, body: 44, resource: 56, void: 28, ghost: 0.54, micro: 0.48, organic: 0.66, haze: 0.58 },
  jazz: { style: "soft_pocket", section: "verse", energy: 42, body: 52, resource: 62, void: 18, ghost: 0.62, micro: 0.32, organic: 0.74, haze: 0.34 },
  funk: { style: "ghost_pressure", section: "chorus", energy: 66, body: 76, resource: 68, void: 14, ghost: 0.68, micro: 0.44, organic: 0.58, haze: 0.22 },
  piano: { style: "soft_pocket", section: "verse", energy: 30, body: 30, resource: 54, void: 34, ghost: 0.24, micro: 0.18, organic: 0.52, haze: 0.48 }
});

const refs = {
  profileList: document.querySelector("#profile-list"),
  profileCount: document.querySelector("#profile-count"),
  profileId: document.querySelector("#profile-id"),
  profileLabel: document.querySelector("#profile-label"),
  profileDescription: document.querySelector("#profile-description"),
  musicPacketInput: document.querySelector("#music-packet-input"),
  musicPacketStatus: document.querySelector("#music-packet-status"),
  musicPacketOutput: document.querySelector("#music-packet-output"),
  musicReturnContext: document.querySelector("#music-return-context"),
  returnBandRoom: document.querySelector("#return-band-room"),
  returnHazamaFm: document.querySelector("#return-hazama-fm"),
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
  activeView: "preview",
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
  scoreDraft: {
    candidate: "live/candidates/ableton-ep133-seed-42",
    target: "ableton",
    reviewer: "human-gate",
    scores: {
      pocket: 4,
      space: 4,
      bass_lock: 4,
      ghost_glue: 4,
      snare_lag_feel: 4,
      fill_naturalness: 3,
      mix_weight: 4,
      surprise: 3,
      repeatability: 4
    },
    notes: {
      what_worked: "Pocket sits well",
      what_failed: "Fill can be rarer",
      next_hint: "Reduce fill pressure"
    }
  },
  suggestionDraft: {
    scoresDir: "evolution/listening-notes",
    frame: "deep_neo_soul_pocket",
    agent: "pocket-director-agent",
    out: "evolution/suggestions"
  },
  promotionDraft: {
    reviewer: "human-gate",
    scoreFiles: "evolution/listening-notes/deep-pocket-score-001.json",
    suggestionFile: "evolution/suggestions/deep_neo_soul_pocket-20260503T000000Z.json",
    patternFrame: "deep_neo_soul_pocket",
    field: "pocket_director.ghost_glue",
    from: "0.86",
    to: "0.88",
    reason: "Listening scores favored more connective ghost texture while keeping space high.",
    musicalIntent: "Keep the drummer relaxed and behind the beat while adding a little more glue between bass answers.",
    listeningSummary: "Ableton preview felt strong in space and pocket, but the transition into the next phrase could connect more softly.",
    acceptanceCondition: "The next generated candidate should keep fill density low and improve ghost continuity without making hats busier.",
    rollbackStrategy: "Open a normal PR restoring the previous value if listening gets cluttered."
  },
  copyStatus: "",
  musicPacket: {
    translation: null,
    packet: null,
    pendingSync: null
  }
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

function escapeText(value) {
  return String(value ?? "");
}

function updatePacketStatus(message, type = "") {
  if (!refs.musicPacketStatus) return;
  refs.musicPacketStatus.textContent = message;
  refs.musicPacketStatus.classList.toggle("is-ok", type === "ok");
  refs.musicPacketStatus.classList.toggle("is-error", type === "error");
}

function renderPacketTranslation(translation) {
  if (!refs.musicPacketOutput) return;
  refs.musicPacketOutput.textContent = JSON.stringify({
    source_session_id: translation.source_session_id,
    profile: translation.profileId,
    frame: translation.frameId,
    controls: translation.controls,
    intent: translation.intent,
    stack_route: translation.stack_route,
    safety: translation.safety
  }, null, 2);
}

function musicPacketMicHint(translation) {
  const mic = translation?.intent?.mic_follow;
  if (!mic || !mic.enabled) return "";
  const drive = Math.round(Number(mic.drive || 0) * 100);
  const label = String(mic.gesture || "mic").toUpperCase();
  return ` MIC ${label}${drive ? ` ${drive}%` : ""}を反映。`;
}

function musicUrl(path, params = {}) {
  const url = new URL(path, MUSIC_APP_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function sourceSongFromPacket(packet) {
  return packet?.routing?.drum_floor?.source_song || {};
}

function hazamaFmContextFromPacket(packet) {
  const drumHazama = packet?.routing?.drum_floor?.hazama_fm || {};
  const perfHazama = packet?.performance_state?.hazama_fm || {};
  return {
    genre: drumHazama.genre || perfHazama.genre || perfHazama.listening_trace?.current_genre || "",
    energy: drumHazama.energy || perfHazama.listening_trace?.current_energy || "",
    bpm: Number(drumHazama.bpm || perfHazama.listening_trace?.bpm || packet?.routing?.drum_floor?.bpm || 0) || null
  };
}

function bandRoomQueryHint() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "band-room") return null;
  const hint = {
    band_id: params.get("band") || "",
    song_id: params.get("song") || "",
    bpm: Number(params.get("bpm") || 0) || null,
    source_section: params.get("section") || "",
    frame_id: params.get("frame") || ""
  };
  return hint.song_id || hint.bpm || hint.source_section || hint.frame_id ? hint : null;
}

function fmQueryHint() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "fm") return null;
  const genre = String(params.get("g") || params.get("genre") || "").toLowerCase();
  const energy = String(params.get("energy") || "mid").toLowerCase();
  const hint = {
    genre: FM_GENRE_HINTS[genre] ? genre : "",
    energy: ["low", "mid", "high"].includes(energy) ? energy : "mid",
    bpm: Number(params.get("bpm") || 0) || null
  };
  return hint.genre || hint.bpm ? hint : null;
}

function packetBpmValue(packet) {
  const drum = packet?.routing?.drum_floor || {};
  const sourceSong = sourceSongFromPacket(packet);
  const hazama = hazamaFmContextFromPacket(packet);
  const candidates = [
    drum.bpm,
    sourceSong.bpm,
    sourceSong.tempo,
    hazama.bpm,
    packet?.performance_state?.bpm,
    packet?.bpm
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }
  return 0;
}

function packetMatchesBandRoomQuery(packet, hint = bandRoomQueryHint()) {
  if (!hint) return true;
  const sourceSong = sourceSongFromPacket(packet);
  const drum = packet?.routing?.drum_floor || {};
  if (hint.song_id && sourceSong.song_id !== hint.song_id) return false;
  if (hint.frame_id && sourceSong.frame_id && sourceSong.frame_id !== hint.frame_id) return false;
  const sourceSection = sourceSong.source_section || drum.section || "";
  if (hint.source_section && sourceSection && sourceSection !== hint.source_section) return false;
  const packetBpm = packetBpmValue(packet);
  if (hint.bpm && packetBpm && Math.abs(packetBpm - hint.bpm) > 2) return false;
  return true;
}

function packetMatchesFmQuery(packet, hint = fmQueryHint()) {
  if (!hint) return true;
  const hazama = hazamaFmContextFromPacket(packet);
  const mode = String(packet?.mode || "").toLowerCase();
  const packetGenre = hazama.genre || (FM_GENRE_HINTS[mode] ? mode : "");
  if (hint.genre && packetGenre !== hint.genre) return false;
  const packetBpm = packetBpmValue(packet);
  if (hint.bpm && packetBpm && Math.abs(packetBpm - hint.bpm) > 4) return false;
  return true;
}

function packetMatchesIncomingQuery(packet) {
  return packetMatchesBandRoomQuery(packet) && packetMatchesFmQuery(packet);
}

function packetFromBandRoomQuery(hint = bandRoomQueryHint()) {
  if (!hint) return null;
  const section = hint.source_section || "preview";
  return {
    source_repo: "Music",
    mode: "band_room",
    session_id: `band-room-query-${hint.song_id || "current"}`,
    created_at: new Date().toISOString(),
    reference_gradient: { weights: { organic: 0.72, pulse: 0.5, ghost: 0.42, micro: 0.35 } },
    ucm_state: { energy: 58, body: 62, resource: 56, void: section === "bridge" ? 32 : 12 },
    performance_state: { active_pad: section, recent_pads: [section, "band-room"] },
    routing: {
      drum_floor: {
        enabled: true,
        section,
        source_song: {
          band_id: hint.band_id || "tabasco",
          song_id: hint.song_id || "",
          song_title: hint.song_id || "Band Room song",
          bpm: hint.bpm || null,
          source_section: section,
          frame_id: hint.frame_id || ""
        },
        review_reason: "Band Room URL handoff fallback. Use this only when localStorage SYNC is unavailable or stale.",
        review_only: true
      }
    },
    safety: { metadata_only: true, human_review_required: true }
  };
}

function packetFromFmQuery(hint = fmQueryHint()) {
  if (!hint) return null;
  const genre = hint.genre || "lofi";
  const info = FM_GENRE_HINTS[genre] || FM_GENRE_HINTS.lofi;
  const energyBoost = hint.energy === "high" ? 8 : hint.energy === "low" ? -8 : 0;
  const bpm = hint.bpm || null;
  return {
    source_repo: "Music",
    mode: genre,
    session_id: `hazama-fm-query-${genre}`,
    created_at: new Date().toISOString(),
    reference_gradient: {
      weights: {
        ghost: info.ghost,
        micro: info.micro,
        organic: info.organic,
        haze: info.haze
      }
    },
    ucm_state: {
      energy: Math.max(0, Math.min(100, info.energy + energyBoost)),
      body: info.body,
      resource: info.resource,
      void: info.void
    },
    performance_state: {
      active_pad: info.section,
      recent_pads: [info.section, "hazama-fm", genre],
      hazama_fm: {
        active: false,
        genre,
        listening_trace: {
          current_genre: genre,
          current_energy: hint.energy,
          bpm,
          dwell_ms_by_genre: { [genre]: 0 },
          switch_count: 0
        },
        integration_mode: "metadata-only",
        review_only: true
      }
    },
    routing: {
      drum_floor: {
        enabled: true,
        section: info.section,
        bpm,
        hazama_fm: {
          genre,
          energy: hint.energy,
          bpm,
          metadata_only: true
        },
        groove_intent: {
          style: info.style,
          ghost_notes: info.ghost,
          micro: info.micro,
          articulation: genre === "techno" ? "dry_repeat" : genre === "funk" ? "body_snap" : "human_pocket",
          review_only: true
        },
        review_reason: "Hazama FM URL handoff fallback. Use this only when shared SYNC is unavailable or stale.",
        review_only: true
      }
    },
    safety: { metadata_only: true, human_review_required: true }
  };
}

function readIncomingQueryPacket() {
  const packet = packetFromBandRoomQuery() || packetFromFmQuery();
  if (!packet) return false;
  return receiveMusicStackPacket(packet, packet.mode === "band_room" ? "band-room-query" : "fm-query");
}

function fmGenreForTranslation(packet, translation) {
  const mode = String(packet?.mode || "").toLowerCase();
  if (["ambient", "techno", "lofi", "jazz", "funk", "piano"].includes(mode)) return mode;
  const profile = String(translation?.profileId || "");
  const frame = String(translation?.frameId || "");
  const haystack = `${profile} ${frame}`.toLowerCase();
  if (haystack.includes("jazz")) return "jazz";
  if (haystack.includes("funk") || haystack.includes("shout")) return "funk";
  if (haystack.includes("breakbeat") || haystack.includes("hiphop")) return "lofi";
  if (haystack.includes("dub") || haystack.includes("space")) return "ambient";
  if (haystack.includes("rock") || haystack.includes("drive")) return "techno";
  return "";
}

function refreshMusicReturnLinks(packet = null, translation = null) {
  const sourceSong = sourceSongFromPacket(packet);
  const hazama = hazamaFmContextFromPacket(packet);
  const section = sourceSong.source_section || packet?.routing?.drum_floor?.section || "";
  const songTitle = sourceSong.song_title || sourceSong.song_id || "";
  const context = songTitle
    ? `${songTitle}${section ? ` / ${section}` : ""}`
    : hazama.genre
      ? `Hazama FM / ${hazama.genre}${hazama.bpm ? ` / ${hazama.bpm}bpm` : ""}`
    : "Music Stack";
  if (refs.musicReturnContext) refs.musicReturnContext.textContent = context;
  if (refs.returnBandRoom) {
    const fromFm = hazama.genre && !sourceSong.song_id;
    refs.returnBandRoom.href = musicUrl("band-room.html", fromFm
      ? {
          from: "fm",
          g: hazama.genre
        }
      : {
          from: "drum-floor",
          band: sourceSong.band_id,
          song: sourceSong.song_id,
          section,
          frame: sourceSong.frame_id,
          bpm: sourceSong.bpm
        });
  }
  if (refs.returnHazamaFm) {
    refs.returnHazamaFm.href = musicUrl("fm.html", {
      from: "drum-floor",
      g: fmGenreForTranslation(packet, translation) || hazama.genre,
      energy: hazama.energy,
      bpm: hazama.bpm
    });
  }
}

function readMusicPacket() {
  const raw = refs.musicPacketInput?.value.trim() || "";
  if (!raw) {
    updatePacketStatus("SYNCが届かない時だけMusic JSONを貼ってください。", "error");
    return null;
  }
  try {
    const packet = JSON.parse(raw);
    const translation = translateMusicSessionPacket(packet);
    state.musicPacket = { packet, translation };
    renderPacketTranslation(translation);
    refreshMusicReturnLinks(packet, translation);
    const route = translation.stack_route;
    const routeHint = route?.label
      ? ` Music推奨: ${route.label}${route.recommended_here ? "。" : "。drum-floorは候補として反映。"}`
      : "";
    updatePacketStatus(`OK: ${escapeText(translation.source_session_id || "Music packet")} を ${translation.profileId} / ${translation.frameId} へ翻訳しました。${escapeText(musicPacketMicHint(translation))}${escapeText(routeHint)}`, "ok");
    return translation;
  } catch (error) {
    state.musicPacket = { packet: null, translation: null };
    if (refs.musicPacketOutput) refs.musicPacketOutput.textContent = "読めませんでした。JSON形式を確認してください。";
    updatePacketStatus(`JSONを読めません: ${error.message}`, "error");
    return null;
  }
}

function applyMusicPacketPreview(options = {}) {
  const translation = state.musicPacket.translation || readMusicPacket();
  if (!translation) return;
  if (!state.profiles.length) {
    state.musicPacket.pendingSync = state.musicPacket.packet;
    updatePacketStatus("SYNCを受信しました。profiles読み込み後にpreviewへ反映します。", "ok");
    return;
  }
  const nextProfile = state.profiles.find((profile) => profile.id === translation.profileId);
  if (nextProfile) state.activeId = nextProfile.id;
  state.controlState.controls = sanitizeControls({
    ...state.controlState.controls,
    ...translation.controls,
    midiEnabled: false,
    liveMode: false
  }, activeProfile());
  state.controlState.controls.frame = translation.frameId;
  state.memory = { ...state.memory, barIndex: 0, lastPhraseAction: "lock" };
  state.activeView = "preview";
  const route = translation.stack_route;
  const routeHint = route?.label
    ? ` Music推奨: ${route.label}${route.recommended_here ? "。ここで再生。" : "。ここは候補preview。"}`
    : "";
  updatePacketStatus(options.message || `preview controlsへ反映しました。再生は人間が押すまで鳴りません。${musicPacketMicHint(translation)}${routeHint}`, "ok");
  render();
}

function clearMusicPacket() {
  if (refs.musicPacketInput) refs.musicPacketInput.value = "";
  if (refs.musicPacketOutput) refs.musicPacketOutput.textContent = "まだ読んでいません。";
  state.musicPacket = { packet: null, translation: null };
  refreshMusicReturnLinks();
  updatePacketStatus("MusicでSYNCすると自動受信します。貼り付け欄はfallbackです。");
}

function musicPacketFromStackPayload(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.packet && typeof payload.packet === "object" && payload.packet.source_repo === "Music") return payload.packet;
  if (payload.packet && typeof payload.packet === "object" && payload.packet.version === "music-orchestra-packet.v1") return payload.packet;
  if (payload.version === "music-orchestra-packet.v1") return payload;
  if (payload.source_repo === "Music") return payload;
  return null;
}

function receiveMusicStackPacket(payload, source = "sync") {
  const packet = musicPacketFromStackPayload(payload);
  if (!packet) return false;
  try {
    const translation = translateMusicSessionPacket(packet);
    state.musicPacket = { packet, translation, pendingSync: state.profiles.length ? null : packet };
    if (refs.musicPacketInput) refs.musicPacketInput.value = JSON.stringify(packet, null, 2);
    renderPacketTranslation(translation);
    refreshMusicReturnLinks(packet, translation);
    const route = translation.stack_route;
    const routeHint = route?.label
      ? ` Music推奨: ${route.label}${route.recommended_here ? "。再生で確認できます。" : "。drum-floorは候補として反映しました。"}`
      : "";
    applyMusicPacketPreview({
      message: `SYNC受信: ${escapeText(translation.source_session_id || source)} をpreview controlsへ反映しました。再生は人間が押すまで鳴りません。${escapeText(musicPacketMicHint(translation))}${escapeText(routeHint)}`
    });
    return true;
  } catch (error) {
    updatePacketStatus(`SYNC packetを読めません: ${error.message}`, "error");
    return false;
  }
}

function readLatestMusicStackPacket() {
  try {
    const raw = window.localStorage?.getItem(MUSIC_STACK_PACKET_STORAGE_KEY)
      || window.localStorage?.getItem(MUSIC_ORCHESTRA_PACKET_STORAGE_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw);
    const packet = musicPacketFromStackPayload(payload);
    if (!packetMatchesIncomingQuery(packet)) return false;
    return receiveMusicStackPacket(payload, "latest");
  } catch (error) {
    updatePacketStatus(`latest SYNCを読めません: ${error.message}`, "error");
    return false;
  }
}

function readBandRoomQueryPacket() {
  const packet = packetFromBandRoomQuery();
  if (!packet) return false;
  return receiveMusicStackPacket(packet, "band-room-query");
}

function setupMusicStackSyncReceiver() {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.BroadcastChannel === "function") {
      const channel = new window.BroadcastChannel(MUSIC_STACK_CHANNEL_NAME);
      channel.addEventListener("message", (event) => receiveMusicStackPacket(event.data, "broadcast"));
      const orchestraChannel = new window.BroadcastChannel(MUSIC_ORCHESTRA_CHANNEL_NAME);
      orchestraChannel.addEventListener("message", (event) => receiveMusicStackPacket(event.data, "orchestra-broadcast"));
    }
  } catch (error) {
    console.warn("[drum-floor] Music stack BroadcastChannel unavailable:", error);
  }
  window.addEventListener("storage", (event) => {
    if (![MUSIC_STACK_PACKET_STORAGE_KEY, MUSIC_ORCHESTRA_PACKET_STORAGE_KEY].includes(event.key) || !event.newValue) return;
    try {
      receiveMusicStackPacket(JSON.parse(event.newValue), "storage");
    } catch (error) {
      updatePacketStatus(`storage SYNCを読めません: ${error.message}`, "error");
    }
  });
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
    if (state.musicPacket.pendingSync) applyMusicPacketPreview({ message: "SYNC受信分をpreview controlsへ反映しました。再生は人間が押すまで鳴りません。" });
    else if (!readLatestMusicStackPacket()) readIncomingQueryPacket();
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
  if (action === "copy-score-command") {
    const command = document.querySelector("#score-command")?.value || "";
    if (command && navigator.clipboard) {
      navigator.clipboard.writeText(command);
      state.copyStatus = "score commandをコピーしました";
    } else {
      state.copyStatus = "score commandを選択してコピーしてください";
    }
    render();
  }
  if (action === "copy-suggestion-command") {
    const command = document.querySelector("#suggestion-command")?.value || "";
    if (command && navigator.clipboard) {
      navigator.clipboard.writeText(command);
      state.copyStatus = "suggest-evolution commandをコピーしました";
    } else {
      state.copyStatus = "suggest-evolution commandを選択してコピーしてください";
    }
    render();
  }
  if (action === "copy-promotion-request") {
    const request = document.querySelector("#promotion-request-json")?.value || "";
    if (request && navigator.clipboard) {
      navigator.clipboard.writeText(request);
      state.copyStatus = "promotion request JSONをコピーしました";
    } else {
      state.copyStatus = "promotion request JSONを選択してコピーしてください";
    }
    render();
  }
  if (action === "read-music-packet") readMusicPacket();
  if (action === "apply-music-packet-preview") applyMusicPacketPreview();
  if (action === "clear-music-packet") clearMusicPacket();
});

document.addEventListener("click", (event) => {
  const score = event.target.closest("[data-score]")?.dataset.score;
  if (!score) return;
  state.scoreDraft.scores[score] = Math.min(5, (state.scoreDraft.scores[score] || 3) + 1);
  event.target.classList.add("is-scored");
  render();
});

document.addEventListener("input", (event) => {
  const control = event.target.closest("[data-control]");
  if (!control) return;
  updateControl(state.controlState, control.dataset.control, control.type === "checkbox" ? control.checked : control.value, activeProfile());
  render();
});

document.addEventListener("input", (event) => {
  const scoreControl = event.target.closest("[data-score-control]");
  if (scoreControl) {
    state.scoreDraft.scores[scoreControl.dataset.scoreControl] = Number(scoreControl.value);
    state.copyStatus = "";
    render();
    return;
  }
  const noteControl = event.target.closest("[data-note-control]");
  if (noteControl) {
    state.scoreDraft.notes[noteControl.dataset.noteControl] = noteControl.value;
    state.copyStatus = "";
    render();
    return;
  }
  const metaControl = event.target.closest("[data-score-meta]");
  if (metaControl) {
    state.scoreDraft[metaControl.dataset.scoreMeta] = metaControl.value;
    state.copyStatus = "";
    render();
    return;
  }
  const suggestionControl = event.target.closest("[data-suggestion-meta]");
  if (suggestionControl) {
    state.suggestionDraft[suggestionControl.dataset.suggestionMeta] = suggestionControl.value;
    state.copyStatus = "";
    render();
    return;
  }
  const promotionControl = event.target.closest("[data-promotion-meta]");
  if (promotionControl) {
    state.promotionDraft[promotionControl.dataset.promotionMeta] = promotionControl.value;
    state.copyStatus = "";
    render();
  }
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

setupMusicStackSyncReceiver();
loadProfiles();
