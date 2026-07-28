import { stagePool, type Difficulty } from "../content/stages";
import type { RNG } from "../core/RNG";
import { GameMap, type MapNode } from "./GameMap";

/**
 * Seeded map generation. Layout, room contents, and elite placement all come
 * from the run RNG, so every run's map is different but a seed always
 * reproduces the same map.
 */

/** Difficulty tier per layer, bottom (first rooms) to top (boss). */
export const LAYER_DIFFICULTY: readonly Difficulty[] = ["easy", "medium", "medium", "hard", "boss"];

/** The layer whose nodes may host the run's single elite room. */
const ELITE_LAYER = 2;

/** Chance to open an extra (branching) edge while wiring adjacent layers. */
const EXTRA_EDGE_CHANCE = 0.35;

export function generateMap(rng: RNG): GameMap {
  // Layer sizes: 2–3 choice nodes per layer, narrowing to the lone boss node.
  const sizes = LAYER_DIFFICULTY.map((d) => (d === "boss" ? 1 : d === "hard" ? 2 : rng.int(2, 3)));

  const nodes: MapNode[] = [];
  const layers: number[][] = sizes.map((size, layer) =>
    Array.from({ length: size }, (_, col) => {
      const id = nodes.length;
      nodes.push({ id, layer, col, stageId: "", next: [], cleared: false });
      return id;
    }),
  );

  // Wire adjacent layers with a monotonic two-pointer walk: every node gets at
  // least one edge in each direction and edges never cross (columns only ever
  // advance), so the drawn map stays readable.
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const src = layers[layer];
    const dst = layers[layer + 1];
    let j = 0;
    for (let i = 0; i < src.length; i++) {
      nodes[src[i]].next.push(dst[j]);
      const srcLeft = src.length - 1 - i;
      // Advance while forced (more uncovered targets than remaining sources)
      // or, occasionally, to open an extra branch.
      while (j < dst.length - 1 && (dst.length - 1 - j > srcLeft || rng.next() < EXTRA_EDGE_CHANCE)) {
        j += 1;
        nodes[src[i]].next.push(dst[j]);
      }
    }
  }

  // Assign stages: shuffle each tier's pool so sibling rooms differ when the
  // pool allows, and the tier picked varies run to run.
  for (let layer = 0; layer < layers.length; layer++) {
    const pool = rng.shuffle(stagePool(LAYER_DIFFICULTY[layer]).slice());
    layers[layer].forEach((id, col) => {
      nodes[id].stageId = pool[col % pool.length].id;
    });
  }

  // One elite room per run, hiding somewhere on its designated layer.
  const elites = stagePool("elite");
  if (elites.length > 0) {
    const id = rng.pick(layers[ELITE_LAYER]);
    nodes[id].stageId = rng.pick(elites).id;
  }

  return new GameMap(nodes, layers);
}
