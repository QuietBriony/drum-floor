const state = {
  profiles: [],
  activeId: null,
  activeView: "profile"
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
    policy: document.querySelector("#view-policy")
  }
};

const docs = [
  ["Decision model", "docs/groove/groove-decision-model.md"],
  ["Groove grammar", "docs/groove/groove-grammar-v1.md"],
  ["Fill policy", "docs/groove/fill-and-transition-policy.md"],
  ["Evaluation rubric", "docs/groove/evaluation-rubric-v1.md"],
  ["Runtime contract", "docs/groove/future-runtime-contract.md"]
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleize(value) {
  return String(value).replaceAll("_", " ");
}

function chipList(items, className = "chip") {
  return `<div class="chip-row">${items.map((item) => `<span class="${className}">${escapeHtml(titleize(item))}</span>`).join("")}</div>`;
}

function keyValues(object) {
  return `<div class="kv-grid">${Object.entries(object)
    .map(([key, value]) => `<div class="kv"><span>${escapeHtml(titleize(key))}</span><span>${escapeHtml(titleize(value))}</span></div>`)
    .join("")}</div>`;
}

function card(title, content, wide = false) {
  return `<article class="card${wide ? " is-wide" : ""}"><h3>${escapeHtml(title)}</h3>${content}</article>`;
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeId) || state.profiles[0];
}

function renderProfileList() {
  refs.profileCount.textContent = `${state.profiles.length} profiles`;
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
    .map(([instrument, values]) => card(titleize(instrument), keyValues(values)))
    .join("");

  refs.views.profile.innerHTML = `
    <div class="grid">
      ${card("Feel profile", keyValues(profile.feel_profile))}
      ${card("Instrument profile", `<div class="grid">${instruments}</div>`)}
      ${card("Section profile", `<div class="section-grid">${sections}</div>`, true)}
    </div>
  `;
}

function renderTranslationView(profile) {
  const structure = Object.entries(profile.drum_translation.structure)
    .map(([part, tokens]) => card(titleize(part), chipList(tokens, "token")))
    .join("");

  refs.views.translation.innerHTML = `
    <div class="grid">
      ${card("Structure", `<div class="grid">${structure}</div>`, true)}
      ${card("Expression", keyValues(profile.drum_translation.expression), true)}
    </div>
  `;
}

function renderPolicyView(profile) {
  const transitionRules = profile.section_transition_rules
    .map((rule) => `
      <article class="section-box">
        <strong>${escapeHtml(rule.from)} to ${escapeHtml(rule.to)}</strong>
        ${chipList(rule.adjustments, "token")}
        <div class="kv"><span>priority</span><span>${escapeHtml(rule.priority)}</span></div>
      </article>
    `)
    .join("");

  refs.views.policy.innerHTML = `
    <div class="grid">
      ${card("Fill policy", `
        ${keyValues({
          types: profile.fill_policy.types.join(", "),
          max_per_8_bars: profile.fill_policy.max_per_8_bars,
          transition_cue_priority: profile.fill_policy.transition_cue_priority
        })}
        <h3>Section priority</h3>
        ${keyValues(profile.fill_policy.section_priority)}
      `)}
      ${card("Ghost notes policy", `
        ${keyValues({ unit: profile.ghost_notes_policy.unit })}
        <h3>Section density</h3>
        ${keyValues(profile.ghost_notes_policy.section_density)}
      `)}
      ${card("Transition rules", `<div class="section-grid">${transitionRules}</div>`, true)}
      ${card("Avoid", chipList(profile.avoid, "token"), true)}
      ${card("Research docs", `<div class="token-row">${docs.map(([label, href]) => `<a class="token" href="${href}">${label}</a>`).join("")}</div>`, true)}
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
}

function setActiveView(view) {
  state.activeView = view;
  refs.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  Object.entries(refs.views).forEach(([key, node]) => node.classList.toggle("is-active", key === view));
}

async function loadProfiles() {
  try {
    const response = await fetch("profiles/groove-profiles.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
    const data = await response.json();
    state.profiles = data.profiles;
    state.activeId = state.profiles[0]?.id;
    renderActiveProfile();
  } catch (error) {
    refs.profileCount.textContent = "offline";
    refs.views.profile.innerHTML = `<div class="notice">${escapeHtml(error.message)}. Open this site through GitHub Pages or a local web server.</div>`;
    refs.profileLabel.textContent = "Profile JSON unavailable";
    refs.profileDescription.textContent = "profiles/groove-profiles.json could not be loaded.";
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
