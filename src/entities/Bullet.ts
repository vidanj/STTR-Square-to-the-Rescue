import type { Shape } from "../config";

/**
 * A single projectile. Plain mutable fields (no Vec2 instances) so pools can
 * recycle thousands of these without allocating. Shared by player and enemy
 * bullets; ownership is tracked by which pool holds it (see BulletSystem).
 *
 * `shape` copies whoever fired it: the player's shots are squares, an enemy's
 * shots match that enemy — the core visual language of the game.
 *
 * Bullets are drawn as crisp fills with no glow halo, deliberately — glow on a
 * screen full of shots destroys readability. Don't add a glow field back.
 */
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  color: string;
  shape: Shape;
  /** Current visual rotation (radians). */
  rot: number;
  /** Visual spin applied each step, purely cosmetic. */
  rotSpeed: number;
  /** Radians per step to rotate the velocity vector (curving shots). */
  spin: number;
  /** Player upgrade: enemies this shot can pass through before being consumed. */
  pierce: number;
  /** Damage gained each time the shot pierces an enemy. */
  pierceGain: number;
  /** Player upgrade: wall bounces remaining before the shot is culled. */
  bounces: number;
  /** Damage gained on each wall bounce. */
  bounceGain: number;
  /** Whether bounces also happen off the bottom wall (normally they don't). */
  bounceFloor: boolean;
  /** Radians per step the velocity may turn toward the nearest target (0 = none). */
  turnRate: number;
  /** Seconds left before the shot expires (0 = lives until culled off-screen). */
  life: number;
  /** Player "eating" shot: destroys enemy bullets it overlaps. */
  eats: boolean;
  /** Radius growth multiplier per step (1 = no growth). */
  growth: number;
  /** Radius cap when growing. */
  maxR: number;
}

export function makeBullet(): Bullet {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 3,
    damage: 1,
    color: "#fff",
    shape: "circle",
    rot: 0,
    rotSpeed: 0,
    spin: 0,
    pierce: 0,
    pierceGain: 0,
    bounces: 0,
    bounceGain: 0,
    bounceFloor: false,
    turnRate: 0,
    life: 0,
    eats: false,
    growth: 1,
    maxR: 0,
  };
}

export function resetBullet(b: Bullet): void {
  b.x = 0;
  b.y = 0;
  b.vx = 0;
  b.vy = 0;
  b.r = 3;
  b.damage = 1;
  b.color = "#fff";
  b.shape = "circle";
  b.rot = 0;
  b.rotSpeed = 0;
  b.spin = 0;
  b.pierce = 0;
  b.pierceGain = 0;
  b.bounces = 0;
  b.bounceGain = 0;
  b.bounceFloor = false;
  b.turnRate = 0;
  b.life = 0;
  b.eats = false;
  b.growth = 1;
  b.maxR = 0;
}
