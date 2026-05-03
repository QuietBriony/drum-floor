export const docs = [
  ["判断モデル", "docs/groove/groove-decision-model.md"],
  ["グルーブ文法", "docs/groove/groove-grammar-v1.md"],
  ["フィル/遷移ポリシー", "docs/groove/fill-and-transition-policy.md"],
  ["評価ルーブリック", "docs/groove/evaluation-rubric-v1.md"],
  ["将来runtime契約", "docs/groove/future-runtime-contract.md"],
  ["ブラウザ音生成", "docs/runtime/browser-groove-engine.md"],
  ["音入力予測", "docs/runtime/audio-input-groove-prediction.md"],
  ["VCV/Live連携", "docs/runtime/vcv-and-live-bridge.md"],
  ["Live AIロードマップ", "docs/runtime/live-ai-audio-interface-roadmap.md"],
  ["Pattern Frame契約", "docs/drum-pattern-frame-contract.md"],
  ["schema", "docs/schema/groove-profiles.schema.json"]
];

export const roadmap = [
  ["Browser synth", "active", "合成音だけでkick/snare/hat/ghost/fill/crashを鳴らす。"],
  ["AI co-player", "rule-based", "外部APIなしで、引く/待つ/返す/煽るを選ぶ。"],
  ["Local audio input", "local only", "getUserMediaのfeaturesだけを見る。録音/保存/送信はしない。"],
  ["MIDI output", "optional", "Web MIDI対応環境だけ外部音源へnoteを送る。"],
  ["VCV/DAW bridge", "later", "ブラウザで手触りを固めてから出口として整える。"]
];

export const labels = {
  section_profile: "セクション設計",
  instrument_profile: "楽器入力",
  feel_profile: "ノリ・人間味",
  drum_translation: "ドラムフィール変換",
  fill_policy: "フィル制御",
  ghost_notes_policy: "ゴーストノート制御",
  section_transition_rules: "セクション遷移ルール",
  pattern_frame: "ドラムパターン枠",
  pocket_director: "Pocket Director",
  mix_hints: "ミックス意図",
  feel_tags: "フィールタグ",
  style_affinity: "style相性",
  section_fit: "セクション適性",
  space: "間",
  snare_lag_ms: "スネア遅れ",
  kick_push_ms: "キック前ノリ",
  ghost_glue: "ゴースト接着",
  hat_swing: "ハット揺れ",
  bass_lock: "ベース追従",
  structure: "構造",
  expression: "表現",
  kick: "キック",
  snare: "スネア",
  hat: "ハット",
  ghost: "ゴースト",
  ghost_notes: "ゴーストノート",
  fill: "フィル",
  crash: "クラッシュ",
  transition: "遷移",
  density: "密度",
  swing: "スイング量",
  humanize: "人間味",
  articulation: "アーティキュレーション",
  groove_push_pull: "前ノリ/後ろノリ",
  intensity: "強度",
  attack: "アタック",
  syncopation: "シンコペーション",
  fill_tendency: "フィル傾向",
  ghost_preference: "ゴースト傾向",
  transition_style: "遷移スタイル",
  types: "種類",
  max_per_8_bars: "8小節あたり上限",
  transition_cue_priority: "遷移キュー優先度",
  section_priority: "セクション優先度",
  section_density: "セクション別密度",
  unit: "単位",
  avoid: "避けること",
  priority: "優先度",
  stores_audio: "音声保存",
  stores_samples: "サンプル保存",
  stores_metadata_only: "メタデータのみ",
  purpose: "目的"
};

export const densityMap = {
  low: 0,
  low_to_mid: 1,
  medium: 2,
  high_to_mid: 3,
  high: 4
};

export const defaultControls = {
  bpm: 118,
  section: "chorus",
  energy: 72,
  density: 58,
  swing: 6,
  humanize: 48,
  kit: "tight_band",
  frame: "auto",
  phraseLength: 16,
  variationSeed: 137,
  risk: 52,
  space: 35,
  lift: 68,
  fillDemand: 44,
  crashGate: true,
  aiMode: "follow",
  inputLock: false,
  liveMode: false,
  midiEnabled: false
};

export const defaultBandInputFrame = {
  inputEnabled: false,
  inputLevel: 0,
  onsetRate: 0,
  roughTempo: 0,
  density: 0,
  stability: 1,
  lastOnsetAt: 0,
  status: "manual only"
};

export const gmDrumMap = {
  kick: 36,
  snare: 38,
  hat: 42,
  open_hat: 46,
  ghost: 37,
  fill: 40,
  crash: 49
};

export const kitPresets = {
  tight_band: {
    label: "Tight Band",
    description: "芯が強いband kit。sub kick、tight hat、firm snareでライブの土台を作る。",
    kick: { start: 148, end: 43, peak: 0.9, decay: 0.2, tone: "sine", sub: 0.28 },
    snare: { noise: 0.5, body: 0.18, rim: 0.12, filter: 1850, decay: 0.15 },
    hat: { clean: 0.13, dirty: 0.04, filter: 7600, closed: 0.04, open: 0.18 },
    crash: { gain: 0.27, width: 0.16, filter: 5200, decay: 0.62 }
  },
  dusty_pocket: {
    label: "Dusty Pocket",
    description: "丸いkickとdirty hat。ghostと間が見えやすいpocket kit。",
    kick: { start: 118, end: 50, peak: 0.76, decay: 0.25, tone: "triangle", sub: 0.18 },
    snare: { noise: 0.35, body: 0.13, rim: 0.09, filter: 1250, decay: 0.21 },
    hat: { clean: 0.08, dirty: 0.08, filter: 5200, closed: 0.06, open: 0.24 },
    crash: { gain: 0.2, width: 0.2, filter: 4300, decay: 0.58 }
  },
  dub_space: {
    label: "Dub Space",
    description: "低いsub kickと長い余白。half-timeとdropに強いkit。",
    kick: { start: 94, end: 36, peak: 0.84, decay: 0.34, tone: "sine", sub: 0.36 },
    snare: { noise: 0.36, body: 0.2, rim: 0.05, filter: 980, decay: 0.28 },
    hat: { clean: 0.07, dirty: 0.05, filter: 6100, closed: 0.07, open: 0.32 },
    crash: { gain: 0.17, width: 0.24, filter: 3600, decay: 0.78 }
  },
  live_breaker: {
    label: "Live Breaker",
    description: "ライブ爆発用。wide crash、dirty hat、前に出るsnareで煽るkit。",
    kick: { start: 138, end: 45, peak: 0.94, decay: 0.18, tone: "sine", sub: 0.22 },
    snare: { noise: 0.56, body: 0.16, rim: 0.18, filter: 2050, decay: 0.14 },
    hat: { clean: 0.14, dirty: 0.09, filter: 6900, closed: 0.038, open: 0.2 },
    crash: { gain: 0.32, width: 0.28, filter: 5600, decay: 0.68 }
  },
  hard_bop_room: {
    label: "Hard Bop Room",
    description: "皮、スティック、スナッピー、短い部屋鳴りを重ねるacoustic寄りkit。ride/ghostが白色ノイズに聞こえないことを優先する。",
    model: "hard_bop_room",
    kick: { start: 96, end: 54, peak: 0.62, decay: 0.18, tone: "triangle", sub: 0.08, beater: 0.16, room: 0.1 },
    snare: { noise: 0.34, body: 0.22, rim: 0.12, filter: 1620, decay: 0.18, stick: 0.16, shell: 0.13, rattle: 0.22, room: 0.13 },
    hat: { clean: 0.08, dirty: 0.04, filter: 6800, closed: 0.09, open: 0.32, ride: 0.14, bell: 0.055, room: 0.055 },
    crash: { gain: 0.18, width: 0.16, filter: 4600, decay: 0.9, room: 0.16 }
  }
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDensity(value, fallback = 0.5) {
  if (typeof value === "number") return clamp(value, 0, 1);
  if (!(value in densityMap)) return fallback;
  return densityMap[value] / 4;
}

export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let next = seed >>> 0;
  return () => {
    next += 0x6d2b79f5;
    let value = next;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(parts) {
  return mulberry32(hashString(parts.join(":")));
}

export function sectionOptions(profile) {
  return Object.keys(profile?.section_profile || { verse: {}, chorus: {}, bridge: {}, end: {} });
}

export function sanitizeControls(controls, profile) {
  const next = { ...defaultControls, ...controls };
  const sections = sectionOptions(profile);
  if (!sections.includes(next.section)) next.section = sections.includes("chorus") ? "chorus" : sections[0];
  next.bpm = clamp(Number(next.bpm) || defaultControls.bpm, 54, 190);
  next.energy = clamp(Number(next.energy) || 0, 0, 100);
  next.density = clamp(Number(next.density) || 0, 0, 100);
  next.swing = clamp(Number(next.swing) || 0, 0, 18);
  next.humanize = clamp(Number(next.humanize) || 0, 0, 100);
  next.phraseLength = [8, 16, 32].includes(Number(next.phraseLength)) ? Number(next.phraseLength) : 16;
  next.risk = clamp(Number(next.risk) || 0, 0, 100);
  next.space = clamp(Number(next.space) || 0, 0, 100);
  next.lift = clamp(Number(next.lift) || 0, 0, 100);
  next.fillDemand = clamp(Number(next.fillDemand) || 0, 0, 100);
  if (!kitPresets[next.kit]) next.kit = "tight_band";
  if (typeof next.frame !== "string" || !next.frame) next.frame = "auto";
  if (!["follow", "lead", "lock"].includes(next.aiMode)) next.aiMode = "follow";
  next.crashGate = Boolean(next.crashGate);
  next.inputLock = Boolean(next.inputLock);
  next.liveMode = Boolean(next.liveMode);
  next.midiEnabled = Boolean(next.midiEnabled);
  return next;
}
