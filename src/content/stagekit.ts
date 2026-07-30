import { COLORS, WIDTH, type Shape } from "../config";
import type { Weapon } from "./patterns";
import type { BossConfig } from "../entities/Boss";
import type { EnemySpec } from "../entities/Enemy";

/** One step of a stage script, processed in order by the WaveManager. */
export type StageEvent =
  | { kind: "wave"; enemies: EnemySpec[] }
  | { kind: "wait"; time: number }
  | { kind: "boss"; boss: BossConfig };

/** Map-node tier; decides which layer of the run map a stage can appear on. */
export type Difficulty = "easy" | "medium" | "elite" | "hard" | "boss";

/** A room's worth of content plus the metadata the map screen shows. */
export interface StageDef {
  id: string;
  name: string;
  difficulty: Difficulty;
  /** Shapes previewed on the map node so the player can read what's inside. */
  preview: Shape[];
  script: StageEvent[];
  /** Reinforcements spawned when this stage's boss enters phase `phase` (0-based). */
  bossAdds?: (phase: number) => EnemySpec[];
}

/** Evenly spread `n` x-positions across the play-field with side margins. */
export function row(n: number): number[] {
  const margin = 60;
  const span = WIDTH - margin * 2;
  return Array.from({ length: n }, (_, i) => margin + span * (n === 1 ? 0.5 : i / (n - 1)));
}

/** Per-shape colour so each enemy type reads consistently across stages. */
export const SHAPE_COLOR: Record<Shape, string> = {
  square: COLORS.player,
  circle: COLORS.enemy,
  triangle: "#ff9a3b",
  diamond: "#b98cff",
  pentagon: COLORS.good,
  hexagon: "#ffd76b",
  star: COLORS.boss,
  rect: COLORS.eat, // Bar, the shopkeeper — never an enemy
};

type GroupExtra = { sway?: number; r?: number; score?: number; entrySpeed?: number };

/** Build a row of `count` identical enemies of one shape. */
export function group(
  shape: Shape,
  count: number,
  targetY: number,
  hp: number,
  weapon: Partial<Weapon>,
  extra: GroupExtra = {},
): EnemySpec[] {
  return row(count).map((x) => ({ x, targetY, hp, shape, color: SHAPE_COLOR[shape], weapon, ...extra }));
}

// Thematic default weapons per shape (spread via the group's overrides).
export const AIMED = { pattern: "aimed", count: 1, interval: 1.3, speed: 130, r: 5 } as const;
export const ARC = { pattern: "arc", count: 6, spread: 1.5, interval: 1.6, speed: 120, r: 5 } as const;
export const BURST = { pattern: "burst", count: 5, spread: 0.8, interval: 1.5, speed: 155, r: 5 } as const;
export const RING = { pattern: "ring", count: 11, interval: 1.6, speed: 105, r: 5, angleStep: 0.26 } as const;
export const SPIRAL = { pattern: "spiral", count: 3, interval: 0.24, speed: 125, r: 5, angleStep: 0.5 } as const;
