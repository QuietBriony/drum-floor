import { gmDrumMap } from "./contracts.js";

export class MidiOutput {
  constructor() {
    this.access = null;
    this.output = null;
    this.status = "not connected";
  }

  async connect() {
    if (!navigator.requestMIDIAccess) {
      this.status = "Web MIDI unsupported";
      return this.snapshot();
    }
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    const outputs = [...this.access.outputs.values()];
    this.output = outputs[0] || null;
    this.status = this.output ? `connected: ${this.output.name}` : "no MIDI output";
    return this.snapshot();
  }

  selectOutput(id) {
    if (!this.access) return this.snapshot();
    this.output = this.access.outputs.get(id) || this.output;
    this.status = this.output ? `connected: ${this.output.name}` : "no MIDI output";
    return this.snapshot();
  }

  snapshot() {
    return {
      connected: Boolean(this.output),
      status: this.status,
      outputs: this.access ? [...this.access.outputs.values()].map((output) => ({ id: output.id, name: output.name })) : []
    };
  }

  sendBar(generatedBar, controls) {
    if (!this.output) return;
    const stepMs = 60000 / controls.bpm / 4;
    generatedBar.events.forEach((event) => {
      const note = event.part === "hat" && event.duration > 0.1 ? gmDrumMap.open_hat : gmDrumMap[event.part];
      if (!note) return;
      const velocity = Math.max(1, Math.min(127, Math.round(event.velocity * 100)));
      const at = window.performance.now() + event.step * stepMs + (event.microOffsetMs || 0);
      this.output.send([0x99, note, velocity], at);
      this.output.send([0x89, note, 0], at + Math.max(45, (event.duration || 0.08) * 1000));
    });
  }
}
