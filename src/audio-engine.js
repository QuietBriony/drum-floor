import { kitPresets } from "./contracts.js";

export class AudioEngine {
  constructor(options = {}) {
    this.audioContext = options.audioContext || null;
    this.destination = options.destination || null;
    this.masterLevel = Number.isFinite(options.gain) ? options.gain : 0.38;
    this.master = null;
    this.compressor = null;
    this.roomDelay = null;
    this.roomFilter = null;
    this.roomGain = null;
    this.bodyFilter = null;
    this.bodyGain = null;
  }

  ensure() {
    if (this.audioContext && this.master) return this.audioContext;
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    this.compressor = this.audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 16;
    this.compressor.ratio.value = 5;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.16;
    this.master = this.audioContext.createGain();
    this.master.gain.value = this.masterLevel;
    this.roomDelay = this.audioContext.createDelay(0.08);
    this.roomFilter = this.audioContext.createBiquadFilter();
    this.roomGain = this.audioContext.createGain();
    this.bodyFilter = this.audioContext.createBiquadFilter();
    this.bodyGain = this.audioContext.createGain();
    this.roomDelay.delayTime.value = 0.031;
    this.roomFilter.type = "bandpass";
    this.roomFilter.frequency.value = 980;
    this.roomFilter.Q.value = 0.64;
    this.roomGain.gain.value = 0.16;
    this.bodyFilter.type = "bandpass";
    this.bodyFilter.frequency.value = 190;
    this.bodyFilter.Q.value = 0.82;
    this.bodyGain.gain.value = 0.055;
    this.roomDelay.connect(this.roomFilter).connect(this.roomGain).connect(this.compressor);
    this.bodyFilter.connect(this.bodyGain).connect(this.compressor);
    this.master.connect(this.compressor).connect(this.destination || this.audioContext.destination);
    return this.audioContext;
  }

  async resume() {
    const context = this.ensure();
    if (context.state === "suspended") await context.resume();
    this.master.gain.setTargetAtTime(this.masterLevel, context.currentTime, 0.02);
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

  linearEnvelope(startTime, peak, attack, decay) {
    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(peak, 0), startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + decay);
    return gain;
  }

  connectVoice(node, roomAmount = 0, bodyAmount = 0) {
    node.connect(this.master);
    if (this.roomDelay && roomAmount > 0) {
      const send = this.audioContext.createGain();
      send.gain.value = Math.min(0.24, Math.max(0, roomAmount));
      node.connect(send).connect(this.roomDelay);
    }
    if (this.bodyFilter && bodyAmount > 0) {
      const send = this.audioContext.createGain();
      send.gain.value = Math.min(0.14, Math.max(0, bodyAmount));
      node.connect(send).connect(this.bodyFilter);
    }
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

  acousticNoise(time, velocity, filterType, frequency, duration, q, roomAmount = 0, bodyAmount = 0) {
    const source = this.audioContext.createBufferSource();
    const filter = this.audioContext.createBiquadFilter();
    const gain = this.linearEnvelope(time, velocity, 0.002, duration);
    source.buffer = this.noiseBuffer(duration + 0.08);
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.value = q;
    source.connect(filter).connect(gain);
    this.connectVoice(gain, roomAmount, bodyAmount);
    source.start(time);
    source.stop(time + duration + 0.08);
  }

  struckTone(time, velocity, frequency, duration, type = "triangle", roomAmount = 0, bodyAmount = 0) {
    const osc = this.audioContext.createOscillator();
    const gain = this.linearEnvelope(time, velocity, 0.002, duration);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.82), time + duration * 0.7);
    osc.connect(gain);
    this.connectVoice(gain, roomAmount, bodyAmount);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  isHardBop(kit) {
    return kit?.model === "hard_bop_room";
  }

  eventVelocity(part, velocity, densityScore = 0) {
    const density = Math.min(1, Math.max(0, Number(densityScore) || 0));
    const maxByPart = {
      kick: 0.92,
      snare: 0.96,
      hat: 0.7,
      ghost: 0.48,
      fill: 0.84,
      crash: 0.72,
    };
    const trimByPart = {
      kick: 1 - density * 0.08,
      snare: 1 - density * 0.05,
      hat: 1 - density * 0.16,
      ghost: 1 - density * 0.08,
      fill: 1 - density * 0.1,
      crash: 1 - density * 0.18,
    };
    const max = maxByPart[part] ?? 0.9;
    const trim = trimByPart[part] ?? 1;
    return Math.min(max, Math.max(0.001, velocity * trim));
  }

  kick(time, velocity, kit) {
    if (this.isHardBop(kit)) {
      const loudness = Math.min(1.2, Math.max(0.05, velocity));
      this.struckTone(time, kit.kick.peak * loudness, kit.kick.start, kit.kick.decay, kit.kick.tone, kit.kick.room * (0.7 + loudness * 0.5), kit.kick.room * 0.55);
      this.acousticNoise(time + 0.001, kit.kick.beater * loudness, "bandpass", 2800 + loudness * 900, 0.024, 2.1, 0.025);
      if (kit.kick.sub) this.struckTone(time + 0.006, kit.kick.sub * loudness, kit.kick.end * 0.72, kit.kick.decay * 1.25, "sine", kit.kick.room * 0.42, kit.kick.room * 0.34);
      return;
    }
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

  snare(time, velocity, kit, rim = false, articulation = "stick") {
    if (this.isHardBop(kit)) {
      const loudness = Math.min(1.2, Math.max(0.05, velocity));
      const room = kit.snare.room * (0.65 + loudness * 0.55);
      if (articulation === "brush") {
        this.acousticNoise(time, kit.snare.rattle * loudness * 0.46, "bandpass", 2600, 0.12, 0.55, room * 0.22);
        this.acousticNoise(time + 0.018, kit.snare.shell * loudness * 0.34, "highpass", 3900, 0.075, 0.65, room * 0.18);
        return;
      }
      if (articulation === "cross_stick") {
        this.acousticNoise(time, kit.snare.rim * loudness * 1.4, "bandpass", 1850, 0.042, 4.8, room * 0.2);
        this.struckTone(time + 0.002, kit.snare.body * loudness * 0.32, 320, 0.052, "square", room * 0.18);
        return;
      }
      if (articulation === "flam_light") {
        this.snare(time - 0.018, velocity * 0.36, kit, false, "drag");
      }
      this.acousticNoise(time, kit.snare.stick * loudness, "highpass", 3100 + loudness * 1000, 0.028, 1.6, room * 0.25);
      this.struckTone(time + 0.001, kit.snare.body * loudness, 190 - loudness * 20, 0.11 + loudness * 0.025, "triangle", room, room * 0.36);
      this.acousticNoise(time + 0.004, kit.snare.noise * loudness, "bandpass", kit.snare.filter + loudness * 700, kit.snare.decay + loudness * 0.035, 2.4, room);
      this.acousticNoise(time + 0.012, kit.snare.rattle * loudness * (articulation === "buzz" ? 1.35 : 1), "highpass", 5200 + loudness * 1400, (articulation === "buzz" ? 0.18 : 0.11) + loudness * 0.045, 0.9, room * 0.85);
      this.acousticNoise(time + 0.018, kit.snare.shell * loudness, "bandpass", 620, 0.1, 0.7, room * 0.7, room * 0.32);
      if (rim && kit.snare.rim) this.acousticNoise(time + 0.002, kit.snare.rim * loudness, "highpass", 3900, 0.042, 1.2, room * 0.35);
      return;
    }
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

  hat(time, velocity, kit, open = false, articulation = "ride_tip") {
    if (this.isHardBop(kit)) {
      const loudness = Math.min(1.2, Math.max(0.04, velocity));
      const decay = open ? kit.hat.open : kit.hat.closed;
      const room = kit.hat.room * (0.7 + loudness * 0.45);
      const bell = articulation === "ride_bell";
      this.acousticNoise(time, kit.hat.ride * loudness * (bell ? 0.72 : 1), "bandpass", bell ? 4300 : 6100 + loudness * 1200, decay + loudness * (bell ? 0.12 : 0.06), bell ? 5.2 : 1.1, room);
      this.acousticNoise(time + 0.004, kit.hat.clean * loudness, "highpass", kit.hat.filter + loudness * 900, decay * 0.55, 0.65, room * 0.45);
      if (loudness > 0.48 || bell) this.acousticNoise(time + 0.007, kit.hat.bell * loudness * (bell ? 1.75 : 1), "bandpass", 3800, bell ? 0.16 : 0.08, 4.2, room * 0.4);
      if (kit.hat.dirty) this.acousticNoise(time + 0.01, kit.hat.dirty * loudness, "bandpass", 2400, decay * 0.8, 0.8, room * 0.3);
      return;
    }
    this.noiseHit(time, kit.hat.clean * velocity, "highpass", kit.hat.filter, open ? kit.hat.open : kit.hat.closed, 0.8);
    if (kit.hat.dirty) this.noiseHit(time + 0.002, kit.hat.dirty * velocity, "bandpass", kit.hat.filter * 0.62, open ? kit.hat.open * 0.7 : kit.hat.closed * 1.2, 1.8);
  }

  ghost(time, velocity, kit, articulation = "brush") {
    if (this.isHardBop(kit)) {
      const soft = Math.min(0.62, Math.max(0.04, velocity));
      const duration = articulation === "buzz" ? 0.11 : articulation === "brush" ? 0.085 : 0.055;
      this.acousticNoise(time, kit.snare.rattle * soft * (articulation === "buzz" ? 1.15 : 0.9), articulation === "brush" ? "bandpass" : "highpass", articulation === "brush" ? 2600 : 4300, duration, 0.8, kit.snare.room * 0.35);
      this.acousticNoise(time + 0.006, kit.snare.shell * soft * 0.55, "bandpass", 720, 0.045, 0.7, kit.snare.room * 0.25);
      if (articulation === "drag") this.acousticNoise(time + 0.028, kit.snare.rattle * soft * 0.55, "highpass", 5000, 0.045, 0.85, kit.snare.room * 0.22);
      return;
    }
    this.noiseHit(time, kit.snare.noise * 0.28 * velocity, "bandpass", kit.snare.filter + 380, 0.055, 2.4);
  }

  fill(time, velocity, kit, articulation = "drag") {
    if (this.isHardBop(kit) && articulation === "flam_light") {
      this.ghost(time - 0.018, velocity * 0.34, kit, "drag");
      this.snare(time + 0.004, velocity * 0.72, kit, true, "rim");
      return;
    }
    this.snare(time, velocity * 0.76, kit, true, articulation);
    this.ghost(time + 0.035, velocity * 0.56, kit, "drag");
  }

  crash(time, velocity, kit) {
    if (this.isHardBop(kit)) {
      const loudness = Math.min(1.1, Math.max(0.06, velocity));
      const room = kit.crash.room * (0.8 + loudness * 0.5);
      this.acousticNoise(time, kit.crash.gain * loudness, "highpass", kit.crash.filter, kit.crash.decay, 0.55, room);
      this.acousticNoise(time + 0.012, kit.crash.width * loudness, "bandpass", kit.crash.filter * 0.58, kit.crash.decay * 0.82, 0.75, room);
      this.acousticNoise(time + 0.028, kit.crash.width * 0.46 * loudness, "bandpass", 2100, kit.crash.decay * 0.65, 0.45, room * 0.7);
      return;
    }
    this.noiseHit(time, kit.crash.gain * velocity, "highpass", kit.crash.filter, kit.crash.decay, 0.5);
    if (kit.crash.width) this.noiseHit(time + 0.012, kit.crash.width * velocity, "bandpass", kit.crash.filter * 0.72, kit.crash.decay * 0.85, 0.7);
  }

  scheduleBar(generatedBar, controls, startTime) {
    const context = this.ensure();
    const kit = kitPresets[controls.kit] || kitPresets.tight_band;
    const stepDuration = 60 / controls.bpm / 4;
    const densityScore = generatedBar.stats?.densityScore ?? 0;
    generatedBar.events.forEach((event) => {
      const time = startTime + Math.max(0, event.step * stepDuration + (event.microOffsetMs || 0) / 1000);
      const velocity = this.eventVelocity(event.part, event.velocity, densityScore);
      if (event.part === "kick") this.kick(time, velocity, kit);
      if (event.part === "snare") this.snare(time, velocity, kit, event.reason.includes("rim") || event.articulation === "rim", event.articulation || "stick");
      if (event.part === "hat") this.hat(time, velocity, kit, event.step === 14 && densityScore > 0.52, event.articulation || "ride_tip");
      if (event.part === "ghost") this.ghost(time, velocity, kit, event.articulation || "brush");
      if (event.part === "fill") this.fill(time, velocity, kit, event.articulation || "drag");
      if (event.part === "crash") this.crash(time, velocity, kit);
    });
    return context;
  }
}
