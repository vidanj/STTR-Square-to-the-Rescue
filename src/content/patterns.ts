import type { Shape } from "../config";
import type { RNG } from "../core/RNG";
import { angleTo } from "../core/Vec2";
import type { BulletSystem } from "../systems/BulletSystem";

export type PatternId = "aimed" | "ring" | "spiral" | "arc" | "burst";

/**
 * A firing weapon: which pattern, how often, and the shape/visual of the shots.
 * The same struct drives both enemies and boss phases. `angle` is a running
 * rotation advanced by `angleStep` each volley, which is what turns a plain
 * ring into a spiral.
 */
export interface Weapon {
  pattern: PatternId;
  interval: number;
  timer: number;
  speed: number;
  count: number;
  /** Total fan spread in radians (aimed/arc/burst). */
  spread: number;
  angle: number;
  angleStep: number;
  shape: Shape;
  color: string;
  glow: number;
  r: number;
  damage: number;
}

export function makeWeapon(shape: Shape, color: string, p: Partial<Weapon> = {}): Weapon {
  return {
    pattern: "aimed",
    interval: 1.1,
    timer: 0.4,
    speed: 130,
    count: 1,
    spread: 0.5,
    angle: 0,
    angleStep: 0.3,
    shape,
    color,
    glow: 5,
    r: 5,
    damage: 1,
    ...p,
  };
}

type PatternFn = (bs: BulletSystem, x: number, y: number, tx: number, ty: number, w: Weapon, rng: RNG) => void;

/** Emit `count` shots fanned across `spread` radians centred on `center`. */
function fan(bs: BulletSystem, x: number, y: number, center: number, w: Weapon): void {
  const n = w.count;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = center - w.spread / 2 + w.spread * t;
    bs.spawnEnemy(x, y, a, w.speed, w);
  }
}

const PATTERNS: Record<PatternId, PatternFn> = {
  // Fan of shots aimed at the player.
  aimed: (bs, x, y, tx, ty, w) => fan(bs, x, y, angleTo(x, y, tx, ty), w),

  // Evenly spaced full circle, offset by the running angle.
  ring: (bs, x, y, _tx, _ty, w) => {
    for (let i = 0; i < w.count; i++) {
      const a = w.angle + (i / w.count) * Math.PI * 2;
      bs.spawnEnemy(x, y, a, w.speed, w);
    }
  },

  // Rotating arms — a ring whose angle advances every volley (see angleStep).
  spiral: (bs, x, y, _tx, _ty, w) => {
    for (let i = 0; i < w.count; i++) {
      const a = w.angle + (i / w.count) * Math.PI * 2;
      bs.spawnEnemy(x, y, a, w.speed, w);
    }
  },

  // Downward fan, ignores the player's position — a curtain to dodge through.
  arc: (bs, x, y, _tx, _ty, w) => fan(bs, x, y, Math.PI / 2, w),

  // Shotgun scatter roughly toward the player.
  burst: (bs, x, y, tx, ty, w, rng) => {
    const center = angleTo(x, y, tx, ty);
    for (let i = 0; i < w.count; i++) {
      const a = center + rng.range(-w.spread / 2, w.spread / 2);
      bs.spawnEnemy(x, y, a, w.speed * rng.range(0.8, 1.15), w);
    }
  },
};

/**
 * Advance a weapon's cooldown and fire a volley when it elapses. Returns true
 * on the frames it actually fired (useful for muzzle sfx/juice).
 */
export function fireWeapon(
  w: Weapon,
  dt: number,
  bs: BulletSystem,
  x: number,
  y: number,
  tx: number,
  ty: number,
  rng: RNG,
): boolean {
  w.timer -= dt;
  if (w.timer > 0) return false;
  w.timer += w.interval;
  PATTERNS[w.pattern](bs, x, y, tx, ty, w, rng);
  w.angle += w.angleStep;
  return true;
}
