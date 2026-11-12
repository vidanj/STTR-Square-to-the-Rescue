import type { Shape } from "../config";
import type { Wave } from "./synth";

/**
 * Every sound takes the waveform of its shape — the audio twin of "every
 * bullet takes the shape of whoever fired it". The Square (and everything the
 * player does) is a square wave; a circle hums a pure sine; a triangle buzzes
 * a triangle wave; and the many-sided shapes get custom harmonic recipes that
 * lean on the partial matching their vertex count. So an enemy's shots, hits
 * and death all share one voice, and friend vs. foe reads by ear too.
 */

/** A built-in oscillator, or a custom wave as harmonic amplitudes (1st, 2nd …). */
export type TimbreDef = Exclude<OscillatorType, "custom"> | { readonly partials: readonly number[] };

export const SHAPE_TIMBRE: Readonly<Record<Shape, TimbreDef>> = {
  square: "square",
  circle: "sine",
  triangle: "triangle",
  diamond: "sawtooth",
  // Fundamental plus a strong 5th partial: hollow, slightly nasal.
  pentagon: { partials: [1, 0.12, 0.08, 0.05, 0.6] },
  // Leans on the 6th partial (and the octave): a brighter, reedy buzz.
  hexagon: { partials: [1, 0.35, 0.15, 0.1, 0.05, 0.55] },
  // Every partial, with the 5th and 10th spiking: the boss's harsh, glittering edge.
  star: { partials: [1, 0.5, 0.33, 0.3, 0.75, 0.2, 0.14, 0.12, 0.11, 0.45] },
  // Bar, the friendly shopkeeper: nearly a sine, just a whisper of overtones.
  rect: { partials: [1, 0, 0.06, 0, 0.02] },
};

/** Turn a timbre into something an oscillator can play on `ctx`. */
export function buildWave(ctx: BaseAudioContext, def: TimbreDef): Wave {
  if (typeof def === "string") return def;
  const n = def.partials.length + 1;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  def.partials.forEach((amp, i) => (imag[i + 1] = amp));
  // Normalised (the default), so every shape plays at a comparable loudness.
  return ctx.createPeriodicWave(real, imag);
}
