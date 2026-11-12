import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeAudioContext, fakeKit } from "./fakeAudio";
import { MusicPlayer } from "./MusicPlayer";
import type { SynthKit } from "./synth";
import { STEPS_PER_BAR, TRACKS, type LoopId, type StingId } from "./tracks";

/** Let the scheduler run for `seconds` of audio-clock time, in timer ticks. */
function run(ctx: FakeAudioContext, seconds: number): void {
  const end = ctx.currentTime + seconds;
  while (ctx.currentTime < end) {
    ctx.currentTime = Math.min(end, ctx.currentTime + 0.025);
    vi.advanceTimersByTime(25);
  }
}

const lengthOf = (id: LoopId | StingId): number =>
  (60 / TRACKS[id].bpm / 4) * TRACKS[id].bars * STEPS_PER_BAR;

describe("MusicPlayer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("plays a loop and keeps it going when asked again", () => {
    const ctx = new FakeAudioContext();
    const music = new MusicPlayer(() => fakeKit(ctx));
    music.play("grid", 1);
    expect(music.playing).toBe("grid");
    run(ctx, 1);
    const voices = ctx.voicesStarted;
    expect(voices).toBeGreaterThan(0);

    // Asked again (as the Game does every step) — and with a new intensity.
    music.play("grid", 2);
    expect(music.playing).toBe("grid");
    run(ctx, 1);
    expect(ctx.voicesStarted).toBeGreaterThan(voices);
  });

  it("crossfades to a new loop, and to silence", () => {
    const ctx = new FakeAudioContext();
    const music = new MusicPlayer(() => fakeKit(ctx));
    music.play("grid");
    run(ctx, 0.5);
    music.play("patrol", 2);
    expect(music.playing).toBe("patrol");
    run(ctx, 2);
    music.play(null);
    expect(music.playing).toBeNull();
    run(ctx, 2);
    const after = ctx.voicesStarted;
    run(ctx, 2);
    expect(ctx.voicesStarted).toBe(after); // truly silent once faded
  });

  it("holds the wanted loop back until a sting has finished", () => {
    const ctx = new FakeAudioContext();
    const music = new MusicPlayer(() => fakeKit(ctx));
    music.play("patrol", 1);
    run(ctx, 1);
    music.playSting("clear");
    music.play("grid", 2); // the upgrade screen asks for the calm loop at once…
    expect(music.playing).toBeNull(); // …but the sting has the floor
    run(ctx, lengthOf("clear") + 0.2);
    expect(music.playing).toBe("grid");
  });

  it("stays silent after the game-over sting", () => {
    const ctx = new FakeAudioContext();
    const music = new MusicPlayer(() => fakeKit(ctx));
    music.play("nexus", 3);
    music.playSting("gameover");
    music.play(null);
    run(ctx, lengthOf("gameover") + 3);
    expect(music.playing).toBeNull();
    const after = ctx.voicesStarted;
    run(ctx, 2);
    expect(ctx.voicesStarted).toBe(after);
  });

  it("remembers what was asked for while locked, and starts it on unlock", () => {
    let kit: SynthKit | null = null;
    const ctx = new FakeAudioContext();
    const music = new MusicPlayer(() => kit);
    music.play("bar");
    expect(music.playing).toBeNull();
    kit = fakeKit(ctx);
    music.resume();
    expect(music.playing).toBe("bar");
  });

  it("schedules every loop at every intensity, and every sting, without an error", () => {
    for (const id of ["grid", "patrol", "nexus", "bar"] as LoopId[]) {
      for (const intensity of [1, 2, 3]) {
        const ctx = new FakeAudioContext();
        const music = new MusicPlayer(() => fakeKit(ctx));
        music.play(id, intensity);
        expect(() => run(ctx, lengthOf(id) + 0.5), `${id}@${intensity}`).not.toThrow();
      }
    }
    for (const id of ["clear", "gameover", "win"] as StingId[]) {
      const ctx = new FakeAudioContext();
      const music = new MusicPlayer(() => fakeKit(ctx));
      music.playSting(id);
      expect(() => run(ctx, lengthOf(id) + 0.5), id).not.toThrow();
    }
  });

  it("brings in more layers as intensity rises", () => {
    const count = (intensity: number): number => {
      const ctx = new FakeAudioContext();
      const music = new MusicPlayer(() => fakeKit(ctx));
      music.play("patrol", intensity);
      run(ctx, lengthOf("patrol"));
      return ctx.voicesStarted;
    };
    const [easy, medium, hard] = [count(1), count(2), count(3)];
    expect(medium).toBeGreaterThan(easy);
    expect(hard).toBeGreaterThan(medium);
  });
});
