import { AUDIO, type Shape } from "../config";
import { noise, tone, type SynthKit } from "./synth";

/**
 * The sound-effect catalog. Every effect is a tiny synth recipe — no samples.
 * Gameplay code only ever names an effect (`sfx.play("kill", { shape })`);
 * how it sounds lives entirely here.
 */
export type SfxId =
  // combat
  | "shoot"
  | "enemyShot"
  | "hit"
  | "kill"
  | "eat"
  | "hurt"
  | "bomb"
  | "bossLand"
  | "bossPhase"
  | "bossDown"
  // interface
  | "move"
  | "confirm"
  | "pick"
  | "buy"
  | "deny"
  | "advance"
  | "pause";

/** Context a recipe may use. Anything left out falls back to a sensible default. */
export interface SfxOpts {
  /** Whose voice this is — picks the waveform (see `timbres.ts`). */
  shape?: Shape;
  /** Health remaining, 0..1: hits climb in pitch as a target weakens. */
  frac?: number;
  /** Body radius in px: bigger bodies die lower. */
  size?: number;
  /** The player is focusing (slow, precise): shots get softer. */
  focus?: boolean;
  /** It's a boss: heavier, lower variants. */
  boss?: boolean;
}

/**
 * Minimum seconds between two plays of the same effect. Bullet-hell density
 * would otherwise turn hits and enemy fire into a wall of noise; anything not
 * listed may play back-to-back.
 */
export const SFX_GAP: Readonly<Partial<Record<SfxId, number>>> = {
  shoot: 0.05,
  enemyShot: 0.07,
  hit: 0.045,
  eat: 0.06,
  kill: 0.03,
  move: 0.03,
  advance: 0.05,
};

/** Effects that are dropped first when the voice cap is reached. */
const MINOR: ReadonlySet<SfxId> = new Set<SfxId>(["shoot", "enemyShot", "hit", "eat"]);

/** Random pitch spread per play (±), so rapid repeats don't sound mechanical. */
const JITTER = 0.03;

/**
 * Per-id rate limiter. Pure (time is passed in), so it is unit-testable.
 */
export class Throttle {
  private readonly last = new Map<string, number>();

  constructor(private readonly gaps: Readonly<Partial<Record<string, number>>>) {}

  /** True — and records the play — if `id` may sound at time `now`. */
  allow(id: string, now: number): boolean {
    const gap = this.gaps[id] ?? 0;
    const prev = this.last.get(id);
    if (prev !== undefined && now - prev < gap) return false;
    this.last.set(id, now);
    return true;
  }
}

/** Counts sounds still ringing, from their scheduled end times. Pure. */
export class VoiceCounter {
  private ends: number[] = [];

  add(end: number): void {
    this.ends.push(end);
  }

  active(now: number): number {
    if (this.ends.length > 0 && this.ends.some((t) => t <= now)) this.ends = this.ends.filter((t) => t > now);
    return this.ends.length;
  }
}

/** A recipe schedules its voices at `at` and returns how long it rings. */
type Recipe = (k: SynthKit, at: number, o: SfxOpts, pitch: number) => number;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

const RECIPES: Readonly<Record<SfxId, Recipe>> = {
  // --- combat --------------------------------------------------------------

  /** The Square's volley: a quick falling square-wave chirp. */
  shoot: (k, at, o, p) => {
    const f = (o.focus ? 660 : 880) * p;
    tone(k, at, {
      wave: "square",
      freq: f,
      freqEnd: f * 0.55,
      decay: 0.05,
      gain: o.focus ? 0.055 : 0.08,
      filter: { type: "lowpass", freq: 3200 },
    });
    return 0.06;
  },

  /** Enemy fire: a faint RISING tick in the shooter's own waveform. */
  enemyShot: (k, at, o, p) => {
    const f = (o.boss ? 330 : 520) * p;
    tone(k, at, {
      wave: k.wave(o.shape ?? "circle"),
      freq: f,
      freqEnd: f * 1.3,
      decay: 0.045,
      gain: 0.045,
      filter: { type: "lowpass", freq: 2600 },
    });
    return 0.05;
  },

  /** A shot connecting: noise tick + a blip that climbs as the target weakens. */
  hit: (k, at, o, p) => {
    const weak = 1 - clamp01(o.frac ?? 1);
    const f = (o.boss ? 170 + weak * 140 : 300 + weak * 500) * p;
    tone(k, at, { wave: k.wave(o.shape ?? "circle"), freq: f, freqEnd: f * 0.7, decay: 0.06, gain: 0.12 });
    noise(k, at, { decay: 0.03, gain: 0.08, filter: { type: "highpass", freq: 3000 } });
    return 0.07;
  },

  /** An enemy popping: its waveform dives while a noise burst blows outward. */
  kill: (k, at, o, p) => {
    const size = o.size ?? 14;
    const f = Math.max(140, Math.min(900, 520 * (14 / size))) * p;
    tone(k, at, { wave: k.wave(o.shape ?? "circle"), freq: f, freqEnd: f * 0.22, decay: 0.24, gain: 0.17 });
    noise(k, at, { decay: 0.26, gain: 0.14, filter: { type: "lowpass", freq: 3000, freqEnd: 300 } });
    return 0.3;
  },

  /** An enemy bullet eaten by a shield or an eating shot: a tiny glassy tink. */
  eat: (k, at, _o, p) => {
    tone(k, at, { wave: "triangle", freq: 2400 * p, freqEnd: 2000 * p, decay: 0.03, gain: 0.06 });
    return 0.04;
  },

  /** The Square takes a hit: a crunching square-wave fall — unmissable. */
  hurt: (k, at) => {
    tone(k, at, {
      wave: "square",
      freq: 520,
      freqEnd: 70,
      decay: 0.38,
      gain: 0.2,
      filter: { type: "lowpass", freq: 2400 },
    });
    tone(k, at + 0.015, {
      wave: "square",
      freq: 392,
      freqEnd: 55,
      decay: 0.4,
      gain: 0.13,
      detune: 18,
      filter: { type: "lowpass", freq: 1800 },
    });
    noise(k, at, { decay: 0.42, gain: 0.3, filter: { type: "lowpass", freq: 1400, freqEnd: 180 } });
    return 0.45;
  },

  /** The bomb: a whoosh that opens up as a low square swells — it GROWS. */
  bomb: (k, at) => {
    noise(k, at, {
      attack: 0.25,
      decay: 0.55,
      gain: 0.2,
      filter: { type: "bandpass", freq: 400, freqEnd: 4200, q: 1.4 },
    });
    tone(k, at, {
      wave: "square",
      freq: 110,
      freqEnd: 220,
      attack: 0.1,
      hold: 0.15,
      decay: 0.45,
      gain: 0.12,
      filter: { type: "lowpass", freq: 900, freqEnd: 2600 },
    });
    return 0.8;
  },

  /** A boss finishes its entrance: one low boom, and the fight is on. */
  bossLand: (k, at) => {
    tone(k, at, { wave: "sine", freq: 90, freqEnd: 35, decay: 0.7, gain: 0.35 });
    noise(k, at, { decay: 0.6, gain: 0.16, filter: { type: "lowpass", freq: 600, freqEnd: 100 } });
    return 0.8;
  },

  /** A boss phase breaks: a rising swell, then a minor chord stab in its voice. */
  bossPhase: (k, at, o) => {
    noise(k, at, {
      attack: 0.3,
      decay: 0.5,
      gain: 0.18,
      filter: { type: "bandpass", freq: 700, freqEnd: 5000, q: 1.2 },
    });
    const wave = k.wave(o.shape ?? "star");
    for (const f of [293.66, 349.23, 440]) {
      tone(k, at + 0.3, { wave, freq: f, decay: 0.6, gain: 0.09, filter: { type: "lowpass", freq: 3000 } });
    }
    return 1.0;
  },

  /** A boss goes down: a long collapsing roar with a sub drop underneath. */
  bossDown: (k, at, o) => {
    noise(k, at, { attack: 0.01, decay: 1.8, gain: 0.3, filter: { type: "lowpass", freq: 5000, freqEnd: 80 } });
    tone(k, at, { wave: "sine", freq: 120, freqEnd: 25, decay: 1.5, gain: 0.4 });
    tone(k, at, { wave: k.wave(o.shape ?? "star"), freq: 880, freqEnd: 55, decay: 1.0, gain: 0.09 });
    return 2.0;
  },

  // --- interface (all square-wave: the menus belong to the Square) ----------

  move: (k, at) => {
    tone(k, at, { wave: "square", freq: 660, decay: 0.04, gain: 0.06, filter: { type: "lowpass", freq: 3000 } });
    return 0.05;
  },

  confirm: (k, at) => {
    tone(k, at, { wave: "square", freq: 660, decay: 0.07, gain: 0.08, filter: { type: "lowpass", freq: 3200 } });
    tone(k, at + 0.06, { wave: "square", freq: 990, decay: 0.1, gain: 0.08, filter: { type: "lowpass", freq: 3200 } });
    return 0.17;
  },

  /** Upgrade chosen: a bright C-major run upward. */
  pick: (k, at) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      tone(k, at + i * 0.05, { wave: "square", freq: f, decay: 0.12, gain: 0.075, filter: { type: "lowpass", freq: 3600 } });
    });
    return 0.32;
  },

  /** Bar takes your points: the classic two-note coin. */
  buy: (k, at) => {
    tone(k, at, { wave: "square", freq: 987.77, decay: 0.05, gain: 0.09 });
    tone(k, at + 0.07, { wave: "square", freq: 1318.5, hold: 0.05, decay: 0.25, gain: 0.09 });
    return 0.38;
  },

  /** Can't do that: a low, slightly sour buzz. */
  deny: (k, at) => {
    for (const f of [150, 158]) {
      tone(k, at, { wave: "square", freq: f, decay: 0.18, gain: 0.08, filter: { type: "lowpass", freq: 1200 } });
    }
    return 0.2;
  },

  /** Next line of dialog: a soft tick. */
  advance: (k, at) => {
    tone(k, at, { wave: "triangle", freq: 880, decay: 0.035, gain: 0.09 });
    return 0.04;
  },

  pause: (k, at) => {
    tone(k, at, { wave: "square", freq: 440, freqEnd: 330, decay: 0.09, gain: 0.075, filter: { type: "lowpass", freq: 2400 } });
    return 0.1;
  },
};

/** Every effect id, for tests and tooling. */
export const SFX_IDS = Object.keys(RECIPES) as SfxId[];

/**
 * Plays catalog effects through the SFX bus, rate-limited per effect and
 * capped in total. Silently does nothing until audio is unlocked (or when it's
 * muted) — gameplay code never has to check.
 */
export class SfxPlayer {
  private readonly throttle = new Throttle(SFX_GAP);
  private readonly voices = new VoiceCounter();

  /** `kit` returns null while audio is locked, unavailable, or muted. */
  constructor(private readonly kit: () => SynthKit | null) {}

  play(id: SfxId, opts: SfxOpts = {}): void {
    const k = this.kit();
    if (!k) return;
    const now = k.ctx.currentTime;
    if (MINOR.has(id) && this.voices.active(now) >= AUDIO.maxVoices) return;
    if (!this.throttle.allow(id, now)) return;
    // Cosmetic randomness — never the run's seeded RNG (see README).
    const pitch = 1 + (Math.random() * 2 - 1) * JITTER;
    this.voices.add(now + RECIPES[id](k, now, opts, pitch));
  }

  /** Effects still ringing right now (debug/tests). */
  get activeVoices(): number {
    const k = this.kit();
    return k ? this.voices.active(k.ctx.currentTime) : 0;
  }
}
