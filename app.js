const state = {
  profiles: [],
  policy: null,
  version: null,
  activeId: null,
  activeView: "profile",
  loadStatus: "読み込み中"
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
    policy: document.querySelector("#view-policy"),
    manual: document.querySelector("#view-manual"),
    status: document.querySelector("#view-status")
  }
};

const docs = [
  ["判断モデル", "docs/groove/groove-decision-model.md"],
  ["グルーブ文法", "docs/groove/groove-grammar-v1.md"],
  ["フィル/遷移ポリシー", "docs/groove/fill-and-transition-policy.md"],
  ["評価ルーブリック", "docs/groove/evaluation-rubric-v1.md"],
  ["将来runtime契約", "docs/groove/future-runtime-contract.md"],
  ["schema", "docs/schema/groove-profiles.schema.json"]
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
      ${card(`${labelFor("instrument_profile")}`, `<div class="grid inner-grid">${instruments}</div>`)}
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
          <li><strong>制御ポリシー</strong>で、fill / ghost notes / transition の上限と意図を見る。</li>
          <li><strong>開発状況</strong>で、Pages設定・JSON読み込み・未実装範囲を確認する。</li>
        </ol>
      `, true)}
      ${card("このUIでできること", chipList([
        "style profile の確認",
        "drum feel の構造確認",
        "fill と transition の方針確認",
        "研究docsへの移動",
        "開発状況の把握"
      ]))}
      ${card("このUIではまだやらないこと", chipList([
        "音を鳴らす",
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
        "runtime生成",
        "audio analysis",
        "DAW連携",
        "MIDI書き出し",
        "samples/audio files"
      ], "token"))}
      ${card("開発用リンク", `<div class="token-row">${docs.map(([label, href]) => `<a class="token" href="${href}">${label}</a>`).join("")}</div>`, true)}
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
  renderPolicyView(profile);
  renderManualView();
  renderStatusView();
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

loadProfiles();
