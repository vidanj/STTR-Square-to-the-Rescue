import { describe, expect, it } from "vitest";
import { DT } from "../config";
import type { Input } from "../core/Input";
import { Player } from "../entities/Player";
import { BulletSystem } from "../systems/BulletSystem";
import { bounceOffBody } from "../systems/CollisionSystem";
import { POWERUPS, cardText, type PowerUp } from "./powerups";
import {
  MAX_SHOT_LEVEL,
  MAX_SHOTS_PER_VOLLEY,
  SHOT_BUFFER,
  SHOT_SPECS,
  orbitShield,
  type FiringShotType,
  type ShotSpec,
} from "./shots";

/** Build one stream's volley at `level` and return copies of the specs. */
function volley(type: FiringShotType, level: number, damage = 1, v = 0): ShotSpec[] {
  const count = SHOT_SPECS[type]({ level, damage, volley: v }, SHOT_BUFFER);
  return SHOT_BUFFER.slice(0, count).map((s) => ({ ...s }));
}

const shotPowerUp = (id: string): PowerUp => POWERUPS.find((p) => p.id === id)!;

describe("shot builders", () => {
  it("never emit more bullets than the shared buffer holds", () => {
    for (const type of Object.keys(SHOT_SPECS) as FiringShotType[]) {
      for (let lvl = 1; lvl <= MAX_SHOT_LEVEL[type] + 2; lvl++) {
        expect(volley(type, lvl).length).toBeLessThanOrEqual(MAX_SHOTS_PER_VOLLEY);
      }
    }
  });

  it("only ever fire squares, whatever the upgrade", () => {
    for (const type of Object.keys(SHOT_SPECS) as FiringShotType[]) {
      for (const spec of volley(type, MAX_SHOT_LEVEL[type])) expect(spec.shape).toBe("square");
    }
  });

  it("gives ricochet two more bounces per level, then floor bounces and bonus damage", () => {
    expect(volley("ricochet", 1)[0].bounces).toBe(2);
    expect(volley("ricochet", 2)[0].bounces).toBe(4);
    expect(volley("ricochet", 3)[0].bounces).toBe(6);
    expect(volley("ricochet", 4)[0].bounces).toBe(8);

    expect(volley("ricochet", 2)[0].bounceGain).toBe(0);
    expect(volley("ricochet", 3)[0].bounceGain).toBe(1);
    expect(volley("ricochet", 3)[0].bounceFloor).toBe(false);
    expect(volley("ricochet", 4)[0].bounceFloor).toBe(true);
  });

  it("prices the ricochet's reach: half damage at first, whole only at the cap", () => {
    const plain = volley("normal", 1, 2)[0];
    expect(volley("ricochet", 1, 2)[0].damage).toBe(plain.damage! * 0.5);
    expect(volley("ricochet", MAX_SHOT_LEVEL.ricochet, 2)[0].damage).toBe(plain.damage);
    const dmg = [1, 2, 3, 4].map((l) => volley("ricochet", l, 2)[0].damage!);
    for (let i = 1; i < dmg.length; i++) expect(dmg[i]).toBeGreaterThan(dmg[i - 1]);
  });

  it("alternates the ricochet's launch angle each volley so it reaches both walls", () => {
    expect(volley("ricochet", 1, 1, 0)[0].angle).toBeGreaterThan(0);
    expect(volley("ricochet", 1, 1, 1)[0].angle).toBeLessThan(0);
  });

  it("deepens pierce per level and ends unlimited", () => {
    expect(volley("pierce", 1)[0].pierce).toBe(2);
    expect(volley("pierce", 2)[0].pierce).toBe(4);
    expect(volley("pierce", 3)[0].pierce).toBe(6);
    expect(volley("pierce", 4)[0].pierce).toBe(Infinity);

    expect(volley("pierce", 1)[0].pierceGain).toBe(0);
    expect(volley("pierce", 2)[0].pierceGain).toBeGreaterThan(0);
  });

  it("keeps the rotating ladder: spin, then growth, then faster growth", () => {
    const l1 = volley("rotating", 1, 2)[0];
    const l2 = volley("rotating", 2, 2)[0];
    const l3 = volley("rotating", 3, 2)[0];
    expect(l1.damage).toBe(3); // 1.5x the player's damage stat
    expect(l1.growth).toBe(1); // no growth yet
    expect(l2.growth).toBeGreaterThan(1);
    expect(l3.growth).toBeGreaterThan(l2.growth!);
    expect(l2.speed).toBeLessThan(l1.speed); // slows down so it grows in flight
    expect(l1.pierce).toBe(0); // stays non-piercing throughout
  });

  it("widens the scatter cone and keeps it short-ranged", () => {
    expect(volley("scatter", 1).length).toBe(3);
    expect(volley("scatter", 2).length).toBe(5);
    expect(volley("scatter", 4).length).toBe(7);
    for (const spec of volley("scatter", 1)) expect(spec.life).toBeGreaterThan(0);
    expect(volley("scatter", 2)[0].bounces).toBe(0);
    expect(volley("scatter", 3)[0].bounces).toBe(1);
    // The fan is symmetric around straight ahead.
    const fan = volley("scatter", 4).map((s) => s.angle);
    expect(fan[0]).toBeCloseTo(-fan[fan.length - 1]);
    expect(fan[(fan.length - 1) / 2]).toBeCloseTo(0);
  });

  it("makes homing splinters turn faster and multiply with level", () => {
    const turn = [1, 2, 3, 4].map((l) => volley("homing", l)[0].turnRate!);
    for (let i = 1; i < turn.length; i++) expect(turn[i]).toBeGreaterThan(turn[i - 1]);
    expect(volley("homing", 1).length).toBe(1);
    expect(volley("homing", 4).length).toBe(3);
    // Splinters expire, so a shot that loses its target can't circle forever.
    expect(volley("homing", 1)[0].life).toBeGreaterThan(0);
  });

  it("prices homing's tracking: sloppy and weak early, whole only at the cap", () => {
    const plain = volley("normal", 1, 2)[0];

    // Half a plain shot's damage at first, full damage only when maxed.
    expect(volley("homing", 1, 2)[0].damage).toBe(plain.damage! * 0.5);
    expect(volley("homing", MAX_SHOT_LEVEL.homing, 2)[0].damage).toBe(plain.damage);
    const dmg = [1, 2, 3, 4].map((l) => volley("homing", l, 2)[0].damage!);
    for (let i = 1; i < dmg.length; i++) expect(dmg[i]).toBeGreaterThan(dmg[i - 1]);

    // Slower than a plain shot, and the early levels genuinely steer badly:
    // under a radian per second, so a moving target can walk out of the arc.
    expect(volley("homing", 1)[0].speed).toBeLessThan(plain.speed);
    expect(volley("homing", 1)[0].turnRate! * 60).toBeLessThan(1);
    expect(volley("homing", 2)[0].turnRate! * 60).toBeLessThan(1.5);
    // Maxed, it tracks properly.
    expect(volley("homing", 4)[0].turnRate! * 60).toBeGreaterThan(3);
  });
});

/** Just enough Input for Player.update: idle stick, no fire. */
const idleInput = { axisX: 0, axisY: 0, focus: false, fire: false } as unknown as Input;

describe("shots in flight", () => {
  it("curves a homing splinter onto a target off to the side", () => {
    const bs = new BulletSystem();
    const spec = volley("homing", 4)[0];
    const b = bs.spawnPlayer(240, 600, -Math.PI / 2, spec.speed, spec);
    const target = { x: 420, y: 560, alive: true };

    expect(b.vx).toBeCloseTo(0, 5); // launched straight up (single splinter)
    for (let i = 0; i < 20; i++) bs.update([target], null);
    expect(b.vx).toBeGreaterThan(0); // now leaning toward the target

    // Speed is steering only — homing must never accelerate the shot.
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(spec.speed, 3);
  });

  it("expires scatter pellets so the cone stays short-ranged", () => {
    const bs = new BulletSystem();
    const spec = volley("scatter", 1)[0];
    bs.spawnPlayer(240, 600, -Math.PI / 2, spec.speed, spec);
    expect(bs.player.count).toBe(1);
    for (let i = 0; i < Math.ceil(spec.life! / DT) + 1; i++) bs.update();
    expect(bs.player.count).toBe(0);
  });

  it("adds damage to a ricochet each time it rebounds", () => {
    const bs = new BulletSystem();
    const spec = volley("ricochet", 3)[0]; // level 3: +1 damage per bounce
    // Fired flat at the left wall so the bounce happens quickly.
    const b = bs.spawnPlayer(20, 400, Math.PI, spec.speed, spec);
    const before = b.damage;
    for (let i = 0; i < 5; i++) bs.update();
    expect(b.vx).toBeGreaterThan(0); // turned around
    expect(b.damage).toBe(before + 1);
    expect(b.bounces).toBe(spec.bounces! - 1);
  });
});

describe("bouncing off a body", () => {
  /** A bullet at `x,y` travelling at `vx,vy`. */
  const shot = (x: number, y: number, vx: number, vy: number) => {
    const bs = new BulletSystem();
    const b = bs.spawnPlayer(0, 0, 0, 0, {});
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.r = 4;
    return b;
  };

  it("reflects a shot back off an enemy it flew into", () => {
    // Rising straight up into an enemy sitting above it.
    const b = shot(100, 120, 0, -600);
    bounceOffBody(b, 100, 100, 14);
    expect(b.vy).toBeGreaterThan(0); // sent back down
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(600, 3); // a bounce, not a boost
  });

  it("pushes the shot clear so one contact can't be counted twice", () => {
    const b = shot(100, 105, 0, -600);
    bounceOffBody(b, 100, 100, 14);
    expect(Math.hypot(b.x - 100, b.y - 100)).toBeGreaterThan(14 + b.r);
  });

  it("never flips a shot that is already leaving back into the body", () => {
    // Already travelling away from the enemy: only nudged clear.
    const b = shot(100, 120, 0, 600);
    bounceOffBody(b, 100, 100, 14);
    expect(b.vy).toBe(600);
  });
});

describe("orbit shield", () => {
  it("grows and speeds up per level, capped below the player's own size", () => {
    let prev = orbitShield(1);
    for (let lvl = 2; lvl <= MAX_SHOT_LEVEL.orbit; lvl++) {
      const cur = orbitShield(lvl);
      expect(cur.r).toBeGreaterThanOrEqual(prev.r);
      expect(cur.speed).toBeGreaterThanOrEqual(prev.speed);
      prev = cur;
    }
    // SHIP_R is 11 — the shield must never read as a second player square.
    expect(orbitShield(MAX_SHOT_LEVEL.orbit).r).toBeLessThan(11);
    expect(orbitShield(99).r).toBe(orbitShield(MAX_SHOT_LEVEL.orbit).r);
  });
});

describe("shot power-ups", () => {
  it("level a stream up to its cap, then open a fresh one", () => {
    for (const id of ["pierce", "bounce", "scatter", "homing"]) {
      const up = shotPowerUp(id);
      const type = up.shot as FiringShotType;
      const player = new Player();

      for (let i = 0; i < MAX_SHOT_LEVEL[type]; i++) up.apply(player);
      expect(player.streamCount(type)).toBe(1);
      expect(player.guns.find((g) => g.type === type)!.level).toBe(MAX_SHOT_LEVEL[type]);

      // The pick past the cap widens instead of deepening.
      up.apply(player);
      expect(player.streamCount(type)).toBe(2);
      expect(player.guns.filter((g) => g.type === type).map((g) => g.level)).toEqual([
        MAX_SHOT_LEVEL[type],
        1,
      ]);
    }
  });

  it("lets rotating upgrade the default stream before adding any gun", () => {
    const player = new Player();
    const rotating = shotPowerUp("rotating");
    expect(player.guns.length).toBe(1);

    rotating.apply(player);
    expect(player.guns.length).toBe(1); // still one stream — upgraded in place
    expect(player.guns[0].type).toBe("rotating");

    for (let i = 1; i < MAX_SHOT_LEVEL.rotating; i++) rotating.apply(player);
    expect(player.guns.length).toBe(1);
    rotating.apply(player);
    expect(player.guns.length).toBe(2);
  });

  it("stacks orbit shields the same way", () => {
    const player = new Player();
    const orbit = shotPowerUp("orbit");
    for (let i = 0; i < MAX_SHOT_LEVEL.orbit; i++) orbit.apply(player);
    expect(player.shields.length).toBe(1);
    orbit.apply(player);
    expect(player.shields.length).toBe(2);
    expect(player.shields[1].level).toBe(1);
    // Shields start out of phase so they cover different arcs.
    expect(player.shields[0].angle).not.toBe(player.shields[1].angle);
  });

  it("keeps shields circling the player as it moves", () => {
    const player = new Player();
    const bs = new BulletSystem();
    const orbit = shotPowerUp("orbit");
    orbit.apply(player);

    player.update(DT, idleInput, bs);
    const shield = player.shields[0];
    const dist = Math.hypot(shield.x - player.x, shield.y - player.y);
    expect(dist).toBeCloseTo(shield.radius, 5);

    // Drag the player sideways: the shield follows, still at orbit distance.
    player.x += 100;
    player.update(DT, idleInput, bs);
    expect(Math.hypot(shield.x - player.x, shield.y - player.y)).toBeCloseTo(shield.radius, 5);
    expect(shield.r).toBeLessThan(11); // never as big as the player square
  });

  it("describes every rung of every ladder, including the extra-stream pick", () => {
    for (const up of POWERUPS) {
      const player = new Player();
      const seen = new Set<string>();
      for (let pick = 0; pick <= (up.shot ? MAX_SHOT_LEVEL[up.shot] : 0); pick++) {
        const name = cardText(up.name, player);
        const desc = cardText(up.desc, player);
        expect(name.length).toBeGreaterThan(0);
        expect(desc.length).toBeGreaterThan(0);
        seen.add(`${name}|${desc}`);
        up.apply(player);
      }
      // Shot cards must never repeat a card across the ladder.
      if (up.shot) expect(seen.size).toBe(MAX_SHOT_LEVEL[up.shot] + 1);
    }
  });
});
