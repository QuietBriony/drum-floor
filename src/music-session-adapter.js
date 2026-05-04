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

function musicPacketMode(packet) {
  return String(packet?.mode || "").toLowerCase();
}

function chooseProfileId(packet, drum, gradient, density, pressure) {
  const intent = asObject(drum.groove_intent);
  const style = String(intent.style || "").toLowerCase();
  const section = String(drum.section || "").toLowerCase();
  const mode = musicPacketMode(packet);

  if (style.includes("dry_grid") || mode.includes("techno")) return "breakbeat_live";
  if (style.includes("ghost_pressure") || pressure > 0.68 || section === "punch") return "raw_live_drum_drive";
  if (style.includes("broken") || mode.includes("idm") || gradient.micro > 0.48) return "nerdy_jazzy_hiphop";
  if (section === "void" || gradient.haze > 0.56 || density < 0.26) return "dubby_half_time";
  return "nerdy_jazzy_hiphop";
}

function chooseFrameId(profileId, packet, drum, gradient, pressure) {
  const section = String(drum.section || "").toLowerCase();
  const intent = asObject(drum.groove_intent);
  const style = String(intent.style || "").toLowerCase();

  if (profileId === "raw_live_drum_drive") return "raw_live_break_drive";
  if (style.includes("dry_grid") || pressure > 0.66) return "live_break_pressure";
  if (section === "void" || gradient.haze > 0.58 || musicPacketMode(packet) === "ambient") return "dub_space_lift";
  if (style.includes("broken") || gradient.micro > 0.46) return "jazzy_ghost_glue";
  return "deep_neo_soul_pocket";
}

function chooseKit(profileId, packet, drum, pressure) {
  const section = String(drum.section || "").toLowerCase();
  const style = String(asObject(drum.groove_intent).style || "").toLowerCase();
  if (section === "void" || musicPacketMode(packet) === "ambient") return "dub_space";
  if (profileId === "raw_live_drum_drive" || pressure > 0.66) return "live_breaker";
  if (style.includes("broken") || style.includes("soft")) return "dusty_pocket";
  return "hard_bop_room";
}

function estimateBpm(packet, density, pressure) {
  const mode = musicPacketMode(packet);
  if (mode.includes("techno")) return 126;
  if (mode.includes("idm") || mode.includes("reference_gradient")) return Math.round(96 + density * 28 + pressure * 10);
  if (mode.includes("ambient")) return Math.round(72 + density * 18);
  return Math.round(84 + density * 34 + pressure * 10);
}

export function translateMusicSessionPacket(packet, options = {}) {
  const routing = asObject(packet?.routing);
  const drum = asObject(routing.drum_floor);
  const ucm = asObject(packet?.ucm_state);
  const gradient = asObject(packet?.reference_gradient?.weights);
  const density = unit(drum.density, percent(ucm.energy, 30) / 100);
  const pressure = unit(drum.pressure, percent(ucm.body, 20) / 100);
  const profileId = chooseProfileId(packet, drum, gradient, density, pressure);
  const frameId = chooseFrameId(profileId, packet, drum, gradient, pressure);
  const kit = chooseKit(profileId, packet, drum, pressure);
  const section = normalizedSection(drum.section || packet?.performance_state?.active_pad);
  const energy = percent(ucm.energy, density * 100);
  const micro = unit(gradient.micro);
  const ghost = unit(gradient.ghost);
  const organic = unit(gradient.organic);
  const voidness = percent(ucm.void, 0) / 100;
  const resource = percent(ucm.resource, 0) / 100;

  const controls = {
    bpm: clamp(Number(options.bpm) || estimateBpm(packet, density, pressure), 54, 190),
    section,
    energy: Math.round(clamp(energy, 0, 100)),
    density: Math.round(clamp(density * 72 + resource * 18 + pressure * 10, 8, 92)),
    swing: Math.round(clamp(4 + micro * 7 + organic * 5 - pressure * 2, 0, 18)),
    humanize: Math.round(clamp(30 + micro * 24 + ghost * 20 + organic * 12, 18, 92)),
    kit,
    frame: frameId,
    risk: Math.round(clamp(16 + pressure * 24 + micro * 12, 8, 58)),
    space: Math.round(clamp(24 + voidness * 38 + unit(gradient.haze) * 18 - pressure * 12, 12, 86)),
    lift: Math.round(clamp(22 + resource * 30 + pressure * 24 + density * 16, 12, 86)),
    fillDemand: Math.round(clamp(10 + micro * 24 + pressure * 18 + (section === "chorus" ? 12 : 0), 4, 68)),
    crashGate: pressure > 0.62 && section !== "bridge",
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
      density,
      pressure,
      ghost_notes: unit(asObject(drum.groove_intent).ghost_notes, ghost),
      micro
    },
    fingerprint: hashString(JSON.stringify({ profileId, frameId, controls })).toString(16),
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
