import type { StageEvent } from "../content/stagekit";
import type { World } from "../core/World";

/** Frame signal the World/Game act on. */
export type WaveSignal = "none" | "win";

type State = "wave" | "wait" | "boss" | "done";

/**
 * Walks a room's stage script one event at a time: spawns waves and gates on
 * their clearance, spawns the boss, and reports the room clear. It mutates the
 * World to spawn things and reads it to detect clears. Upgrade picks happen
 * between rooms (driven by the Game), not mid-script.
 */
export class WaveManager {
  private index = -1;
  private state: State = "done";
  private timer = 0;

  constructor(
    private readonly events: StageEvent[],
    private readonly world: World,
  ) {
    this.advance();
  }

  private advance(): void {
    this.index += 1;
    if (this.index >= this.events.length) {
      this.state = "done";
      return;
    }
    const ev = this.events[this.index];
    switch (ev.kind) {
      case "wave":
        this.world.spawnWave(ev.enemies);
        this.state = "wave";
        break;
      case "wait":
        this.timer = ev.time;
        this.state = "wait";
        break;
      case "boss":
        this.world.spawnBoss(ev.boss);
        this.state = "boss";
        break;
    }
  }

  update(dt: number): WaveSignal {
    switch (this.state) {
      case "wave":
        if (this.world.enemies.length === 0) this.advance();
        return "none";
      case "wait":
        this.timer -= dt;
        if (this.timer <= 0) this.advance();
        return "none";
      case "boss":
        if (this.world.boss && this.world.boss.alive) return "none";
        // A stage can chain more events after a boss — an escaped mini-boss is
        // fought as a prelude to the real finale, so only the LAST encounter
        // clears the room.
        if (this.index + 1 < this.events.length) {
          this.world.boss = null;
          this.advance();
          return "none";
        }
        return "win";
      case "done":
        return "win";
    }
  }
}
