import { clamp, sanitizeControls } from "./contracts.js";

export function createControlState(initialControls, profile) {
  return {
    controls: sanitizeControls(initialControls, profile),
    tapTimes: []
  };
}

export function updateControl(controlState, key, value, profile) {
  const next = { ...controlState.controls };
  if (["bpm", "energy", "density", "swing", "humanize", "risk", "space", "lift", "fillDemand"].includes(key)) next[key] = Number(value);
  else if (["crashGate", "inputLock", "liveMode", "midiEnabled"].includes(key)) next[key] = Boolean(value);
  else next[key] = value;
  controlState.controls = sanitizeControls(next, profile);
  return controlState.controls;
}

export function tapTempo(controlState, profile) {
  const now = performance.now();
  controlState.tapTimes = controlState.tapTimes.filter((time) => now - time < 2400);
  controlState.tapTimes.push(now);
  if (controlState.tapTimes.length >= 2) {
    const intervals = controlState.tapTimes.slice(1).map((time, index) => time - controlState.tapTimes[index]);
    const recent = intervals.slice(-4);
    const average = recent.reduce((sum, ms) => sum + ms, 0) / recent.length;
    controlState.controls.bpm = Math.round(clamp(60000 / average, 54, 190));
  }
  controlState.controls = sanitizeControls(controlState.controls, profile);
  return controlState.controls;
}

export function randomizeVariation(controlState, profile) {
  controlState.controls.variationSeed = Math.floor(Math.random() * 100000);
  controlState.controls = sanitizeControls(controlState.controls, profile);
  return controlState.controls;
}
