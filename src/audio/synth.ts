import type { Shape } from "../config";

/**
 * The two synth primitives every sound in the game is built from — a shaped
 * oscillator note and a burst of filtered noise — plus the kit they draw on.
 *
 * Each call builds a few short-lived Web Audio nodes, schedules its envelope
 * at an exact AudioContext time, and disconnects itself when it ends, so the
 * graph never accumulates dead voices.
 */

/** An oscillator timbre: a built-in wave or a custom harmonic recipe. */
export type Wave = Exclude<OscillatorType, "custom"> | PeriodicWave;

/** Everything a sound recipe needs to make noise. */
export interface SynthKit {
  readonly ctx: BaseAudioContext;
  /** Where this voice should connect (an SFX bus, or one music track's gain). */
  readonly out: AudioNode;
  /** One shared second of white noise, looped by noise voices. */
  readonly noise: AudioBuffer;
  /** The waveform a shape "sounds like" (see `timbres.ts`). */
  wave(shape: Shape): Wave;
}

/** Envelopes ramp exponentially, so they can never quite reach zero. */
const SILENT = 0.0001;

export interface FilterOpts {
  type: BiquadFilterType;
  freq: number;
  /** Sweep the cutoff exponentially to this by the end of the voice. */
  freqEnd?: number;
  q?: number;
}

interface EnvelopeOpts {
  /** Seconds from silence to peak (default a click-free 3ms). */
  attack?: number;
  /** Seconds held at peak before the decay starts. */
  hold?: number;
  /** Seconds from peak back to silence. */
  decay: number;
  /** Peak gain. */
  gain: number;
}

export interface ToneOpts extends EnvelopeOpts {
  wave: Wave;
  freq: number;
  /** Glide the pitch exponentially to this over `glide` seconds. */
  freqEnd?: number;
  /** Seconds the glide takes (defaults to the whole note). */
  glide?: number;
  /** Fixed detune in cents — two detuned voices make a thick, chorused tone. */
  detune?: number;
  /** Delayed pitch wobble, for sustained lead notes. */
  vibrato?: { rate: number; cents: number; delay: number };
  filter?: FilterOpts;
}

export interface NoiseOpts extends EnvelopeOpts {
  filter?: FilterOpts;
}

/** Equal-tempered frequency of a MIDI note number (A4 = 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Schedule an attack-hold-decay envelope on `param`; returns the end time. */
function envelope(param: AudioParam, at: number, o: EnvelopeOpts): number {
  const attack = o.attack ?? 0.003;
  const hold = o.hold ?? 0;
  const peak = Math.max(o.gain, SILENT * 2);
  param.setValueAtTime(SILENT, at);
  param.exponentialRampToValueAtTime(peak, at + attack);
  if (hold > 0) param.setValueAtTime(peak, at + attack + hold);
  const end = at + attack + hold + o.decay;
  param.exponentialRampToValueAtTime(SILENT, end);
  return end;
}

/** Build the optional filter stage; returns its input node (or null). */
function makeFilter(ctx: BaseAudioContext, f: FilterOpts | undefined, at: number, end: number): BiquadFilterNode | null {
  if (!f) return null;
  const node = ctx.createBiquadFilter();
  node.type = f.type;
  node.Q.value = f.q ?? 0.7;
  node.frequency.setValueAtTime(f.freq, at);
  if (f.freqEnd !== undefined) node.frequency.exponentialRampToValueAtTime(Math.max(20, f.freqEnd), end);
  return node;
}

/** One oscillator note. Returns the time it falls silent. */
export function tone(k: SynthKit, at: number, o: ToneOpts): number {
  const { ctx } = k;
  const osc = ctx.createOscillator();
  // (PeriodicWave is an empty interface to TS, so narrow by hand.)
  if (typeof o.wave === "string") osc.type = o.wave as OscillatorType;
  else osc.setPeriodicWave(o.wave);
  if (o.detune) osc.detune.value = o.detune;

  const amp = ctx.createGain();
  const end = envelope(amp.gain, at, o);

  osc.frequency.setValueAtTime(o.freq, at);
  if (o.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), at + (o.glide ?? end - at));
  }

  const filter = makeFilter(ctx, o.filter, at, end);
  if (filter) osc.connect(filter).connect(amp);
  else osc.connect(amp);
  amp.connect(k.out);

  let lfo: OscillatorNode | null = null;
  let depth: GainNode | null = null;
  if (o.vibrato) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibrato.rate;
    depth = ctx.createGain();
    depth.gain.setValueAtTime(0, at);
    depth.gain.linearRampToValueAtTime(o.vibrato.cents, at + o.vibrato.delay);
    lfo.connect(depth).connect(osc.detune);
    lfo.start(at);
    lfo.stop(end + 0.02);
  }

  osc.start(at);
  osc.stop(end + 0.02);
  osc.onended = () => {
    osc.disconnect();
    filter?.disconnect();
    amp.disconnect();
    lfo?.disconnect();
    depth?.disconnect();
  };
  return end;
}

/** One burst of filtered white noise. Returns the time it falls silent. */
export function noise(k: SynthKit, at: number, o: NoiseOpts): number {
  const { ctx } = k;
  const src = ctx.createBufferSource();
  src.buffer = k.noise;
  src.loop = true;

  const amp = ctx.createGain();
  const end = envelope(amp.gain, at, o);
  const filter = makeFilter(ctx, o.filter, at, end);
  if (filter) src.connect(filter).connect(amp);
  else src.connect(amp);
  amp.connect(k.out);

  // Start somewhere random in the buffer so repeated hits don't sound cloned.
  // Cosmetic only — never the run's seeded RNG.
  src.start(at, Math.random() * k.noise.duration);
  src.stop(end + 0.02);
  src.onended = () => {
    src.disconnect();
    filter?.disconnect();
    amp.disconnect();
  };
  return end;
}
