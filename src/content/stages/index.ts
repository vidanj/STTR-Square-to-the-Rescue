import type { Difficulty, StageDef } from "../stagekit";
import { BOSS_STAGES } from "./boss";
import { EASY_STAGES } from "./easy";
import { ELITE_STAGES } from "./elite";
import { HARD_STAGES } from "./hard";
import { MEDIUM_STAGES } from "./medium";

export type { Difficulty, StageDef, StageEvent } from "../stagekit";

/** Every authored stage. Map generation draws from this via `stagePool`. */
export const ALL_STAGES: readonly StageDef[] = [
  ...EASY_STAGES,
  ...MEDIUM_STAGES,
  ...ELITE_STAGES,
  ...HARD_STAGES,
  ...BOSS_STAGES,
];

/** Stage lookup by id (map nodes store ids, not object references). */
export const STAGES: Readonly<Record<string, StageDef>> = Object.fromEntries(
  ALL_STAGES.map((s) => [s.id, s]),
);

/** All stages of one difficulty tier. */
export function stagePool(difficulty: Difficulty): StageDef[] {
  return ALL_STAGES.filter((s) => s.difficulty === difficulty);
}
