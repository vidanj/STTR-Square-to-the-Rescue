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
        // Every battle node's stage id resolves in the registry; shops have none.
        if (node.kind === "shop") expect(node.stageId).toBe("");
        else expect(STAGES[node.stageId]).toBeDefined();

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
      for (const [layer, ids] of map.layers.entries()) {
        // The layer below the mini-boss wires into BOTH of its rooms on
        // purpose, so every route can choose the elite — those edges cross.
        if (layer + 1 === map.sector.eliteLayer) continue;
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
        if (node.kind === "shop") continue; // The Bar has no difficulty
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

  it("offers the mini-boss to every route, and always a way around it", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(new RNG(seed));
      const elites = map.nodes.filter((n) => n.elite);
      expect(elites.length).toBe(1);

      const elite = elites[0];
      expect(elite.layer).toBe(map.sector.eliteLayer);
      expect(STAGES[elite.stageId].difficulty).toBe("elite");

      // Its layer holds exactly two rooms: the mini-boss and the way past.
      const layer = map.layers[elite.layer];
      expect(layer.length).toBe(2);
      const bypass = layer.map((id) => map.nodes[id]).find((n) => !n.elite)!;
      expect(bypass).toBeDefined();
      expect(STAGES[bypass.stageId]?.difficulty ?? "shop").not.toBe("elite");

      // EVERY room on the layer below reaches BOTH — so no route is denied the
      // mini-boss, and no route is forced into it.
      for (const id of map.layers[elite.layer - 1]) {
        expect(map.nodes[id].next).toContain(elite.id);
        expect(map.nodes[id].next).toContain(bypass.id);
      }
    }
  });

  it("places exactly one Bar, never on the elite node, always with a way past it", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(new RNG(seed));
      const shops = map.nodes.filter((n) => n.kind === "shop");
      expect(shops.length).toBe(1);

      const shop = shops[0];
      // The shop's layer must still offer at least one room to fight in, so a
      // player who wants the upgrade pick is never forced through the shop.
      const siblings = map.layers[shop.layer].map((id) => map.nodes[id]);
      expect(siblings.some((n) => n.kind === "battle")).toBe(true);
      // It never eats the run's only elite room, and never the boss.
      expect(shop.elite).toBe(false);
      expect(shop.layer).toBeLessThan(map.layers.length - 1);
    }
  });

  it("still reaches the boss without ever entering the shop", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const map = generateMap(new RNG(seed));
      // Walk the DAG using battle nodes only; the boss must stay reachable.
      let frontier = map.layers[0].map((id) => map.nodes[id]).filter((n) => n.kind === "battle");
      for (let layer = 1; layer < map.layers.length; layer++) {
        const next = new Set<number>();
        for (const node of frontier) for (const id of node.next) next.add(id);
        frontier = [...next].map((id) => map.nodes[id]).filter((n) => n.kind === "battle");
        expect(frontier.length).toBeGreaterThan(0);
      }
    }
  });
});
