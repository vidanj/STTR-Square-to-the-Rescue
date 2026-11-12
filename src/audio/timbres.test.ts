import { describe, expect, it } from "vitest";
import { ENEMY_SHAPES, type Shape } from "../config";
import { FakeAudioContext } from "./fakeAudio";
import { SHAPE_TIMBRE, buildWave } from "./timbres";

const ALL_SHAPES = Object.keys(SHAPE_TIMBRE) as Shape[];
const key = (shape: Shape): string => JSON.stringify(SHAPE_TIMBRE[shape]);

describe("shape timbres", () => {
  it("gives the Square a square wave — the player's voice", () => {
    expect(SHAPE_TIMBRE.square).toBe("square");
  });

  it("covers every shape an actor can have", () => {
    for (const shape of [...ENEMY_SHAPES, "square", "rect"] as Shape[]) {
      expect(SHAPE_TIMBRE[shape], shape).toBeDefined();
    }
  });

  it("gives every shape its own voice, so foes are told apart by ear", () => {
    const voices = new Set(ALL_SHAPES.map(key));
    expect(voices.size).toBe(ALL_SHAPES.length);
  });

  it("never lets an enemy sound like the Square", () => {
    for (const shape of ENEMY_SHAPES) expect(key(shape), shape).not.toBe(key("square"));
  });

  it("builds a playable wave for every shape", () => {
    const ctx = new FakeAudioContext() as unknown as BaseAudioContext;
    for (const shape of ALL_SHAPES) {
      const def = SHAPE_TIMBRE[shape];
      const wave = buildWave(ctx, def);
      if (typeof def === "string") expect(wave).toBe(def);
      else expect(typeof wave).toBe("object");
    }
  });
});
