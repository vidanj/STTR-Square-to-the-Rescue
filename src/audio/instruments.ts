import { midiToFreq, noise, tone, type SynthKit } from "./synth";

/**
 * The music's instrument rack: a synthwave/chiptune kit built from the same
 * two primitives as the sound effects. Each instrument plays one note at an
 * exact time; the MusicPlayer decides which and when.
 */
export type InstrumentId =
  | "kick"
  | "snare"
  | "hat"
  | "brush"
  | "rim"
  | "bass"
  | "sub"
  | "upright"
  | "arp"
  | "glass"
  | "pad"
  | "stab"
  | "lead"
  | "keys";

/**
 * Play `midi` at `at` for `dur` seconds at velocity `vel` (≈0..1). Drums
 * ignore the pitch; sustained instruments use `dur` for how long they hold.
 */
export type Instrument = (k: SynthKit, at: number, midi: number, dur: number, vel: number) => void;

export const INSTRUMENTS: Readonly<Record<InstrumentId, Instrument>> = {
  // --- drums ---------------------------------------------------------------

  /** A sine with a fast pitch drop: the four-on-the-floor heartbeat. */
  kick: (k, at, _m, _d, vel) => {
    tone(k, at, { wave: "sine", freq: 150, freqEnd: 45, glide: 0.12, attack: 0.002, decay: 0.28, gain: 0.8 * vel });
  },

  snare: (k, at, _m, _d, vel) => {
    noise(k, at, { decay: 0.16, gain: 0.3 * vel, filter: { type: "bandpass", freq: 1800, q: 0.8 } });
    tone(k, at, { wave: "triangle", freq: 220, freqEnd: 160, decay: 0.08, gain: 0.2 * vel });
  },

  hat: (k, at, _m, _d, vel) => {
    noise(k, at, { decay: 0.035, gain: 0.12 * vel, filter: { type: "highpass", freq: 7000 } });
  },

  /** A brushed ride for Bar's lounge: softer, longer, darker than a hat. */
  brush: (k, at, _m, _d, vel) => {
    noise(k, at, { attack: 0.01, decay: 0.12, gain: 0.07 * vel, filter: { type: "bandpass", freq: 5200, q: 0.9 } });
  },

  rim: (k, at, _m, _d, vel) => {
    tone(k, at, { wave: "triangle", freq: 820, decay: 0.03, gain: 0.12 * vel });
    noise(k, at, { decay: 0.02, gain: 0.08 * vel, filter: { type: "bandpass", freq: 2600, q: 2 } });
  },

  // --- bass ----------------------------------------------------------------

  /** Sawtooth bass whose filter snaps shut on every note: the synthwave pump. */
  bass: (k, at, midi, dur, vel) => {
    const f = midiToFreq(midi);
    tone(k, at, {
      wave: "sawtooth",
      freq: f,
      attack: 0.004,
      hold: dur * 0.55,
      decay: 0.1,
      gain: 0.22 * vel,
      filter: { type: "lowpass", freq: Math.min(4000, f * 9), freqEnd: f * 2, q: 2 },
    });
  },

  /** A round sine sub under the calm tracks. */
  sub: (k, at, midi, dur, vel) => {
    tone(k, at, { wave: "sine", freq: midiToFreq(midi), attack: 0.04, hold: dur * 0.8, decay: 0.3, gain: 0.3 * vel });
  },

  /** A plucked, woody bass for walking lines. */
  upright: (k, at, midi, dur, vel) => {
    tone(k, at, {
      wave: "triangle",
      freq: midiToFreq(midi),
      attack: 0.008,
      hold: dur * 0.4,
      decay: 0.28,
      gain: 0.34 * vel,
      filter: { type: "lowpass", freq: 900 },
    });
  },

  // --- melodic -------------------------------------------------------------

  /** The square-wave arpeggio — the hero's own waveform running underneath. */
  arp: (k, at, midi, dur, vel) => {
    tone(k, at, {
      wave: "square",
      freq: midiToFreq(midi),
      attack: 0.002,
      decay: Math.min(0.16, dur + 0.05),
      gain: 0.045 * vel,
      filter: { type: "lowpass", freq: 2600 },
    });
  },

  /** A soft, ringing triangle — chimes over the calm tracks. */
  glass: (k, at, midi, _d, vel) => {
    tone(k, at, { wave: "triangle", freq: midiToFreq(midi), attack: 0.004, decay: 0.55, gain: 0.08 * vel });
  },

  /** Two detuned saws behind a lowpass with a slow swell: the wide neon wash. */
  pad: (k, at, midi, dur, vel) => {
    const f = midiToFreq(midi);
    const attack = Math.min(0.5, dur * 0.4);
    for (const detune of [-9, 9]) {
      tone(k, at, {
        wave: "sawtooth",
        freq: f,
        detune,
        attack,
        hold: Math.max(0, dur - attack),
        decay: 0.6,
        gain: 0.035 * vel,
        filter: { type: "lowpass", freq: 1300 },
      });
    }
  },

  /** The pad's short, punchy cousin, for rhythmic chord hits. */
  stab: (k, at, midi, dur, vel) => {
    const f = midiToFreq(midi);
    for (const detune of [-7, 7]) {
      tone(k, at, {
        wave: "sawtooth",
        freq: f,
        detune,
        attack: 0.004,
        hold: dur * 0.3,
        decay: 0.18,
        gain: 0.04 * vel,
        filter: { type: "lowpass", freq: 2400, freqEnd: 800 },
      });
    }
  },

  /** The melody voice: a square lead that blooms into vibrato on held notes. */
  lead: (k, at, midi, dur, vel) => {
    tone(k, at, {
      wave: "square",
      freq: midiToFreq(midi),
      attack: 0.01,
      hold: Math.max(0, dur * 0.85 - 0.01),
      decay: 0.12,
      gain: 0.06 * vel,
      vibrato: { rate: 5.5, cents: 16, delay: 0.18 },
      filter: { type: "lowpass", freq: 3400 },
    });
  },

  /** Electric-piano-ish keys: a sine body with a bell-like octave on top. */
  keys: (k, at, midi, dur, vel) => {
    const f = midiToFreq(midi);
    tone(k, at, { wave: "sine", freq: f, attack: 0.006, hold: dur * 0.5, decay: 0.7, gain: 0.09 * vel });
    tone(k, at, { wave: "triangle", freq: f * 2, attack: 0.004, decay: 0.3, gain: 0.025 * vel });
  },
};
