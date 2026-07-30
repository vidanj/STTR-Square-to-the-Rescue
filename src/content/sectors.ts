import type { Difficulty, StageDef, StageEvent } from "./stagekit";

/**
 * A sector is one run map: how many rooms deep it is, which layer holds its
 * mini-boss, and where its shop can appear. Future sectors are another entry
 * in `SECTORS` — nothing else has to change.
 */
export interface SectorDef {
  id: string;
  name: string;
  /** Difficulty tier per layer, first rooms → boss. Length = map depth. */
  layers: readonly Difficulty[];
  /**
   * The layer that hosts this sector's mini-boss. That layer is always built
   * with exactly two rooms — the elite and one normal room — and every room on
   * the layer below connects to BOTH, so taking on the mini-boss is a choice
   * every route gets to make.
   */
  eliteLayer: number;
  /** Layers the shop (The Bar) may replace a room on. */
  shopLayers: readonly number[];
  /** Seconds of breathing room between an escaped mini-boss and the finale. */
  escapedEliteGap: number;
}

export const SECTORS: readonly SectorDef[] = [
  {
    id: "sector-1",
    name: "SECTOR ONE",
    layers: ["easy", "medium", "medium", "hard", "hard", "boss"],
    eliteLayer: 2,
    shopLayers: [3, 4],
    escapedEliteGap: 1.2,
  },
];

/** The sector a run starts in. (No meta-progression yet, so always the first.) */
export const FIRST_SECTOR = SECTORS[0];

/**
 * The boss room to play when the sector's mini-boss was never beaten: its
 * encounter is spliced in immediately before the sector boss, so ducking the
 * elite only postpones it — and lands it in the worst possible place.
 *
 * Everything else about the boss stage is untouched, including `bossAdds`,
 * which means the escaped mini-boss brings the finale's reinforcements with it.
 */
export function withEscapedElite(bossStage: StageDef, eliteStage: StageDef, gap: number): StageDef {
  const encounter = eliteStage.script.find((e): e is Extract<StageEvent, { kind: "boss" }> => e.kind === "boss");
  if (!encounter) return bossStage;

  const script = [...bossStage.script];
  const at = script.findIndex((e) => e.kind === "boss");
  script.splice(at < 0 ? script.length : at, 0, encounter, { kind: "wait", time: gap });
  return { ...bossStage, script };
}
