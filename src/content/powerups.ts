import { COLORS } from "../config";
import type { Player } from "../entities/Player";
import { SHOT_COLOR, type ShotType } from "./shots";

/** Card text that can depend on what the player already owns. */
export type CardText = string | ((player: Player) => string);

/** Resolve a name/description for the player it is being offered to. */
export function cardText(t: CardText, player: Player): string {
  return typeof t === "string" ? t : t(player);
}

/** An in-run upgrade. `apply` mutates the player (stats and/or shot streams). */
export interface PowerUp {
  id: string;
  name: CardText;
  desc: CardText;
  color: string;
  /** Set for shot upgrades, so cards can show which level they'd grant. */
  shot?: ShotType;
  apply(player: Player): void;
}

const MIN_FIRE_INTERVAL = 0.05;

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

/**
 * Card title for a shot upgrade: the level it would grant, or "NEW STREAM"
 * when every stream of that type is already maxed and the pick opens another.
 */
function shotName(base: string, shot: ShotType): CardText {
  return (p) => {
    const lvl = p.nextLevel(shot);
    if (lvl > 1) return `${base} ${ROMAN[lvl] ?? lvl}`;
    return p.streamCount(shot) > 0 ? `${base} (NEW)` : base;
  };
}

/**
 * Description for a shot upgrade. `steps[i]` describes reaching level i+1; the
 * "all maxed, here's another one" case gets its own line so the player knows
 * the pick widens rather than deepens.
 */
function shotDesc(steps: readonly string[], shot: ShotType, fresh: string): CardText {
  return (p) => {
    const lvl = p.nextLevel(shot);
    if (lvl === 1 && p.streamCount(shot) > 0) return fresh;
    return steps[lvl - 1] ?? steps[steps.length - 1];
  };
}

/**
 * The full pool of power-ups, all repeatable across a run. Lives and bombs are
 * deliberately NOT in here: the only source for either is Bar's shop
 * (`src/content/shop.ts`), so surviving is something you spend score on.
 *
 * Stat upgrades (rapid/power) stack globally. Every SHOT upgrade instead levels
 * an existing stream of its type along a hand-authored ladder (see
 * `src/content/shots.ts`); once every stream of that type has hit
 * `MAX_SHOT_LEVEL`, the next pick opens a fresh level-1 stream of the same
 * type — so any shot can be invested in for the whole run.
 */
export const POWERUPS: readonly PowerUp[] = [
  {
    id: "rapid",
    name: "Rapid Fire",
    desc: "Fire 18% faster.",
    color: COLORS.player,
    apply: (p) => (p.stats.fireInterval = Math.max(MIN_FIRE_INTERVAL, p.stats.fireInterval * 0.82)),
  },
  {
    id: "power",
    name: "Sharpened Edge",
    desc: "+1 damage to every stream.",
    color: COLORS.hurtbox,
    apply: (p) => (p.stats.damage += 1),
  },
  {
    id: "pierce",
    name: shotName("Piercing Rounds", "pierce"),
    desc: shotDesc(
      [
        "Add a stream that drills through 2 enemies.",
        "Drills 4 enemies, and gains damage with each one pierced.",
        "Drills 6 enemies as a bigger, faster lance.",
        "Drills through everything, +1 damage.",
      ],
      "pierce",
      "Add a second piercing stream, back at 2 pierces.",
    ),
    color: SHOT_COLOR.pierce,
    shot: "pierce",
    apply: (p) => p.addShotType("pierce"),
  },
  {
    id: "bounce",
    name: shotName("Ricochet", "ricochet"),
    desc: shotDesc(
      [
        "Add a stream that rebounds twice — off walls AND off enemies, hitting each one. Half damage.",
        "4 rebounds per shot, and they hit harder.",
        "6 rebounds, and every rebound adds +1 damage.",
        "8 rebounds, the floor bounces too, and full damage.",
      ],
      "ricochet",
      "Add a second bouncing stream, back at 2 rebounds.",
    ),
    color: SHOT_COLOR.ricochet,
    shot: "ricochet",
    apply: (p) => p.addShotType("ricochet"),
  },
  {
    id: "rotating",
    name: shotName("Rotating Shot", "rotating"),
    desc: shotDesc(
      [
        "Main shot spins for 1.5× damage.",
        "The spinning shot slows down and grows as it flies.",
        "It grows faster, filling more of the lane.",
        "Fastest growth — a wall of square.",
      ],
      "rotating",
      "Add a second spinning stream, back at 1.5× damage.",
    ),
    color: SHOT_COLOR.rotating,
    shot: "rotating",
    apply: (p) => p.addShotType("rotating"),
  },
  {
    id: "scatter",
    name: shotName("Scatter", "scatter"),
    desc: shotDesc(
      [
        "Add a close-range cone of 3 pellets.",
        "5 pellets per volley.",
        "Pellets bounce once off walls.",
        "7 pellets in a tighter cone.",
      ],
      "scatter",
      "Add a second scatter stream, back at 3 pellets.",
    ),
    color: SHOT_COLOR.scatter,
    shot: "scatter",
    apply: (p) => p.addShotType("scatter"),
  },
  {
    id: "homing",
    name: shotName("Homing Splinter", "homing"),
    desc: shotDesc(
      [
        "A slow splinter drifts toward the nearest enemy. Half damage.",
        "2 splinters, and they steer noticeably better.",
        "Sharp turns now — they rarely lose a target. 80% damage.",
        "3 splinters, tightest tracking, full damage.",
      ],
      "homing",
      "Add a second homing stream, back at 1 loose splinter.",
    ),
    color: SHOT_COLOR.homing,
    shot: "homing",
    apply: (p) => p.addShotType("homing"),
  },
  {
    id: "orbit",
    name: shotName("Orbit Shield", "orbit"),
    desc: shotDesc(
      [
        "A small square orbits you, eating enemy bullets it touches.",
        "The shield grows slightly and orbits faster.",
        "Bigger and faster still.",
        "Bigger and faster still.",
        "Near its maximum size, sweeping quickly.",
        "Maximum size and orbit speed.",
      ],
      "orbit",
      "Add a second shield square, orbiting out of phase.",
    ),
    color: SHOT_COLOR.orbit,
    shot: "orbit",
    apply: (p) => p.addShotType("orbit"),
  },
];
