import { Player } from "../entities/Player";
import type { GameMap } from "../map/GameMap";
import { generateMap } from "../map/MapGen";
import { PowerUpSystem } from "../systems/PowerUpSystem";
import { RNG } from "./RNG";

/**
 * Everything that survives from room to room within one run: the seeded RNG
 * (map layout, power-up rolls, and enemy fire all draw from the same stream),
 * the player (lives, bombs, stats, shot streams), the acquired power-ups, the
 * score, and the run map itself. A World is per-room and borrows from this.
 */
export class RunState {
  readonly rng: RNG;
  readonly player = new Player();
  readonly powerups: PowerUpSystem;
  readonly map: GameMap;
  /** Cutscene ids already played this run — each scene fires once per run. */
  readonly seenCutscenes = new Set<string>();
  score = 0;

  constructor(readonly seed: number) {
    this.rng = new RNG(seed);
    // Map first so its layout is a pure function of the seed.
    this.map = generateMap(this.rng);
    this.powerups = new PowerUpSystem(this.rng);
  }
}
