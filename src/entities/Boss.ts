import { WIDTH, type Shape } from "../config";
import type { RNG } from "../core/RNG";
import type { Renderer } from "../render/Renderer";
import { fireWeapon, makeWeapon, type Weapon } from "../content/patterns";
import type { BulletSystem } from "../systems/BulletSystem";
import type { Player } from "./Player";

export interface BossPhase {
  name: string;
  hp: number;
  /** One or more weapons fired simultaneously — a phase can combine patterns. */
  weapons: Partial<Weapon>[];
}

export interface BossConfig {
  name: string;
  shape: Shape;
  color: string;
  r: number;
  phases: BossPhase[];
  /** Seconds the boss hovers on arrival before the fight starts. */
  entrance?: number;
}

/** Result of applying damage, so the World can react to phase breaks / death. */
export type BossHitResult = "none" | "phase" | "dead";

const ENTRY_Y = 120;
const ENTRY_SPEED = 70;
const TRANSITION = 1.3; // seconds of no-fire flash between phases

/**
 * How long a boss holds station after descending, before anything starts. The
 * health bar is already up, so this is the beat where the player reads what
 * they're up against — the boss can't be hurt and can't hurt anyone yet, and
 * its entrance cutscene fires at the end of it (see `World.update`).
 */
const ENTRANCE_HOLD = 1.8;

export class Boss {
  x = WIDTH / 2;
  y = -40;
  readonly r: number;
  readonly shape: Shape;
  readonly color: string;
  readonly name: string;
  alive = true;
  private readonly phases: BossPhase[];
  private phaseIndex = 0;
  private phaseHp: number;
  private readonly totalMax: number;
  private weapons: Weapon[];
  private entering = true;
  private hold: number;
  private transition = 0;
  private t = 0;

  constructor(cfg: BossConfig) {
    this.name = cfg.name;
    this.shape = cfg.shape;
    this.color = cfg.color;
    this.r = cfg.r;
    this.phases = cfg.phases;
    this.phaseHp = cfg.phases[0].hp;
    this.totalMax = cfg.phases.reduce((s, p) => s + p.hp, 0);
    this.weapons = this.buildWeapons(cfg.phases[0]);
    this.hold = cfg.entrance ?? ENTRANCE_HOLD;
  }

  private buildWeapons(phase: BossPhase): Weapon[] {
    return phase.weapons.map((w) => makeWeapon(this.shape, this.color, w));
  }

  get phaseCount(): number {
    return this.phases.length;
  }
  get phaseNumber(): number {
    return this.phaseIndex + 1;
  }
  get transitioning(): boolean {
    return this.transition > 0;
  }
  /**
   * True while the boss is descending or holding station. It cannot be damaged
   * and cannot fire; the World waits for this to clear before bringing in
   * reinforcements and playing the entrance cutscene.
   */
  get arriving(): boolean {
    return this.entering || this.hold > 0;
  }
  /** Overall remaining health fraction across all phases. */
  get healthFrac(): number {
    let below = this.phaseHp;
    for (let i = this.phaseIndex + 1; i < this.phases.length; i++) below += this.phases[i].hp;
    return below / this.totalMax;
  }

  update(dt: number, player: Player, bs: BulletSystem, rng: RNG): void {
    this.t += dt;
    if (this.entering) {
      this.y = Math.min(ENTRY_Y, this.y + ENTRY_SPEED * dt);
      if (this.y >= ENTRY_Y) this.entering = false;
      return;
    }
    if (this.hold > 0) {
      // Landed but not yet in the fight: hold centre and just breathe, so the
      // player gets a clean look at what arrived (and at the health bar).
      this.hold -= dt;
      this.x = WIDTH / 2;
      this.y = ENTRY_Y + Math.sin(this.t * 1.3) * 4;
      return;
    }
    // Weave horizontally, bob vertically.
    this.x = WIDTH / 2 + Math.sin(this.t * 0.6) * (WIDTH * 0.32);
    this.y = ENTRY_Y + Math.sin(this.t * 1.3) * 10;

    if (this.transition > 0) {
      this.transition -= dt;
      return; // hold fire during the flash
    }
    for (const w of this.weapons) fireWeapon(w, dt, bs, this.x, this.y, player.x, player.y, rng);
  }

  /** Apply damage; advances phases and reports what happened. */
  damage(dmg: number): BossHitResult {
    // Untouchable while arriving and between phases.
    if (!this.alive || this.arriving || this.transition > 0) return "none";
    this.phaseHp -= dmg;
    if (this.phaseHp > 0) return "none";
    if (this.phaseIndex + 1 < this.phases.length) {
      this.phaseIndex += 1;
      this.phaseHp = this.phases[this.phaseIndex].hp;
      this.weapons = this.buildWeapons(this.phases[this.phaseIndex]);
      this.transition = TRANSITION;
      return "phase";
    }
    this.alive = false;
    return "dead";
  }

  draw(r: Renderer): void {
    const flash = this.transition > 0 && Math.floor(this.transition * 12) % 2 === 0;
    const color = flash ? "#ffffff" : this.color;
    r.glowShape(this.shape, this.x, this.y, this.r, this.t * 0.4, color, this.r * 0.9);
    r.strokeShape(this.shape, this.x, this.y, this.r, this.t * 0.4, "rgba(255,255,255,0.5)", 2);

    // A closing ring while it arrives, so "you can't hurt this yet" is visible
    // rather than something the player has to infer from bullets doing nothing.
    if (this.arriving) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
      r.ring(this.x, this.y, this.r + 12 + pulse * 10, "rgba(255,255,255,0.35)", 2);
    }
  }
}
