import type { Difficulty } from "../content/stagekit";
import type { InstrumentId } from "./instruments";

/**
 * The soundtrack, as data. Four looping tracks (one per kind of screen) and
 * three one-shot stings, all in the A-minor family so crossfades sit well.
 *
 * ## Pattern notation
 *
 * One whitespace-separated token per 16th-note step (16 steps = one bar):
 *
 * - `a3`, `c#5`, `bb2` — a note (letter, optional `#`/`b`, octave; c4 = middle C)
 * - `x` / `+`          — a drum hit / a ghost (half-velocity) hit
 * - `.`                — rest
 * - `-`                — hold the previous note one more step
 * - `tok*n`            — the token lasts n steps (`a3*16` = a whole-bar note,
 *                        `.*4` = a beat of rest, `x*4` = a hit then three steps)
 * - `|`                — ignored; use it to mark bars for readability
 *
 * A layer shorter than its track is tiled to fill it, as long as it divides
 * evenly — a one-bar drum loop under an eight-bar melody is just one bar.
 */

/** A note (or drum hit) starting on a step. `midi` is 0 for drums. */
export interface NoteEvent {
  readonly midi: number;
  /** Length in steps, including holds. */
  len: number;
  readonly vel: number;
}

/** One step of a layer: a note starting here, or nothing new. */
export type Step = NoteEvent | null;

export interface Layer {
  readonly inst: InstrumentId;
  readonly gain: number;
  /** Plays only while the track's intensity is within [min, max]. */
  readonly minIntensity: number;
  readonly maxIntensity: number;
  readonly steps: readonly Step[];
}

export interface Track {
  readonly id: TrackId;
  /** Display name (for the curious; nothing renders it yet). */
  readonly title: string;
  readonly bpm: number;
  readonly bars: number;
  /** Loops forever (a screen's music) or plays once (a sting). */
  readonly loop: boolean;
  /** Delay applied to off-beat 8ths, as a fraction of a step (0 = straight). */
  readonly swing: number;
  readonly layers: readonly Layer[];
}

export const STEPS_PER_BAR = 16;

const SEMITONE: Readonly<Record<string, number>> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NOTE_RE = /^([a-g])(#|b)?(\d)$/;

/** MIDI number of a note name like `c#4` (c4 = 60), or NaN if malformed. */
export function noteToMidi(name: string): number {
  const m = NOTE_RE.exec(name);
  if (!m) return NaN;
  const accidental = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + accidental;
}

/** Parse pattern text (see the notation above) into one entry per step. */
export function parsePattern(src: string): Step[] {
  const out: Step[] = [];
  let last: NoteEvent | null = null;
  for (const raw of src.trim().split(/\s+/)) {
    if (raw === "" || raw === "|") continue;
    const [tok, n] = raw.split("*");
    const count = n === undefined ? 1 : Number(n);
    if (!Number.isInteger(count) || count < 1) throw new Error(`Bad step count in "${raw}"`);

    if (tok === ".") {
      for (let i = 0; i < count; i++) out.push(null);
      last = null;
      continue;
    }
    if (tok === "-") {
      for (let i = 0; i < count; i++) out.push(null);
      if (last) last.len += count;
      continue;
    }

    let ev: NoteEvent;
    if (tok === "x") ev = { midi: 0, len: count, vel: 1 };
    else if (tok === "+") ev = { midi: 0, len: count, vel: 0.5 };
    else {
      const midi = noteToMidi(tok);
      if (Number.isNaN(midi)) throw new Error(`Bad note "${tok}"`);
      ev = { midi, len: count, vel: 1 };
    }
    out.push(ev);
    for (let i = 1; i < count; i++) out.push(null);
    last = ev;
  }
  return out;
}

// --- authoring helpers ------------------------------------------------------

/** `s` repeated `n` times. */
const rep = (s: string, n: number): string => Array.from({ length: n }, () => s).join(" ");
/** Every token becomes an 8th note (two steps); bar lines pass through. */
const e8 = (s: string): string =>
  s
    .trim()
    .split(/\s+/)
    .map((t) => (t === "|" ? t : `${t}*2`))
    .join(" ");
/** The 3-3-2 stab rhythm on one note, then half a bar of space. */
const stab332 = (note: string): string => `${note}*3 ${note}*3 ${note}*2 .*8`;
/** A whole bar of rest. */
const REST_BAR = ".*16";

interface LayerSpec {
  inst: InstrumentId;
  notes: string;
  gain?: number;
  minIntensity?: number;
  maxIntensity?: number;
}

interface TrackSpec {
  id: TrackId;
  title: string;
  bpm: number;
  bars: number;
  loop?: boolean;
  swing?: number;
  layers: LayerSpec[];
}

function track(spec: TrackSpec): Track {
  const total = spec.bars * STEPS_PER_BAR;
  const layers = spec.layers.map((l): Layer => {
    const one = parsePattern(l.notes);
    if (one.length === 0 || total % one.length !== 0) {
      throw new Error(`${spec.id}/${l.inst}: ${one.length} steps don't tile ${total}`);
    }
    return {
      inst: l.inst,
      gain: l.gain ?? 1,
      minIntensity: l.minIntensity ?? 0,
      maxIntensity: l.maxIntensity ?? Infinity,
      steps: Array.from({ length: total }, (_, i) => one[i % one.length]),
    };
  });
  return {
    id: spec.id,
    title: spec.title,
    bpm: spec.bpm,
    bars: spec.bars,
    loop: spec.loop ?? true,
    swing: spec.swing ?? 0,
    layers,
  };
}

// --- the soundtrack -----------------------------------------------------------

export type LoopId = "grid" | "patrol" | "nexus" | "bar";
export type StingId = "clear" | "gameover" | "win";
export type TrackId = LoopId | StingId;

export const TRACKS: Readonly<Record<TrackId, Track>> = {
  /**
   * Menu + Map. Am–Fmaj7–C–G–Am–Fmaj7–Dm7–E: wide pads, a sine sub and chiming
   * triangle arpeggios over the empty grid. Intensity 2 (the map) adds a soft
   * pulse so choosing a route feels like it's going somewhere.
   */
  grid: track({
    id: "grid",
    title: "Grid Hymn",
    bpm: 84,
    bars: 8,
    layers: [
      { inst: "pad", notes: "a3*16 a3*16 g3*16 g3*16 a3*16 a3*16 a3*16 g#3*16" },
      { inst: "pad", notes: "c4*16 c4*16 c4*16 b3*16 c4*16 c4*16 c4*16 b3*16" },
      { inst: "pad", notes: "e4*16 e4*16 e4*16 d4*16 e4*16 e4*16 f4*16 e4*16" },
      { inst: "sub", notes: "a2*16 f2*16 c3*16 g2*16 a2*16 f2*16 d3*16 e2*16", gain: 0.9 },
      {
        inst: "glass",
        gain: 0.8,
        notes: e8(`
          a4 c5 e5 c5 a5 e5 c5 e5 | f4 a4 c5 e5 a5 e5 c5 a4
          c5 e5 g5 e5 c6 g5 e5 g5 | g4 b4 d5 g5 b5 g5 d5 b4
          a4 c5 e5 c5 a5 e5 c5 e5 | f4 a4 c5 e5 a5 e5 c5 a4
          d5 f5 a5 c6 a5 f5 d5 c5 | e5 g#5 b5 e6 b5 g#5 e5 d5`),
      },
      { inst: "hat", notes: rep(".*2 +*2", 4), gain: 0.6, minIntensity: 2 },
      { inst: "kick", notes: "x*8 x*8", gain: 0.35, minIntensity: 2 },
    ],
  }),

  /**
   * Combat rooms. Am–F–C–G with a pumping octave saw bass and the Square's own
   * square-wave arpeggio. Intensity follows the room's difficulty: easy is the
   * bare engine, medium adds snare, pads and the hook, hard adds the call
   * phrase and 16th hats.
   */
  patrol: track({
    id: "patrol",
    title: "Shape Patrol",
    bpm: 128,
    bars: 8,
    layers: [
      { inst: "kick", notes: "x*4 x*4 x*4 x*4" },
      { inst: "hat", notes: rep(".*2 x*2", 4), maxIntensity: 2 },
      { inst: "hat", notes: rep("+ + x +", 4), minIntensity: 3 },
      { inst: "snare", notes: ".*4 x*4 .*4 x*4", minIntensity: 2 },
      {
        inst: "bass",
        notes: e8(`
          a2 a3 a2 a3 a2 a3 a2 a3 | f2 f3 f2 f3 f2 f3 f2 f3
          c3 c4 c3 c4 c3 c4 c3 c4 | g2 g3 g2 g3 g2 g3 g2 g3`),
      },
      {
        inst: "arp",
        notes: [rep("a4 c5 e5 a5", 4), rep("f4 a4 c5 f5", 4), rep("g4 c5 e5 g5", 4), rep("g4 b4 d5 g5", 4)].join(" "),
      },
      { inst: "pad", notes: "a3*16 a3*16 g3*16 g3*16", gain: 0.8, minIntensity: 2 },
      { inst: "pad", notes: "c4*16 c4*16 c4*16 b3*16", gain: 0.8, minIntensity: 2 },
      { inst: "pad", notes: "e4*16 f4*16 e4*16 d4*16", gain: 0.8, minIntensity: 2 },
      {
        // The call: bars 1–4, hard rooms only.
        inst: "lead",
        minIntensity: 3,
        notes: `
          a4*2 .*2 a4*2 c5*2 e5*4 d5*2 c5*2 | c5*4 a4*4 .*4 f4*2 a4*2
          g4*2 .*2 g4*2 c5*2 e5*4 g5*2 e5*2 | d5*8 b4*4 .*4
          ${rep(REST_BAR, 4)}`,
      },
      {
        // The hook: bars 5–8, from medium up.
        inst: "lead",
        minIntensity: 2,
        notes: `
          ${rep(REST_BAR, 4)}
          e5*4 a5*4 g5*2 e5*2 c5*4 | d5*2 c5*2 a4*4 c5*4 f5*4
          e5*4 g5*4 c6*4 b5*2 g5*2 | d5*6 b4*2 d5*4 g5*4`,
      },
    ],
  }),

  /**
   * Boss fights. Dm–Bb–Gm–A at 150 BPM with a galloping bass. The lead is
   * built on a FIVE-note figure, for Astra the five-point. Intensity is the
   * boss's phase: phase 2 brings in the lead, phase 3 the 3-3-2 chord stabs,
   * doubled kicks and 16th hats.
   */
  nexus: track({
    id: "nexus",
    title: "Five-Point",
    bpm: 150,
    bars: 8,
    layers: [
      { inst: "kick", notes: "x*4 x*4 x*4 x*4" },
      { inst: "kick", notes: ".*3 x .*7 x .*4", gain: 0.8, minIntensity: 3 },
      { inst: "snare", notes: ".*4 x*4 .*4 x*4" },
      { inst: "hat", notes: rep("x*2", 8), maxIntensity: 2 },
      { inst: "hat", notes: rep("x +", 8), minIntensity: 3 },
      {
        inst: "bass",
        notes: [rep("d2*2 d2 d3", 4), rep("bb1*2 bb1 bb2", 4), rep("g2*2 g2 g3", 4), rep("a2*2 a2 a3", 4)].join(" "),
      },
      {
        inst: "arp",
        notes: [rep("d5 f5 a5 f5", 4), rep("d5 f5 bb5 f5", 4), rep("d5 g5 bb5 g5", 4), rep("c#5 e5 a5 e5", 4)].join(" "),
      },
      {
        inst: "lead",
        minIntensity: 2,
        notes: `
          a5*3 f5*3 d5*2 e5*4 f5*4 | d5*12 .*4
          bb5*3 g5*3 d5*2 e5*4 f5*4 | e5*8 c#5*8
          a5*3 f5*3 d5*2 e5*4 f5*4 | f5*3 d5*3 bb4*2 c5*4 d5*4
          g5*3 bb5*3 d6*2 c6*4 bb5*4 | a5*4 g5*2 f5*2 e5*4 c#5*4`,
      },
      { inst: "stab", notes: [stab332("d4"), stab332("d4"), stab332("d4"), stab332("c#4")].join(" "), minIntensity: 3 },
      { inst: "stab", notes: [stab332("f4"), stab332("f4"), stab332("g4"), stab332("e4")].join(" "), minIntensity: 3 },
      { inst: "stab", notes: [stab332("a4"), stab332("bb4"), stab332("bb4"), stab332("a4")].join(" "), minIntensity: 3 },
    ],
  }),

  /**
   * The Bar. A swung ii–V–I–VI (Dm9–G13–Cmaj9–A7b9): Charleston-comped keys,
   * a walking upright, brushes and rim. The second time round, a vibes melody.
   */
  bar: track({
    id: "bar",
    title: "Last Call at Bar's",
    bpm: 92,
    bars: 8,
    swing: 0.45,
    layers: [
      { inst: "keys", notes: "f3*3 .*3 f3*8 .*2 f3*3 .*3 f3*8 .*2 e3*3 .*3 e3*8 .*2 g3*3 .*3 g3*8 .*2", gain: 0.85 },
      { inst: "keys", notes: "a3*3 .*3 a3*8 .*2 b3*3 .*3 b3*8 .*2 g3*3 .*3 g3*8 .*2 c#4*3 .*3 c#4*8 .*2", gain: 0.85 },
      { inst: "keys", notes: "c4*3 .*3 c4*8 .*2 e4*3 .*3 e4*8 .*2 b3*3 .*3 b3*8 .*2 e4*3 .*3 e4*8 .*2", gain: 0.85 },
      { inst: "keys", notes: "e4*3 .*3 e4*8 .*2 a4*3 .*3 a4*8 .*2 d4*3 .*3 d4*8 .*2 bb4*3 .*3 bb4*8 .*2", gain: 0.85 },
      { inst: "upright", notes: "d2*4 f2*4 a2*4 g#2*4 | g2*4 b2*4 d3*4 c#3*4 | c3*4 e2*4 g2*4 b2*4 | a2*4 g2*4 f2*4 e2*4" },
      { inst: "brush", notes: "x*4 x*2 +*2 x*4 x*2 +*2" },
      { inst: "rim", notes: ".*4 x*4 .*4 x*4", gain: 0.8 },
      { inst: "kick", notes: "x*8 x*8", gain: 0.35 },
      {
        inst: "glass",
        notes: `
          ${rep(REST_BAR, 4)}
          a4*3 .*3 c5*2 e5*4 d5*4 | b4*6 d5*2 f5*4 e5*4
          e5*8 d5*2 c5*2 b4*4 | c#5*6 e5*2 g5*4 .*4`,
      },
    ],
  }),

  // --- stings (play once, then whatever the screen wants) --------------------

  /** Room cleared: a rising A-major arpeggio — the minor key finally lifts. */
  clear: track({
    id: "clear",
    title: "Room Clear",
    bpm: 140,
    bars: 1,
    loop: false,
    layers: [
      { inst: "lead", notes: "a4*2 c#5*2 e5*2 a5*10" },
      { inst: "glass", notes: "a5*2 c#6*2 e6*2 a6*10", gain: 0.7 },
      { inst: "pad", notes: "a3*16" },
      { inst: "pad", notes: "c#4*16" },
      { inst: "pad", notes: "e4*16" },
      { inst: "sub", notes: "a2*16" },
    ],
  }),

  /** Game over: a slow minor fall, then silence. */
  gameover: track({
    id: "gameover",
    title: "Flatline",
    bpm: 76,
    bars: 1,
    loop: false,
    layers: [
      { inst: "lead", notes: "e5*4 d5*4 c5*4 a4*4", gain: 0.9 },
      { inst: "pad", notes: "a3*16" },
      { inst: "pad", notes: "c4*16" },
      { inst: "pad", notes: "e4*16" },
      { inst: "sub", notes: "a2*16" },
    ],
  }),

  /** Sector cleared: a square-wave fanfare landing on a big C major. */
  win: track({
    id: "win",
    title: "Sector Cleared",
    bpm: 132,
    bars: 2,
    loop: false,
    layers: [
      { inst: "lead", notes: "c5*2 e5*2 g5*2 c6*6 .*2 g5*2 | c6*16" },
      { inst: "arp", notes: `${rep("c5 e5 g5 c6", 4)} ${REST_BAR}` },
      { inst: "pad", notes: "c4*32" },
      { inst: "pad", notes: "e4*32" },
      { inst: "pad", notes: "g4*32" },
      { inst: "sub", notes: "c3*32" },
      { inst: "snare", notes: ".*12 + + x x | .*16", gain: 0.7 },
      { inst: "kick", notes: ".*16 x*16" },
    ],
  }),
};

/** How hard the combat loop drives in each kind of room. */
export const COMBAT_INTENSITY: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  medium: 2,
  hard: 3,
  elite: 3,
  boss: 1,
};

/**
 * Which loop a room plays, and how hard. Once a boss has turned up (`bossPhase`
 * is its phase number) the boss track takes over and escalates with it; the
 * finale room starts on the boss track before anything has even arrived.
 */
export function roomMusic(difficulty: Difficulty, bossPhase: number | null): { id: LoopId; intensity: number } {
  if (bossPhase !== null) return { id: "nexus", intensity: bossPhase };
  if (difficulty === "boss") return { id: "nexus", intensity: 1 };
  return { id: "patrol", intensity: COMBAT_INTENSITY[difficulty] };
}
