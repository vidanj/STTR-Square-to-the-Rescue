import type { Shape } from "../config";
import type { RNG } from "../core/RNG";
import type { Renderer } from "../render/Renderer";
import { fireWeapon, makeWeapon, type Weapon } from "../content/patterns";
import type { BulletSystem } from "../systems/BulletSystem";
import type { Player } from "./Player";

/** Data describing one enemy in a wave (see content/stages/). */
export interface EnemySpec {
  x: number;
  targetY: number;
  hp: number;
  shape: Shape;
  color: string;
  weapon?: Partial<Weapon>;
  r?: number;
  score?: number;
  entrySpeed?: number;
  /** Horizontal sway amplitude (px) once hovering. */
  sway?: number;
}

export class Enemy {
  x: number;
  y: number;
  readonly r: number;
  readonly shape: Shape;
  readonly color: string;
  readonly maxHp: number;
  hp: number;
  readonly score: number;
  alive = true;
  private readonly baseX: number;
  private readonly targetY: number;
  private readonly entrySpeed: number;
  private readonly sway: number;
  private readonly weapon: Weapon;
  private t = 0;

  constructor(spec: EnemySpec) {
    this.baseX = spec.x;
    this.x = spec.x;
    this.r = spec.r ?? 14;
    this.y = -this.r;
    this.shape = spec.shape;
    this.color = spec.color;
    this.maxHp = spec.hp;
    this.hp = spec.hp;
    this.score = spec.score ?? 100;
    this.targetY = spec.targetY;
    this.entrySpeed = spec.entrySpeed ?? 90;
    this.sway = spec.sway ?? 0;
    this.weapon = makeWeapon(spec.shape, spec.color, spec.weapon);
  }

  update(dt: number, player: Player, bs: BulletSystem, rng: RNG): void {
    this.t += dt;
    if (this.y < this.targetY) {
      this.y = Math.min(this.targetY, this.y + this.entrySpeed * dt);
    } else {
      // Hover: gentle bob + optional horizontal sway.
      this.x = this.baseX + Math.sin(this.t * 1.4) * this.sway;
      this.y = this.targetY + Math.sin(this.t * 2.2) * 4;
      fireWeapon(this.weapon, dt, bs, this.x, this.y, player.x, player.y, rng);
    }
  }

  draw(r: Renderer): void {
    // Crisp fill (no glow) so each shape's silhouette stays readable; the
    // outline brightens as the enemy takes damage.
    const frac = Math.max(0, this.hp / this.maxHp);
    const outline = `rgba(255,255,255,${(0.3 + 0.5 * (1 - frac)).toFixed(2)})`;
    r.fillShape(this.shape, this.x, this.y, this.r, this.t * 0.6, this.color, outline, 1.5);
  }
}
