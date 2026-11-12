import type { Shape } from "../config";
import type { SynthKit } from "./synth";
import { SHAPE_TIMBRE, buildWave } from "./timbres";

/**
 * TEST DOUBLE — a strict, minimal stand-in for the Web Audio graph so the
 * synth recipes and the sequencer can run under Vitest (Node has no Web
 * Audio). It throws on the automation mistakes a real browser rejects, such
 * as an exponential ramp to zero or a non-finite time, and counts the voices
 * it was asked to start. Never imported by the game itself.
 */

function check(kind: string, value: number, time: number): void {
  if (!Number.isFinite(value) || !Number.isFinite(time) || time < 0) {
    throw new RangeError(`${kind}(${value}, ${time}) is not schedulable`);
  }
}

class FakeParam {
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number): this {
    check("setValueAtTime", v, t);
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    check("linearRampToValueAtTime", v, t);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    check("exponentialRampToValueAtTime", v, t);
    if (v <= 0) throw new RangeError(`exponential ramp to ${v} (must be > 0)`);
    return this;
  }
  setTargetAtTime(v: number, t: number, timeConstant: number): this {
    check("setTargetAtTime", v, t);
    if (!(timeConstant > 0)) throw new RangeError(`time constant ${timeConstant}`);
    return this;
  }
  cancelScheduledValues(t: number): this {
    check("cancelScheduledValues", 0, t);
    return this;
  }
}

class FakeNode {
  connect<T>(next: T): T {
    return next;
  }
  disconnect(): void {}
}

class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  private startedAt = -1;
  constructor(private readonly ctx: FakeAudioContext) {
    super();
  }
  start(t = 0, offset = 0): void {
    check("start", offset, t);
    if (this.startedAt >= 0) throw new Error("a source can only be started once");
    this.startedAt = t;
    this.ctx.voicesStarted += 1;
  }
  stop(t = 0): void {
    check("stop", 0, t);
    if (this.startedAt < 0) throw new Error("stop() before start()");
    if (t < this.startedAt) throw new RangeError(`stop(${t}) before start(${this.startedAt})`);
  }
}

class FakeOscillator extends FakeSource {
  type: OscillatorType = "sine";
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);
  setPeriodicWave(_wave: unknown): void {
    this.type = "custom";
  }
}

class FakeBufferSource extends FakeSource {
  buffer: unknown = null;
  loop = false;
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate = 8000;
  readonly state = "running";
  readonly destination = new FakeNode();
  /** Oscillators + buffer sources started so far. */
  voicesStarted = 0;

  createOscillator(): FakeOscillator {
    return new FakeOscillator(this);
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this);
  }
  createGain(): FakeNode & { gain: FakeParam } {
    return Object.assign(new FakeNode(), { gain: new FakeParam(1) });
  }
  createBiquadFilter(): FakeNode & { type: string; frequency: FakeParam; Q: FakeParam } {
    return Object.assign(new FakeNode(), { type: "lowpass", frequency: new FakeParam(350), Q: new FakeParam(1) });
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array): object {
    if (real.length !== imag.length || real.length < 2) throw new Error("bad periodic wave");
    return {};
  }
  createBuffer(channels: number, length: number, rate: number): { duration: number; getChannelData(): Float32Array } {
    const data = new Float32Array(length * channels);
    return { duration: length / rate, getChannelData: () => data };
  }
}

/** A SynthKit wired to a fake context (and, optionally, a shared one). */
export function fakeKit(ctx = new FakeAudioContext()): SynthKit {
  const real = ctx as unknown as BaseAudioContext;
  return {
    ctx: real,
    out: ctx.createGain() as unknown as AudioNode,
    noise: ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate) as unknown as AudioBuffer,
    wave: (shape: Shape) => buildWave(real, SHAPE_TIMBRE[shape]),
  };
}
