import { describe, expect, it } from "vitest";
import { RNG } from "../core/RNG";
import { generateMap } from "../map/MapGen";
import { FIRST_SECTOR, SECTORS, withEscapedElite } from "./sectors";
import { STAGES } from "./stages";

/** The boss events of a stage script, in order. */
const bosses = (stage: { script: readonly { kind: string }[] }) =>
  stage.script.filter((e) => e.kind === "boss");

describe("sector definitions", () => {
  it("are internally consistent", () => {
    for (const sector of SECTORS) {
      expect(sector.layers.length).toBeGreaterThan(2);
      expect(sector.layers[sector.layers.length - 1]).toBe("boss");
      // The mini-boss layer must be a real, non-boss layer with a layer below
      // it to wire in from.
      expect(sector.eliteLayer).toBeGreaterThan(0);
      expect(sector.eliteLayer).toBeLessThan(sector.layers.length - 1);
      for (const layer of sector.shopLayers) {
        expect(layer).toBeGreaterThan(0);
        expect(layer).toBeLessThan(sector.layers.length - 1);
        expect(layer).not.toBe(sector.eliteLayer);
      }
    }
  });

  it("gives sector one an extra room over the old four-room run", () => {
    // easy → medium → medium(elite) → hard → hard → boss
    expect(FIRST_SECTOR.layers.length).toBe(6);
  });
});

describe("an escaped mini-boss", () => {
  const boss = STAGES["boss-astra"];
  const elite = STAGES["elite-prism"];

  it("is fought immediately before the finale", () => {
    const merged = withEscapedElite(boss, elite, 1.2);
    const encounters = bosses(merged);
    expect(encounters.length).toBe(bosses(boss).length + 1);
    // Prism first, Astra last.
    expect(encounters[0]).toBe(bosses(elite)[0]);
    expect(encounters[encounters.length - 1]).toBe(bosses(boss)[bosses(boss).length - 1]);
  });

  it("leaves the authored boss stage untouched", () => {
    const before = boss.script.length;
    withEscapedElite(boss, elite, 1.2);
    expect(boss.script.length).toBe(before);
    expect(bosses(boss).length).toBe(1);
  });

  it("only applies while the elite room is unclear", () => {
    const map = generateMap(new RNG(7));
    expect(map.eliteEscaped).toBe(true);

    map.enter(map.eliteNode!.id);
    map.markCleared();
    expect(map.eliteEscaped).toBe(false);
  });
});
