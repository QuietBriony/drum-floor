import { clamp } from "./contracts.js";

export function createManualIntent(controls) {
  return {
    bpm: controls.bpm,
    section: controls.section,
    energy: controls.energy / 100,
    density: controls.density / 100,
    swing: controls.swing,
    humanize: controls.humanize,
    risk: controls.risk / 100,
    space: controls.space / 100,
    lift: controls.lift / 100,
    fillDemand: controls.fillDemand / 100,
    crashGate: controls.crashGate,
    aiMode: controls.aiMode,
    inputLock: controls.inputLock
  };
}

export function createGrooveDecision(profile, manualIntent, bandInput, memory) {
  const barInPhrase = memory.barIndex % 8;
  const inputLevel = manualIntent.inputLock ? 0 : bandInput.inputLevel;
  const inputDensity = manualIntent.inputLock ? 0 : bandInput.density;
  const onsetRate = manualIntent.inputLock ? 0 : bandInput.onsetRate;
  const inputEnergy = clamp(inputLevel * 0.42 + inputDensity * 0.28 + onsetRate * 0.3, 0, 1);
  const followBlend = manualIntent.aiMode === "lead" ? 0.24 : manualIntent.aiMode === "lock" ? 0 : 0.5;
  const effectiveEnergy = clamp(manualIntent.energy * (1 - followBlend) + inputEnergy * followBlend, 0, 1);
  const phraseLift = barInPhrase >= 5 ? (barInPhrase - 4) / 3 : 0;
  const phraseRecovery = barInPhrase === 0 && memory.lastPhraseAction === "explode" ? 0.4 : 0;
  const spaceIntent = clamp(manualIntent.space * 0.72 + (barInPhrase === 5 ? 0.24 : 0) + phraseRecovery - effectiveEnergy * 0.2, 0, 1);
  const liftIntent = clamp(manualIntent.lift * 0.58 + effectiveEnergy * 0.22 + phraseLift * 0.2 - spaceIntent * 0.12, 0, 1);
  const dropIntent = clamp(spaceIntent * 0.55 + (barInPhrase === 5 ? 0.2 : 0) + (manualIntent.risk > 0.72 ? 0.08 : 0), 0, 1);
  const fillIntent = clamp(manualIntent.fillDemand * 0.5 + liftIntent * 0.34 + onsetRate * 0.12 + manualIntent.risk * 0.12 - spaceIntent * 0.18, 0, 1);
  const crashIntent = manualIntent.crashGate ? clamp(liftIntent * 0.58 + effectiveEnergy * 0.16 + (barInPhrase === 0 ? 0.22 : 0) - spaceIntent * 0.18, 0, 1) : 0;
  let phraseAction = "lock";
  if (barInPhrase === 6 && liftIntent > 0.42) phraseAction = "pre_lift_gap";
  else if (barInPhrase === 7 && (liftIntent > 0.5 || fillIntent > 0.52)) phraseAction = "explode";
  else if (barInPhrase === 0 && memory.lastPhraseAction === "explode") phraseAction = "recover";
  else if (spaceIntent > 0.68) phraseAction = "space";
  else if (liftIntent > 0.62 || effectiveEnergy > 0.72) phraseAction = "build";
  const confidence = clamp(0.5 + Math.abs(effectiveEnergy - 0.5) * 0.22 + (bandInput.inputEnabled ? bandInput.stability * 0.18 : 0.08), 0.42, 0.94);
  const reasons = [
    `${profile.id} / ${manualIntent.section}`,
    `mode=${manualIntent.aiMode}`,
    `phrase=${barInPhrase + 1}/8`,
    `action=${phraseAction}`,
    bandInput.inputEnabled ? `input level ${Math.round(inputLevel * 100)}%` : "manual only",
    spaceIntent > 0.55 ? "間を作る" : "土台維持",
    liftIntent > 0.55 ? "発火準備" : "安定"
  ];
  return {
    barInPhrase,
    phraseAction,
    effectiveEnergy,
    inputEnergy,
    spaceIntent,
    liftIntent,
    dropIntent,
    fillIntent,
    crashIntent,
    densityScalar: clamp(0.58 + effectiveEnergy * 0.34 + liftIntent * 0.16 - spaceIntent * 0.36, 0.22, 1.15),
    velocityScalar: clamp(0.72 + effectiveEnergy * 0.38 + liftIntent * 0.16, 0.56, 1.18),
    confidence,
    reasons
  };
}

export function updatePhraseMemory(memory, decision) {
  return {
    ...memory,
    barIndex: memory.barIndex + 1,
    lastPhraseAction: decision.phraseAction,
    lastDecision: decision,
    explodeCount: memory.explodeCount + (decision.phraseAction === "explode" ? 1 : 0)
  };
}
