import { COLORS, WIDTH } from "../config";
import type { World } from "../core/World";
import type { Renderer } from "../render/Renderer";
import type { Enemy } from "./Enemy";

const START_HALF = 6; // half-side at launch (a normal-ish bullet)
const MAX_HALF = WIDTH * 0.25; // grows to half the screen width (side = WIDTH/2)
const GROWTH = 1.05; // exponential factor per fixed step
const SPEED = 210; // upward px/s
const ENEMY_DAMAGE = 6; // one-time damage to each shape it engulfs
const BOSS_DAMAGE = 6;

/**
 * The player's bomb: a square fired upward that starts small and grows
 * exponentially as it advances, sweeping the screen. It erases any enemy
 * bullet inside it and deals a one-time hit to enemies/boss it engulfs.
 *
 * Because it needs distance to grow, firing from afar clears far more than a
 * point-blank shot — that trade-off is the skill hook.
 */
export class BombSquare {
  half = START_HALF;
  alive = true;
  private readonly hitEnemies = new Set<Enemy>();
  private bossHit = false;

  constructor(
    public x: number,
    public y: number,
  ) {}

  update(dt: number, world: World): void {
    this.y -= SPEED * dt;
    this.half = Math.min(MAX_HALF, this.half * GROWTH);

    // Erase enemy bullets caught inside the square (AABB).
    const pool = world.bullets.enemy;
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      if (Math.abs(b.x - this.x) <= this.half && Math.abs(b.y - this.y) <= this.half) {
        pool.release(i);
      }
    }

    // One-time damage to engulfed enemies.
    for (const e of world.enemies) {
      if (!e.alive || this.hitEnemies.has(e)) continue;
      if (Math.abs(e.x - this.x) <= this.half + e.r && Math.abs(e.y - this.y) <= this.half + e.r) {
        this.hitEnemies.add(e);
        e.hp -= ENEMY_DAMAGE;
        world.particles.burst(e.x, e.y, e.color, 4, 120, 0.6);
        if (e.hp <= 0) {
          e.alive = false;
          world.onEnemyKilled(e);
        }
      }
    }

    // One-time chip damage to the boss (the bomb is mainly defensive here).
    const boss = world.boss;
    if (
      boss &&
      boss.alive &&
      !this.bossHit &&
      Math.abs(boss.x - this.x) <= this.half + boss.r &&
      Math.abs(boss.y - this.y) <= this.half + boss.r
    ) {
      this.bossHit = true;
      const result = boss.damage(BOSS_DAMAGE);
      if (result === "phase") world.onBossPhase();
      else if (result === "dead") world.onBossDead();
    }

    if (this.y + this.half < 0) this.alive = false;
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    const side = this.half * 2;
    // Translucent fill so the player still sees through it, bright square border.
    ctx.fillStyle = "rgba(108,240,255,0.14)";
    ctx.fillRect(this.x - this.half, this.y - this.half, side, side);
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x - this.half, this.y - this.half, side, side);
  }
}
