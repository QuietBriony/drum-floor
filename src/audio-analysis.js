import { clamp, defaultBandInputFrame } from "./contracts.js";

export class AudioInputAnalyzer {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.buffer = null;
    this.lastLevel = 0;
    this.onsetTimes = [];
    this.frame = { ...defaultBandInputFrame };
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.frame = { ...defaultBandInputFrame, status: "getUserMedia unsupported" };
      return this.frame;
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextClass();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.buffer = new Float32Array(this.analyser.fftSize);
    source.connect(this.analyser);
    this.frame = { ...defaultBandInputFrame, inputEnabled: true, status: "listening local features only" };
    return this.update();
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach((track) => track.stop());
    if (this.audioContext) this.audioContext.close();
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.buffer = null;
    this.onsetTimes = [];
    this.frame = { ...defaultBandInputFrame, status: "manual only" };
    return this.frame;
  }

  update() {
    if (!this.analyser || !this.buffer) return this.frame;
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    let zeroCrossings = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      const sample = this.buffer[i];
      sum += sample * sample;
      if (i > 0 && Math.sign(sample) !== Math.sign(this.buffer[i - 1])) zeroCrossings += 1;
    }
    const rms = Math.sqrt(sum / this.buffer.length);
    const level = clamp(rms * 8, 0, 1);
    const now = performance.now();
    const onset = level > 0.08 && level - this.lastLevel > 0.09;
    if (onset) this.onsetTimes.push(now);
    this.onsetTimes = this.onsetTimes.filter((time) => now - time < 4000);
    const onsetRate = clamp(this.onsetTimes.length / 14, 0, 1);
    const roughTempo = this.estimateTempo();
    const density = clamp(level * 0.55 + onsetRate * 0.45, 0, 1);
    const stability = clamp(1 - Math.abs(level - this.lastLevel) * 2.2, 0, 1);
    this.lastLevel = level;
    this.frame = {
      inputEnabled: true,
      inputLevel: level,
      onsetRate,
      roughTempo,
      density,
      stability,
      lastOnsetAt: this.onsetTimes[this.onsetTimes.length - 1] || 0,
      status: "local analysis active"
    };
    return this.frame;
  }

  estimateTempo() {
    if (this.onsetTimes.length < 3) return 0;
    const intervals = this.onsetTimes.slice(1).map((time, index) => time - this.onsetTimes[index]).filter((ms) => ms > 220 && ms < 1400);
    if (!intervals.length) return 0;
    const average = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length;
    return Math.round(clamp(60000 / average, 54, 190));
  }
}
