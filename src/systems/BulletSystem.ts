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
  shape?: Shape;
  spin?: number;
  rotSpeed?: number;
  pierce?: number;
  pierceGain?: number;
  bounces?: number;
  bounceGain?: number;
  bounceFloor?: boolean;
  turnRate?: number;
  life?: number;
  eats?: boolean;
  growth?: number;
  maxR?: number;
}

/**
 * Anything a homing shot can steer toward. Structural on purpose so the bullet
 * layer never has to know about Enemy/Boss.
 */
export interface Target {
  x: number;
  y: number;
  alive: boolean;
}

/** Shared empty target list, so the enemy pool's step allocates nothing. */
const NO_TARGETS: readonly Target[] = [];

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
    b.shape = o.shape ?? defShape;
    b.spin = o.spin ?? 0;
    b.rot = angle;
    b.rotSpeed = o.rotSpeed ?? 0;
    b.pierce = o.pierce ?? 0;
    b.pierceGain = o.pierceGain ?? 0;
    b.bounces = o.bounces ?? 0;
    b.bounceGain = o.bounceGain ?? 0;
    b.bounceFloor = o.bounceFloor ?? false;
    b.turnRate = o.turnRate ?? 0;
    b.life = o.life ?? 0;
    b.eats = o.eats ?? false;
    b.growth = o.growth ?? 1;
    b.maxR = o.maxR ?? 0;
    return b;
  }

  /**
   * Advance every bullet one step. `targets` are what homing player shots steer
   * toward — enemy bullets never home, so their pool is stepped without any.
   */
  update(targets: readonly Target[] = NO_TARGETS, boss: Target | null = null): void {
    this.step(this.enemy, NO_TARGETS, null);
    this.step(this.player, targets, boss);
  }

  private step(pool: Pool<Bullet>, targets: readonly Target[], boss: Target | null): void {
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];

      if (b.life > 0) {
        b.life -= DT;
        if (b.life <= 0) {
          pool.release(i);
          continue;
        }
      }

      if (b.turnRate > 0) this.home(b, targets, boss);

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

      // Ricochet upgrade: reflect off the left/right/top walls — and, once the
      // upgrade is deep enough (`bounceFloor`), off the bottom too. One bounce
      // is spent per step, and `bounceGain` makes each rebound hit harder.
      if (b.bounces > 0) {
        let bounced = false;
        if (b.x < b.r && b.vx < 0) {
          b.x = b.r;
          b.vx = -b.vx;
          bounced = true;
        } else if (b.x > WIDTH - b.r && b.vx > 0) {
          b.x = WIDTH - b.r;
          b.vx = -b.vx;
          bounced = true;
        }
        if (b.y < b.r && b.vy < 0) {
          b.y = b.r;
          b.vy = -b.vy;
          bounced = true;
        } else if (b.bounceFloor && b.y > HEIGHT - b.r && b.vy > 0) {
          b.y = HEIGHT - b.r;
          b.vy = -b.vy;
          bounced = true;
        }
        if (bounced) {
          b.bounces--;
          b.damage += b.bounceGain;
        }
      }

      if (b.x < -CULL || b.x > WIDTH + CULL || b.y < -CULL || b.y > HEIGHT + CULL) {
        pool.release(i);
      }
    }
  }

  /**
   * Steer a homing shot toward the nearest live target, turning at most
   * `turnRate` radians this step so splinters arc instead of snapping on.
   * Speed is preserved; the search allocates nothing.
   */
  private home(b: Bullet, targets: readonly Target[], boss: Target | null): void {
    let best: Target | null = null;
    let bestD2 = Infinity;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t.alive) continue;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = t;
      }
    }
    if (boss && boss.alive) {
      const dx = boss.x - b.x;
      const dy = boss.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) best = boss;
    }
    if (!best) return;

    const desired = Math.atan2(best.y - b.y, best.x - b.x);
    const current = Math.atan2(b.vy, b.vx);
    // Shortest signed angle to the target, wrapped into [-PI, PI].
    let delta = desired - current;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    else if (delta < -Math.PI) delta += 2 * Math.PI;

    const turn = Math.max(-b.turnRate, Math.min(b.turnRate, delta));
    const angle = current + turn;
    const speed = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
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
