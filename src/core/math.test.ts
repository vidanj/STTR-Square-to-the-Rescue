import { describe, expect, it } from "vitest";
import { circleHit } from "../systems/CollisionSystem";
import { RNG } from "./RNG";
import { clamp } from "./Vec2";

describe("RNG", () => {
  it("is deterministic for a given seed", () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1)", () => {
    const r = new RNG(99);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("shuffle keeps the same elements", () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = new RNG(7).shuffle([...src]);
    expect([...out].sort((x, y) => x - y)).toEqual(src);
  });
});

describe("clamp", () => {
  it("bounds values to the range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("circleHit", () => {
  it("detects overlap and misses", () => {
    expect(circleHit(0, 0, 5, 3, 0, 5)).toBe(true); // centres 3 apart, radii sum 10
    expect(circleHit(0, 0, 2, 10, 0, 2)).toBe(false); // far apart
    expect(circleHit(0, 0, 2, 4, 0, 2)).toBe(true); // exactly touching
  });
});
