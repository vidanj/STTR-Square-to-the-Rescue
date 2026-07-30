import { COLORS } from "../config";
import type { World } from "../core/World";
import type { Bullet } from "../entities/Bullet";

/**
 * Reflect a bouncing shot off a body it just hit, and shove it clear of the
 * body's radius so the next step can't count the same contact twice. A shot
 * already travelling away is only pushed out, never flipped back inward.
 *
 * Exported for unit tests.
 */
export function bounceOffBody(b: Bullet, bx: number, by: number, br: number): void {
  const dx = b.x - bx;
  const dy = b.y - by;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  const into = b.vx * nx + b.vy * ny;
  if (into < 0) {
    b.vx -= 2 * into * nx;
    b.vy -= 2 * into * ny;
  }
  b.x = bx + nx * (br + b.r + 0.5);
  b.y = by + ny * (br + b.r + 0.5);
}

/** Circle-vs-circle overlap test. Exported for unit tests. */
export function circleHit(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * Resolves the two collision relationships each step. All shapes are treated as
 * circles of their draw radius, which is the standard, forgiving feel for a
 * bullet hell. Side effects (score, particles, phase/death) go through World.
 */
export class CollisionSystem {
  run(world: World): void {
    this.eatingShotsVsEnemyBullets(world);
    this.shieldsVsEnemyBullets(world);
    this.playerBulletsVsEnemies(world);
    this.enemyBulletsVsPlayer(world);
  }

  /**
   * Orbiting shield squares eat any enemy bullet they touch. They never expire,
   * so the cover they give is purely about where they are in their orbit.
   */
  private shieldsVsEnemyBullets(world: World): void {
    const shields = world.player.shields;
    if (shields.length === 0) return;
    const enemy = world.bullets.enemy;
    for (const s of shields) {
      for (let j = enemy.count - 1; j >= 0; j--) {
        const b = enemy.items[j];
        if (circleHit(s.x, s.y, s.r, b.x, b.y, b.r)) {
          world.particles.burst(b.x, b.y, COLORS.eat, 3, 90, 0.5);
          enemy.release(j);
        }
      }
    }
  }

  /**
   * "Eating" player shots destroy enemy bullets they overlap without being
   * consumed, clearing a lane through incoming fire as they travel.
   */
  private eatingShotsVsEnemyBullets(world: World): void {
    const shots = world.bullets.player;
    const enemy = world.bullets.enemy;
    for (let i = 0; i < shots.count; i++) {
      const p = shots.items[i];
      if (!p.eats) continue;
      for (let j = enemy.count - 1; j >= 0; j--) {
        const b = enemy.items[j];
        if (circleHit(p.x, p.y, p.r, b.x, b.y, b.r)) {
          world.particles.burst(b.x, b.y, p.color, 3, 90, 0.5);
          enemy.release(j);
        }
      }
    }
  }

  private playerBulletsVsEnemies(world: World): void {
    const pool = world.bullets.player;
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      let consumed = false;

      // Enemies. A piercing shot spends one pierce per enemy it drills through
      // (gaining `pierceGain` damage each time); a bouncing shot rebounds off
      // the enemy and spends one bounce, so a ricochet can work its way through
      // a cluster; anything else is consumed by the first enemy it hits.
      for (const e of world.enemies) {
        if (!e.alive) continue;
        if (circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) {
          e.hp -= b.damage;
          world.particles.burst(b.x, b.y, e.color, 4, 120, 0.6);
          if (e.hp <= 0) {
            e.alive = false;
            world.onEnemyKilled(e);
          }
          if (b.pierce > 0) {
            b.pierce -= 1;
            b.damage += b.pierceGain;
          } else if (b.bounces > 0) {
            bounceOffBody(b, e.x, e.y, e.r);
            b.bounces -= 1;
            b.damage += b.bounceGain;
            break; // it's heading somewhere else now — stop testing this step
          } else {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        pool.release(i);
        continue;
      }

      // Boss. While it is still making its entrance shots pass straight
      // through rather than being eaten, so "not yet" reads honestly.
      const boss = world.boss;
      if (boss && boss.alive && !boss.arriving && circleHit(b.x, b.y, b.r, boss.x, boss.y, boss.r)) {
        const result = boss.damage(b.damage);
        world.particles.burst(b.x, b.y, boss.color, 4, 120, 0.6);
        if (result === "phase") world.onBossPhase();
        else if (result === "dead") world.onBossDead();
        if (b.pierce > 0) {
          b.pierce -= 1;
          b.damage += b.pierceGain;
        } else if (b.bounces > 0) {
          bounceOffBody(b, boss.x, boss.y, boss.r);
          b.bounces -= 1;
          b.damage += b.bounceGain;
        } else {
          pool.release(i);
        }
      }
    }
  }

  private enemyBulletsVsPlayer(world: World): void {
    const player = world.player;
    if (player.invulnerable) return;
    const pool = world.bullets.enemy;
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.items[i];
      if (circleHit(player.x, player.y, player.hurtR, b.x, b.y, b.r)) {
        pool.release(i);
        if (player.hit()) {
          world.onPlayerHit();
          return; // player is now invulnerable + bullets cleared; stop here
        }
      }
    }
  }
}
