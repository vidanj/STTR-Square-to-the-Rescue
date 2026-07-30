import { COLORS } from "../config";
import type { SpawnOpts } from "../systems/BulletSystem";

/**
 * Every kind of gun the player can own. All of them fire squares (the player's
 * shape never changes) — what differs is how the squares behave.
 *
 * `orbit` is the odd one out: it is not a firing stream at all but a shield
 * square that circles the player, so it has no entry in SHOT_SPECS.
 */
export type ShotType = "normal" | "pierce" | "ricochet" | "rotating" | "scatter" | "homing" | "orbit";
export type FiringShotType = Exclude<ShotType, "orbit">;

/**
 * Per-stream colours. Shape already says "this is yours" — colour just tells
 * the streams apart from each other, so these stay clear of the enemy palette.
 * Nothing here glows: player shots are drawn as crisp fills so a full screen
 * stays readable.
 */
export const SHOT_COLOR: Record<ShotType, string> = {
  normal: COLORS.playerBullet,
  pierce: COLORS.good,
  ricochet: "#ffffff", // white, so bouncing shots never read as enemy fire
  rotating: COLORS.player, // the upgraded main shot matches the hero square
  scatter: "#c8ff6c",
  homing: COLORS.accent,
  orbit: "#98a2b8", // plain grey: the shield is hardware, not firepower
};

/**
 * How far each ladder goes. Reaching the cap does NOT retire the upgrade: the
 * next pick of that type opens a fresh level-1 stream (or a second shield),
 * so any shot can be invested in indefinitely — see `Player.addShotType`.
 */
export const MAX_SHOT_LEVEL: Record<ShotType, number> = {
  normal: 1,
  pierce: 4,
  ricochet: 4,
  rotating: 4,
  scatter: 4,
  homing: 4,
  orbit: 6,
};

/** Muzzle speed of a plain shot; several ladders tune away from this. */
const BULLET_SPEED = 660;

// --- Ricochet -------------------------------------------------------------
// Shots rebound off walls AND off enemies, and an enemy rebound lands a hit on
// the way through — one shot can work a whole cluster. That's a lot of value
// per trigger pull, so like homing it is priced: half damage at first, whole
// damage only at the cap.
// L1 two bounces · L2 four · L3 six + each bounce adds damage · L4 eight and
// the shots start rebounding off the floor too (full-arena pinball).
const RICOCHET_ANGLE = 0.2; // radians off vertical, so shots reach the side walls
/** Damage as a fraction of a plain shot, indexed by level - 1. */
const RICOCHET_DAMAGE = [0.5, 0.65, 0.8, 1];

// --- Rotating -------------------------------------------------------------
// Upgrades the DEFAULT stream in place: L1 spins for 1.5x damage; L2 slows down
// and starts growing as it flies; L3/L4 grow faster. Non-piercing throughout.
const ROT_DAMAGE_MULT = 1.5;
const ROT_SPEED = 340; // slower once growing, so the shot grows while travelling
const ROT_START_R = 5;
const ROT_MAX_R = 38; // fixed size cap
const ROT_GROWTH_BASE = 1.015; // radius multiplier per step at the first growth pick
const ROT_GROWTH_PER_LEVEL = 0.012; // each later pick makes the growth faster
const ROT_SPIN = 0.5; // fast visual rotation

// --- Homing ---------------------------------------------------------------
// Tracking is strong, so it is priced accordingly: slow shots, weak shots, and
// early levels that genuinely miss. Indexed by level - 1.
/** Radians per step a splinter may turn. L1/L2 are loose on purpose. */
const HOMING_TURN = [0.011, 0.019, 0.036, 0.055];
/** Damage as a fraction of a plain shot — half at first, whole only at the cap. */
const HOMING_DAMAGE = [0.5, 0.65, 0.8, 1];
/** Slower than every other stream: you trade muzzle speed for the tracking. */
const HOMING_SPEED = 300;
/** Seconds before a splinter gives up (a lost one would otherwise loiter). */
const HOMING_LIFE = 3.0;

/**
 * One bullet to spawn, expressed as spawn options plus where to aim it.
 * `angle` is an offset from straight up, in radians.
 */
export interface ShotSpec extends SpawnOpts {
  angle: number;
  speed: number;
}

/** What a stream needs to know about its owner to build this volley. */
export interface ShotContext {
  /** This stream's upgrade level (1-based). */
  level: number;
  /** The player's global damage stat. */
  damage: number;
  /** Volley counter, so a stream can alternate between shots. */
  volley: number;
}

/**
 * Builds one stream's volley. Writes into the caller's `out` buffer and returns
 * how many entries it filled — nothing is allocated, since this runs on the
 * spawn path (see design rule 4).
 */
export type ShotBuilder = (ctx: ShotContext, out: ShotSpec[]) => number;

/** Upper bound on bullets a single stream emits per volley (scatter at cap). */
export const MAX_SHOTS_PER_VOLLEY = 8;

function makeSpec(): ShotSpec {
  return {
    angle: 0,
    speed: BULLET_SPEED,
    shape: "square",
    r: 4,
    damage: 1,
    color: SHOT_COLOR.normal,
    spin: 0,
    rotSpeed: 0.25,
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

/** Reusable volley buffer — one per module, refilled on every shot. */
export const SHOT_BUFFER: ShotSpec[] = Array.from({ length: MAX_SHOTS_PER_VOLLEY }, makeSpec);

/** Reset slot `i` of `out` to plain-shot defaults and hand it back for filling. */
function slot(out: ShotSpec[], i: number): ShotSpec {
  const s = out[i];
  s.angle = 0;
  s.speed = BULLET_SPEED;
  s.shape = "square";
  s.r = 4;
  s.damage = 1;
  s.color = SHOT_COLOR.normal;
  s.spin = 0;
  s.rotSpeed = 0.25;
  s.pierce = 0;
  s.pierceGain = 0;
  s.bounces = 0;
  s.bounceGain = 0;
  s.bounceFloor = false;
  s.turnRate = 0;
  s.life = 0;
  s.eats = false;
  s.growth = 1;
  s.maxR = 0;
  return s;
}

/**
 * Spread `count` bullets evenly across a cone of half-width `half` radians.
 * Returns the angle for index `i` (a single bullet fires dead ahead).
 */
function fanAngle(i: number, count: number, half: number): number {
  if (count <= 1) return 0;
  return ((i / (count - 1)) * 2 - 1) * half;
}

/**
 * The ladders. Each builder is a pure function of level + stats, which is what
 * keeps balancing in content and makes the whole thing unit-testable.
 */
export const SHOT_SPECS: Record<FiringShotType, ShotBuilder> = {
  normal: (ctx, out) => {
    const s = slot(out, 0);
    s.damage = ctx.damage;
    return 1;
  },

  // Pierce: more pass-throughs per level, and from L2 the shot gets stronger
  // with every enemy it drills, so lining enemies up is the skill hook.
  pierce: (ctx, out) => {
    const lvl = ctx.level;
    const lance = lvl >= 3; // longer, faster round
    const s = slot(out, 0);
    s.color = SHOT_COLOR.pierce;
    s.speed = lance ? 760 : BULLET_SPEED;
    s.r = lance ? 5.5 : 4;
    s.damage = ctx.damage + Math.max(0, lvl - 3);
    s.pierce = lvl >= 4 ? Infinity : 2 * lvl;
    s.pierceGain = lvl >= 2 ? 0.5 : 0;
    return 1;
  },

  // Ricochet: bounces are the currency. Shots leave at an angle (alternating
  // sides each volley) so they actually reach the side walls.
  ricochet: (ctx, out) => {
    const lvl = ctx.level;
    const s = slot(out, 0);
    s.color = SHOT_COLOR.ricochet;
    s.angle = RICOCHET_ANGLE * (ctx.volley % 2 === 0 ? 1 : -1);
    s.damage = ctx.damage * RICOCHET_DAMAGE[Math.min(lvl, RICOCHET_DAMAGE.length) - 1];
    s.bounces = 2 * lvl;
    s.bounceGain = lvl >= 3 ? 1 : 0;
    s.bounceFloor = lvl >= 4;
    return 1;
  },

  // Rotating: the main shot itself, upgraded in place.
  rotating: (ctx, out) => {
    const lvl = ctx.level;
    const growing = lvl >= 2;
    const s = slot(out, 0);
    s.color = SHOT_COLOR.rotating;
    s.speed = growing ? ROT_SPEED : BULLET_SPEED;
    s.r = ROT_START_R;
    s.damage = Math.max(1, Math.round(ctx.damage * ROT_DAMAGE_MULT));
    s.rotSpeed = ROT_SPIN;
    s.growth = growing ? ROT_GROWTH_BASE + (lvl - 2) * ROT_GROWTH_PER_LEVEL : 1;
    s.maxR = growing ? ROT_MAX_R : 0;
    return 1;
  },

  // Scatter: a close-range cone. The pellets expire on a timer, so the trade is
  // heavy damage up close for nothing at all at range.
  scatter: (ctx, out) => {
    const lvl = ctx.level;
    const count = lvl >= 4 ? 7 : lvl >= 2 ? 5 : 3;
    const half = lvl >= 4 ? 0.3 : lvl >= 2 ? 0.34 : 0.24;
    for (let i = 0; i < count; i++) {
      const s = slot(out, i);
      s.color = SHOT_COLOR.scatter;
      s.angle = fanAngle(i, count, half);
      s.speed = 520;
      s.r = 3;
      s.rotSpeed = 0.4;
      s.damage = ctx.damage;
      s.life = 0.4 + 0.04 * lvl; // the range limit
      s.bounces = lvl >= 3 ? 1 : 0;
    }
    return count;
  },

  // Homing: slow splinters that curve into the nearest target. Tracking that
  // good has to be paid for, so the early levels are deliberately sloppy — a
  // level-1 splinter wanders toward a target and often misses a moving one —
  // and every splinter hits for less than a plain shot until the ladder is
  // maxed. What levels buy is a sharper turn, then more splinters, then full
  // damage: the shot only becomes reliable once it's fully invested in.
  homing: (ctx, out) => {
    const lvl = ctx.level;
    const i0 = Math.min(lvl, HOMING_TURN.length) - 1;
    const count = Math.min(3, 1 + Math.floor(lvl / 2));
    for (let i = 0; i < count; i++) {
      const s = slot(out, i);
      s.color = SHOT_COLOR.homing;
      s.angle = fanAngle(i, count, 0.35); // fan out, then curve back in
      s.speed = HOMING_SPEED;
      s.r = 3.5;
      s.rotSpeed = 0.35;
      s.damage = ctx.damage * HOMING_DAMAGE[i0];
      s.turnRate = HOMING_TURN[i0];
      s.life = HOMING_LIFE; // so a splinter with no target eventually gives up
    }
    return count;
  },
};

// --- Orbit Shield ---------------------------------------------------------

/** A shield square circling the player: how big, how far out, how fast. */
export interface OrbitShield {
  /** Half-size of the square. Always kept well under the player's own 11px. */
  r: number;
  /** Orbit radius around the player. */
  radius: number;
  /** Angular speed in radians per second. */
  speed: number;
}

const ORBIT_BASE_R = 4.5;
const ORBIT_R_PER_LEVEL = 0.8;
const ORBIT_MAX_R = 8.5; // never as big as the player square (SHIP_R = 11)
const ORBIT_BASE_SPEED = 2.4;
const ORBIT_SPEED_PER_LEVEL = 0.55;
const ORBIT_MAX_SPEED = 5.2;
const ORBIT_RADIUS = 34; // fixed, so the shield stays a predictable cover

/**
 * Stats for a shield at `level`. It eats enemy bullets it touches; upgrades
 * make it slightly bigger and noticeably faster around the loop. Once a shield
 * hits MAX_SHOT_LEVEL.orbit, the next pick adds another one instead.
 */
export function orbitShield(level: number): OrbitShield {
  const lvl = Math.max(1, level);
  return {
    r: Math.min(ORBIT_MAX_R, ORBIT_BASE_R + ORBIT_R_PER_LEVEL * (lvl - 1)),
    radius: ORBIT_RADIUS,
    speed: Math.min(ORBIT_MAX_SPEED, ORBIT_BASE_SPEED + ORBIT_SPEED_PER_LEVEL * (lvl - 1)),
  };
}
