import { AUDIO } from "../config";
import { INSTRUMENTS } from "./instruments";
import type { SynthKit } from "./synth";
import { STEPS_PER_BAR, TRACKS, type Layer, type LoopId, type StingId, type Track } from "./tracks";

/** How often the scheduler wakes (ms), and how far ahead it books notes (s). */
const TICK_MS = 25;
const LOOKAHEAD = 0.12;
/** Lead-in before a freshly started track's first note. */
const START_DELAY = 0.05;
/** How long a finished sting's tail is left ringing before it's cleaned up. */
const STING_TAIL = 2;

/** One track being played into its own gain node (so it can crossfade). */
interface Playback {
  readonly track: Track;
  readonly gain: GainNode;
  /** The kit, re-pointed at this playback's gain. */
  readonly kit: SynthKit;
  /** Next step index to book, and the AudioContext time it lands on. */
  step: number;
  nextTime: number;
  /** Once set, nothing is booked from here on and the node is reaped after. */
  stopAt: number | null;
}

/**
 * The soundtrack sequencer. A classic Web Audio lookahead scheduler: a timer
 * wakes every 25ms and books every note due in the next ~120ms against the
 * AudioContext clock, so timing is sample-accurate however the frame rate
 * stutters. It runs beside the game loop, not inside it.
 *
 * `play()` is idempotent — the Game calls it every step with whatever the
 * current screen wants, and only a change of track does anything (a
 * crossfade). A `sting()` interrupts the loop; requests made while it plays
 * wait until it has finished.
 */
export class MusicPlayer {
  private wanted: LoopId | null = null;
  private intensity = 1;
  private current: Playback | null = null;
  private sting: Playback | null = null;
  private stingEnd = 0;
  private fading: Playback[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  /** `kit` returns null until audio is unlocked (or when it's unavailable). */
  constructor(private readonly kit: () => SynthKit | null) {}

  /** The loop the game wants right now (null for silence), at `intensity`. */
  play(id: LoopId | null, intensity = 1): void {
    this.wanted = id;
    this.intensity = intensity;
    this.apply();
  }

  /** Interrupt the loop with a one-shot; the wanted loop resumes after it. */
  playSting(id: StingId): void {
    const kit = this.kit();
    if (!kit) return;
    this.ensureTimer();
    this.fadeOut(this.current, kit, 0.25);
    this.current = null;
    this.fadeOut(this.sting, kit, 0.1);
    const track = TRACKS[id];
    this.sting = this.start(track, kit, false);
    this.stingEnd = this.sting.nextTime + this.stepDur(track) * track.bars * STEPS_PER_BAR;
  }

  /** Start whatever was asked for before audio was unlocked. */
  resume(): void {
    this.apply();
  }

  /** Bring the playing track in line with what's wanted. */
  private apply(): void {
    const kit = this.kit();
    if (!kit) return;
    this.ensureTimer();
    if (this.sting) return; // the wanted loop starts once the sting is over
    if ((this.current?.track.id ?? null) === this.wanted) return;
    this.fadeOut(this.current, kit, AUDIO.crossfade);
    this.current = this.wanted ? this.start(TRACKS[this.wanted], kit, true) : null;
  }

  private ensureTimer(): void {
    if (this.timer === null) this.timer = setInterval(this.tick, TICK_MS);
  }

  private stepDur(track: Track): number {
    return 60 / track.bpm / 4;
  }

  private start(track: Track, kit: SynthKit, fadeIn: boolean): Playback {
    const ctx = kit.ctx;
    const gain = ctx.createGain();
    gain.connect(kit.out);
    const t = ctx.currentTime + START_DELAY;
    if (fadeIn) {
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(1, t + AUDIO.crossfade);
    } else {
      gain.gain.setValueAtTime(1, t);
    }
    return { track, gain, kit: { ...kit, out: gain }, step: 0, nextTime: t, stopAt: null };
  }

  /** Ramp a playback down and hand it to the reaper. */
  private fadeOut(p: Playback | null, kit: SynthKit, seconds: number): void {
    if (!p || p.stopAt !== null) return;
    const t = kit.ctx.currentTime;
    const g = p.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.exponentialRampToValueAtTime(0.0001, t + seconds);
    p.stopAt = t + seconds;
    this.fading.push(p);
  }

  private layerOn(layer: Layer, track: Track): boolean {
    // Stings play every layer; loops gate layers by the current intensity.
    if (!track.loop) return true;
    return this.intensity >= layer.minIntensity && this.intensity <= layer.maxIntensity;
  }

  /** Book every note of `p` that falls before `horizon`. */
  private schedule(p: Playback, horizon: number, now: number): void {
    const { track } = p;
    const dur = this.stepDur(track);
    const total = track.bars * STEPS_PER_BAR;
    // The clock ran on without us (a starved timer): skip ahead, don't cram.
    if (p.nextTime < now - 0.05) p.nextTime = now + 0.02;
    const limit = p.stopAt === null ? horizon : Math.min(horizon, p.stopAt);

    while (p.nextTime < limit) {
      if (!track.loop && p.step >= total) return;
      const i = p.step % total;
      const swing = track.swing > 0 && i % 4 === 2 ? track.swing * dur : 0;
      for (const layer of track.layers) {
        const ev = layer.steps[i];
        if (!ev || !this.layerOn(layer, track)) continue;
        INSTRUMENTS[layer.inst](p.kit, p.nextTime + swing, ev.midi, ev.len * dur, layer.gain * ev.vel);
      }
      p.step += 1;
      p.nextTime += dur;
    }
  }

  private tick = (): void => {
    const kit = this.kit();
    if (!kit) return;
    const now = kit.ctx.currentTime;
    const horizon = now + LOOKAHEAD;

    if (this.current) this.schedule(this.current, horizon, now);
    if (this.sting) this.schedule(this.sting, horizon, now);
    for (const p of this.fading) this.schedule(p, horizon, now);

    // Sting over: let its tail ring while the wanted loop fades in under it.
    if (this.sting && now >= this.stingEnd) {
      this.sting.stopAt = now + STING_TAIL;
      this.fading.push(this.sting);
      this.sting = null;
      this.apply();
    }

    if (this.fading.some((p) => now > (p.stopAt ?? 0) + 0.2)) {
      this.fading = this.fading.filter((p) => {
        if (now <= (p.stopAt ?? 0) + 0.2) return true;
        p.gain.disconnect();
        return false;
      });
    }
  };

  /** The loop currently sounding (debug/tests). */
  get playing(): LoopId | null {
    return (this.current?.track.id as LoopId | undefined) ?? null;
  }
}
