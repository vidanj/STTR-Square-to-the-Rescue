import { DT, HEIGHT, WIDTH, type Shape } from "../config";
import { Pool } from "../core/Pool";
import { makeBullet, resetBullet, type Bullet } from "../entities/Bullet";
import type { Renderer } from "../render/Renderer";

/** How far off-screen a bullet travels before it is recycled. */
const CULL = 48;

export interface SpawnOpts {
  r?: number;
  damage?: number;
  color?: string;
  glow?: number;
  shape?: Shape;
  spin?: number;
  rotSpeed?: number;
  pierce?: boolean;
  bounces?: number;
  eats?: boolean;
  growth?: number;
  maxR?: number;
}

/**
 * Owns every bullet in the world, split into two pools so collision only ever
 * checks the relevant set: `enemy` bullets vs. the player hurtbox, `player`
 * bullets vs. enemies. Movement, curving and culling happen here each step.
 */
export class BulletSystem {
  readonly enemy = new Pool<Bullet>(makeBullet, resetBullet, 512);
  readonly player = new Pool<Bullet>(makeBullet, resetBullet, 128);

  spawnEnemy(x: number, y: number, angle: number, speed: number, o: SpawnOpts = {}): Bullet {
    return this.fill(this.enemy.spawn(), x, y, angle, speed, o, "circle", 4);
  }

  spawnPlayer(x: number, y: number, angle: number, speed: number, o: SpawnOpts = {}): Bullet {
    return this.fill(this.player.spawn(), x, y, angle, speed, o, "square", 4);
  }

  private fill(
    b: Bullet,
    x: number,
    y: number,
    angle: number,
    speed: number,
    o: SpawnOpts,
    defShape: Shape,
    defR: number,
  ): Bullet {
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.r = o.r ?? defR;
    b.damage = o.damage ?? 1;
    b.color = o.color ?? "#fff";
    b.glow = o.glow ?? b.r * 1.6;
    b.shape = o.shape ?? defShape;
    b.spin = o.spin ?? 0;
    b.rot = angle;
    b.rotSpeed = o.rotSpeed ?? 0;
    b.pierce = o.pierce ?? false;
    b.bounces = o.bounces ?? 0;
    b.eats = o.eats ?? false;
    b.growth = o.growth ?? 1;
    b.maxR = o.maxR ?? 0;
    return b;
  }

  update(): void {
    this.step(this.enemy);
    this.step(this.player);
  }

  private step(pool: Pool<Bullet>): void {
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      if (b.spin !== 0) {
        // Rotate the velocity vector for curving shots.
        const cos = Math.cos(b.spin);
        const sin = Math.sin(b.spin);
        const vx = b.vx * cos - b.vy * sin;
        b.vy = b.vx * sin + b.vy * cos;
        b.vx = vx;
      }
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      b.rot += b.rotSpeed;
      if (b.growth !== 1) b.r = Math.min(b.maxR, b.r * b.growth);

      // Ricochet upgrade: reflect off left/right/top walls (never the bottom),
      // spending one bounce per wall touched.
      if (b.bounces > 0) {
        if (b.x < b.r && b.vx < 0) {
          b.x = b.r;
          b.vx = -b.vx;
          b.bounces--;
        } else if (b.x > WIDTH - b.r && b.vx > 0) {
          b.x = WIDTH - b.r;
          b.vx = -b.vx;
          b.bounces--;
        }
        if (b.y < b.r && b.vy < 0) {
          b.y = b.r;
          b.vy = -b.vy;
          b.bounces--;
        }
      }

      if (b.x < -CULL || b.x > WIDTH + CULL || b.y < -CULL || b.y > HEIGHT + CULL) {
        pool.release(i);
      }
    }
  }

  /** Wipe all enemy bullets (bombs, boss phase transitions). */
  clearEnemy(): void {
    this.enemy.clear();
  }

  clearAll(): void {
    this.enemy.clear();
    this.player.clear();
  }

  draw(r: Renderer): void {
    // Crisp fills (no glow) so bullets are recognised by shape, not just colour.
    // A faint rim keeps them legible against the dark field.
    const rim = "rgba(255,255,255,0.4)";
    for (let i = 0; i < this.enemy.count; i++) {
      const b = this.enemy.items[i];
      r.fillShape(b.shape, b.x, b.y, b.r, b.rot, b.color, rim, 1);
    }
    for (let i = 0; i < this.player.count; i++) {
      const b = this.player.items[i];
      r.fillShape(b.shape, b.x, b.y, b.r, b.rot, b.color, rim, 1);
    }
  }
}
