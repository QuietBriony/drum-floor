import { clamp, normalizeDensity, seededRng } from "./contracts.js";

function addEvent(events, event) {
  const step = clamp(Math.round(event.step), 0, 15);
  const part = event.part;
  const existing = events.find((item) => item.step === step && item.part === part);
  const normalized = {
    id: `${part}-${step}-${events.length}`,
    step,
    part,
    velocity: clamp(event.velocity, 0.04, 1.22),
    microOffsetMs: Math.round(event.microOffsetMs || 0),
    duration: event.duration || defaultDuration(part),
    reason: event.reason || "generated"
  };
  if (existing) {
    existing.velocity = Math.max(existing.velocity, normalized.velocity);
    existing.reason = `${existing.reason}, ${normalized.reason}`;
    existing.microOffsetMs = Math.round((existing.microOffsetMs + normalized.microOffsetMs) / 2);
    return;
  }
  events.push(normalized);
}

function defaultDuration(part) {
  if (part === "kick") return 0.22;
  if (part === "snare") return 0.16;
  if (part === "hat") return 0.05;
  if (part === "ghost") return 0.06;
  if (part === "fill") return 0.12;
  if (part === "crash") return 0.68;
  return 0.1;
}

function templateSteps(stepValue) {
  if (Number.isInteger(stepValue)) return [stepValue];
  const mapping = {
    even_8ths: [0, 4, 8, 12],
    steady_8ths: [0, 4, 8, 12],
    sparse_8ths: [0, 8, 12],
    broken_16ths: [0, 3, 4, 7, 10, 12, 14],
    swung_8ths_with_16th_pickups: [0, 3, 4, 7, 8, 11, 12, 15]
  };
  return mapping[String(stepValue)] || [];
}

function directorValue(director, key, fallback = 0) {
  const value = Number(director?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function frameOffset(part, step, director) {
  const snareLag = directorValue(director, "snare_lag_ms");
  const kickPush = directorValue(director, "kick_push_ms");
  const hatSwing = clamp(directorValue(director, "hat_swing"), 0, 1);
  if (part === "kick") return kickPush;
  if (part === "snare" || part === "fill") return snareLag;
  if (part === "ghost") return Math.round(snareLag * 0.7);
  if (part === "hat" && step % 4 !== 0) return Math.round(hatSwing * 8);
  return 0;
}

function applyPatternFrame(events, patternFrame, context) {
  if (!patternFrame?.structure_template) return;
  const director = patternFrame.pocket_director || {};
  Object.entries(patternFrame.structure_template).forEach(([part, entries]) => {
    if (!Array.isArray(entries)) return;
    if (part === "fill" && !context.fillActive) return;
    if (part === "crash" && !context.crashAllowed) return;
    entries.forEach((entry) => {
      templateSteps(entry.step).forEach((step) => {
        addEvent(events, {
          step,
          part,
          velocity: context.velocityBase(part),
          microOffsetMs: frameOffset(part, step, director),
          reason: `frame:${patternFrame.id}:${entry.role || "shape"}`
        });
      });
    });
  });
}

function fillSlots(profile, controls, decision, stats, rng) {
  if (stats.fillBudget <= 0) return [];
  const weighted = [...Array(8).keys()].map((bar) => ({
    bar,
    score: rng() + (bar === 7 ? 0.34 : bar === 3 ? 0.14 : 0) + decision.fillIntent * 0.3 + (decision.phraseAction === "explode" ? 0.2 : 0)
  }));
  return weighted.sort((a, b) => b.score - a.score).slice(0, stats.fillBudget).map((item) => item.bar);
}

export function buildGenerationStats(profile, controls, decision) {
  const sectionProfile = profile.section_profile?.[controls.section] || {};
  const sectionDensity = normalizeDensity(sectionProfile.density, normalizeDensity(profile.feel_profile?.density, 0.5));
  const profileDensity = normalizeDensity(profile.feel_profile?.density, 0.5);
  const manualDensity = controls.density / 100;
  const densityScore = clamp((profileDensity * 0.25 + sectionDensity * 0.22 + manualDensity * 0.28 + decision.densityScalar * 0.25), 0.05, 1);
  const ghostScore = clamp(normalizeDensity(profile.ghost_notes_policy?.section_density?.[controls.section], 0.2) * 0.5 + controls.humanize / 230 + densityScore * 0.12 - decision.spaceIntent * 0.08, 0, 1);
  const sectionPriority = Number(profile.fill_policy?.section_priority?.[controls.section] ?? 3);
  const maxFills = clamp(Number(profile.fill_policy?.max_per_8_bars ?? 1), 0, 8);
  const rawFill = (maxFills / 8) * 0.38 + sectionPriority / 25 + decision.fillIntent * 0.34 - decision.spaceIntent * 0.12;
  const fillChance = clamp(rawFill, 0.02, 0.9);
  const fillBudget = clamp(Math.round(maxFills * clamp(0.14 + fillChance * 0.9, 0, 1)), 0, maxFills);
  const swingMs = Math.round((controls.swing / 100) * (60 / controls.bpm / 4) * 1000);
  const humanizeMs = Math.round(2 + controls.humanize * 0.12);
  return { sectionDensity, profileDensity, densityScore, ghostScore, fillChance, fillBudget, sectionPriority, maxFills, swingMs, humanizeMs };
}

export function generateGrooveBar(profile, controls, decision, memory, patternFrame = null) {
  const rng = seededRng([profile.id, patternFrame?.id || "no-frame", controls.section, controls.kit, controls.variationSeed, memory.barIndex, decision.phraseAction, controls.risk, controls.space, controls.lift]);
  const stats = buildGenerationStats(profile, controls, decision);
  const events = [];
  const barInPhrase = memory.barIndex % 8;
  const energy = decision.effectiveEnergy;
  const density = stats.densityScore;
  const isHalfTime = profile.id === "dubby_half_time" || (controls.section === "bridge" && decision.spaceIntent > 0.55);
  const isBreakbeat = profile.id === "breakbeat_live";
  const isPocket = profile.id === "nerdy_jazzy_hiphop";
  const isHeavy = profile.id === "rock_heavy" || profile.id === "mixture_shout";
  const preLift = decision.phraseAction === "pre_lift_gap";
  const explode = decision.phraseAction === "explode";
  const recover = decision.phraseAction === "recover";
  const space = decision.phraseAction === "space";
  const velocityBase = decision.velocityScalar;
  const director = patternFrame?.pocket_director || {};
  const directorSpace = clamp(directorValue(director, "space", 0.4), 0, 1);
  const snareLagMs = Math.round(directorValue(director, "snare_lag_ms"));
  const kickPushMs = Math.round(directorValue(director, "kick_push_ms", -3));
  const ghostGlue = clamp(directorValue(director, "ghost_glue"), 0, 1);
  const hatSwing = clamp(directorValue(director, "hat_swing"), 0, 1);
  stats.densityScore = clamp(stats.densityScore * (1 - directorSpace * 0.14) + (1 - directorSpace) * 0.06, 0.05, 1);
  stats.ghostScore = clamp(Math.max(stats.ghostScore, ghostGlue * 0.72), 0, 1);

  const frameFillActive = (decision.fillIntent > 0.46 && barInPhrase >= 6) || explode;
  applyPatternFrame(events, patternFrame, {
    fillActive: frameFillActive,
    crashAllowed: controls.crashGate && (barInPhrase === 0 || barInPhrase === 7 || explode || recover),
    velocityBase: (part) => {
      const base = { kick: 0.72, snare: 0.68, hat: 0.28, ghost: 0.18, fill: 0.48, crash: 0.55 }[part] || 0.4;
      return base + energy * 0.22 + stats.densityScore * 0.08;
    }
  });

  addEvent(events, { step: 0, part: "kick", velocity: (0.78 + energy * 0.2) * velocityBase, microOffsetMs: kickPushMs, reason: "downbeat anchor" });
  addEvent(events, { step: isHalfTime ? 8 : 4, part: "snare", velocity: (0.72 + energy * 0.22) * velocityBase, microOffsetMs: snareLagMs || (decision.spaceIntent > 0.5 ? 5 : 1), reason: isHalfTime ? "half-time backbeat" : "backbeat" });
  if (!isHalfTime && !space) addEvent(events, { step: 12, part: "snare", velocity: (0.74 + energy * 0.2) * velocityBase, microOffsetMs: snareLagMs, reason: "backbeat return" });

  if ((density > 0.32 || isHeavy) && !preLift) addEvent(events, { step: 8, part: "kick", velocity: 0.52 + energy * 0.26, microOffsetMs: kickPushMs, reason: "mid-bar anchor" });
  if ((density > 0.52 || isBreakbeat) && !space) addEvent(events, { step: rng() > 0.45 ? 10 : 11, part: "kick", velocity: 0.38 + density * 0.3, microOffsetMs: kickPushMs, reason: "density response" });
  if ((density > 0.68 || profile.id === "mixture_shout") && !preLift) addEvent(events, { step: rng() > 0.5 ? 7 : 15, part: "kick", velocity: 0.36 + energy * 0.26, microOffsetMs: kickPushMs, reason: "riff pickup" });
  if (isPocket && rng() > 0.3 && !explode) addEvent(events, { step: rng() > 0.5 ? 3 : 6, part: "kick", velocity: 0.34, microOffsetMs: 5, reason: "soft displacement" });
  if (isBreakbeat && !space) {
    addEvent(events, { step: 3, part: "kick", velocity: 0.44 + rng() * 0.18, reason: "breakbeat stagger" });
    addEvent(events, { step: 6, part: "snare", velocity: 0.26 + rng() * 0.18, reason: "break ghost response" });
  }

  let hatSteps = [0, 2, 4, 6, 8, 10, 12, 14];
  if (density < 0.26 || space) hatSteps = [0, 4, 8, 12];
  if (density > 0.68 || explode) hatSteps = [...Array(16).keys()];
  if (profile.id === "dubby_half_time" && controls.section !== "chorus") hatSteps = [0, 4, 10, 12];
  if (preLift) hatSteps = [0, 4, 8];
  hatSteps.forEach((step) => {
    const accent = step % 4 === 0 ? 0.2 : 0;
    const microOffsetMs = step % 4 === 2 ? stats.swingMs + Math.round(hatSwing * 8) : Math.round(hatSwing * 3);
    addEvent(events, { step, part: "hat", velocity: 0.2 + density * 0.24 + accent + (rng() - 0.5) * 0.1, microOffsetMs, reason: preLift ? "pre-lift gap timekeeper" : "timekeeper" });
  });

  const ghostCandidates = isBreakbeat ? [2, 5, 6, 9, 13, 14] : isPocket ? [3, 5, 7, 11, 13] : [5, 11, 13];
  ghostCandidates.forEach((step) => {
    if (!preLift && rng() < stats.ghostScore * (isPocket ? 0.7 : 0.48)) addEvent(events, { step, part: "ghost", velocity: 0.16 + rng() * 0.24, microOffsetMs: stats.humanizeMs / 2 + Math.round(snareLagMs * 0.5), reason: "human pocket texture" });
  });

  const slots = fillSlots(profile, controls, decision, stats, rng);
  const fillActive = slots.includes(barInPhrase) || explode && decision.fillIntent > 0.42;
  if (fillActive) {
    const longFill = profile.fill_policy?.types?.includes("long") && (energy > 0.6 || isBreakbeat || explode);
    const fillSteps = longFill ? [11, 12, 13, 14, 15] : [14, 15];
    fillSteps.forEach((step, index) => addEvent(events, { step, part: "fill", velocity: 0.38 + energy * 0.34 + index * 0.045, microOffsetMs: snareLagMs + (index % 2 ? stats.humanizeMs : -stats.humanizeMs / 2), reason: longFill ? "long transition fill" : "rare transition fill" }));
  }

  const crashNow = controls.crashGate && (explode || decision.crashIntent > 0.74 && (barInPhrase === 0 || barInPhrase === 7));
  if (crashNow) addEvent(events, { step: explode ? 15 : 0, part: "crash", velocity: 0.48 + energy * 0.35, reason: explode ? "explosion release" : "section entry accent" });
  if (recover) addEvent(events, { step: 0, part: "crash", velocity: 0.42, reason: "recover shimmer" });

  const partOrder = { kick: 0, snare: 1, hat: 2, ghost: 3, fill: 4, crash: 5 };
  return {
    barIndex: memory.barIndex,
    barInPhrase,
    decision,
    stats: {
      ...stats,
      fillActive,
      fillSlots: slots,
      phraseAction: decision.phraseAction,
      frameId: patternFrame?.id || "none",
      frameLabel: patternFrame?.label || "未選択",
      pocket: {
        space: directorSpace,
        snareLagMs,
        kickPushMs,
        ghostGlue,
        hatSwing
      }
    },
    events: events.sort((a, b) => a.step - b.step || partOrder[a.part] - partOrder[b.part])
  };
}
