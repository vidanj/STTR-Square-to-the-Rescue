import { describe, expect, it } from "vitest";
import { ENEMY_SHAPES, type Shape } from "../config";
import { ALL_STAGES, STAGES, stagePool } from "./stages";
import { LAYER_DIFFICULTY } from "../map/MapGen";

/** Shapes that actually appear in a stage's script (waves + boss). */
function shapesUsed(stageId: string): Set<Shape> {
  const used = new Set<Shape>();
  for (const ev of STAGES[stageId].script) {
    if (ev.kind === "wave") for (const e of ev.enemies) used.add(e.shape);
    if (ev.kind === "boss") used.add(ev.boss.shape);
  }
  return used;
}

describe("stage registry", () => {
  it("has unique ids and non-empty scripts", () => {
    const ids = ALL_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const stage of ALL_STAGES) {
      expect(stage.script.length).toBeGreaterThan(0);
      expect(stage.preview.length).toBeGreaterThan(0);
    }
  });

  it("only uses legal enemy shapes (never the player's square)", () => {
    for (const stage of ALL_STAGES) {
      for (const shape of shapesUsed(stage.id)) {
        expect(ENEMY_SHAPES).toContain(shape);
      }
    }
  });

  it("previews only shapes that actually appear in the room", () => {
    for (const stage of ALL_STAGES) {
      const used = shapesUsed(stage.id);
      for (const shape of stage.preview) {
        expect(used, `${stage.id} previews ${shape}`).toContain(shape);
      }
    }
  });

  it("has stages for every tier the map generator asks for", () => {
    for (const difficulty of new Set([...LAYER_DIFFICULTY, "elite" as const])) {
      expect(stagePool(difficulty).length, `no ${difficulty} stages`).toBeGreaterThan(0);
    }
  });
});
