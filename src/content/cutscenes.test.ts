import { describe, expect, it } from "vitest";
import { CUTSCENES, cutsceneForRoom } from "./cutscenes";
import { STAGES } from "./stages";

describe("cutscene triggers", () => {
  it("meet-astra fires on entering the boss room", () => {
    const scene = cutsceneForRoom(STAGES["boss-astra"], new Set());
    expect(scene?.id).toBe("meet-astra");
  });

  it("meet-astra still fires after meet-diamonds was seen earlier in the run", () => {
    const seen = new Set<string>(["meet-diamonds"]);
    expect(cutsceneForRoom(STAGES["boss-astra"], seen)?.id).toBe("meet-astra");
  });

  it("meet-diamonds fires on the first diamond room only", () => {
    const seen = new Set<string>();
    const first = cutsceneForRoom(STAGES["easy-diamonds"], seen);
    expect(first?.id).toBe("meet-diamonds");
    seen.add(first!.id);
    expect(cutsceneForRoom(STAGES["easy-diamonds"], seen)).toBeNull();
  });

  it("every scene's lines reference actors that exist in the scene", () => {
    for (const scene of CUTSCENES) {
      const ids = new Set(scene.actors.map((a) => a.id));
      for (const line of scene.lines) {
        expect(ids, `${scene.id}: unknown actor "${line.actor}"`).toContain(line.actor);
      }
    }
  });
});
