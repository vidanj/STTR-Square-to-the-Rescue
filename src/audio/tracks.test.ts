import { describe, expect, it } from "vitest";
import type { InstrumentId } from "./instruments";
import { STEPS_PER_BAR, TRACKS, noteToMidi, parsePattern, roomMusic, type TrackId } from "./tracks";

const DRUMS: ReadonlySet<InstrumentId> = new Set<InstrumentId>(["kick", "snare", "hat", "brush", "rim"]);
const LOOPS: TrackId[] = ["grid", "patrol", "nexus", "bar"];
const STINGS: TrackId[] = ["clear", "gameover", "win"];

describe("note names", () => {
  it("maps names to MIDI numbers (c4 = middle C = 60)", () => {
    expect(noteToMidi("c4")).toBe(60);
    expect(noteToMidi("a4")).toBe(69);
    expect(noteToMidi("c#4")).toBe(61);
    expect(noteToMidi("bb3")).toBe(58);
    expect(noteToMidi("a2")).toBe(45);
  });

  it("rejects malformed names", () => {
    expect(noteToMidi("h4")).toBeNaN();
    expect(noteToMidi("c")).toBeNaN();
    expect(noteToMidi("x")).toBeNaN();
  });
});

describe("parsePattern", () => {
  it("emits one entry per step, with notes carrying their held length", () => {
    const steps = parsePattern("a3*4 . c4 - - x +");
    expect(steps).toHaveLength(10);
    expect(steps[0]).toEqual({ midi: 57, len: 4, vel: 1 });
    expect(steps.slice(1, 5)).toEqual([null, null, null, null]);
    expect(steps[5]).toEqual({ midi: 60, len: 3, vel: 1 });
    expect(steps[8]).toEqual({ midi: 0, len: 1, vel: 1 });
    expect(steps[9]).toEqual({ midi: 0, len: 1, vel: 0.5 });
  });

  it("ignores bar lines and treats a hold after a rest as more rest", () => {
    const steps = parsePattern(". - | .*2");
    expect(steps).toEqual([null, null, null, null]);
  });

  it("throws on typos instead of silently dropping notes", () => {
    expect(() => parsePattern("a3 h4")).toThrow();
    expect(() => parsePattern("a3*0")).toThrow();
    expect(() => parsePattern("a3*x")).toThrow();
  });
});

describe("the soundtrack", () => {
  it("fills every bar of every layer exactly", () => {
    for (const track of Object.values(TRACKS)) {
      for (const layer of track.layers) {
        expect(layer.steps.length, `${track.id}/${layer.inst}`).toBe(track.bars * STEPS_PER_BAR);
      }
    }
  });

  it("keeps notes on pitched instruments and hits on drums", () => {
    for (const track of Object.values(TRACKS)) {
      for (const layer of track.layers) {
        for (const ev of layer.steps) {
          if (!ev) continue;
          const where = `${track.id}/${layer.inst}`;
          if (DRUMS.has(layer.inst)) expect(ev.midi, where).toBe(0);
          else {
            expect(ev.midi, where).toBeGreaterThanOrEqual(21); // A0
            expect(ev.midi, where).toBeLessThanOrEqual(108); // C8
          }
        }
      }
    }
  });

  it("loops the screen music and plays stings once", () => {
    for (const id of LOOPS) expect(TRACKS[id].loop, id).toBe(true);
    for (const id of STINGS) expect(TRACKS[id].loop, id).toBe(false);
  });

  it("never goes silent at the lowest intensity", () => {
    for (const id of LOOPS) {
      const audible = TRACKS[id].layers.filter((l) => l.minIntensity <= 1 && l.maxIntensity >= 1);
      expect(audible.length, id).toBeGreaterThan(0);
    }
  });

  it("swings only the off-beat 8ths, never by a whole step", () => {
    for (const track of Object.values(TRACKS)) {
      expect(track.swing).toBeGreaterThanOrEqual(0);
      expect(track.swing).toBeLessThan(1);
    }
  });
});

describe("roomMusic", () => {
  it("drives harder as rooms get harder", () => {
    expect(roomMusic("easy", null)).toEqual({ id: "patrol", intensity: 1 });
    expect(roomMusic("medium", null)).toEqual({ id: "patrol", intensity: 2 });
    expect(roomMusic("hard", null)).toEqual({ id: "patrol", intensity: 3 });
  });

  it("hands over to the boss track when a boss turns up, escalating by phase", () => {
    expect(roomMusic("elite", null).id).toBe("patrol"); // the guard wave
    expect(roomMusic("elite", 1)).toEqual({ id: "nexus", intensity: 1 });
    expect(roomMusic("boss", 3)).toEqual({ id: "nexus", intensity: 3 });
  });

  it("opens the finale room on the boss track before anything arrives", () => {
    expect(roomMusic("boss", null)).toEqual({ id: "nexus", intensity: 1 });
  });
});
