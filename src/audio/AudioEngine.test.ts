import { describe, expect, it } from "vitest";
import { AUDIO } from "../config";
import { AudioEngine } from "./AudioEngine";

// Node has no Web Audio and no window: the engine must be a silent, harmless
// no-op there — the same path a locked browser takes before the first click.
describe("AudioEngine without Web Audio", () => {
  it("accepts every call without throwing", () => {
    const audio = new AudioEngine();
    expect(audio.state).toBe("locked");
    expect(() => {
      audio.sfx.play("hurt");
      audio.music.play("patrol", 2);
      audio.music.playSting("clear");
      audio.setMuffled(true);
      audio.setMuffled(false);
      audio.hurtDip();
    }).not.toThrow();
    expect(audio.music.playing).toBeNull();
  });

  it("starts at the default volume, unmuted", () => {
    const audio = new AudioEngine();
    expect(audio.volume).toBe(AUDIO.volume);
    expect(audio.muted).toBe(false);
  });

  it("toggles mute", () => {
    const audio = new AudioEngine();
    audio.toggleMute();
    expect(audio.muted).toBe(true);
    audio.toggleMute();
    expect(audio.muted).toBe(false);
  });

  it("steps volume in tenths, clamped to 0..1", () => {
    const audio = new AudioEngine();
    for (let i = 0; i < 20; i++) audio.changeVolume(AUDIO.volumeStep);
    expect(audio.volume).toBe(1);
    for (let i = 0; i < 3; i++) audio.changeVolume(-AUDIO.volumeStep);
    expect(audio.volume).toBe(0.7);
    for (let i = 0; i < 20; i++) audio.changeVolume(-AUDIO.volumeStep);
    expect(audio.volume).toBe(0);
  });

  it("unmutes when the volume is turned up, but not down", () => {
    const audio = new AudioEngine();
    audio.toggleMute();
    audio.changeVolume(-AUDIO.volumeStep);
    expect(audio.muted).toBe(true);
    audio.changeVolume(AUDIO.volumeStep);
    expect(audio.muted).toBe(false);
  });
});
