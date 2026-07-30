import { COLORS, HEIGHT, WIDTH } from "../config";
import {
  MAX_SHOT_LEVEL,
  SHOT_BUFFER,
  SHOT_COLOR,
  SHOT_SPECS,
  orbitShield,
  type FiringShotType,
  type ShotContext,
  type ShotType,
} from "../content/shots";
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
 * One shot stream ("gun") the player owns, with its own upgrade level. Levels
 * and behaviour are content (`src/content/shots.ts`); this file only fires them.
 */
export interface Gun {
  type: FiringShotType;
  level: number;
}

/**
 * A shield square circling the player, eating enemy bullets it touches. Levels
 * make it bigger and faster; `x`/`y` are refreshed every step for collision.
 */
export interface Shield {
  level: number;
  angle: number;
  speed: number;
  radius: number;
  r: number;
  x: number;
  y: number;
}

/** Radians between the starting phases of successive shields. */
const SHIELD_PHASE = (Math.PI * 2) / 3;

const SHIP_R = 11;
const HURT_R = 3.5;
const INVULN = 3.0; // seconds of blinking i-frames after a hit
const START_LIVES = 3;
const STREAM_GAP = 11; // px between adjacent streams' origins

/**
 * Hard ceilings on the two survival resources. Neither can be raised by an
 * upgrade pick any more — the only source is Bar's shop (see
 * `src/content/shop.ts`), and these caps are what keep that money sink finite.
 */
export const MAX_LIVES = 5;
export const MAX_BOMBS = 6;

export class Player {
  x = WIDTH / 2;
  y = HEIGHT - 90;
  readonly hurtR = HURT_R;
  lives = START_LIVES;
  invuln = 0;
  focus = false;
  private fireTimer = 0;
  private volley = 0;
  readonly stats = makePlayerStats();
  /** The active shot streams, fired side by side. Index 0 is the default. */
  readonly guns: Gun[] = [{ type: "normal", level: 1 }];
  /** Orbiting shield squares (empty until the Orbit Shield power-up is taken). */
  readonly shields: Shield[] = [];
  /** Reused so building a volley allocates nothing (design rule 4). */
  private readonly shotCtx: ShotContext = { level: 1, damage: 1, volley: 0 };

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
   * Apply a shot power-up. A pick levels up the first stream of that type that
   * still has room (`MAX_SHOT_LEVEL`); when every stream of the type is maxed
   * — or there is none yet — it opens a fresh level-1 stream instead. So a
   * type can always be invested in: deepen first, widen once capped.
   *
   * Rotating is the one exception on its first pick: it upgrades the default
   * `normal` stream in place rather than adding a second gun.
   */
  addShotType(type: ShotType): void {
    if (type === "orbit") {
      const shield = this.shields.find((s) => s.level < MAX_SHOT_LEVEL.orbit);
      if (shield) this.setShieldLevel(shield, shield.level + 1);
      else this.addShield();
      return;
    }

    const gun = this.guns.find((g) => g.type === type && g.level < MAX_SHOT_LEVEL[type]);
    if (gun) {
      gun.level += 1;
      return;
    }
    if (type === "rotating" && this.guns[0].type === "normal") {
      this.guns[0].type = "rotating";
      this.guns[0].level = 1;
      return;
    }
    this.guns.push({ type, level: 1 });
  }

  /** The level the next pick of `type` would produce (1 = it opens a stream). */
  nextLevel(type: ShotType): number {
    if (type === "orbit") {
      const shield = this.shields.find((s) => s.level < MAX_SHOT_LEVEL.orbit);
      return shield ? shield.level + 1 : 1;
    }
    const gun = this.guns.find((g) => g.type === type && g.level < MAX_SHOT_LEVEL[type]);
    return gun ? gun.level + 1 : 1;
  }

  /** How many streams (or shields) of `type` the player already owns. */
  streamCount(type: ShotType): number {
    if (type === "orbit") return this.shields.length;
    let n = 0;
    for (const g of this.guns) if (g.type === type) n++;
    return n;
  }

  private addShield(): void {
    const shield: Shield = {
      level: 0,
      angle: this.shields.length * SHIELD_PHASE,
      speed: 0,
      radius: 0,
      r: 0,
      x: this.x,
      y: this.y,
    };
    this.setShieldLevel(shield, 1);
    this.shields.push(shield);
  }

  private setShieldLevel(shield: Shield, level: number): void {
    const cfg = orbitShield(level);
    shield.level = level;
    shield.r = cfg.r;
    shield.radius = cfg.radius;
    shield.speed = cfg.speed;
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

    // Shields keep circling wherever the player goes; each spins at its own
    // level's speed, so a newer one drifts out of phase with an older one.
    for (const s of this.shields) {
      s.angle += s.speed * dt;
      s.x = this.x + Math.cos(s.angle) * s.radius;
      s.y = this.y + Math.sin(s.angle) * s.radius;
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

  /**
   * Fire every stream from origins clustered near centre. Each stream asks its
   * content builder for this volley's bullets (a fan may be several), so all
   * the balance lives in `src/content/shots.ts` and none of it lives here.
   */
  private fire(bs: BulletSystem): void {
    const up = -Math.PI / 2;
    this.volley++;
    const ctx = this.shotCtx;
    ctx.damage = this.stats.damage;
    ctx.volley = this.volley;

    for (let i = 0; i < this.guns.length; i++) {
      const gun = this.guns[i];
      ctx.level = gun.level;
      const count = SHOT_SPECS[gun.type](ctx, SHOT_BUFFER);
      const x = this.x + this.streamOffset(i);
      const y = this.y - SHIP_R;
      for (let k = 0; k < count; k++) {
        const spec = SHOT_BUFFER[k];
        bs.spawnPlayer(x, y, up + spec.angle, spec.speed, spec);
      }
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
    // Shields orbit outside the blink, so cover stays readable during i-frames.
    // Crisp grey fill, no halo — it's a plate of hardware, not a weapon.
    for (const s of this.shields) {
      r.fillShape("square", s.x, s.y, s.r, s.angle, SHOT_COLOR.orbit, "rgba(255,255,255,0.5)", 1.5);
    }

    // Blink for the whole invulnerability window to signal it.
    if (this.invuln > 0 && Math.floor(this.invuln * 10) % 2 === 0) return;

    // Small muzzle pips show how many streams are active and their type colours.
    const n = this.guns.length;
    if (n > 1) {
      for (let i = 0; i < n; i++) {
        r.fillShape("square", this.x + this.streamOffset(i), this.y - SHIP_R - 2, 2.5, 0, SHOT_COLOR[this.guns[i].type]);
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
