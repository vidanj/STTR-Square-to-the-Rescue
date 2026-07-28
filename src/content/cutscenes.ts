import { COLORS, type Shape } from "../config";
import { SHAPE_COLOR, type StageDef } from "./stagekit";

/**
 * Cutscenes: visual-novel style dialog scenes that freeze the game and play a
 * short exchange between big shape "portraits". Authored by hand here — see
 * DOCS/cutscenes.md for the full guide to adding scenes.
 */

/** A character on the cutscene stage. One actor per side fits the layout. */
export interface CutsceneActor {
  id: string;
  /** Shown in the name tag while this actor speaks. */
  name: string;
  shape: Shape;
  color: string;
  /** Which side of the screen the portrait stands on. */
  side: "left" | "right";
}

/** One dialog line; `actor` is the speaking actor's id. */
export interface CutsceneLine {
  actor: string;
  text: string;
}

/**
 * When a scene auto-plays. `room-enter` fires the first time (per run) the
 * player enters a room whose stage contains the given enemy shape.
 * Scenes without a trigger only play when started from code.
 */
export type CutsceneTrigger = { kind: "room-enter"; shape: Shape };

export interface Cutscene {
  id: string;
  trigger?: CutsceneTrigger;
  actors: CutsceneActor[];
  lines: CutsceneLine[];
}

/** The protagonist's recurring portrait — reuse in any scene Squero is in. */
export const SQUERO: CutsceneActor = {
  id: "squero",
  name: "SQUERO",
  shape: "square",
  color: COLORS.player,
  side: "left",
};

export const CUTSCENES: readonly Cutscene[] = [
  
  {
    id: "testing",                                   // unique; used to fire once per run
    // trigger: { kind: "room-enter", shape: "circle" },     // optional — see Triggers
    actors: [
      SQUERO,                                           // the shared protagonist actor
      { id: "astra", name: "ASTRA", shape: "star", color: COLORS.boss, side: "right" },
    ],
    lines: [
      { actor: "squero", text: "So you're the one bending every shape in this sector." },
      { actor: "astra", text: "Five points, little square. You only have four." },
      { actor: "squero", text: "Four is plenty." },
    ],
  },
  // Squero meets the diamonds — plays in the first room of a run that has them.
  {
    id: "meet-diamonds",
    trigger: { kind: "room-enter", shape: "diamond" },
    actors: [
      SQUERO,
      { id: "diamond", name: "DIAMOND", shape: "diamond", color: SHAPE_COLOR.diamond, side: "right" },
    ],
    lines: [
      { actor: "squero", text: "Diamonds? You just squares rotating 90 degrees, you traitors!" },
      { actor: "diamond", text: "SHUT UP! WE ARE DIAMONDS!" },
    ],
  },
  // Squero meets Astra
  {
    id: "meet-astra",                                   // unique; used to fire once per run
    trigger: { kind: "room-enter", shape: "star" },     // optional — see Triggers
    actors: [
      SQUERO,                                           // the shared protagonist actor
      { id: "astra", name: "ASTRA", shape: "star", color: COLORS.boss, side: "right" },
    ],
    lines: [
      { actor: "squero", text: "So you're the one bending every shape in this sector." },
      { actor: "astra", text: "Five points, little square. You only have four." },
      { actor: "squero", text: "Four is plenty." },
    ],
  },

];

/** Every enemy shape that appears anywhere in a stage's script. */
function stageShapes(stage: StageDef): Set<Shape> {
  const used = new Set<Shape>();
  for (const ev of stage.script) {
    if (ev.kind === "wave") for (const e of ev.enemies) used.add(e.shape);
    if (ev.kind === "boss") used.add(ev.boss.shape);
  }
  return used;
}

/** First unseen cutscene triggered by entering a room of this stage, if any. */
export function cutsceneForRoom(stage: StageDef, seen: ReadonlySet<string>): Cutscene | null {
  const shapes = stageShapes(stage);
  for (const scene of CUTSCENES) {
    if (scene.trigger?.kind !== "room-enter" || seen.has(scene.id)) continue;
    if (shapes.has(scene.trigger.shape)) return scene;
  }
  return null;
}
