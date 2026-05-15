import { clamp, hashString } from "./contracts.js";

const SECTION_MAP = Object.freeze({
  drift: "verse",
  repeat: "chorus",
  punch: "chorus",
  void: "bridge",
  self_running: "verse",
  manual: "verse",
  intro: "verse",
  verse: "verse",
  chorus: "chorus",
  bridge: "bridge",
  end: "end"
});

function unit(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, 0, 1);
}

function percent(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, 0, 100);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizedSection(section) {
  return SECTION_MAP[String(section || "").toLowerCase()] || "verse";
}

function destinationFromTargetRepo(targetRepo) {
  const map = {
    Music: "music",
    "drum-floor": "drum_floor",
    namima: "namima",
    chill: "chill",
    OpenClaw: "openclaw"
  };
  return map[targetRepo] || "openclaw";
}

function normalizeMusicPacket(packet) {
  if (!packet || packet.version !== "music-orchestra-packet.v1") return packet;
  const musicState = asObject(packet.music_state);
  const performance = asObject(musicState.performance_summary);
  const routing = asObject(packet.routing);
  const drum = asObject(routing.drum_floor);
  const openclaw = asObject(routing.openclaw);
  const promotion = asObject(packet.promotion);
  return {
    version: 1,
    source_repo: "Music",
    created_at: packet.created_at,
    session_id: packet.session_id,
    mode: musicState.mode || "orchestra",
    reference_gradient: {
      weights: asObject(packet.reference_gradient)
    },
    ucm_state: asObject(musicState.ucm_state),
    performance_state: {
      active_pad: performance.active_pad || null,
      recent_pads: Array.isArray(performance.recent_pads) ? performance.recent_pads : [],
      automix_enabled: !!performance.automix_enabled,
      mic_follow: asObject(packet.mic_follow),
      radio_brain: { program: performance.radio_program || null, metadata_only: true },
      hazama_fm: performance.hazama_fm_genre ? { genre: performance.hazama_fm_genre, integration_mode: "metadata-only" } : null
    },
    routing: {
      drum_floor: {
        enabled: drum.enabled !== false,
        groove_intent: {
          style: String(drum.intent || "").toLowerCase().includes("dry") ? "dry_grid" : "soft_pocket",
          review_only: true
        },
        review_reason: drum.intent || drum.next_action || "Music orchestra packetから作る手動preview候補。",
        review_only: true
      },
      openclaw: {
        enabled: true,
        promotion_status: promotion.status || "draft",
        human_review_required: true,
        next_action: {
          destination: destinationFromTargetRepo(promotion.target_repo),
          label: promotion.target_repo || "OpenClaw",
          reason: promotion.reviewer_note || openclaw.intent || "",
          action: openclaw.next_action || promotion.rollback || "",
          metadata_only: true
        },
        review_only: true
      }
    },
    safety: {
      stores_audio: false,
      stores_samples: false,
      stores_lyrics: false,
      metadata_only: true,
      human_review_required: true
    }
  };
}

function musicPacketMode(packet) {
  return String(packet?.mode || "").toLowerCase();
}

function micFollowSummary(packet) {
  const mic = asObject(asObject(packet?.performance_state).mic_follow);
  const gesture = String(mic.gesture || "silent").toLowerCase();
  const confidence = unit(mic.confidence);
  const enabled = mic.enabled === true && confidence > 0.08;
  return {
    enabled,
    gesture,
    drive: unit(mic.drive),
    pulse: unit(mic.pulse),
    clap: unit(mic.clap),
    hum: unit(mic.hum),
    air: unit(mic.air),
    noisy: unit(mic.noisy),
    bpmLock: clamp(Number(mic.bpm_lock) || 0, 0, 240),
    confidence
  };
}

function micRhythmBias(mic) {
  if (!mic.enabled) return 0;
  const gestureBoost = mic.gesture === "clap" || mic.gesture === "pulse" ? 0.18 : 0;
  return clamp(Math.max(mic.pulse, mic.clap, mic.drive * 0.72) + gestureBoost, 0, 1) * mic.confidence;
}

function micAirBias(mic) {
  if (!mic.enabled) return 0;
  const gestureBoost = mic.gesture === "breath" || mic.gesture === "hum" || mic.gesture === "silent" ? 0.18 : 0;
  return clamp(Math.max(mic.air, mic.hum * 0.72) + gestureBoost, 0, 1) * mic.confidence;
}

function chooseProfileId(packet, drum, gradient, density, pressure, mic) {
  const intent = asObject(drum.groove_intent);
  const style = String(intent.style || "").toLowerCase();
  const section = String(drum.section || "").toLowerCase();
  const mode = musicPacketMode(packet);
  const rhythm = micRhythmBias(mic);
  const air = micAirBias(mic);

  if (rhythm > 0.34 && pressure > 0.52) return "raw_live_drum_drive";
  if (rhythm > 0.24 || mic?.gesture === "clap" || mic?.gesture === "pulse") return "breakbeat_live";
  if (air > 0.26) return "dubby_half_time";
  if (style.includes("dry_grid") || mode.includes("techno")) return "breakbeat_live";
  if (style.includes("ghost_pressure") || pressure > 0.68 || section === "punch") return "raw_live_drum_drive";
  if (style.includes("broken") || mode.includes("idm") || gradient.micro > 0.48) return "nerdy_jazzy_hiphop";
  if (section === "void" || gradient.haze > 0.56 || density < 0.26) return "dubby_half_time";
  return "nerdy_jazzy_hiphop";
}

function chooseFrameId(profileId, packet, drum, gradient, pressure, mic) {
  const section = String(drum.section || "").toLowerCase();
  const intent = asObject(drum.groove_intent);
  const style = String(intent.style || "").toLowerCase();

  if (profileId === "raw_live_drum_drive") return "raw_live_break_drive";
  if (micRhythmBias(mic) > 0.24) return "live_break_pressure";
  if (micAirBias(mic) > 0.24) return "dub_space_lift";
  if (style.includes("dry_grid") || pressure > 0.66) return "live_break_pressure";
  if (section === "void" || gradient.haze > 0.58 || musicPacketMode(packet) === "ambient") return "dub_space_lift";
  if (style.includes("broken") || gradient.micro > 0.46) return "jazzy_ghost_glue";
  return "deep_neo_soul_pocket";
}

function chooseKit(profileId, packet, drum, pressure, mic) {
  const section = String(drum.section || "").toLowerCase();
  const style = String(asObject(drum.groove_intent).style || "").toLowerCase();
  if (micAirBias(mic) > 0.28) return "dub_space";
  if (micRhythmBias(mic) > 0.26) return "live_breaker";
  if (section === "void" || musicPacketMode(packet) === "ambient") return "dub_space";
  if (profileId === "raw_live_drum_drive" || pressure > 0.66) return "live_breaker";
  if (style.includes("broken") || style.includes("soft")) return "dusty_pocket";
  return "hard_bop_room";
}

function estimateBpm(packet, density, pressure, mic = {}) {
  const mode = musicPacketMode(packet);
  let base = 84 + density * 34 + pressure * 10;
  if (mode.includes("techno")) base = 126;
  else if (mode.includes("idm") || mode.includes("reference_gradient")) base = 96 + density * 28 + pressure * 10;
  else if (mode.includes("ambient")) base = 72 + density * 18;
  if (mic.enabled && mic.bpmLock > 0 && mic.confidence > 0.3) {
    base = base * 0.74 + mic.bpmLock * 0.26;
  }
  return Math.round(clamp(base, 54, 190));
}

function packetBpmHint(packet, drum) {
  const sourceSong = asObject(drum.source_song);
  const candidates = [
    drum.bpm,
    sourceSong.bpm,
    sourceSong.tempo,
    asObject(packet?.performance_state).bpm,
    packet?.bpm
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return Math.round(clamp(value, 54, 190));
  }
  return 0;
}

export function translateMusicSessionPacket(packet, options = {}) {
  packet = normalizeMusicPacket(packet);
  const routing = asObject(packet?.routing);
  const drum = asObject(routing.drum_floor);
  const openclaw = asObject(routing.openclaw);
  const nextAction = asObject(openclaw.next_action);
  const ucm = asObject(packet?.ucm_state);
  const gradient = asObject(packet?.reference_gradient?.weights);
  const mic = micFollowSummary(packet);
  const bpmHint = packetBpmHint(packet, drum);
  const rhythmBias = micRhythmBias(mic);
  const airBias = micAirBias(mic);
  const density = unit(drum.density, percent(ucm.energy, 30) / 100);
  const pressure = unit(drum.pressure, percent(ucm.body, 20) / 100);
  const shapedDensity = clamp(density + rhythmBias * 0.14 - airBias * 0.08, 0, 1);
  const shapedPressure = clamp(pressure + rhythmBias * 0.08 + mic.noisy * 0.04 - airBias * 0.05, 0, 1);
  const profileId = chooseProfileId(packet, drum, gradient, shapedDensity, shapedPressure, mic);
  const frameId = chooseFrameId(profileId, packet, drum, gradient, shapedPressure, mic);
  const kit = chooseKit(profileId, packet, drum, shapedPressure, mic);
  const section = normalizedSection(drum.section || packet?.performance_state?.active_pad);
  const energy = percent(ucm.energy, density * 100);
  const micro = unit(gradient.micro);
  const ghost = unit(gradient.ghost);
  const organic = unit(gradient.organic);
  const voidness = percent(ucm.void, 0) / 100;
  const resource = percent(ucm.resource, 0) / 100;

  const controls = {
    bpm: clamp(Number(options.bpm) || bpmHint || estimateBpm(packet, shapedDensity, shapedPressure, mic), 54, 190),
    section,
    energy: Math.round(clamp(energy, 0, 100)),
    density: Math.round(clamp(shapedDensity * 72 + resource * 18 + shapedPressure * 10, 8, 92)),
    swing: Math.round(clamp(4 + micro * 7 + organic * 5 - shapedPressure * 2 + airBias * 4, 0, 18)),
    humanize: Math.round(clamp(30 + micro * 24 + ghost * 20 + organic * 12 + airBias * 8 - rhythmBias * 3, 18, 92)),
    kit,
    frame: frameId,
    risk: Math.round(clamp(16 + shapedPressure * 24 + micro * 12 + mic.noisy * 8, 8, 58)),
    space: Math.round(clamp(24 + voidness * 38 + unit(gradient.haze) * 18 - shapedPressure * 12 + airBias * 18, 12, 86)),
    lift: Math.round(clamp(22 + resource * 30 + shapedPressure * 24 + shapedDensity * 16 + rhythmBias * 10, 12, 86)),
    fillDemand: Math.round(clamp(10 + micro * 24 + shapedPressure * 18 + rhythmBias * 18 + (section === "chorus" ? 12 : 0), 4, 68)),
    crashGate: shapedPressure > 0.62 && section !== "bridge" && rhythmBias < 0.54,
    aiMode: "follow",
    inputLock: true,
    liveMode: false,
    midiEnabled: false
  };

  return {
    schema: "drum-floor.music-session-groove-adapter.v1",
    source_repo: "Music",
    source_session_id: packet?.session_id || "",
    enabled: drum.enabled !== false,
    review_only: true,
    profileId,
    frameId,
    controls,
    intent: {
      style: asObject(drum.groove_intent).style || "soft_pocket",
      section,
      density: shapedDensity,
      pressure: shapedPressure,
      ghost_notes: unit(asObject(drum.groove_intent).ghost_notes, ghost),
      micro,
      mic_follow: {
        enabled: mic.enabled,
        gesture: mic.gesture,
        drive: Number(mic.drive.toFixed(3)),
        confidence: Number(mic.confidence.toFixed(3)),
        bpm_lock: Math.round(mic.bpmLock),
        rhythm_bias: Number(rhythmBias.toFixed(3)),
        air_bias: Number(airBias.toFixed(3))
      },
      review_reason: String(drum.review_reason || "Music packetから作る手動preview候補。")
    },
    stack_route: {
      destination: String(nextAction.destination || ""),
      label: String(nextAction.label || ""),
      reason: String(nextAction.reason || ""),
      action: String(nextAction.action || ""),
      recommended_here: String(nextAction.destination || "") === "drum_floor"
    },
    fingerprint: hashString(JSON.stringify({ profileId, frameId, controls, nextAction })).toString(16),
    safety: {
      stores_audio: false,
      stores_samples: false,
      metadata_only: true,
      human_review_required: true,
      auto_arm: false
    }
  };
}

if (typeof window !== "undefined") {
  window.DrumFloorMusicSessionAdapter = {
    translateMusicSessionPacket
  };
}
