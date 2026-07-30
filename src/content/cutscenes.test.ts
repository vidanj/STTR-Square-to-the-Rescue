import { describe, expect, it } from "vitest";
import { ENEMY_SHAPES } from "../config";
import { CUTSCENES, cutsceneForActor, cutsceneForRoom, cutsceneForShop } from "./cutscenes";
import { STAGES } from "./stages";

const BOSS_ROOM = "boss-astra";
const CORRIDOR = "elite-prism";

describe("cutscene triggers", () => {
  it("meet-astra waits for Astra to descend, not for the room to open", () => {
    // Entering the boss room must NOT spend the scene...
    expect(cutsceneForRoom(STAGES[BOSS_ROOM], new Set())?.id).not.toBe("meet-astra");
    // ...it fires the moment the boss actually spawns.
    expect(cutsceneForActor("spawn", "star", true, BOSS_ROOM, new Set())?.id).toBe("meet-astra");
  });

  it("meet-astra still fires after meet-diamonds was seen earlier in the run", () => {
    const seen = new Set<string>(["meet-diamonds"]);
    expect(cutsceneForActor("spawn", "star", true, BOSS_ROOM, seen)?.id).toBe("meet-astra");
  });

  it("does not fire a boss scene for a rank-and-file enemy of the same shape", () => {
    expect(cutsceneForActor("spawn", "star", false, BOSS_ROOM, new Set())).toBeNull();
  });

  it("fires each actor scene once per run", () => {
    const seen = new Set<string>();
    const first = cutsceneForActor("spawn", "star", true, BOSS_ROOM, seen);
    expect(first).not.toBeNull();
    seen.add(first!.id);
    expect(cutsceneForActor("spawn", "star", true, BOSS_ROOM, seen)).toBeNull();
  });

  it("gives Prism a different scene in his corridor than in the finale", () => {
    expect(cutsceneForActor("spawn", "hexagon", true, CORRIDOR, new Set())?.id).toBe("prism-simp");
    expect(cutsceneForActor("spawn", "hexagon", true, BOSS_ROOM, new Set())?.id).toBe("prism-showoff");
  });

  it("keeps a stage-pinned scene out of every other room", () => {
    for (const stageId of Object.keys(STAGES)) {
      if (stageId === CORRIDOR) continue;
      expect(cutsceneForActor("spawn", "hexagon", true, stageId, new Set())?.id).not.toBe("prism-simp");
    }
  });

  it("greets Astra differently depending on where Prism died", () => {
    // Prism was put down back in his corridor: she has no idea who he was.
    const killed = new Set<string>(["prism-simp"]);
    expect(cutsceneForActor("spawn", "star", true, BOSS_ROOM, killed)?.id).toBe("meet-astra");

    // Prism followed you here and went off at her feet: she noticed the noise,
    // and nothing else about him.
    const followed = new Set<string>(["prism-showoff"]);
    expect(cutsceneForActor("spawn", "star", true, BOSS_ROOM, followed)?.id).toBe("meet-astra-encore");
  });

  it("plays exactly one Astra greeting per run either way", () => {
    for (const history of [["prism-simp"], ["prism-showoff"], []]) {
      const seen = new Set<string>(history);
      const greeting = cutsceneForActor("spawn", "star", true, BOSS_ROOM, seen);
      expect(greeting).not.toBeNull();
      seen.add(greeting!.id);
      expect(cutsceneForActor("spawn", "star", true, BOSS_ROOM, seen)).toBeNull();
    }
  });

  it("lists every gated scene before the fallback it competes with", () => {
    for (const scene of CUTSCENES) {
      if (!scene.after) continue;
      expect(CUTSCENES.some((c) => c.id === scene.after), `${scene.id}: unknown after`).toBe(true);
      // Its ungated twin must sit later, or the gate never gets a look in.
      const gated = CUTSCENES.findIndex((c) => c.id === scene.id);
      const fallback = CUTSCENES.findIndex(
        (c) => c.id !== scene.id && !c.after && JSON.stringify(c.trigger) === JSON.stringify(scene.trigger),
      );
      if (fallback >= 0) expect(gated).toBeLessThan(fallback);
    }
  });

  it("retires every alternative once one of a group has played", () => {
    const groups = new Set(CUTSCENES.map((c) => c.group).filter(Boolean));
    expect(groups.size).toBeGreaterThan(0);
    for (const group of groups) {
      const members = CUTSCENES.filter((c) => c.group === group);
      expect(members.length).toBeGreaterThan(1); // a group of one is a mistake
      for (const played of members) {
        const seen = new Set<string>([played.id]);
        for (const other of members) {
          const t = other.trigger;
          if (t?.kind !== "spawn") continue;
          expect(cutsceneForActor("spawn", t.shape, true, BOSS_ROOM, seen)).toBeNull();
        }
      }
    }
  });

  it("meet-diamonds fires on the first diamond room only", () => {
    const seen = new Set<string>();
    const first = cutsceneForRoom(STAGES["easy-diamonds"], seen);
    expect(first?.id).toBe("meet-diamonds");
    seen.add(first!.id);
    expect(cutsceneForRoom(STAGES["easy-diamonds"], seen)).toBeNull();
  });

  it("meet-bar fires on the first visit to The Bar only", () => {
    const seen = new Set<string>();
    const first = cutsceneForShop(seen);
    expect(first?.id).toBe("meet-bar");
    seen.add(first!.id);
    expect(cutsceneForShop(seen)).toBeNull();
  });

  it("keeps the shop scene out of the room-enter triggers", () => {
    // A shop scene must never fire on walking into a combat room.
    for (const stageId of Object.keys(STAGES)) {
      expect(cutsceneForRoom(STAGES[stageId], new Set())?.id).not.toBe("meet-bar");
    }
  });

  it("only lets friendly actors use the rect shape", () => {
    // `rect` is Bar's; an enemy portrait must come from the enemy shapes.
    for (const scene of CUTSCENES) {
      for (const actor of scene.actors) {
        if (actor.shape === "rect") expect(actor.id).toBe("bar");
        else expect([...ENEMY_SHAPES, "square"]).toContain(actor.shape);
      }
    }
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
