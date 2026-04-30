const state = {
  profiles: [],
  policy: null,
  version: null,
  activeId: null,
  activeView: "profile",
  loadStatus: "読み込み中",
  preview: {
    audioContext: null,
    master: null,
    timeoutId: null,
    isPlaying: false,
    barIndex: 0,
    lastEvents: [],
    lastStats: null,
    tapTimes: [],
    controls: {
      bpm: 118,
      section: "chorus",
      energy: 68,
      density: 62,
      swing: 6,
      humanize: 46,
      kit: "tight_band",
      variationSeed: 137
    }
  }
};

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

const docs = [
  ["判断モデル", "docs/groove/groove-decision-model.md"],
  ["グルーブ文法", "docs/groove/groove-grammar-v1.md"],
  ["フィル/遷移ポリシー", "docs/groove/fill-and-transition-policy.md"],
  ["評価ルーブリック", "docs/groove/evaluation-rubric-v1.md"],
  ["将来runtime契約", "docs/groove/future-runtime-contract.md"],
  ["ブラウザ音生成", "docs/runtime/browser-groove-engine.md"],
  ["音入力予測", "docs/runtime/audio-input-groove-prediction.md"],
  ["VCV/Live連携", "docs/runtime/vcv-and-live-bridge.md"],
  ["Live AIロードマップ", "docs/runtime/live-ai-audio-interface-roadmap.md"],
  ["schema", "docs/schema/groove-profiles.schema.json"]
];

const roadmap = [
  {
    title: "Browser音生成",
    status: "generator preview",
    detail: "Web Audioの合成音だけでkick/snare/hat/ghost/fill/crashを自動生成previewする。samples/audio filesは使わない。"
  },
  {
    title: "Manual groove generator",
    status: "initial controls",
    detail: "profile JSONにBPM、section、energy、density、swing、humanizeを重ねてbar-level patternを作る。"
  },
  {
    title: "Audio input",
    status: "planned",
    detail: "getUserMediaでマイク/line inputを受け、音量・onset・rough densityを読む。"
  },
  {
    title: "Groove prediction",
    status: "planned",
    detail: "最初はAI直結ではなく、音入力featuresをprofile候補へ写すルールベースで始める。"
  },
  {
    title: "VCV bridge",
    status: "optional live output",
    detail: "VCVはライブ安定出力の候補。browser engineを唯一の出口にしない。"
  },
  {
    title: "AI + audio interface live co-player",
    status: "long-term target",
    detail: "band inputを聞いて次のsection/fill/densityを提案・生成する長期目標。"
  }
];

const labels = {
  section_profile: "セクション設計",
  instrument_profile: "楽器入力",
  feel_profile: "ノリ・人間味",
  drum_translation: "ドラムフィール変換",
  fill_policy: "フィル制御",
  ghost_notes_policy: "ゴーストノート制御",
  section_transition_rules: "セクション遷移ルール",
  velocity_curve: "ベロシティ曲線",
  microtiming_deviation: "微細なタイミング差",
  humanize_range: "人間味レンジ",
  density_profile: "密度プロファイル",
  swing_profile: "スイング設計",
  groove_push_pull: "前ノリ/後ろノリ",
  swing: "スイング量",
  humanize: "人間味",
  density: "密度",
  articulation: "アーティキュレーション",
  intensity: "強度",
  attack: "アタック",
  syncopation: "シンコペーション",
  fill_tendency: "フィル傾向",
  ghost_preference: "ゴースト傾向",
  transition_style: "遷移スタイル",
  structure: "構造",
  expression: "表現",
  kick: "キック",
  snare: "スネア",
  hat: "ハット",
  ghost_notes: "ゴーストノート",
  ghost: "ゴースト",
  fill: "フィル",
  crash: "クラッシュ",
  transition: "遷移",
  types: "種類",
  max_per_8_bars: "8小節あたり上限",
  transition_cue_priority: "遷移キュー優先度",
  section_priority: "セクション優先度",
  section_density: "セクション別密度",
  unit: "単位",
  avoid: "避けること",
  priority: "優先度",
  from: "元セクション",
  to: "次セクション",
  adjustments: "調整",
  stores_audio: "音声保存",
  stores_samples: "サンプル保存",
  stores_metadata_only: "メタデータのみ",
  purpose: "目的"
};

const densityMap = {
  low: 0,
  low_to_mid: 1,
  medium: 2,
  high_to_mid: 3,
  high: 4
};

const kitPresets = {
  tight_band: {
    label: "Tight Band",
    description: "硬めのkick/snareと短いhatで、バンドの芯を前に出すkit。",
    kick: { start: 142, end: 46, peak: 0.92, decay: 0.18, tone: "sine" },
    snare: { noise: 0.5, body: 0.18, filter: 1850, decay: 0.15 },
    hat: { gain: 0.15, filter: 7600, closed: 0.042, open: 0.18 },
    crash: { gain: 0.28, filter: 5200, decay: 0.62 }
  },
  dusty_pocket: {
    label: "Dusty Pocket",
    description: "少し丸く汚したpocket寄り。ghostとswingが見えやすいkit。",
    kick: { start: 118, end: 52, peak: 0.78, decay: 0.24, tone: "triangle" },
    snare: { noise: 0.34, body: 0.13, filter: 1250, decay: 0.2 },
    hat: { gain: 0.11, filter: 5200, closed: 0.06, open: 0.24 },
    crash: { gain: 0.2, filter: 4300, decay: 0.55 }
  },
  dub_space: {
    label: "Dub Space",
    description: "低めkickと長めの余白。half-timeや間のあるgroove向け。",
    kick: { start: 92, end: 38, peak: 0.86, decay: 0.34, tone: "sine" },
    snare: { noise: 0.38, body: 0.2, filter: 980, decay: 0.26 },
    hat: { gain: 0.09, filter: 6100, closed: 0.07, open: 0.32 },
    crash: { gain: 0.17, filter: 3600, decay: 0.78 }
  }
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelFor(key) {
  const human = labels[key] || String(key).replaceAll("_", " ");
  return `${human} <code>${escapeHtml(key)}</code>`;
}

function valueText(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).replaceAll("_", " ");
}

function chipList(items, className = "chip") {
  return `<div class="chip-row">${items.map((item) => `<span class="${className}">${escapeHtml(valueText(item))}</span>`).join("")}</div>`;
}

function keyValues(object) {
  return `<div class="kv-grid">${Object.entries(object)
    .map(([key, value]) => `<div class="kv"><span>${labelFor(key)}</span><span>${escapeHtml(valueText(value))}</span></div>`)
    .join("")}</div>`;
}

function card(title, content, wide = false) {
  return `<article class="card${wide ? " is-wide" : ""}"><h3>${title}</h3>${content}</article>`;
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeId) || state.profiles[0];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDensity(value, fallback = 0.5) {
  if (typeof value === "number") return clamp(value, 0, 1);
  if (!(value in densityMap)) return fallback;
  return densityMap[value] / 4;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let next = seed >>> 0;
  return () => {
    next += 0x6d2b79f5;
    let value = next;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sectionOptions(profile) {
  return Object.keys(profile?.section_profile || { verse: {}, chorus: {}, bridge: {}, end: {} });
}

function previewControls(profile = activeProfile()) {
  const controls = state.preview.controls;
  const sections = sectionOptions(profile);
  if (!sections.includes(controls.section)) controls.section = sections.includes("chorus") ? "chorus" : sections[0];
  controls.bpm = clamp(Number(controls.bpm) || 118, 54, 190);
  controls.energy = clamp(Number(controls.energy) || 0, 0, 100);
  controls.density = clamp(Number(controls.density) || 0, 0, 100);
  controls.swing = clamp(Number(controls.swing) || 0, 0, 18);
  controls.humanize = clamp(Number(controls.humanize) || 0, 0, 100);
  if (!kitPresets[controls.kit]) controls.kit = "tight_band";
  return controls;
}

function seededRng(profile, controls, barIndex, salt = "main") {
  return mulberry32(hashString([
    profile.id,
    controls.section,
    controls.kit,
    controls.variationSeed,
    Math.floor(controls.energy),
    Math.floor(controls.density),
    Math.floor(controls.swing),
    Math.floor(controls.humanize),
    barIndex,
    salt
  ].join(":")));
}

function generationStats(profile, controls, barIndex) {
  const sectionProfile = profile.section_profile?.[controls.section] || {};
  const sectionDensity = normalizeDensity(sectionProfile.density, normalizeDensity(profile.feel_profile?.density, 0.5));
  const profileDensity = normalizeDensity(profile.feel_profile?.density, 0.5);
  const manualDensity = controls.density / 100;
  const energy = controls.energy / 100;
  const densityScore = clamp(profileDensity * 0.28 + sectionDensity * 0.24 + manualDensity * 0.3 + energy * 0.18, 0.08, 1);
  const ghostScore = clamp(normalizeDensity(profile.ghost_notes_policy?.section_density?.[controls.section], 0.2) * 0.55 + controls.humanize / 220 + densityScore * 0.16, 0, 1);
  const sectionPriority = Number(profile.fill_policy?.section_priority?.[controls.section] ?? 3);
  const maxFills = clamp(Number(profile.fill_policy?.max_per_8_bars ?? 1), 0, 8);
  const fillChance = clamp((maxFills / 8) * 0.55 + sectionPriority / 22 + energy * 0.16 + densityScore * 0.08, 0.03, 0.88);
  const fillBudget = clamp(Math.round(maxFills * clamp(0.2 + fillChance, 0, 1)), 0, maxFills);
  const swingMs = Math.round((controls.swing / 100) * (60 / controls.bpm / 4) * 1000);
  const humanizeMs = Math.round(2 + controls.humanize * 0.12);
  return {
    sectionDensity,
    profileDensity,
    densityScore,
    ghostScore,
    fillChance,
    fillBudget,
    sectionPriority,
    maxFills,
    swingMs,
    humanizeMs,
    barInWindow: barIndex % 8
  };
}

function fillSlots(profile, controls, barIndex, stats) {
  if (stats.fillBudget <= 0) return [];
  const windowIndex = Math.floor(barIndex / 8);
  const rng = seededRng(profile, controls, windowIndex, "fill-window");
  return [...Array(8).keys()]
    .map((bar) => ({
      bar,
      score: rng() + (bar === 7 ? 0.32 : bar === 3 ? 0.16 : 0) + stats.sectionPriority / 80
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, stats.fillBudget)
    .map((item) => item.bar);
}

function addEvent(events, step, part, velocity, reason) {
  const safeStep = clamp(Math.round(step), 0, 15);
  const existing = events.find((event) => event.step === safeStep && event.part === part);
  if (existing) {
    existing.velocity = Math.max(existing.velocity, clamp(velocity, 0.05, 1.2));
    existing.reason = `${existing.reason}, ${reason}`;
    return;
  }
  events.push({ step: safeStep, part, velocity: clamp(velocity, 0.05, 1.2), reason });
}

function generateGrooveBar(profile, controls = previewControls(profile), barIndex = state.preview.barIndex) {
  const rng = seededRng(profile, controls, barIndex);
  const stats = generationStats(profile, controls, barIndex);
  const events = [];
  const energy = controls.energy / 100;
  const density = stats.densityScore;
  const isHalfTime = profile.id === "dubby_half_time" || controls.section === "bridge" && energy < 0.42;
  const isBreakbeat = profile.id === "breakbeat_live";
  const isPocket = profile.id === "nerdy_jazzy_hiphop";
  const isHeavy = profile.id === "rock_heavy" || profile.id === "mixture_shout";

  addEvent(events, 0, "kick", 0.82 + energy * 0.18, "downbeat anchor");
  addEvent(events, isHalfTime ? 8 : 4, "snare", 0.76 + energy * 0.22, isHalfTime ? "half-time backbeat" : "backbeat");
  if (!isHalfTime) addEvent(events, 12, "snare", 0.78 + energy * 0.2, "backbeat return");

  if (density > 0.32 || isHeavy) addEvent(events, 8, "kick", 0.55 + energy * 0.24, "mid-bar anchor");
  if (density > 0.5 || isBreakbeat) addEvent(events, rng() > 0.45 ? 10 : 11, "kick", 0.42 + density * 0.28, "density response");
  if (density > 0.68 || profile.id === "mixture_shout") addEvent(events, rng() > 0.5 ? 7 : 15, "kick", 0.38 + energy * 0.24, "riff pickup");
  if (isPocket && rng() > 0.28) addEvent(events, rng() > 0.5 ? 3 : 6, "kick", 0.36, "soft displacement");
  if (isBreakbeat) {
    addEvent(events, 3, "kick", 0.46 + rng() * 0.18, "breakbeat stagger");
    addEvent(events, 6, "snare", 0.28 + rng() * 0.18, "break ghost response");
  }

  let hatSteps = [0, 2, 4, 6, 8, 10, 12, 14];
  if (density < 0.26) hatSteps = [0, 4, 8, 12];
  if (density > 0.66) hatSteps = [...Array(16).keys()];
  if (profile.id === "dubby_half_time" && controls.section !== "chorus") hatSteps = [0, 4, 10, 12];
  hatSteps.forEach((step) => {
    const accent = step % 4 === 0 ? 0.2 : 0;
    const variation = (rng() - 0.5) * 0.12;
    addEvent(events, step, "hat", 0.24 + density * 0.24 + accent + variation, "timekeeper");
  });

  const ghostCandidates = isBreakbeat ? [2, 5, 6, 9, 13, 14] : isPocket ? [3, 5, 7, 11, 13] : [5, 11, 13];
  ghostCandidates.forEach((step) => {
    if (rng() < stats.ghostScore * (isPocket ? 0.72 : 0.54)) addEvent(events, step, "ghost", 0.18 + rng() * 0.28, "human pocket texture");
  });

  const slots = fillSlots(profile, controls, barIndex, stats);
  const fillActive = slots.includes(stats.barInWindow);
  if (fillActive) {
    const longFill = profile.fill_policy?.types?.includes("long") && (energy > 0.64 || isBreakbeat);
    const fillSteps = longFill ? [12, 13, 14, 15] : [14, 15];
    fillSteps.forEach((step, index) => addEvent(events, step, "fill", 0.42 + energy * 0.34 + index * 0.04, longFill ? "long transition fill" : "short transition fill"));
  }

  const crashOnPhrase = stats.barInWindow === 0 && (controls.section === "chorus" || controls.section === "end" || energy > 0.72);
  const crashAfterFill = stats.barInWindow === 0 && slots.includes(7);
  if (crashOnPhrase || crashAfterFill || rng() < energy * 0.04) addEvent(events, 0, "crash", 0.48 + energy * 0.32, "section entry accent");

  const partOrder = { kick: 0, snare: 1, hat: 2, ghost: 3, fill: 4, crash: 5 };
  return {
    events: events.sort((a, b) => a.step - b.step || partOrder[a.part] - partOrder[b.part]),
    stats: { ...stats, fillActive, fillSlots: slots }
  };
}

function stopPreview() {
  if (state.preview.timeoutId) {
    clearTimeout(state.preview.timeoutId);
    state.preview.timeoutId = null;
  }
  state.preview.isPlaying = false;
  const profile = activeProfile();
  if (profile) renderPreviewView(profile);
}

function ensureAudio() {
  if (state.preview.audioContext) return state.preview.audioContext;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const master = audioContext.createGain();
  master.gain.value = 0.42;
  master.connect(audioContext.destination);
  state.preview.audioContext = audioContext;
  state.preview.master = master;
  return audioContext;
}

function envelopeGain(audioContext, startTime, peak, attack, decay) {
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + decay);
  return gain;
}

function selectedKit() {
  return kitPresets[previewControls().kit] || kitPresets.tight_band;
}

function playKick(audioContext, time, velocity) {
  const kit = selectedKit();
  const oscillator = audioContext.createOscillator();
  const gain = envelopeGain(audioContext, time, kit.kick.peak * velocity, 0.008, kit.kick.decay);
  oscillator.type = kit.kick.tone;
  oscillator.frequency.setValueAtTime(kit.kick.start, time);
  oscillator.frequency.exponentialRampToValueAtTime(kit.kick.end, time + kit.kick.decay * 0.84);
  oscillator.connect(gain).connect(state.preview.master);
  oscillator.start(time);
  oscillator.stop(time + kit.kick.decay + 0.08);
}

function noiseBuffer(audioContext, duration) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playNoiseHit(audioContext, time, velocity, filterType, frequency, duration, q = 1) {
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = envelopeGain(audioContext, time, velocity, 0.004, duration);
  source.buffer = noiseBuffer(audioContext, duration + 0.05);
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  source.connect(filter).connect(gain).connect(state.preview.master);
  source.start(time);
  source.stop(time + duration + 0.06);
}

function playSnare(audioContext, time, velocity) {
  const kit = selectedKit();
  playNoiseHit(audioContext, time, kit.snare.noise * velocity, "bandpass", kit.snare.filter, kit.snare.decay, 2.2);
  const body = audioContext.createOscillator();
  const gain = envelopeGain(audioContext, time, kit.snare.body * velocity, 0.004, 0.08);
  body.type = "triangle";
  body.frequency.value = kit === kitPresets.dub_space ? 150 : 185;
  body.connect(gain).connect(state.preview.master);
  body.start(time);
  body.stop(time + 0.11);
}

function playHat(audioContext, time, velocity, open = false) {
  const kit = selectedKit();
  playNoiseHit(audioContext, time, kit.hat.gain * velocity, "highpass", kit.hat.filter, open ? kit.hat.open : kit.hat.closed, 0.8);
}

function playGhost(audioContext, time, velocity) {
  const kit = selectedKit();
  playNoiseHit(audioContext, time, kit.snare.noise * 0.32 * velocity, "bandpass", kit.snare.filter + 380, 0.055, 2.4);
}

function playFill(audioContext, time, velocity) {
  playSnare(audioContext, time, velocity * 0.76);
  playGhost(audioContext, time + 0.035, velocity * 0.56);
}

function playCrash(audioContext, time, velocity) {
  const kit = selectedKit();
  playNoiseHit(audioContext, time, kit.crash.gain * velocity, "highpass", kit.crash.filter, kit.crash.decay, 0.5);
}

function eventOffset(event, profile, controls, stepDuration) {
  const swing = controls.swing / 100;
  const isOffEighth = event.step % 4 === 2;
  const humanRange = (2 + controls.humanize * 0.12) / 1000;
  const rng = seededRng(profile, controls, state.preview.barIndex, `offset-${event.step}-${event.part}-${event.reason}`);
  const humanOffset = (rng() - 0.5) * humanRange;
  const pushPull = profile.feel_profile?.groove_push_pull === "forward" ? -0.004 : profile.feel_profile?.groove_push_pull === "backward" ? 0.006 : 0;
  const ghostDrag = event.part === "ghost" ? humanRange * 0.25 : 0;
  return event.step * stepDuration + (isOffEighth ? swing * stepDuration : 0) + humanOffset + pushPull + ghostDrag;
}

function schedulePreviewBar(profile, startTime) {
  const audioContext = ensureAudio();
  const controls = previewControls(profile);
  const stepDuration = 60 / controls.bpm / 4;
  const generated = generateGrooveBar(profile, controls, state.preview.barIndex);
  state.preview.lastEvents = generated.events;
  state.preview.lastStats = generated.stats;

  generated.events.forEach((event) => {
    const time = startTime + Math.max(0, eventOffset(event, profile, controls, stepDuration));
    if (event.part === "kick") playKick(audioContext, time, event.velocity);
    if (event.part === "snare") playSnare(audioContext, time, event.velocity);
    if (event.part === "hat") playHat(audioContext, time, event.velocity, event.step === 14 && generated.stats.densityScore > 0.52);
    if (event.part === "ghost") playGhost(audioContext, time, event.velocity);
    if (event.part === "fill") playFill(audioContext, time, event.velocity);
    if (event.part === "crash") playCrash(audioContext, time, event.velocity);
  });
}

function scheduleNextPreviewBar(delayMs = 0) {
  if (!state.preview.isPlaying) return;
  state.preview.timeoutId = setTimeout(() => {
    const profile = activeProfile();
    if (!profile || !state.preview.isPlaying) return;
    const audioContext = ensureAudio();
    const controls = previewControls(profile);
    const barDuration = 60 / controls.bpm * 4;
    schedulePreviewBar(profile, audioContext.currentTime + 0.05);
    renderPreviewView(profile);
    state.preview.barIndex += 1;
    scheduleNextPreviewBar(barDuration * 1000);
  }, delayMs);
}

async function startPreview() {
  const profile = activeProfile();
  if (!profile) return;
  const audioContext = ensureAudio();
  if (audioContext.state === "suspended") await audioContext.resume();
  if (state.preview.timeoutId) clearTimeout(state.preview.timeoutId);
  state.preview.isPlaying = true;
  scheduleNextPreviewBar(0);
  renderPreviewView(profile);
}

function tapTempo() {
  const now = performance.now();
  state.preview.tapTimes = state.preview.tapTimes.filter((time) => now - time < 2400);
  state.preview.tapTimes.push(now);
  if (state.preview.tapTimes.length < 2) {
    renderPreviewView(activeProfile());
    return;
  }
  const intervals = state.preview.tapTimes.slice(1).map((time, index) => time - state.preview.tapTimes[index]);
  const recent = intervals.slice(-4);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  state.preview.controls.bpm = Math.round(clamp(60000 / average, 54, 190));
  renderPreviewView(activeProfile());
}

function renderProfileList() {
  refs.profileCount.textContent = `${state.profiles.length}件`;
  refs.profileList.innerHTML = state.profiles
    .map((profile) => `
      <button class="profile-button${profile.id === state.activeId ? " is-active" : ""}" type="button" data-profile-id="${escapeHtml(profile.id)}">
        <strong>${escapeHtml(profile.label)}</strong>
        <span>${escapeHtml(profile.id)}</span>
      </button>
    `)
    .join("");
}

function renderProfileView(profile) {
  const sections = Object.entries(profile.section_profile)
    .map(([section, values]) => `
      <div class="section-box">
        <strong>${escapeHtml(section)}</strong>
        ${keyValues(values)}
      </div>
    `)
    .join("");

  const instruments = Object.entries(profile.instrument_profile)
    .map(([instrument, values]) => card(`${escapeHtml(instrument)}`, keyValues(values)))
    .join("");

  refs.views.profile.innerHTML = `
    <div class="grid">
      ${card(`${labelFor("feel_profile")}`, keyValues(profile.feel_profile))}
      ${card(`${labelFor("instrument_profile")}`, `<div class="grid inner-grid">${instruments}</div>`, true)}
      ${card(`${labelFor("section_profile")}`, `<div class="section-grid">${sections}</div>`, true)}
    </div>
  `;
}

function renderTranslationView(profile) {
  const structure = Object.entries(profile.drum_translation.structure)
    .map(([part, tokens]) => card(labelFor(part), chipList(tokens, "token")))
    .join("");

  refs.views.translation.innerHTML = `
    <div class="grid">
      ${card(`${labelFor("structure")}`, `<div class="grid inner-grid">${structure}</div>`, true)}
      ${card(`${labelFor("expression")}`, keyValues(profile.drum_translation.expression), true)}
    </div>
  `;
}

function meter(label, value, detail = "") {
  const percent = Math.round(clamp(value, 0, 1) * 100);
  return `<div class="reason-meter">
    <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail || `${percent}%`)}</span></div>
    <div class="meter-track"><span style="width: ${percent}%"></span></div>
  </div>`;
}

function controlRange(key, label, min, max, step = 1, unit = "") {
  const value = previewControls()[key];
  return `<label class="control-field">
    <span>${escapeHtml(label)} <strong>${escapeHtml(value)}${unit}</strong></span>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(value)}" data-preview-control="${key}" />
  </label>`;
}

function renderPreviewView(profile) {
  const controls = previewControls(profile);
  const previewBar = generateGrooveBar(profile, controls, state.preview.barIndex);
  const events = state.preview.lastEvents.length ? state.preview.lastEvents : previewBar.events;
  const stats = state.preview.lastStats || previewBar.stats;
  const sections = sectionOptions(profile);
  const partLabels = { kick: "K", snare: "S", hat: "H", ghost: "G", fill: "F", crash: "C" };
  const stepCells = [...Array(16).keys()]
    .map((step) => {
      const parts = events.filter((event) => event.step === step);
      return `<div class="step-cell${parts.length ? " has-hit" : ""}" title="${escapeHtml(parts.map((part) => `${part.part}: ${part.reason}`).join(" / "))}">
        <span>${step + 1}</span>
        <strong>${parts.map((part) => escapeHtml(partLabels[part.part] || part.part[0].toUpperCase())).join("")}</strong>
      </div>`;
    })
    .join("");

  refs.views.preview.innerHTML = `
    <div class="grid">
      ${card("自動生成プレビュー", `
        <p class="card-copy">選択中のprofileに手動入力を重ねて、毎小節少し変わるbar-level grooveを生成します。音はWeb Audio合成だけで、サンプルや外部依存は使いません。</p>
        <div class="preview-controls">
          <button class="preview-button" type="button" data-preview-action="start">${state.preview.isPlaying ? "再スタート" : "再生"}</button>
          <button class="preview-button secondary" type="button" data-preview-action="stop">停止</button>
          <button class="preview-button secondary" type="button" data-preview-action="tap">Tap tempo</button>
          <button class="preview-button secondary" type="button" data-preview-action="variation">Variation更新</button>
          <span class="preview-state">${state.preview.isPlaying ? "再生中" : "停止中"} / bar ${state.preview.barIndex} / ${controls.bpm} BPM</span>
        </div>
      `, true)}
      ${card("入力合わせ", `
        <div class="control-grid">
          <label class="control-field">
            <span>section <strong>${escapeHtml(controls.section)}</strong></span>
            <select data-preview-control="section">${sections.map((section) => `<option value="${escapeHtml(section)}"${section === controls.section ? " selected" : ""}>${escapeHtml(section)}</option>`).join("")}</select>
          </label>
          <label class="control-field">
            <span>kit <strong>${escapeHtml(kitPresets[controls.kit].label)}</strong></span>
            <select data-preview-control="kit">${Object.entries(kitPresets).map(([id, kit]) => `<option value="${escapeHtml(id)}"${id === controls.kit ? " selected" : ""}>${escapeHtml(kit.label)}</option>`).join("")}</select>
          </label>
          ${controlRange("bpm", "BPM", 54, 190)}
          ${controlRange("energy", "energy", 0, 100)}
          ${controlRange("density", "density", 0, 100)}
          ${controlRange("swing", "swing", 0, 18, 1, "%")}
          ${controlRange("humanize", "humanize", 0, 100)}
        </div>
      `, true)}
      ${card("16 step generated bar", `<div class="step-grid">${stepCells}</div>`, true)}
      ${card("生成理由メーター", `
        ${meter("密度", stats.densityScore, `${Math.round(stats.densityScore * 100)}% / profile + section + manual`)}
        ${meter("fill", stats.fillChance, `${stats.fillBudget}/${stats.maxFills} per 8 bars / slots ${stats.fillSlots.join(", ") || "none"}`)}
        ${meter("ghost", stats.ghostScore, `${Math.round(stats.ghostScore * 100)}% / humanize + section`)}
        ${meter("swing", controls.swing / 18, `${stats.swingMs}ms offset`)}
        ${meter("humanize", controls.humanize / 100, `±${stats.humanizeMs}ms`)}
      `)}
      ${card("現在の出力", keyValues({
        current_bpm: controls.bpm,
        section: controls.section,
        kit: kitPresets[controls.kit].label,
        density: `${Math.round(stats.densityScore * 100)}%`,
        fill_probability: `${Math.round(stats.fillChance * 100)}%`,
        generated_bar: state.preview.barIndex,
        variation_seed: controls.variationSeed
      }))}
      ${card("鳴らしている要素", chipList([...new Set(events.map((event) => event.part))], "token"))}
      ${card("kit detail", `<p class="card-copy">${escapeHtml(kitPresets[controls.kit].description)}</p>${chipList(Object.keys(kitPresets), "token")}`)}
      ${card("安全条件", chipList([
        "Web Audio synthesis only",
        "no samples",
        "no audio storage",
        "manual stop",
        "no external network"
      ], "token"), true)}
    </div>
  `;
}

function renderPolicyView(profile) {
  const transitionRules = profile.section_transition_rules
    .map((rule) => `
      <article class="section-box">
        <strong>${escapeHtml(rule.from)} → ${escapeHtml(rule.to)}</strong>
        ${chipList(rule.adjustments, "token")}
        <div class="kv"><span>${labelFor("priority")}</span><span>${escapeHtml(rule.priority)}</span></div>
      </article>
    `)
    .join("");

  refs.views.policy.innerHTML = `
    <div class="grid">
      ${card(`${labelFor("fill_policy")}`, `
        ${keyValues({
          types: profile.fill_policy.types.join(", "),
          max_per_8_bars: profile.fill_policy.max_per_8_bars,
          transition_cue_priority: profile.fill_policy.transition_cue_priority
        })}
        <h3>${labelFor("section_priority")}</h3>
        ${keyValues(profile.fill_policy.section_priority)}
      `)}
      ${card(`${labelFor("ghost_notes_policy")}`, `
        ${keyValues({ unit: profile.ghost_notes_policy.unit })}
        <h3>${labelFor("section_density")}</h3>
        ${keyValues(profile.ghost_notes_policy.section_density)}
      `)}
      ${card(`${labelFor("section_transition_rules")}`, `<div class="section-grid">${transitionRules}</div>`, true)}
      ${card(`${labelFor("avoid")}`, chipList(profile.avoid, "token"), true)}
      ${card("研究docs", `<div class="token-row">${docs.map(([label, href]) => `<a class="token" href="${href}">${label}</a>`).join("")}</div>`, true)}
    </div>
  `;
}

function renderManualView() {
  refs.views.manual.innerHTML = `
    <div class="grid">
      ${card("使い方マニュアル", `
        <ol class="manual-list">
          <li>左の一覧から style profile を選ぶ。</li>
          <li><strong>プロフィール</strong>で、セクション設計・楽器入力・ノリの傾向を見る。</li>
          <li><strong>ドラムフィール</strong>で、構造 <code>structure</code> と表現 <code>expression</code> を確認する。</li>
          <li><strong>自動生成プレビュー</strong>で、BPM、section、kit、energy、density、swing、humanizeを操作してWeb Audio grooveを試聴する。</li>
          <li><strong>Tap tempo</strong>を数回押して、手元のテンポ感にBPMを合わせる。</li>
          <li><strong>制御ポリシー</strong>で、fill / ghost notes / transition の上限と意図を見る。</li>
          <li><strong>開発状況</strong>で、Pages設定・JSON読み込み・未実装範囲を確認する。</li>
          <li><strong>次の方向</strong>で、音入力・VCV連携・AIライブ化のロードマップを見る。</li>
        </ol>
      `, true)}
      ${card("このUIでできること", chipList([
        "style profile の確認",
        "drum feel の構造確認",
        "bar-level groove 自動生成",
        "3種類の合成kit切替",
        "tap tempo",
        "section/energy/density調整",
        "fill と transition の方針確認",
        "研究docsへの移動",
        "開発状況の把握",
        "次段階ロードマップの確認"
      ]))}
      ${card("このUIではまだやらないこと", chipList([
        "生音サンプルを鳴らす",
        "MIDIを書き出す",
        "マイク入力解析をする",
        "DAWと同期する",
        "サンプルを管理する"
      ], "token"))}
    </div>
  `;
}

function renderStatusView() {
  const policy = state.policy || {};
  refs.views.status.innerHTML = `
    <div class="grid">
      ${card("公開状態", keyValues({
        pages_source: "main + /(root)",
        pages_url: "https://quietbriony.github.io/drum-floor/",
        entry_file: "index.html",
        data_file: "profiles/groove-profiles.json"
      }))}
      ${card("読み込み状態", keyValues({
        json_status: state.loadStatus,
        profile_version: state.version ?? "unknown",
        profile_count: state.profiles.length
      }))}
      ${card("policy flags", keyValues(policy))}
      ${card("未実装・非対応", chipList([
        "audio input analysis",
        "AI/ML groove prediction",
        "DAW連携",
        "MIDI書き出し",
        "samples/audio files"
      ], "token"))}
      ${card("開発用リンク", `<div class="token-row">${docs.map(([label, href]) => `<a class="token" href="${href}">${label}</a>`).join("")}</div>`, true)}
    </div>
  `;
}

function renderRoadmapView() {
  const roadmapCards = roadmap
    .map((item) => `
      <article class="section-box roadmap-box">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="roadmap-status">${escapeHtml(item.status)}</span>
        <p>${escapeHtml(item.detail)}</p>
      </article>
    `)
    .join("");

  refs.views.roadmap.innerHTML = `
    <div class="grid">
      ${card("次の方向", `
        <p class="card-copy">VCVはライブ出力の候補として残しつつ、ブラウザを試聴・開発・予測debugの中心にします。現在はサンプルなしのWeb Audio自動生成previewを育てています。</p>
        <div class="section-grid">${roadmapCards}</div>
      `, true)}
      ${card("runtime docs", `<div class="token-row">${docs
        .filter(([, href]) => href.startsWith("docs/runtime/") || href.includes("future-runtime-contract"))
        .map(([label, href]) => `<a class="token" href="${href}">${label}</a>`)
        .join("")}</div>`, true)}
      ${card("今回まだやらないこと", chipList([
        "音声入力実装",
        "AI/MLモデル追加",
        "dependencies追加",
        "samples/audio files追加",
        "VCV自動操作"
      ], "token"), true)}
    </div>
  `;
}

function renderActiveProfile() {
  const profile = activeProfile();
  if (!profile) return;
  previewControls(profile);

  refs.profileId.textContent = profile.id;
  refs.profileLabel.textContent = profile.label;
  refs.profileDescription.textContent = profile.description;

  renderProfileList();
  renderProfileView(profile);
  renderTranslationView(profile);
  renderPreviewView(profile);
  renderPolicyView(profile);
  renderManualView();
  renderStatusView();
  renderRoadmapView();
}

function setActiveView(view) {
  state.activeView = view;
  refs.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  Object.entries(refs.views).forEach(([key, node]) => node.classList.toggle("is-active", key === view));
}

async function loadProfiles() {
  try {
    const response = await fetch("profiles/groove-profiles.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`profile JSONの取得に失敗しました: ${response.status}`);
    const data = await response.json();
    state.profiles = data.profiles;
    state.policy = data.policy;
    state.version = data.version;
    state.activeId = state.profiles[0]?.id;
    state.loadStatus = "読み込み成功";
    renderActiveProfile();
  } catch (error) {
    state.loadStatus = "読み込み失敗";
    refs.profileCount.textContent = "offline";
    refs.views.profile.innerHTML = `<div class="notice">${escapeHtml(error.message)}。GitHub PagesまたはローカルHTTPサーバー経由で開いてください。</div>`;
    refs.profileLabel.textContent = "profile JSONを読めません";
    refs.profileDescription.textContent = "profiles/groove-profiles.json の読み込みに失敗しました。";
    renderManualView();
    renderStatusView();
  }
}

refs.profileList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-profile-id]");
  if (!button) return;
  state.activeId = button.dataset.profileId;
  state.preview.lastEvents = [];
  state.preview.lastStats = null;
  renderActiveProfile();
});

refs.tabs.forEach((tab) => {
  tab.addEventListener("click", () => setActiveView(tab.dataset.view));
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-preview-action]");
  if (!button) return;
  if (button.dataset.previewAction === "start") startPreview();
  if (button.dataset.previewAction === "stop") stopPreview();
  if (button.dataset.previewAction === "tap") tapTempo();
  if (button.dataset.previewAction === "variation") {
    state.preview.controls.variationSeed = Math.floor(Math.random() * 100000);
    state.preview.lastEvents = [];
    state.preview.lastStats = null;
    renderPreviewView(activeProfile());
  }
});

document.addEventListener("input", (event) => {
  const control = event.target.closest("[data-preview-control]");
  if (!control) return;
  state.preview.controls[control.dataset.previewControl] = control.type === "range" ? Number(control.value) : control.value;
  state.preview.lastEvents = [];
  state.preview.lastStats = null;
  renderPreviewView(activeProfile());
});

document.addEventListener("change", (event) => {
  const control = event.target.closest("[data-preview-control]");
  if (!control) return;
  state.preview.controls[control.dataset.previewControl] = control.type === "range" ? Number(control.value) : control.value;
  state.preview.lastEvents = [];
  state.preview.lastStats = null;
  renderPreviewView(activeProfile());
});

window.addEventListener("pagehide", stopPreview);

loadProfiles();
