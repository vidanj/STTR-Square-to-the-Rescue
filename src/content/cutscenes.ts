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
 * When a scene auto-plays. Every trigger fires at most once per run.
 *
 * - `room-enter` — at the START of a room whose stage script contains `shape`
 *   anywhere. The room sits frozen behind the dialog before the first wave.
 * - `shop-enter` — the first time the player walks into The Bar.
 * - `spawn` — the moment something of `shape` actually walks in, mid-room.
 *   Set `boss: true` to mean "only when it's a boss of that shape" (a star
 *   mini-enemy then won't fire the boss's entrance scene).
 * - `defeat` — the moment something of `shape` goes down. `boss` narrows it the
 *   same way; a boss `defeat` scene plays before the room reports its clear.
 *
 * `spawn`/`defeat` also take an optional `stage` id, which pins the scene to
 * one room. That's what lets the same character have different things to say
 * depending on where they turn up — Prism guarding his own corridor versus
 * Prism gatecrashing the finale.
 *
 * Scenes without a trigger only play when started from code.
 */
export type CutsceneTrigger =
  | { kind: "room-enter"; shape: Shape }
  | { kind: "shop-enter" }
  | { kind: "spawn"; shape: Shape; boss?: boolean; stage?: string }
  | { kind: "defeat"; shape: Shape; boss?: boolean; stage?: string };

export interface Cutscene {
  id: string;
  trigger?: CutsceneTrigger;
  /**
   * Only auto-play if the scene with this id has already been seen this run.
   * Two scenes can then share a trigger and pick themselves by what the player
   * has actually been through — list the gated one FIRST, since the first
   * match wins. Astra's greeting uses this: she has a different (equally
   * uninterested) remark depending on where Prism died.
   */
  after?: string;
  /**
   * Scenes sharing a group are **alternatives**: once one of them has played,
   * none of the others can. Use it with `after` to write one beat several ways
   * and let the run pick — whichever variant fires retires the rest.
   */
  group?: string;
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

/** The barkeep of The Bar: a square someone sat on. Reuse in any Bar scene. */
export const BAR: CutsceneActor = {
  id: "bar",
  name: "BAR",
  shape: "rect",
  color: SHAPE_COLOR.rect,
  side: "right",
};

/** The sector's leading lady. Five points, zero interest in anyone's feelings. */
export const ASTRA: CutsceneActor = {
  id: "astra",
  name: "ASTRA",
  shape: "star",
  color: COLORS.boss,
  side: "right",
};

/** Her self-appointed guard. She has never once asked him to be. */
export const PRISM: CutsceneActor = {
  id: "prism",
  name: "PRISM",
  shape: "hexagon",
  color: SHAPE_COLOR.hexagon,
  side: "right",
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
      { actor: "squero", text: "Diamonds? You are just squares rotating 90 degrees, you traitors!" },
      { actor: "diamond", text: "SHUT UP! WE ARE DIAMONDS!" },
    ],
  },
  // First time Squero pushes open the door of The Bar.
  {
    id: "meet-bar",
    trigger: { kind: "shop-enter" },
    actors: [SQUERO, BAR],
    lines: [
      { actor: "squero", text: "A bar. Out here. In the middle of a war." },
      { actor: "bar", text: "THE Bar. I'm Bar. It's my bar. Ask me the joke, I dare you." },
      { actor: "squero", text: "You're a rectangle." },
      { actor: "bar", text: "I'm a square who put in the hours, kid. Stretched myself thin." },
      { actor: "bar", text: "Points on the counter and I'll patch you up. No credit. No refunds." },
      { actor: "squero", text: "Everyone out there is trying to kill me and you're charging me?" },
      { actor: "bar", text: "Everyone out there isn't running a business. What'll it be?" },
    ],
  },
  // Prism in his own corridor. Squero is not equipped for this conversation.
  {
    id: "prism-simp",
    trigger: { kind: "spawn", shape: "hexagon", boss: true, stage: "elite-prism" },
    actors: [SQUERO, PRISM],
    lines: [
      { actor: "prism", text: "HALT. None may pass to Lady Astra. I am PRISM, THE PRISIMP." },
      { actor: "squero", text: "You are the what?" },
      { actor: "prism", text: "Her most devoted facet. I have held this corridor six hundred cycles." },
      { actor: "squero", text: "Does she know that?" },
      { actor: "prism", text: "She looked at me once. Possibly at something behind me. It was ambiguous." },
      { actor: "squero", text: "Okay. I'm going to walk around you now." },
      { actor: "prism", text: "You will walk around NOTHING! I REFRACT FOR HER!" },
      { actor: "squero", text: "I don't know what that means and I've decided not to find out." },
    ],
  },
  // ...and Prism when the corridor was skipped: he followed you to the finale
  // to do it in front of her. This is worse.
  {
    id: "prism-showoff",
    trigger: { kind: "spawn", shape: "hexagon", boss: true, stage: "boss-astra" },
    actors: [SQUERO, PRISM, ASTRA],
    lines: [
      { actor: "prism", text: "LADY ASTRA! I have tracked the square across the sector to lay it at your points!" },
      { actor: "astra", text: "Who is that?" },
      { actor: "prism", text: "It's PRISM! Your PRISIMP! From the corridor!" },
      { actor: "astra", text: "I have a corridor?" },
      { actor: "squero", text: "You skipped a whole room to be ignored in a nicer one." },
      { actor: "prism", text: "I am WARMING UP for her." },
      { actor: "astra", text: "Warm up somewhere else, hexagon. You're standing in my light." },
      { actor: "prism", text: "She SPOKE to me. WITNESS IT, SQUARE!" },
      { actor: "squero", text: "I'm going to fight both of you and learn nothing more about this." },
    ],
  },
  // Squero meets Astra — held until she actually descends, not on room entry.
  // Two versions, and the run picks one: this first variant only plays if
  // Prism followed you here and detonated at her feet moments ago. Listed
  // before the default so the `after` gate gets first refusal.
  {
    id: "meet-astra-encore",
    trigger: { kind: "spawn", shape: "star", boss: true },
    after: "prism-showoff",
    group: "astra-greeting",
    actors: [SQUERO, ASTRA],
    lines: [
      { actor: "astra", text: "Something detonated in my light a moment ago. Was that yours?" },
      { actor: "squero", text: "That was your hexagon." },
      { actor: "astra", text: "I don't have a hexagon." },
      { actor: "squero", text: "He was extremely confident that you did." },
      { actor: "astra", text: "They always are. It has never once come up on my end." },
      { actor: "squero", text: "Great. Are we doing this, or is there more of him to discuss?" },
      { actor: "astra", text: "Oh, I like you, little square. But I have five points. You only have four." },
      { actor: "squero", text: "Four is plenty." },
    ],
  },
  // The default: Prism died back in his corridor, and she has no idea who that
  // was either.
  {
    id: "meet-astra",                                   // unique; used to fire once per run
    trigger: { kind: "spawn", shape: "star", boss: true },
    group: "astra-greeting",
    actors: [SQUERO, ASTRA],
    lines: [
      { actor: "squero", text: "So you're the one bending every shape in this sector." },
      { actor: "astra", text: "They bend themselves, darling. I simply stand here having five points." },
      { actor: "astra", text: "And you only have four." },
      { actor: "squero", text: "Four is plenty." },
    ],
  },

];

/**
 * Whether a scene may auto-play right now: not already seen, its `after` gate
 * satisfied, and no sibling from its `group` already spent.
 */
function ready(scene: Cutscene, seen: ReadonlySet<string>): boolean {
  if (seen.has(scene.id)) return false;
  if (scene.after && !seen.has(scene.after)) return false;
  if (scene.group && CUTSCENES.some((c) => c.group === scene.group && seen.has(c.id))) return false;
  return true;
}

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
    if (scene.trigger?.kind !== "room-enter" || !ready(scene, seen)) continue;
    if (shapes.has(scene.trigger.shape)) return scene;
  }
  return null;
}

/** First unseen cutscene triggered by walking into The Bar, if any. */
export function cutsceneForShop(seen: ReadonlySet<string>): Cutscene | null {
  for (const scene of CUTSCENES) {
    if (scene.trigger?.kind === "shop-enter" && ready(scene, seen)) return scene;
  }
  return null;
}

/**
 * First unseen cutscene for something of `shape` spawning or dying mid-room.
 * `isBoss` distinguishes a boss from a rank-and-file enemy of the same shape,
 * so a `boss: true` trigger only fires for the real thing.
 */
export function cutsceneForActor(
  kind: "spawn" | "defeat",
  shape: Shape,
  isBoss: boolean,
  stageId: string,
  seen: ReadonlySet<string>,
): Cutscene | null {
  for (const scene of CUTSCENES) {
    const t = scene.trigger;
    if (!t || t.kind !== kind || !ready(scene, seen)) continue;
    if (t.shape !== shape) continue;
    if (t.boss && !isBoss) continue;
    if (t.stage && t.stage !== stageId) continue;
    return scene;
  }
  return null;
}
