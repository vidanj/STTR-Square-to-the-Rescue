import type { World } from "../core/World";

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
    this.playerBulletsVsEnemies(world);
    this.enemyBulletsVsPlayer(world);
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

      // Enemies. A piercing shot damages every enemy it overlaps and is not
      // consumed; a normal shot hits the first and stops.
      for (const e of world.enemies) {
        if (!e.alive) continue;
        if (circleHit(b.x, b.y, b.r, e.x, e.y, e.r)) {
          e.hp -= b.damage;
          world.particles.burst(b.x, b.y, e.color, 4, 120, 0.6);
          if (e.hp <= 0) {
            e.alive = false;
            world.onEnemyKilled(e);
          }
          if (!b.pierce) {
            consumed = true;
            break;
          }
        }
      }
      if (consumed) {
        pool.release(i);
        continue;
      }

      // Boss.
      const boss = world.boss;
      if (boss && boss.alive && circleHit(b.x, b.y, b.r, boss.x, boss.y, boss.r)) {
        const result = boss.damage(b.damage);
        world.particles.burst(b.x, b.y, boss.color, 4, 120, 0.6);
        if (result === "phase") world.onBossPhase();
        else if (result === "dead") world.onBossDead();
        if (!b.pierce) pool.release(i);
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
