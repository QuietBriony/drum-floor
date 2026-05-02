import { kitPresets } from "./contracts.js";

export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.master = null;
    this.compressor = null;
  }

  ensure() {
    if (this.audioContext) return this.audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.16;
    this.master = this.audioContext.createGain();
    this.master.gain.value = 0.38;
    this.master.connect(this.compressor).connect(this.audioContext.destination);
    return this.audioContext;
  }

  async resume() {
    const context = this.ensure();
    if (context.state === "suspended") await context.resume();
    this.master.gain.setTargetAtTime(0.38, context.currentTime, 0.02);
    return context;
  }

  panic() {
    if (!this.audioContext || !this.master) return;
    this.master.gain.cancelScheduledValues(this.audioContext.currentTime);
    this.master.gain.setTargetAtTime(0.0001, this.audioContext.currentTime, 0.01);
  }

  envelope(startTime, peak, attack, decay) {
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + decay);
    return gain;
  }

  noiseBuffer(duration) {
    const length = Math.max(1, Math.floor(this.audioContext.sampleRate * duration));
    const buffer = this.audioContext.createBuffer(1, length, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  noiseHit(time, velocity, filterType, frequency, duration, q = 1, destination = this.master) {
    const source = this.audioContext.createBufferSource();
    const filter = this.audioContext.createBiquadFilter();
    const gain = this.envelope(time, velocity, 0.004, duration);
    source.buffer = this.noiseBuffer(duration + 0.06);
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    source.connect(filter).connect(gain).connect(destination);
    source.start(time);
    source.stop(time + duration + 0.07);
  }

  kick(time, velocity, kit) {
    const osc = this.audioContext.createOscillator();
    const gain = this.envelope(time, kit.kick.peak * velocity, 0.008, kit.kick.decay);
    osc.type = kit.kick.tone;
    osc.frequency.setValueAtTime(kit.kick.start, time);
    osc.frequency.exponentialRampToValueAtTime(kit.kick.end, time + kit.kick.decay * 0.84);
    osc.connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + kit.kick.decay + 0.08);
    if (kit.kick.sub) {
      const sub = this.audioContext.createOscillator();
      const subGain = this.envelope(time + 0.002, kit.kick.sub * velocity, 0.012, kit.kick.decay * 1.35);
      sub.type = "sine";
      sub.frequency.setValueAtTime(42, time);
      sub.frequency.exponentialRampToValueAtTime(34, time + kit.kick.decay);
      sub.connect(subGain).connect(this.master);
      sub.start(time);
      sub.stop(time + kit.kick.decay * 1.5);
    }
  }

  snare(time, velocity, kit, rim = false) {
    this.noiseHit(time, kit.snare.noise * velocity, "bandpass", kit.snare.filter, kit.snare.decay, 2.2);
    const body = this.audioContext.createOscillator();
    const gain = this.envelope(time, kit.snare.body * velocity, 0.004, 0.08);
    body.type = "triangle";
    body.frequency.value = kit === kitPresets.dub_space ? 150 : 185;
    body.connect(gain).connect(this.master);
    body.start(time);
    body.stop(time + 0.11);
    if (rim && kit.snare.rim) this.noiseHit(time + 0.002, kit.snare.rim * velocity, "highpass", 2400, 0.045, 1.4);
  }

  hat(time, velocity, kit, open = false) {
    this.noiseHit(time, kit.hat.clean * velocity, "highpass", kit.hat.filter, open ? kit.hat.open : kit.hat.closed, 0.8);
    if (kit.hat.dirty) this.noiseHit(time + 0.002, kit.hat.dirty * velocity, "bandpass", kit.hat.filter * 0.62, open ? kit.hat.open * 0.7 : kit.hat.closed * 1.2, 1.8);
  }

  ghost(time, velocity, kit) {
    this.noiseHit(time, kit.snare.noise * 0.28 * velocity, "bandpass", kit.snare.filter + 380, 0.055, 2.4);
  }

  fill(time, velocity, kit) {
    this.snare(time, velocity * 0.76, kit, true);
    this.ghost(time + 0.035, velocity * 0.56, kit);
  }

  crash(time, velocity, kit) {
    this.noiseHit(time, kit.crash.gain * velocity, "highpass", kit.crash.filter, kit.crash.decay, 0.5);
    if (kit.crash.width) this.noiseHit(time + 0.012, kit.crash.width * velocity, "bandpass", kit.crash.filter * 0.72, kit.crash.decay * 0.85, 0.7);
  }

  scheduleBar(generatedBar, controls, startTime) {
    const context = this.ensure();
    const kit = kitPresets[controls.kit] || kitPresets.tight_band;
    const stepDuration = 60 / controls.bpm / 4;
    generatedBar.events.forEach((event) => {
      const time = startTime + Math.max(0, event.step * stepDuration + (event.microOffsetMs || 0) / 1000);
      if (event.part === "kick") this.kick(time, event.velocity, kit);
      if (event.part === "snare") this.snare(time, event.velocity, kit, event.reason.includes("rim"));
      if (event.part === "hat") this.hat(time, event.velocity, kit, event.step === 14 && generatedBar.stats.densityScore > 0.52);
      if (event.part === "ghost") this.ghost(time, event.velocity, kit);
      if (event.part === "fill") this.fill(time, event.velocity, kit);
      if (event.part === "crash") this.crash(time, event.velocity, kit);
    });
    return context;
  }
}
