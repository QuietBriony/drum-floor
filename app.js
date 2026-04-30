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
    intervalId: null,
    isPlaying: false,
    bpm: 120
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
    status: "initial preview",
    detail: "Web Audioの合成音だけでkick/snare/hat/ghost/fillのpreviewを鳴らす。samples/audio filesは使わない。"
  },
  {
    title: "Manual groove generator",
    status: "planned",
    detail: "profile JSONからbar-level patternを作り、structure/expressionを確認できるようにする。"
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

function stopPreview() {
  if (state.preview.intervalId) {
    clearInterval(state.preview.intervalId);
    state.preview.intervalId = null;
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
  master.gain.value = 0.44;
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

function playKick(audioContext, time, velocity) {
  const oscillator = audioContext.createOscillator();
  const gain = envelopeGain(audioContext, time, 0.85 * velocity, 0.008, 0.18);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(135, time);
  oscillator.frequency.exponentialRampToValueAtTime(44, time + 0.16);
  oscillator.connect(gain).connect(state.preview.master);
  oscillator.start(time);
  oscillator.stop(time + 0.22);
}

function noiseBuffer(audioContext, duration) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoiseHit(audioContext, time, velocity, filterType, frequency, duration) {
  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = envelopeGain(audioContext, time, velocity, 0.004, duration);
  source.buffer = noiseBuffer(audioContext, duration + 0.04);
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = filterType === "bandpass" ? 2.2 : 0.8;
  source.connect(filter).connect(gain).connect(state.preview.master);
  source.start(time);
  source.stop(time + duration + 0.06);
}

function playSnare(audioContext, time, velocity) {
  playNoiseHit(audioContext, time, 0.45 * velocity, "bandpass", 1650, 0.16);
  const body = audioContext.createOscillator();
  const gain = envelopeGain(audioContext, time, 0.16 * velocity, 0.004, 0.08);
  body.type = "triangle";
  body.frequency.value = 185;
  body.connect(gain).connect(state.preview.master);
  body.start(time);
  body.stop(time + 0.1);
}

function playHat(audioContext, time, velocity, open = false) {
  playNoiseHit(audioContext, time, (open ? 0.22 : 0.14) * velocity, "highpass", 6800, open ? 0.18 : 0.045);
}

function playGhost(audioContext, time, velocity) {
  playNoiseHit(audioContext, time, 0.12 * velocity, "bandpass", 2100, 0.055);
}

function previewBpm(profile) {
  const base = {
    mixture_shout: 126,
    rock_heavy: 118,
    nerdy_jazzy_hiphop: 92,
    breakbeat_live: 104,
    dubby_half_time: 78
  };
  return base[profile.id] || 110;
}

function buildPreviewEvents(profile) {
  const density = densityMap[profile.feel_profile.density] ?? 2;
  const ghostDensity = profile.ghost_notes_policy.section_density.chorus;
  const ghostLevel = densityMap[ghostDensity] ?? 1;
  const events = [
    { step: 0, part: "kick", velocity: 1 },
    { step: 4, part: "snare", velocity: 0.92 },
    { step: 8, part: "kick", velocity: 0.88 },
    { step: 12, part: "snare", velocity: 0.96 }
  ];

  const hatSteps = density >= 3 ? [...Array(16).keys()] : [0, 2, 4, 6, 8, 10, 12, 14];
  hatSteps.forEach((step) => events.push({ step, part: "hat", velocity: step % 4 === 0 ? 0.58 : 0.38 }));

  if (profile.id === "mixture_shout") {
    events.push({ step: 7, part: "kick", velocity: 0.55 }, { step: 15, part: "fill", velocity: 0.66 });
  }
  if (profile.id === "rock_heavy") {
    events.push({ step: 10, part: "kick", velocity: 0.62 });
  }
  if (profile.id === "nerdy_jazzy_hiphop") {
    events.push({ step: 3, part: "ghost", velocity: 0.44 }, { step: 11, part: "ghost", velocity: 0.5 });
  }
  if (profile.id === "breakbeat_live") {
    events.push({ step: 3, part: "kick", velocity: 0.6 }, { step: 6, part: "ghost", velocity: 0.48 }, { step: 14, part: "fill", velocity: 0.7 });
  }
  if (profile.id === "dubby_half_time") {
    events.splice(events.findIndex((event) => event.step === 4 && event.part === "snare"), 1);
    events.push({ step: 10, part: "hat", velocity: 0.24 });
  }

  if (ghostLevel >= 2) events.push({ step: 5, part: "ghost", velocity: 0.34 }, { step: 13, part: "ghost", velocity: 0.38 });
  return events.sort((a, b) => a.step - b.step || a.part.localeCompare(b.part));
}

function eventOffset(event, profile, stepDuration) {
  const swing = Number(profile.feel_profile.swing || 0) / 100;
  const isOffEighth = event.step % 4 === 2;
  const humanize = profile.feel_profile.humanize === "high" ? 0.012 : profile.feel_profile.humanize === "medium" ? 0.007 : 0.003;
  const humanOffset = (Math.random() - 0.5) * humanize;
  return event.step * stepDuration + (isOffEighth ? swing * stepDuration : 0) + humanOffset;
}

function schedulePreviewBar(profile, startTime) {
  const audioContext = ensureAudio();
  const bpm = previewBpm(profile);
  const stepDuration = 60 / bpm / 4;
  const events = buildPreviewEvents(profile);

  events.forEach((event) => {
    const time = startTime + Math.max(0, eventOffset(event, profile, stepDuration));
    if (event.part === "kick") playKick(audioContext, time, event.velocity);
    if (event.part === "snare") playSnare(audioContext, time, event.velocity);
    if (event.part === "hat") playHat(audioContext, time, event.velocity, event.step === 14 && profile.id === "rock_heavy");
    if (event.part === "ghost") playGhost(audioContext, time, event.velocity);
    if (event.part === "fill") playSnare(audioContext, time, event.velocity * 0.72);
  });
}

async function startPreview() {
  const profile = activeProfile();
  if (!profile) return;
  const audioContext = ensureAudio();
  if (audioContext.state === "suspended") await audioContext.resume();
  stopPreview();
  state.preview.isPlaying = true;
  state.preview.bpm = previewBpm(profile);
  const barDuration = 60 / state.preview.bpm * 4;
  schedulePreviewBar(profile, audioContext.currentTime + 0.05);
  state.preview.intervalId = setInterval(() => {
    schedulePreviewBar(activeProfile(), audioContext.currentTime + 0.05);
  }, barDuration * 1000);
  renderPreviewView(profile);
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

function renderPreviewView(profile) {
  const events = buildPreviewEvents(profile);
  const stepCells = [...Array(16).keys()]
    .map((step) => {
      const parts = events.filter((event) => event.step === step).map((event) => event.part);
      return `<div class="step-cell${parts.length ? " has-hit" : ""}">
        <span>${step + 1}</span>
        <strong>${parts.map((part) => escapeHtml(part[0].toUpperCase())).join("")}</strong>
      </div>`;
    })
    .join("");

  refs.views.preview.innerHTML = `
    <div class="grid">
      ${card("ブラウザ音プレビュー", `
        <p class="card-copy">選択中のprofileから16ステップの簡易patternを作り、Web Audioの合成音だけで鳴らします。サンプルや外部依存は使いません。ブラウザの自動再生制限に合わせて、再生ボタンを押した時だけ音が出ます。</p>
        <div class="preview-controls">
          <button class="preview-button" type="button" data-preview-action="start">${state.preview.isPlaying ? "再スタート" : "再生"}</button>
          <button class="preview-button secondary" type="button" data-preview-action="stop">停止</button>
          <span class="preview-state">${state.preview.isPlaying ? "再生中" : "停止中"} / ${previewBpm(profile)} BPM</span>
        </div>
      `, true)}
      ${card("16 step preview", `<div class="step-grid">${stepCells}</div>`, true)}
      ${card("鳴らしている要素", chipList([...new Set(events.map((event) => event.part))], "token"))}
      ${card("安全条件", chipList([
        "Web Audio synthesis only",
        "no samples",
        "manual stop",
        "low master gain"
      ], "token"))}
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
          <li><strong>音プレビュー</strong>で、サンプルなしの簡易Web Audio grooveを試聴する。</li>
          <li><strong>制御ポリシー</strong>で、fill / ghost notes / transition の上限と意図を見る。</li>
          <li><strong>開発状況</strong>で、Pages設定・JSON読み込み・未実装範囲を確認する。</li>
          <li><strong>次の方向</strong>で、音入力・VCV連携・AIライブ化のロードマップを見る。</li>
        </ol>
      `, true)}
      ${card("このUIでできること", chipList([
        "style profile の確認",
        "drum feel の構造確認",
        "簡易ブラウザ音プレビュー",
        "fill と transition の方針確認",
        "研究docsへの移動",
        "開発状況の把握",
        "次段階ロードマップの確認"
      ]))}
      ${card("このUIではまだやらないこと", chipList([
        "生音サンプルを鳴らす",
        "MIDIを書き出す",
        "音声解析をする",
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
        "本格runtime生成",
        "audio analysis",
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
        <p class="card-copy">VCVはライブ出力の候補として残しつつ、ブラウザを試聴・開発・予測debugの中心にします。まずはサンプルなしの簡易Web Audio previewから育てます。</p>
        <div class="section-grid">${roadmapCards}</div>
      `, true)}
      ${card("runtime docs", `<div class="token-row">${docs
        .filter(([, href]) => href.startsWith("docs/runtime/") || href.includes("future-runtime-contract"))
        .map(([label, href]) => `<a class="token" href="${href}">${label}</a>`)
        .join("")}</div>`, true)}
      ${card("今回まだやらないこと", chipList([
        "本格groove engine",
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
});

window.addEventListener("pagehide", stopPreview);

loadProfiles();
