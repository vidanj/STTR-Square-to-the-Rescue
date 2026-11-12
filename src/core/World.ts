import type { AudioEngine } from "../audio/AudioEngine";
import { COLORS } from "../config";
import { cutsceneForActor, type Cutscene } from "../content/cutscenes";
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
export type WorldEvent = "none" | "win" | "gameover" | "cutscene";

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
  /** A story beat raised mid-room, waiting for the Game to play it. */
  private pendingScene: Cutscene | null = null;
  /** The boss currently making its entrance; cleared once it has landed. */
  private bossArrival: BossConfig | null = null;

  constructor(
    readonly run: RunState,
    readonly stage: StageDef,
    private readonly renderer: Renderer,
    /** Exposed (like `particles`) so systems can cue sounds where things happen. */
    readonly audio: AudioEngine,
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

    const sfx = this.audio.sfx;
    this.player.update(dt, input, this.bullets);
    if (this.player.firedThisStep) sfx.play("shoot", { focus: this.player.focus });
    for (const e of this.enemies) {
      if (e.update(dt, this.player, this.bullets, this.rng)) sfx.play("enemyShot", { shape: e.shape });
    }
    const boss = this.boss;
    if (boss?.update(dt, this.player, this.bullets, this.rng)) sfx.play("enemyShot", { shape: boss.shape, boss: true });

    // The boss has finished hovering: start the fight for real.
    if (this.bossArrival && this.boss && !this.boss.arriving) {
      const cfg = this.bossArrival;
      this.bossArrival = null;
      this.bossArrived(cfg);
    }

    // Homing player shots steer toward whatever is alive in the room.
    this.bullets.update(this.enemies, this.boss);
    for (const bomb of this.bombs) bomb.update(dt, this);
    if (this.bombs.some((b) => !b.alive)) this.bombs = this.bombs.filter((b) => b.alive);
    this.particles.update();
    this.collision.run(this);

    // Reap dead enemies so wave-clear detection and iteration stay cheap.
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);

    this.renderer.updateShake();

    if (this.player.lives <= 0) return "gameover";

    // A beat raised this step (something spawned or died) interrupts before the
    // room can advance — so a boss's defeat scene plays before the room clears.
    if (this.pendingScene) return "cutscene";

    if (this.waves.update(dt) === "win") return "win";
    return "none";
  }

  /**
   * Queue a story beat for the Game to play. Marked seen immediately so a wave
   * of five same-shaped enemies raises it once, not five times.
   */
  private raise(scene: Cutscene | null): void {
    if (!scene || this.pendingScene) return;
    this.run.seenCutscenes.add(scene.id);
    this.pendingScene = scene;
  }

  /** Hand the queued beat to the Game (and clear it). */
  takeCutscene(): Cutscene | null {
    const scene = this.pendingScene;
    this.pendingScene = null;
    return scene;
  }

  private bomb(): void {
    this.player.stats.bombs -= 1;
    this.bombs.push(new BombSquare(this.player.x, this.player.y - 12));
    this.particles.burst(this.player.x, this.player.y - 12, COLORS.player, 12, 160, 0.8);
    this.renderer.shake(6);
    this.audio.sfx.play("bomb");
  }

  // --- spawning (called by WaveManager) ---
  spawnWave(specs: EnemySpec[]): void {
    const seen = this.run.seenCutscenes;
    for (const s of specs) {
      this.enemies.push(new Enemy(s));
      this.raise(cutsceneForActor("spawn", s.shape, false, this.stage.id, seen));
    }
  }
  /**
   * Bring in a boss. Nothing else happens yet: it descends and holds station,
   * untouchable and silent, while the player reads the health bar. Its
   * reinforcements and its entrance cutscene both wait for `bossArrived`.
   */
  spawnBoss(cfg: BossConfig): void {
    this.boss = new Boss(cfg);
    this.bossArrival = cfg;
  }

  /** Fires once, the moment a boss finishes its entrance hold. */
  private bossArrived(cfg: BossConfig): void {
    this.audio.sfx.play("bossLand", { shape: cfg.shape });
    // The entrance scene plays now — after the player has had a good look.
    this.raise(cutsceneForActor("spawn", cfg.shape, true, this.stage.id, this.run.seenCutscenes));
    // Phase-1 reinforcements only turn up once the staring contest is over.
    if (this.stage.bossAdds) this.spawnWave(this.stage.bossAdds(0));
  }

  // --- collision/bomb callbacks ---
  onEnemyKilled(e: Enemy): void {
    this.run.score += e.score;
    this.particles.burst(e.x, e.y, e.color, 18, 200, 1.2);
    this.renderer.shake(6);
    this.audio.sfx.play("kill", { shape: e.shape, size: e.r });
    this.raise(cutsceneForActor("defeat", e.shape, false, this.stage.id, this.run.seenCutscenes));
  }
  onBossPhase(): void {
    // Boss bullets persist through phase changes — no screen wipe, just a flash.
    if (this.boss) {
      this.particles.burst(this.boss.x, this.boss.y, this.boss.color, 32, 260, 1.3);
      this.audio.sfx.play("bossPhase", { shape: this.boss.shape });
      // Each new phase brings a tougher squad of reinforcements.
      if (this.stage.bossAdds) this.spawnWave(this.stage.bossAdds(this.boss.phaseNumber - 1));
    }
    this.renderer.shake(14);
  }
  onBossDead(): void {
    this.run.score += 5000;
    this.bullets.clearEnemy();
    if (this.boss) {
      this.particles.burst(this.boss.x, this.boss.y, this.boss.color, 60, 340, 1.6);
      this.audio.sfx.play("bossDown", { shape: this.boss.shape });
      this.raise(cutsceneForActor("defeat", this.boss.shape, true, this.stage.id, this.run.seenCutscenes));
    }
    this.renderer.shake(26);
  }
  onPlayerHit(): void {
    // Enemy bullets persist — the player's 3s of blinking invulnerability is
    // the escape window, not a screen wipe.
    this.particles.burst(this.player.x, this.player.y, COLORS.player, 26, 240, 1.3);
    this.renderer.shake(16);
    this.audio.sfx.play("hurt");
    this.audio.hurtDip();
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
