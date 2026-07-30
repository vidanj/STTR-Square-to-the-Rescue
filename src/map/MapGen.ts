import { FIRST_SECTOR, type SectorDef } from "../content/sectors";
import { stagePool } from "../content/stages";
import type { RNG } from "../core/RNG";
import { GameMap, type MapNode } from "./GameMap";

/**
 * Seeded map generation. Layout, room contents, elite and shop placement all
 * come from the run RNG, so every run's map is different but a seed always
 * reproduces the same map. The shape of the run — depth, which layer holds the
 * mini-boss, where the shop may appear — is sector data (`content/sectors.ts`).
 */

/** Difficulty tier per layer of the first sector. Kept for tests/back-compat. */
export const LAYER_DIFFICULTY = FIRST_SECTOR.layers;

/** Chance to open an extra (branching) edge while wiring adjacent layers. */
const EXTRA_EDGE_CHANCE = 0.35;

export function generateMap(rng: RNG, sector: SectorDef = FIRST_SECTOR): GameMap {
  const { layers: tiers, eliteLayer } = sector;

  // Layer sizes: 2–3 choice nodes per layer, narrowing to the lone boss node.
  // The elite layer is always exactly two: the mini-boss, or the way past it.
  const sizes = tiers.map((d, layer) =>
    d === "boss" ? 1 : layer === eliteLayer || d === "hard" ? 2 : rng.int(2, 3),
  );

  const nodes: MapNode[] = [];
  const layers: number[][] = sizes.map((size, layer) =>
    Array.from({ length: size }, (_, col) => {
      const id = nodes.length;
      nodes.push({ id, layer, col, kind: "battle", elite: false, stageId: "", next: [], cleared: false });
      return id;
    }),
  );

  for (let layer = 0; layer < layers.length - 1; layer++) {
    // Every route must reach the mini-boss, so the layer below it wires into
    // BOTH of its rooms. Elsewhere, edges stay monotonic (see wireLayer).
    if (layer + 1 === eliteLayer) wireAll(nodes, layers[layer], layers[layer + 1]);
    else wireLayer(nodes, layers[layer], layers[layer + 1], rng);
  }

  // Assign stages: shuffle each tier's pool so sibling rooms differ when the
  // pool allows, and the tier picked varies run to run.
  for (let layer = 0; layer < layers.length; layer++) {
    const pool = rng.shuffle(stagePool(tiers[layer]).slice());
    layers[layer].forEach((id, col) => {
      nodes[id].stageId = pool[col % pool.length].id;
    });
  }

  // The sector's mini-boss takes one of the two rooms on the elite layer; the
  // other keeps its normal stage, so the layer always offers a way around.
  const elites = stagePool("elite");
  if (elites.length > 0 && layers[eliteLayer]) {
    const node = nodes[rng.pick(layers[eliteLayer])];
    node.elite = true;
    node.stageId = rng.pick(elites).id;
  }

  // One Bar per run. It replaces a normal room, so taking it trades a fight
  // (and that fight's upgrade pick) for a chance to spend score — never the
  // mini-boss, and never the only room on its layer.
  const shopLayers = sector.shopLayers.filter((l) => l < layers.length && layers[l].length > 1);
  if (shopLayers.length > 0) {
    const layer = rng.pick(shopLayers.slice());
    const candidates = layers[layer].filter((id) => !nodes[id].elite);
    if (candidates.length > 0) {
      const shop = nodes[rng.pick(candidates)];
      shop.kind = "shop";
      shop.stageId = "";
    }
  }

  return new GameMap(nodes, layers, sector);
}

/**
 * Wire two adjacent layers with a monotonic two-pointer walk: every node gets
 * at least one edge in each direction and edges never cross (columns only ever
 * advance), so the drawn map stays readable.
 */
function wireLayer(nodes: MapNode[], src: readonly number[], dst: readonly number[], rng: RNG): void {
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

/**
 * Wire every source to every target. Used only into the elite layer, where the
 * point is that no route can be denied the mini-boss — the edges cross, and
 * that crossing IS the guarantee.
 */
function wireAll(nodes: MapNode[], src: readonly number[], dst: readonly number[]): void {
  for (const from of src) for (const to of dst) nodes[from].next.push(to);
}
