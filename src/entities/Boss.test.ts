import { describe, expect, it } from "vitest";
import { DT } from "../config";
import { RNG } from "../core/RNG";
import { BulletSystem } from "../systems/BulletSystem";
import { Boss, type BossConfig } from "./Boss";
import { Player } from "./Player";

const CFG: BossConfig = {
  name: "TEST WARDEN",
  shape: "hexagon",
  color: "#fff",
  r: 24,
  entrance: 1.5,
  phases: [
    { name: "One", hp: 100, weapons: [{ pattern: "ring", count: 8, interval: 0.1, speed: 100 }] },
    { name: "Two", hp: 100, weapons: [{ pattern: "ring", count: 8, interval: 0.1, speed: 100 }] },
  ],
};

/** Step a boss for `seconds` and report how many bullets it fired. */
function run(boss: Boss, seconds: number): number {
  const bs = new BulletSystem();
  const player = new Player();
  const rng = new RNG(1);
  for (let i = 0; i < Math.round(seconds / DT); i++) boss.update(DT, player, bs, rng);
  return bs.enemy.count;
}

describe("boss entrance", () => {
  it("descends, then holds station before the fight starts", () => {
    const boss = new Boss(CFG);
    expect(boss.arriving).toBe(true);

    // Mid-entrance: on screen (so the health bar means something) but silent.
    const fired = run(boss, 1.0);
    expect(boss.arriving).toBe(true);
    expect(fired).toBe(0);
    expect(boss.y).toBeGreaterThan(0);
  });

  it("cannot be damaged while arriving", () => {
    const boss = new Boss(CFG);
    expect(boss.damage(9999)).toBe("none");
    expect(boss.healthFrac).toBe(1);

    run(boss, 1.0);
    expect(boss.damage(9999)).toBe("none");
    expect(boss.healthFrac).toBe(1);
  });

  it("opens fire and becomes vulnerable once the hold expires", () => {
    const boss = new Boss(CFG);
    run(boss, 6.0); // descent + the 1.5s hold, with room to spare
    expect(boss.arriving).toBe(false);

    expect(boss.damage(100)).toBe("phase");
    expect(run(boss, 2.0)).toBeGreaterThan(0);
  });

  it("honours a per-boss entrance length, and has a default", () => {
    const quick = new Boss({ ...CFG, entrance: 0 });
    run(quick, 4.0);
    expect(quick.arriving).toBe(false);

    const slow = new Boss({ ...CFG, entrance: 5 });
    run(slow, 4.0);
    expect(slow.arriving).toBe(true);

    const { entrance: _omitted, ...noEntrance } = CFG;
    const standard = new Boss(noEntrance);
    run(standard, 2.5); // ~0.6s of descent, then the default hold
    expect(standard.arriving).toBe(true);
    run(standard, 2.0);
    expect(standard.arriving).toBe(false);
  });
});
