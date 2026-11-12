import { describe, expect, it } from "vitest";
import { AUDIO, type Shape } from "../config";
import { FakeAudioContext, fakeKit } from "./fakeAudio";
import { SFX_GAP, SFX_IDS, SfxPlayer, Throttle, VoiceCounter } from "./sfx";
import { SHAPE_TIMBRE } from "./timbres";

describe("Throttle", () => {
  it("drops a repeat inside the gap and allows it after", () => {
    const t = new Throttle({ hit: 0.045 });
    expect(t.allow("hit", 1)).toBe(true);
    expect(t.allow("hit", 1.02)).toBe(false);
    expect(t.allow("hit", 1.05)).toBe(true);
  });

  it("measures the gap from the last play that got through", () => {
    const t = new Throttle({ hit: 0.1 });
    t.allow("hit", 0);
    t.allow("hit", 0.06); // dropped — does not reset the clock
    expect(t.allow("hit", 0.1)).toBe(true);
  });

  it("never limits effects without a gap, and keeps ids independent", () => {
    const t = new Throttle({ hit: 1 });
    expect(t.allow("bomb", 0)).toBe(true);
    expect(t.allow("bomb", 0)).toBe(true);
    expect(t.allow("hit", 0)).toBe(true);
    expect(t.allow("kill", 0)).toBe(true);
  });
});

describe("VoiceCounter", () => {
  it("counts only the sounds still ringing", () => {
    const v = new VoiceCounter();
    v.add(1);
    v.add(2);
    expect(v.active(0.5)).toBe(2);
    expect(v.active(1.5)).toBe(1);
    expect(v.active(3)).toBe(0);
  });
});

describe("the sfx catalog", () => {
  it("only rate-limits effects that exist", () => {
    for (const id of Object.keys(SFX_GAP)) expect(SFX_IDS).toContain(id);
  });

  it("plays every effect, in every shape's voice, without a scheduling error", () => {
    const ctx = new FakeAudioContext();
    const player = new SfxPlayer(() => fakeKit(ctx));
    for (const id of SFX_IDS) {
      for (const shape of Object.keys(SHAPE_TIMBRE) as Shape[]) {
        for (const opts of [{ shape }, { shape, boss: true, frac: 0 }, { shape, size: 30, focus: true }]) {
          ctx.currentTime += 1; // clear every throttle
          expect(() => player.play(id, opts), `${id}/${shape}`).not.toThrow();
        }
      }
    }
    expect(ctx.voicesStarted).toBeGreaterThan(SFX_IDS.length);
  });

  it("keeps a burst of hits from stacking up", () => {
    const ctx = new FakeAudioContext();
    const player = new SfxPlayer(() => fakeKit(ctx));
    for (let i = 0; i < 50; i++) player.play("hit", { shape: "circle" });
    // All fifty landed on the same instant: only the first one sounds.
    expect(player.activeVoices).toBe(1);
  });

  it("drops minor effects, never big ones, once the voice cap is full", () => {
    const ctx = new FakeAudioContext();
    const player = new SfxPlayer(() => fakeKit(ctx));
    for (let i = 0; i < AUDIO.maxVoices; i++) player.play("bossDown");
    expect(player.activeVoices).toBe(AUDIO.maxVoices);
    player.play("hit");
    expect(player.activeVoices).toBe(AUDIO.maxVoices);
    player.play("hurt");
    expect(player.activeVoices).toBe(AUDIO.maxVoices + 1);
  });

  it("is a silent no-op while audio is locked or muted", () => {
    const player = new SfxPlayer(() => null);
    expect(() => player.play("bomb")).not.toThrow();
    expect(player.activeVoices).toBe(0);
  });
});
