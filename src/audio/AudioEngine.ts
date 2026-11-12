import { AUDIO, type Shape } from "../config";
import { MusicPlayer } from "./MusicPlayer";
import { SfxPlayer } from "./sfx";
import type { SynthKit, Wave } from "./synth";
import { SHAPE_TIMBRE, buildWave } from "./timbres";

/** Where the player's mute/volume choice is remembered. */
const PREFS_KEY = "sttr.audio";

/** Music lowpass cutoff when wide open, and when muffled (pause/cutscene). */
const OPEN_HZ = 20000;
const MUFFLED_HZ = 700;
const MUFFLED_GAIN = 0.55;

interface Prefs {
  volume: number;
  muted: boolean;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The browser's AudioContext constructor, or null where there is none. */
function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const g = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

/** `localStorage`, or null when it's missing or blocked. Never throws. */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function loadPrefs(): Prefs {
  try {
    const raw = storage()?.getItem(PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      return {
        volume: typeof p.volume === "number" ? clamp01(p.volume) : AUDIO.volume,
        muted: p.muted === true,
      };
    }
  } catch {
    // Corrupt or inaccessible: fall through to defaults.
  }
  return { volume: AUDIO.volume, muted: false };
}

function savePrefs(p: Prefs): void {
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Private mode / blocked storage: the choice just won't survive a reload.
  }
}

/** The graph that exists once audio has been unlocked. */
interface Graph {
  ctx: AudioContext;
  master: GainNode;
  musicFilter: BiquadFilterNode;
  musicDuck: GainNode;
  sfxKit: SynthKit;
  musicKit: SynthKit;
}

/**
 * Owns the AudioContext and the mixing graph:
 *
 *     sfx voices ───────► sfxBus ─────────────────────────────┐
 *     music tracks ─────► musicBus ─► musicFilter ─► musicDuck ┤
 *                                                              ▼
 *                                  master (volume, mute) ─► compressor ─► out
 *
 * Browsers only allow audio after a user gesture, so nothing is created until
 * the first key press or click; before that (and in tests, where there is no
 * Web Audio at all) every call is a silent no-op. Gameplay code never checks.
 */
export class AudioEngine {
  readonly sfx: SfxPlayer;
  readonly music: MusicPlayer;
  private graph: Graph | null = null;
  private prefs: Prefs = loadPrefs();
  private muffled = false;
  private readonly waves = new Map<Shape, Wave>();

  constructor() {
    this.sfx = new SfxPlayer(() => (this.graph && !this.prefs.muted ? this.graph.sfxKit : null));
    this.music = new MusicPlayer(() => this.graph?.musicKit ?? null);
    if (!audioContextCtor()) return;
    window.addEventListener("keydown", this.unlock, true);
    window.addEventListener("pointerdown", this.unlock, true);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  get volume(): number {
    return this.prefs.volume;
  }
  get muted(): boolean {
    return this.prefs.muted;
  }
  /** Context state for debugging: "locked" until the first gesture. */
  get state(): AudioContextState | "locked" {
    return this.graph?.ctx.state ?? "locked";
  }

  toggleMute(): void {
    this.prefs.muted = !this.prefs.muted;
    this.commitPrefs();
  }

  /** Nudge the master volume; turning it up also unmutes. */
  changeVolume(delta: number): void {
    this.prefs.volume = Math.round(clamp01(this.prefs.volume + delta) * 10) / 10;
    if (delta > 0) this.prefs.muted = false;
    this.commitPrefs();
  }

  /** Muffle the music behind pause screens and dialog. Idempotent. */
  setMuffled(on: boolean): void {
    if (on === this.muffled) return;
    this.muffled = on;
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    this.retarget(g.musicFilter.frequency, on ? MUFFLED_HZ : OPEN_HZ, t, 0.08);
    this.retarget(g.musicDuck.gain, on ? MUFFLED_GAIN : 1, t, 0.08);
  }

  /** A brief underwater dip in the music when the Square takes a hit. */
  hurtDip(): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const freq = g.musicFilter.frequency;
    const gain = g.musicDuck.gain;
    this.retarget(freq, 350, t, 0.02);
    this.retarget(gain, 0.5, t, 0.02);
    freq.setTargetAtTime(this.muffled ? MUFFLED_HZ : OPEN_HZ, t + 0.3, 0.25);
    gain.setTargetAtTime(this.muffled ? MUFFLED_GAIN : 1, t + 0.3, 0.25);
  }

  private commitPrefs(): void {
    savePrefs(this.prefs);
    const g = this.graph;
    if (g) this.retarget(g.master.gain, this.masterLevel(), g.ctx.currentTime, 0.03);
  }

  /** Squared, so each volume step sounds roughly as big as the last. */
  private masterLevel(): number {
    return this.prefs.muted ? 0 : this.prefs.volume * this.prefs.volume;
  }

  /** Glide `param` from wherever it is now toward `value`. */
  private retarget(param: AudioParam, value: number, t: number, timeConstant: number): void {
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.setTargetAtTime(value, t, timeConstant);
  }

  /** The waveform a shape sounds like, built once per context. */
  private wave = (shape: Shape): Wave => {
    let w = this.waves.get(shape);
    if (!w) {
      w = buildWave(this.graph!.ctx, SHAPE_TIMBRE[shape]);
      this.waves.set(shape, w);
    }
    return w;
  };

  /** First gesture: build the graph (once) and make sure it's running. */
  private unlock = (): void => {
    if (!this.graph) this.graph = this.build();
    const ctx = this.graph.ctx;
    if (ctx.state === "running") {
      this.stopListening();
      return;
    }
    // Some keys (Escape, bare modifiers) don't count as a gesture; keep
    // listening until one that does gets the context running.
    void ctx.resume().then(() => {
      if (ctx.state === "running") this.stopListening();
    });
  };

  private stopListening(): void {
    window.removeEventListener("keydown", this.unlock, true);
    window.removeEventListener("pointerdown", this.unlock, true);
  }

  private onVisibility = (): void => {
    const ctx = this.graph?.ctx;
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  };

  private build(): Graph {
    const Ctor = audioContextCtor()!;
    const ctx = new Ctor({ latencyHint: "interactive" });

    // A gentle bus compressor so a boss death over a full mix never clips.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.masterLevel();
    master.connect(comp);

    const sfxBus = ctx.createGain();
    sfxBus.gain.value = AUDIO.sfx;
    sfxBus.connect(master);

    const musicDuck = ctx.createGain();
    musicDuck.gain.value = this.muffled ? MUFFLED_GAIN : 1;
    musicDuck.connect(master);
    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = "lowpass";
    musicFilter.Q.value = 0.7;
    musicFilter.frequency.value = this.muffled ? MUFFLED_HZ : OPEN_HZ;
    musicFilter.connect(musicDuck);
    const musicBus = ctx.createGain();
    musicBus.gain.value = AUDIO.music;
    musicBus.connect(musicFilter);

    // One second of white noise, shared by every noise voice.
    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const graph: Graph = {
      ctx,
      master,
      musicFilter,
      musicDuck,
      sfxKit: { ctx, out: sfxBus, noise, wave: this.wave },
      musicKit: { ctx, out: musicBus, noise, wave: this.wave },
    };
    // Whatever the menu asked for while we were locked starts now.
    queueMicrotask(() => this.music.resume());
    return graph;
  }
}
