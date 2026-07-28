import { COLORS } from "../config";
import type { StageDef } from "../content/stages";
import { BombSquare } from "../entities/BombSquare";
import { Boss, type BossConfig } from "../entities/Boss";
import { Enemy, type EnemySpec } from "../entities/Enemy";
import type { Player } from "../entities/Player";
import type { Renderer } from "../render/Renderer";
import { BulletSystem } from "../systems/BulletSystem";
import { CollisionSystem } from "../systems/CollisionSystem";
import { ParticleSystem } from "../systems/ParticleSystem";
import { WaveManager } from "../systems/WaveManager";
import type { Input } from "./Input";
import type { RNG } from "./RNG";
import type { RunState } from "./RunState";

/** What one world step reports up to the top-level Game state machine. */
export type WorldEvent = "none" | "win" | "gameover";

/**
 * Owns the live gameplay state for a single ROOM and advances it one fixed
 * step at a time. Run-level state (player, score, power-ups, RNG) lives in the
 * RunState and persists between rooms; bullets/enemies/particles are per-room
 * and die with the World when the room is left.
 */
export class World {
  readonly bullets = new BulletSystem();
  readonly particles = new ParticleSystem();
  enemies: Enemy[] = [];
  bombs: BombSquare[] = [];
  boss: Boss | null = null;

  private readonly collision = new CollisionSystem();
  private readonly waves: WaveManager;

  constructor(
    readonly run: RunState,
    readonly stage: StageDef,
    private readonly renderer: Renderer,
  ) {
    this.waves = new WaveManager(stage.script, this);
  }

  // Run-level state, exposed so systems/HUD keep a single `world` handle.
  get rng(): RNG {
    return this.run.rng;
  }
  get player(): Player {
    return this.run.player;
  }
  get score(): number {
    return this.run.score;
  }
  get powerups(): RunState["powerups"] {
    return this.run.powerups;
  }

  update(dt: number, input: Input): WorldEvent {
    if (input.pressed("KeyX", "Mouse2") && this.player.stats.bombs > 0) this.bomb();

    this.player.update(dt, input, this.bullets);
    for (const e of this.enemies) e.update(dt, this.player, this.bullets, this.rng);
    this.boss?.update(dt, this.player, this.bullets, this.rng);

    this.bullets.update();
    for (const bomb of this.bombs) bomb.update(dt, this);
    if (this.bombs.some((b) => !b.alive)) this.bombs = this.bombs.filter((b) => b.alive);
    this.particles.update();
    this.collision.run(this);

    // Reap dead enemies so wave-clear detection and iteration stay cheap.
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);

    this.renderer.updateShake();

    if (this.player.lives <= 0) return "gameover";

    if (this.waves.update(dt) === "win") return "win";
    return "none";
  }

  private bomb(): void {
    this.player.stats.bombs -= 1;
    this.bombs.push(new BombSquare(this.player.x, this.player.y - 12));
    this.particles.burst(this.player.x, this.player.y - 12, COLORS.player, 12, 160, 0.8);
    this.renderer.shake(6);
  }

  // --- spawning (called by WaveManager) ---
  spawnWave(specs: EnemySpec[]): void {
    for (const s of specs) this.enemies.push(new Enemy(s));
  }
  spawnBoss(cfg: BossConfig): void {
    this.boss = new Boss(cfg);
    // Phase-1 reinforcements arrive with the boss.
    if (this.stage.bossAdds) this.spawnWave(this.stage.bossAdds(0));
  }

  // --- collision/bomb callbacks ---
  onEnemyKilled(e: Enemy): void {
    this.run.score += e.score;
    this.particles.burst(e.x, e.y, e.color, 18, 200, 1.2);
    this.renderer.shake(6);
  }
  onBossPhase(): void {
    // Boss bullets persist through phase changes — no screen wipe, just a flash.
    if (this.boss) {
      this.particles.burst(this.boss.x, this.boss.y, this.boss.color, 32, 260, 1.3);
      // Each new phase brings a tougher squad of reinforcements.
      if (this.stage.bossAdds) this.spawnWave(this.stage.bossAdds(this.boss.phaseNumber - 1));
    }
    this.renderer.shake(14);
  }
  onBossDead(): void {
    this.run.score += 5000;
    this.bullets.clearEnemy();
    if (this.boss) this.particles.burst(this.boss.x, this.boss.y, this.boss.color, 60, 340, 1.6);
    this.renderer.shake(26);
  }
  onPlayerHit(): void {
    // Enemy bullets persist — the player's 3s of blinking invulnerability is
    // the escape window, not a screen wipe.
    this.particles.burst(this.player.x, this.player.y, COLORS.player, 26, 240, 1.3);
    this.renderer.shake(16);
  }

  draw(r: Renderer): void {
    this.boss?.draw(r);
    for (const e of this.enemies) e.draw(r);
    this.bullets.draw(r);
    for (const bomb of this.bombs) bomb.draw(r);
    this.particles.draw(r);
    this.player.draw(r);
  }
}
