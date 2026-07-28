import { POWERUPS, type PowerUp } from "../content/powerups";
import type { RNG } from "../core/RNG";
import type { Player } from "../entities/Player";

/**
 * Rolls the seeded power-up choices offered between waves and records what the
 * player has taken (for the HUD). Choices come from the shared RNG so the same
 * run seed always offers the same upgrades.
 */
export class PowerUpSystem {
  readonly acquired: PowerUp[] = [];

  constructor(private readonly rng: RNG) {}

  /** `count` distinct upgrades to choose from. */
  rollChoices(count = 3): PowerUp[] {
    const pool = this.rng.shuffle([...POWERUPS]);
    return pool.slice(0, Math.min(count, pool.length));
  }

  /** Apply a chosen upgrade to the player and remember it. */
  choose(p: PowerUp, player: Player): void {
    p.apply(player);
    this.acquired.push(p);
  }
}
