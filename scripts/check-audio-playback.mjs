import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { AudioEngine } from "../src/audio-engine.js";
import { MidiOutput } from "../src/midi-output.js";

let allocations = 0;
const sources = [];
const param = () => ({ value:0, setValueAtTime() {}, linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
const node = () => ({ gain:param(), frequency:param(), Q:param(),
  connect(destination) { return destination; }, disconnect() { this.disconnected = true; },
  start(time, offset) { this.time = time; this.offset = offset; },
  stop() { this.stopped = true; } });
const context = { sampleRate:48000, currentTime:1, state:"running",
  createBuffer(channels,length,rate) {
    allocations++;
    return {duration:length/rate,getChannelData:() => new Float32Array(length)};
  },
  createBufferSource() { const source = node(); sources.push(source); return source; },
  createBiquadFilter:node, createGain:node };
const engine = new AudioEngine({audioContext:context});
engine.master = node();
assert.equal(engine.noiseBuffer(0.12), engine.noiseBuffer(0.15));
assert.equal(allocations, 1, "Noise buffers must be reused across nearby durations");
for (let i=0;i<100;i++) {
  engine.noiseHit(1+i/8,0.5,"bandpass",4000,0.12);
  const current = sources.at(-1);
  assert.ok(current.offset >= 0 && current.offset + 0.18 <= current.buffer.duration + 1e-8);
  current.onended();
  assert.equal(engine.activeVoices.size, 0);
  assert.equal(current.disconnected, true);
}
assert.equal(allocations, 2, "100 noise hits should share their size bucket");
engine.noiseHit(20,0.5,"bandpass",4000,0.12);
engine.stop();
assert.equal(engine.activeVoices.size, 0);
assert.equal(sources.at(-1).stopped, true, "STOP must cancel a not-yet-started voice");

const app = readFileSync("app.js", "utf8");
function fn(name) {
  const match = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n}`));
  assert.ok(match, name);
  return match[0];
}
const timers = new Map();
let timerSeq = 0;
const scheduled = [];
let stops = 0;
const state = {playback:{isPlaying:false,starting:false,startSeq:0,nextBarTime:0,timeoutId:null},
  controlState:{controls:{bpm:120}}, memory:{}, currentBar:{}};
const sb = { state, console, refs:{}, activeProfile:() => ({}), updateCurrentBar() {},
  render() {}, renderAll() { context.currentTime += 0.018; }, updatePhraseMemory:() => ({}),
  setTimeout(fn,delay) { const id=++timerSeq; timers.set(id,{fn,delay}); return id; },
  clearTimeout(id) { timers.delete(id); },
  audioEngine:{ensure:() => context,resume:async () => context,
    scheduleBar(bar,controls,time) { scheduled.push(time); }, stop() { stops++; }} };
vm.runInNewContext(["clearPlaybackTimer","scheduleNextBar","startPlayback","stopPlayback"].map(fn).join("\n"), sb);
await sb.startPlayback();
await sb.startPlayback();
assert.equal(timers.size, 1, "Repeated START must retain a single scheduling timer");
while(scheduled.length < 5) {
  const [id,timer] = timers.entries().next().value;
  timers.delete(id);
  context.currentTime += timer.delay/1000 + 0.015;
  timer.fn();
}
for(let i=1;i<scheduled.length;i++) {
  assert.ok(Math.abs(scheduled[i]-scheduled[i-1]-2) < 1e-8, "Render/timer delays must not drift the bar clock");
}
sb.stopPlayback();
assert.equal(timers.size, 0);
assert.equal(stops, 1);
let resolveResume;
sb.audioEngine.resume = () => new Promise(resolve => { resolveResume = resolve; });
const pending = sb.startPlayback();
sb.stopPlayback();
resolveResume(context);
await pending;
assert.equal(state.playback.isPlaying, false, "A pending resume must not restart after STOP");

// Optional MIDI uses the same future bar start, rather than the earlier poll.
globalThis.window = { performance: { now: () => 1000 } };
const midi = new MidiOutput();
const messages = [];
midi.output = {send: (data, time) => messages.push({data,time})};
midi.sendBar({events:[{part:"kick",step:4,velocity:0.7,duration:0.08,microOffsetMs:5}]}, {bpm:120}, 1080);
assert.equal(messages[0].time, 1585);
assert.equal(messages[1].time, 1665);
const midiTimes = [];
sb.window = window;
sb.midiOutput = {sendBar(bar, controls, time) { midiTimes.push(time); }};
sb.audioEngine.resume = async () => context;
state.controlState.controls.midiEnabled = true;
await sb.startPlayback();
const [timerId,timer] = timers.entries().next().value;
timers.delete(timerId);
timer.fn();
assert.ok(Math.abs(midiTimes[0]-1080) < 1e-8, "MIDI and audio must share the 80 ms future bar start");
sb.stopPlayback();
delete globalThis.window;
console.log("Drum Floor audio playback passed: pooled noise, source cleanup, fixed clock, pending STOP and MIDI phase");
