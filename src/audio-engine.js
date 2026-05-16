import { kitPresets } from "./contracts.js";

export class AudioEngine {
  constructor(options = {}) {
    this.audioContext = options.audioContext || null;
    this.destination = options.destination || null;
    this.masterLevel = Number.isFinite(options.gain) ? options.gain : 0.5;
    this.softGlue = Math.min(1, Math.max(0, Number(options.softGlue) || 0));
    // Per-hit jitter so consecutive hits are never bit-identical (organic, not robotic).
    this.hitSeed = (Math.random() * 0xffffffff) >>> 0;
    this.master = null;
    this.masterHighpass = null;
    this.masterShelf = null;
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
    this.masterHighpass = this.audioContext.createBiquadFilter();
    this.masterHighpass.type = "highpass";
    this.masterHighpass.frequency.value = 34;
    this.masterHighpass.Q.value = 0.7;
    this.masterShelf = this.audioContext.createBiquadFilter();
    this.masterShelf.type = "highshelf";
    this.masterShelf.frequency.value = 6200;
    this.masterShelf.gain.value = -1.1 - this.softGlue * 1.8;
    this.roomDelay = this.audioContext.createDelay(0.08);
    this.roomFilter = this.audioContext.createBiquadFilter();
    this.roomGain = this.audioContext.createGain();
    this.bodyFilter = this.audioContext.createBiquadFilter();
    this.bodyGain = this.audioContext.createGain();
    this.roomDelay.delayTime.value = 0.031;
    this.roomFilter.type = "bandpass";
    this.roomFilter.frequency.value = 980;
    this.roomFilter.Q.value = 0.64;
    this.roomGain.gain.value = 0.21 + this.softGlue * 0.035;
    this.bodyFilter.type = "bandpass";
    this.bodyFilter.frequency.value = 190;
    this.bodyFilter.Q.value = 0.82;
    this.bodyGain.gain.value = 0.085;
    this.roomDelay.connect(this.roomFilter).connect(this.roomGain).connect(this.compressor);
    this.bodyFilter.connect(this.bodyGain).connect(this.compressor);
    this.master
      .connect(this.masterHighpass)
      .connect(this.masterShelf)
      .connect(this.compressor)
      .connect(this.destination || this.audioContext.destination);
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

  // Deterministic-per-call but ever-advancing PRNG: each hit pulls a fresh value
  // so two hits at the same velocity still differ slightly. Range is [-1, 1).
  hitRandom() {
    this.hitSeed = (this.hitSeed + 0x6d2b79f5) >>> 0;
    let value = this.hitSeed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (((value ^ (value >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  }

  // Multiplicative jitter centred on 1: jitter(0.04) -> ~[0.96, 1.04].
  jitter(amount) {
    return 1 + this.hitRandom() * amount;
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

  eventVelocity(part, velocity, densityScore = 0, kit = null) {
    const density = Math.min(1, Math.max(0, Number(densityScore) || 0));
    const hardBop = this.isHardBop(kit);
    const glue = hardBop ? this.softGlue : 0;
    const maxByPart = hardBop
      ? {
          kick: 0.82 - glue * 0.06,
          snare: 0.86 - glue * 0.16,
          hat: 0.58 - glue * 0.2,
          ghost: 0.4 - glue * 0.04,
          fill: 0.72 - glue * 0.18,
          crash: 0.6 - glue * 0.18,
        }
      : { kick: 0.92, snare: 0.96, hat: 0.7, ghost: 0.48, fill: 0.84, crash: 0.72 };
    const trimByPart = hardBop
      ? {
          kick: 1 - density * 0.1,
          snare: 1 - density * 0.08,
          hat: 1 - density * 0.22,
          ghost: 1 - density * 0.12,
          fill: 1 - density * 0.14,
          crash: 1 - density * 0.22,
        }
      : { kick: 1 - density * 0.08, snare: 1 - density * 0.05, hat: 1 - density * 0.16, ghost: 1 - density * 0.08, fill: 1 - density * 0.1, crash: 1 - density * 0.18 };
    const max = maxByPart[part] ?? 0.9;
    const trim = trimByPart[part] ?? 1;
    const glueTrim = hardBop
      ? {
          kick: 1 - glue * 0.08,
          snare: 1 - glue * 0.18,
          hat: 1 - glue * 0.28,
          ghost: 1 - glue * 0.08,
          fill: 1 - glue * 0.22,
          crash: 1 - glue * 0.24,
        }[part] ?? 1
      : 1;
    return Math.min(max, Math.max(0.001, velocity * trim * glueTrim));
  }

  kick(time, velocity, kit) {
    if (this.isHardBop(kit)) {
      const loudness = Math.min(1.2, Math.max(0.05, velocity));
      // Light per-hit jitter so repeated hard-bop kicks are not bit-identical.
      const pitchJ = this.jitter(0.022);
      const decayJ = this.jitter(0.05);
      this.struckTone(time, kit.kick.peak * loudness, kit.kick.start * pitchJ, kit.kick.decay * decayJ, kit.kick.tone, kit.kick.room * (0.7 + loudness * 0.5), kit.kick.room * 0.55);
      this.acousticNoise(time + 0.001, kit.kick.beater * loudness, "bandpass", (2800 + loudness * 900) * this.jitter(0.03), 0.024, 2.1, 0.025);
      if (kit.kick.sub) this.struckTone(time + 0.006, kit.kick.sub * loudness, kit.kick.end * 0.72 * pitchJ, kit.kick.decay * 1.25 * decayJ, "sine", kit.kick.room * 0.42, kit.kick.room * 0.34);
      return;
    }
    // Per-hit variation: harder hits punch the pitch sweep higher and ring a touch
    // longer; small jitter keeps consecutive kicks from sounding machine-stamped.
    const accent = Math.min(1.15, Math.max(0.05, velocity));
    const decay = kit.kick.decay * (0.9 + accent * 0.16) * this.jitter(0.05);
    const startFreq = kit.kick.start * (0.94 + accent * 0.12) * this.jitter(0.025);
    // Tame the boom: roll the low-mid resonance off the body so it stops as soon
    // as the transient is gone, instead of "pon"-ing on. 0.86 trims overall level.
    const osc = this.audioContext.createOscillator();
    const bodyTrim = this.audioContext.createBiquadFilter();
    bodyTrim.type = "lowpass";
    bodyTrim.frequency.setValueAtTime(2400, time);
    bodyTrim.frequency.exponentialRampToValueAtTime(220, time + decay * 0.7);
    bodyTrim.Q.value = 0.5;
    const gain = this.envelope(time, kit.kick.peak * velocity * 0.86, 0.008, decay);
    osc.type = kit.kick.tone;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(kit.kick.end, time + decay * 0.84);
    osc.connect(bodyTrim).connect(gain).connect(this.master);
    osc.start(time);
    osc.stop(time + decay + 0.08);
    if (kit.kick.sub) {
      // Shorter, quieter sub: the long sub tail was the boomy "pon". Trim its
      // decay multiplier (1.35 -> 1.05) and level (0.7x) so the kick sits tight.
      const sub = this.audioContext.createOscillator();
      const subGain = this.envelope(time + 0.002, kit.kick.sub * velocity * 0.7, 0.012, decay * 1.05);
      sub.type = "sine";
      sub.frequency.setValueAtTime(42 * this.jitter(0.03), time);
      sub.frequency.exponentialRampToValueAtTime(34, time + decay);
      sub.connect(subGain).connect(this.master);
      sub.start(time);
      sub.stop(time + decay * 1.25);
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
      // Light per-hit jitter so repeated hard-bop snares are not bit-identical.
      const snFilterJ = this.jitter(0.035);
      const snDecayJ = this.jitter(0.06);
      this.acousticNoise(time, kit.snare.stick * loudness, "highpass", (3100 + loudness * 1000) * snFilterJ, 0.028, 1.6, room * 0.25);
      this.struckTone(time + 0.001, kit.snare.body * loudness, (190 - loudness * 20) * this.jitter(0.018), (0.11 + loudness * 0.025) * snDecayJ, "triangle", room, room * 0.36);
      this.acousticNoise(time + 0.004, kit.snare.noise * loudness, "bandpass", (kit.snare.filter + loudness * 700) * snFilterJ, (kit.snare.decay + loudness * 0.035) * snDecayJ, 2.4, room);
      this.acousticNoise(time + 0.012, kit.snare.rattle * loudness * (articulation === "buzz" ? 1.35 : 1), "highpass", (5200 + loudness * 1400) * snFilterJ, (articulation === "buzz" ? 0.18 : 0.11) + loudness * 0.045, 0.9, room * 0.85);
      this.acousticNoise(time + 0.018, kit.snare.shell * loudness, "bandpass", 620, 0.1, 0.7, room * 0.7, room * 0.32);
      if (rim && kit.snare.rim) this.acousticNoise(time + 0.002, kit.snare.rim * loudness, "highpass", 3900, 0.042, 1.2, room * 0.35);
      return;
    }
    // Per-hit variation: velocity opens the noise filter and shortens the decay
    // (accents = brighter/snappier, ghosts = darker/duller); jitter de-robotizes.
    const accent = Math.min(1.2, Math.max(0.05, velocity));
    const noiseFilter = kit.snare.filter * (0.82 + accent * 0.3) * this.jitter(0.04);
    const noiseDecay = kit.snare.decay * (1.08 - accent * 0.16) * this.jitter(0.06);
    this.noiseHit(time, kit.snare.noise * velocity, "bandpass", noiseFilter, noiseDecay, 2.2);
    const body = this.audioContext.createOscillator();
    const gain = this.envelope(time, kit.snare.body * velocity, 0.004, 0.08 * this.jitter(0.07));
    const baseBody = kit === kitPresets.dub_space ? 150 : 185;
    body.type = "triangle";
    // Harder hits push the shell pitch up a little; small per-hit detune on top.
    body.frequency.value = baseBody * (0.96 + accent * 0.08) * this.jitter(0.02);
    body.connect(gain).connect(this.master);
    body.start(time);
    body.stop(time + 0.11);
    if (rim && kit.snare.rim) this.noiseHit(time + 0.002, kit.snare.rim * velocity, "highpass", 2400 * this.jitter(0.03), 0.045, 1.4);
  }

  hat(time, velocity, kit, open = false, articulation = "ride_tip") {
    if (this.isHardBop(kit)) {
      const loudness = Math.min(1.2, Math.max(0.04, velocity));
      const decay = open ? kit.hat.open : kit.hat.closed;
      const glue = this.softGlue;
      const room = kit.hat.room * (0.7 + loudness * 0.45 + glue * 0.35);
      const bell = articulation === "ride_bell";
      // Light per-hit jitter: ride/hat is the most-repeated voice, most exposed to
      // the "every hit identical" complaint. Bell is steadier, so jitter it less.
      const hatFreqJ = this.jitter(bell ? 0.02 : 0.045);
      const hatDecayJ = this.jitter(0.08);
      const rideFreq = (bell ? 4100 - glue * 280 : 6100 + loudness * 900 - glue * 950) * hatFreqJ;
      this.acousticNoise(time, kit.hat.ride * loudness * (bell ? 0.62 : 1 - glue * 0.12), "bandpass", rideFreq, (decay + loudness * (bell ? 0.12 : 0.06) + glue * 0.018) * hatDecayJ, bell ? 4.4 : 0.9, room);
      this.acousticNoise(time + 0.004, kit.hat.clean * loudness * (1 - glue * 0.18), "highpass", (kit.hat.filter + loudness * 650 - glue * 900) * hatFreqJ, decay * 0.55 * hatDecayJ, 0.58, room * 0.5);
      if (loudness > 0.56 || bell) this.acousticNoise(time + 0.007, kit.hat.bell * loudness * (bell ? 1.35 : 0.72), "bandpass", 3600 - glue * 260, bell ? 0.14 : 0.075, 3.4, room * 0.42);
      if (kit.hat.dirty) this.acousticNoise(time + 0.01, kit.hat.dirty * loudness, "bandpass", 2400, decay * 0.8, 0.8, room * 0.3);
      return;
    }
    // Per-hit variation: repeated timekeeper hats are the most exposed to the
    // "every hit identical" complaint, so jitter filter, decay and a touch of level.
    const accent = Math.min(1.2, Math.max(0.04, velocity));
    const hatFilter = kit.hat.filter * (0.93 + accent * 0.12) * this.jitter(0.05);
    const hatDecay = (open ? kit.hat.open : kit.hat.closed) * this.jitter(0.09);
    this.noiseHit(time, kit.hat.clean * velocity * this.jitter(0.05), "highpass", hatFilter, hatDecay, 0.8);
    if (kit.hat.dirty) this.noiseHit(time + 0.002, kit.hat.dirty * velocity, "bandpass", kit.hat.filter * 0.62 * this.jitter(0.04), (open ? kit.hat.open * 0.7 : kit.hat.closed * 1.2) * this.jitter(0.08), 1.8);
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
      const velocity = this.eventVelocity(event.part, event.velocity, densityScore, kit);
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
