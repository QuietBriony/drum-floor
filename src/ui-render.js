import { docs, labels, roadmap, kitPresets, sectionOptions } from "./contracts.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function valueText(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value === null || value === undefined) return "-";
  return String(value).replaceAll("_", " ");
}

function labelFor(key) {
  const human = labels[key] || String(key).replaceAll("_", " ");
  return `${human} <code>${escapeHtml(key)}</code>`;
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

function activePatternFrame(state, profile) {
  const requestedId = state.controlState.controls.frame;
  const frames = state.patternFrames || [];
  if (!frames.length) return null;
  if (requestedId && requestedId !== "auto") {
    const requested = frames.find((frame) => frame.id === requestedId);
    if (requested) return requested;
  }
  return frames.find((frame) => frame.style_affinity?.includes(profile.id)) || frames[0];
}

function meter(label, value, detail = "") {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return `<div class="reason-meter">
    <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail || `${percent}%`)}</span></div>
    <div class="meter-track"><span style="width: ${percent}%"></span></div>
  </div>`;
}

function controlRange(key, label, controls, min, max, step = 1, unit = "") {
  const value = controls[key];
  return `<label class="control-field">
    <span>${escapeHtml(label)} <strong>${escapeHtml(value)}${unit}</strong></span>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(value)}" data-control="${key}" />
  </label>`;
}

function controlToggle(key, label, controls) {
  return `<label class="control-field toggle-field">
    <span>${escapeHtml(label)} <strong>${controls[key] ? "on" : "off"}</strong></span>
    <input type="checkbox" ${controls[key] ? "checked" : ""} data-control="${key}" />
  </label>`;
}

const scoreAxes = [
  ["pocket", "ポケット"],
  ["space", "間"],
  ["bass_lock", "ベース追従"],
  ["ghost_glue", "ゴースト接着"],
  ["snare_lag_feel", "スネア遅れ感"],
  ["fill_naturalness", "フィル自然さ"],
  ["mix_weight", "ミックス重量"],
  ["surprise", "小さな驚き"],
  ["repeatability", "繰り返し耐性"]
];

function shellQuote(value) {
  return `"${String(value ?? "").replaceAll('"', '\\"')}"`;
}

function renderScoreControl(key, label, draft) {
  const value = draft.scores[key] ?? 3;
  return `<label class="control-field score-field">
    <span>${escapeHtml(label)} <strong>${value}/5</strong></span>
    <input type="range" min="1" max="5" step="1" value="${escapeHtml(value)}" data-score-control="${escapeHtml(key)}" />
  </label>`;
}

function buildScoreCommand(state) {
  const draft = state.scoreDraft;
  const scoreArgs = scoreAxes.map(([key]) => `--${key.replaceAll("_", "-")} ${draft.scores[key] ?? 3}`).join(" ");
  return [
    "python -m drum_floor score",
    draft.candidate || "live/candidates/ableton-ep133-seed-42",
    `--target ${draft.target || "ableton"}`,
    `--reviewer ${shellQuote(draft.reviewer || "human-gate")}`,
    scoreArgs,
    `--what-worked ${shellQuote(draft.notes.what_worked)}`,
    `--what-failed ${shellQuote(draft.notes.what_failed)}`,
    `--next-hint ${shellQuote(draft.notes.next_hint)}`
  ].join(" ");
}

function renderScorecardView(state) {
  const draft = state.scoreDraft;
  const command = buildScoreCommand(state);
  return card("聴感スコアカード", `
    <p class="card-copy">ここではファイル保存せず、CLI用のscore commandを作ります。Abletonやブラウザで聴いたあと、ターミナルで実行してください。</p>
    <div class="control-grid">
      <label class="control-field"><span>candidate <strong>${escapeHtml(draft.candidate)}</strong></span><input value="${escapeHtml(draft.candidate)}" data-score-meta="candidate" /></label>
      <label class="control-field"><span>target <strong>${escapeHtml(draft.target)}</strong></span><select data-score-meta="target"><option value="browser"${draft.target === "browser" ? " selected" : ""}>browser</option><option value="ableton"${draft.target === "ableton" ? " selected" : ""}>ableton</option><option value="ep133_preview"${draft.target === "ep133_preview" ? " selected" : ""}>ep133_preview</option></select></label>
      <label class="control-field"><span>reviewer <strong>${escapeHtml(draft.reviewer)}</strong></span><input value="${escapeHtml(draft.reviewer)}" data-score-meta="reviewer" /></label>
      ${scoreAxes.map(([key, label]) => renderScoreControl(key, label, draft)).join("")}
      <label class="control-field note-field"><span>what worked</span><textarea data-note-control="what_worked">${escapeHtml(draft.notes.what_worked)}</textarea></label>
      <label class="control-field note-field"><span>what failed</span><textarea data-note-control="what_failed">${escapeHtml(draft.notes.what_failed)}</textarea></label>
      <label class="control-field note-field"><span>next hint</span><textarea data-note-control="next_hint">${escapeHtml(draft.notes.next_hint)}</textarea></label>
    </div>
    <textarea class="command-box" id="score-command" readonly>${escapeHtml(command)}</textarea>
    <div class="preview-controls">
      <button class="preview-button secondary" type="button" data-action="copy-score-command">score commandをコピー</button>
      <span class="preview-state">${escapeHtml(state.copyStatus || "score JSONはCLIがmetadata-onlyで保存します")}</span>
    </div>`, true);
}

function renderProfileList(refs, state) {
  refs.profileCount.textContent = `${state.profiles.length}件`;
  refs.profileList.innerHTML = state.profiles.map((profile) => `
    <button class="profile-button${profile.id === state.activeId ? " is-active" : ""}" type="button" data-profile-id="${escapeHtml(profile.id)}">
      <strong>${escapeHtml(profile.label)}</strong>
      <span>${escapeHtml(profile.id)}</span>
    </button>`).join("");
}

function renderProfileView(profile) {
  const sections = Object.entries(profile.section_profile).map(([section, values]) => `
    <div class="section-box"><strong>${escapeHtml(section)}</strong>${keyValues(values)}</div>`).join("");
  const instruments = Object.entries(profile.instrument_profile)
    .map(([instrument, values]) => card(escapeHtml(instrument), keyValues(values)))
    .join("");
  return `<div class="grid">
    ${card(labelFor("feel_profile"), keyValues(profile.feel_profile))}
    ${card(labelFor("instrument_profile"), `<div class="grid inner-grid">${instruments}</div>`, true)}
    ${card(labelFor("section_profile"), `<div class="section-grid">${sections}</div>`, true)}
  </div>`;
}

function renderTranslationView(profile) {
  const structure = Object.entries(profile.drum_translation.structure)
    .map(([part, tokens]) => card(labelFor(part), chipList(tokens, "token")))
    .join("");
  return `<div class="grid">
    ${card(labelFor("structure"), `<div class="grid inner-grid">${structure}</div>`, true)}
    ${card(labelFor("expression"), keyValues(profile.drum_translation.expression), true)}
  </div>`;
}

function renderPatternFrameSummary(frame) {
  if (!frame) return card("ドラムパターン枠", `<p class="card-copy">patterns/drum-pattern-frames.json を読み込み中です。</p>`);
  const director = frame.pocket_director || {};
  return card("Pocket Director", `
    <p class="card-copy">${escapeHtml(frame.description)}</p>
    ${chipList(frame.feel_tags || [], "token")}
    <div class="kv-grid">
      <div class="kv"><span>${labelFor("pattern_frame")}</span><span>${escapeHtml(frame.label)} <code>${escapeHtml(frame.id)}</code></span></div>
      <div class="kv"><span>${labelFor("bass_lock")}</span><span>${escapeHtml(director.bass_lock || "-")}</span></div>
    </div>
    ${meter("間 space", Number(director.space || 0), `${Math.round(Number(director.space || 0) * 100)}%`)}
    ${meter("ゴースト接着 ghost glue", Number(director.ghost_glue || 0), `${Math.round(Number(director.ghost_glue || 0) * 100)}%`)}
    ${meter("ハット揺れ hat swing", Number(director.hat_swing || 0), `${Math.round(Number(director.hat_swing || 0) * 100)}%`)}
    ${keyValues({
      snare_lag_ms: director.snare_lag_ms,
      kick_push_ms: director.kick_push_ms
    })}`);
}

function renderMixHints(frame) {
  const hints = frame?.pocket_director?.mix_hints || {};
  return card("ミックス意図", Object.keys(hints).length ? keyValues(hints) : `<p class="card-copy">選択中のframeにmix hintsがありません。</p>`);
}

function renderStepGrid(generatedBar) {
  const labels = { kick: "K", snare: "S", hat: "H", ghost: "G", fill: "F", crash: "C" };
  return [...Array(16).keys()].map((step) => {
    const parts = generatedBar.events.filter((event) => event.step === step);
    return `<div class="step-cell${parts.length ? " has-hit" : ""}" title="${escapeHtml(parts.map((part) => `${part.part}: ${part.reason}`).join(" / "))}">
      <span>${step + 1}</span><strong>${parts.map((part) => escapeHtml(labels[part.part] || part.part[0].toUpperCase())).join("")}</strong>
    </div>`;
  }).join("");
}

function renderPreviewView(profile, state) {
  const controls = state.controlState.controls;
  const sections = sectionOptions(profile);
  const frame = state.currentFrame || activePatternFrame(state, profile);
  const bar = state.currentBar;
  const decision = state.currentDecision;
  const stats = bar.stats;
  const modeLabel = controls.liveMode ? "Live Mode" : "Develop Mode";
  return `<div class="grid${controls.liveMode ? " live-grid" : ""}">
    ${card("AI Live Groove Co-player", `
      <p class="card-copy">rule-based AIが、手動intentとローカル音入力featuresから次barの <strong>間 → 溜め → 発火 → 回収</strong> を判断します。録音/保存/送信はしません。</p>
      <div class="preview-controls live-controls">
        <button class="preview-button" type="button" data-action="start">${state.playback.isPlaying ? "再スタート" : "再生"}</button>
        <button class="preview-button secondary" type="button" data-action="stop">停止</button>
        <button class="preview-button danger" type="button" data-action="panic">緊急停止</button>
        <button class="preview-button secondary" type="button" data-action="tap">Tap tempo</button>
        <button class="preview-button secondary" type="button" data-action="variation">Variation更新</button>
        <button class="preview-button secondary" type="button" data-action="live-toggle">${modeLabel}</button>
        <span class="preview-state">${state.playback.isPlaying ? "再生中" : "停止中"} / bar ${bar.barIndex} / ${controls.bpm} BPM</span>
      </div>`, true)}
    ${card("Manual Intent", `
      <div class="control-grid">
        <label class="control-field"><span>section <strong>${escapeHtml(controls.section)}</strong></span><select data-control="section">${sections.map((section) => `<option value="${escapeHtml(section)}"${section === controls.section ? " selected" : ""}>${escapeHtml(section)}</option>`).join("")}</select></label>
        <label class="control-field"><span>kit <strong>${escapeHtml(kitPresets[controls.kit].label)}</strong></span><select data-control="kit">${Object.entries(kitPresets).map(([id, kit]) => `<option value="${escapeHtml(id)}"${id === controls.kit ? " selected" : ""}>${escapeHtml(kit.label)}</option>`).join("")}</select></label>
        <label class="control-field"><span>pattern frame <strong>${escapeHtml(frame?.label || "auto")}</strong></span><select data-control="frame">${(state.patternFrames || []).map((item) => `<option value="${escapeHtml(item.id)}"${item.id === frame?.id ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
        <label class="control-field"><span>AI mode <strong>${escapeHtml(controls.aiMode)}</strong></span><select data-control="aiMode"><option value="follow"${controls.aiMode === "follow" ? " selected" : ""}>follow</option><option value="lead"${controls.aiMode === "lead" ? " selected" : ""}>lead</option><option value="lock"${controls.aiMode === "lock" ? " selected" : ""}>lock</option></select></label>
        ${controlRange("bpm", "BPM", controls, 54, 190)}
        ${controlRange("energy", "energy", controls, 0, 100)}
        ${controlRange("density", "density", controls, 0, 100)}
        ${controlRange("space", "space", controls, 0, 100)}
        ${controlRange("lift", "lift", controls, 0, 100)}
        ${controlRange("risk", "risk", controls, 0, 100)}
        ${controlRange("fillDemand", "fill demand", controls, 0, 100)}
        ${controlRange("swing", "swing", controls, 0, 18, 1, "%")}
        ${controlRange("humanize", "humanize", controls, 0, 100)}
        ${controlToggle("crashGate", "crash gate", controls)}
        ${controlToggle("inputLock", "input lock", controls)}
        ${controlToggle("midiEnabled", "MIDI send", controls)}
      </div>`, true)}
    ${renderPatternFrameSummary(frame)}
    ${renderMixHints(frame)}
    ${card("16 step generated bar", `<div class="step-grid">${renderStepGrid(bar)}</div>`, true)}
    ${card("AI判断", `
      ${meter("space", decision.spaceIntent, `${Math.round(decision.spaceIntent * 100)}% / 間`) }
      ${meter("lift", decision.liftIntent, `${Math.round(decision.liftIntent * 100)}% / 溜め`) }
      ${meter("fill", decision.fillIntent, `${Math.round(decision.fillIntent * 100)}% / 発火候補`) }
      ${meter("crash", decision.crashIntent, `${Math.round(decision.crashIntent * 100)}% / release`) }
      ${meter("confidence", decision.confidence, `${Math.round(decision.confidence * 100)}%`) }
      ${chipList(decision.reasons, "token")}`)}
    ${card("音入力 / MIDI", `
      <div class="preview-controls">
        <button class="preview-button secondary" type="button" data-action="enable-input">音入力を有効化</button>
        <button class="preview-button secondary" type="button" data-action="disable-input">音入力停止</button>
        <button class="preview-button secondary" type="button" data-action="connect-midi">MIDI接続</button>
      </div>
      ${keyValues({
        input_status: state.bandFrame.status,
        input_level: `${Math.round(state.bandFrame.inputLevel * 100)}%`,
        onset_rate: `${Math.round(state.bandFrame.onsetRate * 100)}%`,
        rough_tempo: state.bandFrame.roughTempo || "-",
        input_density: `${Math.round(state.bandFrame.density * 100)}%`,
        midi_status: state.midiStatus.status
      })}`)}
    ${card("現在の出力", keyValues({
      phrase_action: decision.phraseAction,
      bar_in_phrase: `${decision.barInPhrase + 1}/8`,
      density: `${Math.round(stats.densityScore * 100)}%`,
      fill_probability: `${Math.round(stats.fillChance * 100)}%`,
      fill_slots: stats.fillSlots.join(", ") || "none",
      pattern_frame: stats.frameLabel,
      kit: kitPresets[controls.kit].label,
      variation_seed: controls.variationSeed
    }))}
    ${renderScorecardView(state)}
    ${card("安全条件", chipList(["local audio features only", "no recording", "no upload", "Web Audio synthesis only", "no samples", "manual panic stop"], "token"), true)}
  </div>`;
}

function renderPolicyView(profile) {
  const transitionRules = profile.section_transition_rules.map((rule) => `
    <article class="section-box"><strong>${escapeHtml(rule.from)} → ${escapeHtml(rule.to)}</strong>${chipList(rule.adjustments, "token")}<div class="kv"><span>${labelFor("priority")}</span><span>${escapeHtml(rule.priority)}</span></div></article>`).join("");
  return `<div class="grid">
    ${card(labelFor("fill_policy"), `${keyValues({ types: profile.fill_policy.types.join(", "), max_per_8_bars: profile.fill_policy.max_per_8_bars, transition_cue_priority: profile.fill_policy.transition_cue_priority })}<h3>${labelFor("section_priority")}</h3>${keyValues(profile.fill_policy.section_priority)}`)}
    ${card(labelFor("ghost_notes_policy"), `${keyValues({ unit: profile.ghost_notes_policy.unit })}<h3>${labelFor("section_density")}</h3>${keyValues(profile.ghost_notes_policy.section_density)}`)}
    ${card(labelFor("section_transition_rules"), `<div class="section-grid">${transitionRules}</div>`, true)}
    ${card(labelFor("avoid"), chipList(profile.avoid, "token"), true)}
    ${card("研究docs", `<div class="token-row">${docs.map(([label, href]) => `<a class="token" href="${href}">${label}</a>`).join("")}</div>`, true)}
  </div>`;
}

function renderManualView() {
  return `<div class="grid">
    ${card("使い方マニュアル", `<ol class="manual-list">
      <li>style profileを選ぶ。</li><li><strong>AI Live Groove Co-player</strong>で再生する。</li><li>pattern frameで中のドラマーのポケットを選ぶ。</li><li>energy/space/lift/risk/fill demandで、間と爆発の量を決める。</li><li><strong>音入力を有効化</strong>すると、ローカルfeaturesだけでAI followに反映する。</li><li>必要ならMIDI接続で外部音源へ送る。</li><li>危ない時は<strong>緊急停止</strong>。</li></ol>`, true)}
    ${card("できること", chipList(["rule-based AI共演", "間/溜め/発火/回収", "local audio feature follow", "Web MIDI optional output", "live mode", "listening harness"]))}
    ${card("まだやらないこと", chipList(["録音", "音声アップロード", "外部AI API", "サンプル再生", "MIDI file export", "VCV自動操作"], "token"))}
  </div>`;
}

function renderStatusView(state) {
  return `<div class="grid">
    ${card("公開状態", keyValues({ pages_source: "main + /(root)", pages_url: "https://quietbriony.github.io/drum-floor/", entry_file: "index.html", app_entry: "app.js type=module" }))}
    ${card("読み込み状態", keyValues({ json_status: state.loadStatus, profile_version: state.version ?? "unknown", profile_count: state.profiles.length, pattern_frame_version: state.patternVersion ?? "unknown", pattern_frame_count: state.patternFrames.length }))}
    ${card("policy flags", keyValues(state.policy || {}))}
    ${card("pattern frame policy", keyValues(state.patternPolicy || {}))}
    ${card("runtime boundary", chipList(["rule-based AI only", "local audio features", "no dependencies", "no samples", "optional Web MIDI"], "token"))}
    ${card("開発用リンク", `<div class="token-row">${docs.map(([label, href]) => `<a class="token" href="${href}">${label}</a>`).join("")}</div>`, true)}
  </div>`;
}

function renderRoadmapView() {
  return `<div class="grid">
    ${card("次の方向", `<p class="card-copy">ブラウザ上のAI co-playerで聴感を固め、次にMIDI/VCV/DAWの出口へ広げます。</p><div class="section-grid">${roadmap.map(([title, status, detail]) => `<article class="section-box roadmap-box"><strong>${escapeHtml(title)}</strong><span class="roadmap-status">${escapeHtml(status)}</span><p>${escapeHtml(detail)}</p></article>`).join("")}</div>`, true)}
  </div>`;
}

export function renderAll(refs, state) {
  const profile = state.profiles.find((item) => item.id === state.activeId) || state.profiles[0];
  if (!profile) return;
  refs.profileId.textContent = profile.id;
  refs.profileLabel.textContent = profile.label;
  refs.profileDescription.textContent = profile.description;
  renderProfileList(refs, state);
  refs.views.profile.innerHTML = renderProfileView(profile);
  refs.views.translation.innerHTML = renderTranslationView(profile);
  refs.views.preview.innerHTML = renderPreviewView(profile, state);
  refs.views.policy.innerHTML = renderPolicyView(profile);
  refs.views.manual.innerHTML = renderManualView();
  refs.views.status.innerHTML = renderStatusView(state);
  refs.views.roadmap.innerHTML = renderRoadmapView();
  refs.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === state.activeView));
  Object.entries(refs.views).forEach(([key, node]) => node.classList.toggle("is-active", key === state.activeView));
}

export function renderLoadError(refs, state, error) {
  refs.profileCount.textContent = "offline";
  refs.profileLabel.textContent = "profile JSONを読めません";
  refs.profileDescription.textContent = "profiles/groove-profiles.json の読み込みに失敗しました。";
  refs.views.profile.innerHTML = `<div class="notice">${escapeHtml(error.message)}。GitHub PagesまたはローカルHTTPサーバー経由で開いてください。</div>`;
  refs.views.manual.innerHTML = renderManualView();
  refs.views.status.innerHTML = renderStatusView(state);
}
