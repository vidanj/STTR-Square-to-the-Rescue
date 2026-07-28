import { COLORS, HEIGHT, WIDTH } from "../config";
import type { Input } from "../core/Input";
import { clamp } from "../core/Vec2";
import type { Renderer } from "../render/Renderer";
import type { BulletSystem } from "../systems/BulletSystem";

/** Mutable, upgradeable stats — global tweaks power-ups apply to every stream. */
export interface PlayerStats {
  fireInterval: number; // seconds between volleys (lower = faster)
  damage: number;
  moveSpeed: number; // px/s, unfocused
  focusSpeed: number; // px/s, focused (precise)
  bombs: number;
}

export function makePlayerStats(): PlayerStats {
  return {
    fireInterval: 0.13,
    damage: 1,
    moveSpeed: 275,
    focusSpeed: 125,
    bombs: 3,
  };
}

/**
 * A shot stream ("gun"). The player always keeps the default `normal` stream;
 * pierce/ricochet power-ups add another parallel stream fired from a
 * nearby-but-distinct origin (repeats allowed, so streams stack up). The
 * rotating power-up is different: it upgrades the default stream in place.
 */
export type ShotType = "normal" | "pierce" | "ricochet" | "rotating";

const SHOT_COLOR: Record<ShotType, string> = {
  normal: COLORS.playerBullet,
  pierce: COLORS.good,
  ricochet: "#ffffff", // white, so bouncing shots never read as enemy fire
  rotating: COLORS.player, // the upgraded main shot matches the hero square
};
const RICOCHET_BOUNCES = 4;
const RICOCHET_ANGLE = 0.2; // radians off vertical, so shots reach the side walls

// The Rotating path upgrades the DEFAULT stream in place, pick by pick:
//   pick 1 — the main shot becomes a spinning square hitting for 1.5× damage;
//   pick 2 — it slows down and starts growing exponentially as it flies;
//   pick 3+ — each pick makes the growth faster (the size cap is fixed).
// It stays non-piercing: the first enemy hit consumes it.
const ROT_DAMAGE_MULT = 1.5; // the spinning shot hits harder than normal
const ROT_SPEED = 340; // slower once growing, so the shot grows while travelling
const ROT_START_R = 5;
const ROT_MAX_R = 38; // fixed size cap
const ROT_GROWTH_BASE = 1.015; // radius multiplier per step at the first growth pick
const ROT_GROWTH_PER_LEVEL = 0.012; // each later pick makes the growth faster
const ROT_SPIN = 0.5; // fast visual rotation

const SHIP_R = 11;
const HURT_R = 3.5;
const INVULN = 3.0; // seconds of blinking i-frames after a hit
const START_LIVES = 3;
const BULLET_SPEED = 660;
const STREAM_GAP = 11; // px between adjacent streams' origins

export class Player {
  x = WIDTH / 2;
  y = HEIGHT - 90;
  readonly hurtR = HURT_R;
  lives = START_LIVES;
  invuln = 0;
  focus = false;
  private fireTimer = 0;
  private volley = 0;
  /** Rotating picks taken: 1 = spin + 1.5× damage, 2+ = growth (faster each). */
  private rotLevel = 0;
  readonly stats = makePlayerStats();
  /** The active shot streams, drawn/fired side by side. Index 0 is the default. */
  readonly guns: ShotType[] = ["normal"];

  get invulnerable(): boolean {
    return this.invuln > 0;
  }

  /** Back to the start position with timers cleared; stats/lives/guns persist. */
  resetForRoom(): void {
    this.x = WIDTH / 2;
    this.y = HEIGHT - 90;
    this.invuln = 0;
    this.fireTimer = 0;
    this.focus = false;
  }

  /**
   * Apply a shot power-up. Pierce/ricochet ADD a parallel stream (the default
   * `normal` stream is always kept). Rotating instead upgrades the default
   * stream in place — see the ROT_* constants for the pick-by-pick path.
   */
  addShotType(type: ShotType): void {
    if (type === "rotating") {
      this.rotLevel++;
      return;
    }
    this.guns.push(type);
  }

  update(dt: number, input: Input, bs: BulletSystem): void {
    this.focus = input.focus;

    let dx = input.axisX;
    let dy = input.axisY;
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    const speed = this.focus ? this.stats.focusSpeed : this.stats.moveSpeed;
    this.x = clamp(this.x + dx * speed * dt, SHIP_R, WIDTH - SHIP_R);
    this.y = clamp(this.y + dy * speed * dt, SHIP_R, HEIGHT - SHIP_R);

    this.fireTimer -= dt;
    if (input.fire && this.fireTimer <= 0) {
      this.fire(bs);
      this.fireTimer = this.stats.fireInterval;
    }

    if (this.invuln > 0) this.invuln -= dt;
  }

  /**
   * X-offset of stream `i` from the player's centre. The default stream (index
   * 0) always fires dead-centre; each added stream alternates sides — first
   * left, then right, then further left, and so on.
   */
  private streamOffset(i: number): number {
    if (i === 0) return 0;
    return (i % 2 === 1 ? -1 : 1) * Math.ceil(i / 2) * STREAM_GAP;
  }

  /** Fire one bullet per stream from origins clustered near centre. */
  private fire(bs: BulletSystem): void {
    const up = -Math.PI / 2;
    const s = this.stats;
    const n = this.guns.length;
    this.volley++;
    // Ricochet shots angle off vertical, alternating side each volley, so they
    // bounce off the side walls rather than only the ceiling.
    const bounceDir = this.volley % 2 === 0 ? 1 : -1;

    for (let i = 0; i < n; i++) {
      const type = this.guns[i];
      // The Rotating path applies to the default stream only (index 0):
      // level 1 spins and hits for 1.5×, level 2+ adds exponential growth.
      const rot = i === 0 ? this.rotLevel : 0;
      const growing = rot >= 2;
      const angle = type === "ricochet" ? up + RICOCHET_ANGLE * bounceDir : up;
      bs.spawnPlayer(this.x + this.streamOffset(i), this.y - SHIP_R, angle, growing ? ROT_SPEED : BULLET_SPEED, {
        shape: "square",
        color: rot > 0 ? SHOT_COLOR.rotating : SHOT_COLOR[type],
        r: rot > 0 ? ROT_START_R : 4,
        damage: rot > 0 ? Math.max(1, Math.round(s.damage * ROT_DAMAGE_MULT)) : s.damage,
        glow: 7,
        rotSpeed: rot > 0 ? ROT_SPIN : 0.25,
        pierce: type === "pierce",
        bounces: type === "ricochet" ? RICOCHET_BOUNCES : 0,
        growth: growing ? ROT_GROWTH_BASE + (rot - 2) * ROT_GROWTH_PER_LEVEL : 1,
        maxR: growing ? ROT_MAX_R : 0,
      });
    }
  }

  /** Register a hit. Returns true if it landed (not invulnerable / had lives). */
  hit(): boolean {
    if (this.invuln > 0) return false;
    this.lives -= 1;
    this.invuln = INVULN;
    return true;
  }

  draw(r: Renderer): void {
    // Blink for the whole invulnerability window to signal it.
    if (this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0) return;

    // Small muzzle pips show how many streams are active and their type colours.
    const n = this.guns.length;
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        const color = i === 0 && this.rotLevel > 0 ? SHOT_COLOR.rotating : SHOT_COLOR[this.guns[i]];
        r.fillShape("square", this.x + this.streamOffset(i), this.y - SHIP_R - 2, 2.5, 0, color);
      }
    }

    // The hero square — crisp fill + outline, no halo.
    r.fillShape("square", this.x, this.y, SHIP_R, 0, COLORS.player, "rgba(255,255,255,0.7)");

    // Focus mode reveals the true hitbox: a bright dot + faint ring.
    if (this.focus) {
      r.ring(this.x, this.y, SHIP_R + 3, "rgba(255,59,107,0.5)", 1);
      r.fillShape("circle", this.x, this.y, this.hurtR, 0, COLORS.hurtbox);
    } else {
      r.fillShape("circle", this.x, this.y, this.hurtR * 0.8, 0, COLORS.playerCore);
    }
  }
}
