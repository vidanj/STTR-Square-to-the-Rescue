import { describe, expect, it } from "vitest";
import { STAGES } from "../content/stages";
import { RNG } from "../core/RNG";
import type { GameMap } from "./GameMap";
import { LAYER_DIFFICULTY, generateMap } from "./MapGen";

/** Structural snapshot for equality checks (functions/refs stripped). */
function layout(map: GameMap): string {
  return JSON.stringify(map.nodes.map((n) => [n.layer, n.col, n.stageId, n.next]));
}

describe("map generation", () => {
  it("is deterministic: the same seed reproduces the same map", () => {
    for (const seed of [1, 42, 0xdeadbeef]) {
      expect(layout(generateMap(new RNG(seed)))).toBe(layout(generateMap(new RNG(seed))));
    }
  });

  it("varies between seeds", () => {
    const layouts = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) layouts.add(layout(generateMap(new RNG(seed))));
    expect(layouts.size).toBeGreaterThan(1);
  });

  it("builds a valid, fully-connected DAG for many seeds", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(new RNG(seed));
      const last = map.layers.length - 1;

      expect(map.layers.length).toBe(LAYER_DIFFICULTY.length);
      // A single final boss node.
      expect(map.layers[last].length).toBe(1);

      const incoming = new Map<number, number>();
      for (const node of map.nodes) {
        // Every stage id resolves in the registry.
        expect(STAGES[node.stageId]).toBeDefined();

        // Every non-final node leads somewhere in the next layer.
        if (node.layer < last) {
          expect(node.next.length).toBeGreaterThan(0);
          for (const id of node.next) {
            expect(map.nodes[id].layer).toBe(node.layer + 1);
            incoming.set(id, (incoming.get(id) ?? 0) + 1);
          }
        } else {
          expect(node.next.length).toBe(0);
        }
      }

      // Every node past the first layer can be reached.
      for (const node of map.nodes) {
        if (node.layer > 0) expect(incoming.get(node.id) ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("keeps edges monotonic so the drawn map has no crossings", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(new RNG(seed));
      for (const ids of map.layers) {
        for (let i = 0; i + 1 < ids.length; i++) {
          const left = map.nodes[ids[i]].next.map((id) => map.nodes[id].col);
          const right = map.nodes[ids[i + 1]].next.map((id) => map.nodes[id].col);
          if (left.length && right.length) {
            expect(Math.max(...left)).toBeLessThanOrEqual(Math.min(...right));
          }
        }
      }
    }
  });

  it("matches each layer's difficulty tier, with exactly one elite room", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(new RNG(seed));
      let elites = 0;
      for (const node of map.nodes) {
        const diff = STAGES[node.stageId].difficulty;
        if (diff === "elite") {
          elites += 1;
          continue; // elites replace a node on their host layer
        }
        expect(diff).toBe(LAYER_DIFFICULTY[node.layer]);
      }
      expect(elites).toBe(1);
    }
  });
});
