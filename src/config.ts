/**
 * Global tuning constants. Gameplay is authored against a fixed logical
 * resolution; the canvas is scaled to fit the window in the Renderer.
 */

/** Display title. */
export const TITLE = "SQUARE TO THE RESCUE";
export const SUBTITLE = "STTR";

/**
 * Every drawable actor and its bullets share a shape. The player (and its
 * shots) are always squares; enemies are anything BUT squares, and their
 * bullets copy their shape — so the player can read friend vs. foe at a glance.
 *
 * `rect` is the odd one out: it is reserved for friendly NPCs (Bar, who runs
 * the shop) and never appears on an enemy or a bullet, so a stretched square
 * always reads as "someone who isn't shooting at you".
 */
export type Shape =
  | "square"
  | "circle"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "rect";

/** Shapes enemies/bosses are allowed to use (never "square", never "rect"). */
export const ENEMY_SHAPES: readonly Shape[] = ["circle", "triangle", "diamond", "pentagon", "hexagon", "star"];

/** Logical play-field width in pixels. */
export const WIDTH = 480;
/** Logical play-field height in pixels. */
export const HEIGHT = 720;

/** Fixed simulation step in seconds (60 Hz). Bullet patterns assume this. */
export const DT = 1 / 60;
/** Upper bound on sub-steps per frame so a stall can't spiral. */
export const MAX_STEPS = 5;

/**
 * Audio mix. Every sound and every note of music is synthesized in code (see
 * `src/audio/`) — these are the knobs, not asset paths.
 */
export const AUDIO = {
  /** Default master volume, 0..1. The player's own choice is remembered. */
  volume: 0.8,
  /** How much one −/+ press moves the master volume. */
  volumeStep: 0.1,
  /** Bus levels under the master. Music sits back so combat cues read. */
  music: 0.38,
  sfx: 1,
  /** Seconds to crossfade from one music track to the next. */
  crossfade: 0.8,
  /** Most sound effects allowed at once; past this, minor ones are dropped. */
  maxVoices: 24,
} as const;

/** Neon-ish palette used across renderer + UI. */
export const COLORS = {
  bg: "#05060d",
  bgGrid: "rgba(80, 120, 255, 0.05)",
  player: "#6cf0ff",
  playerCore: "#ffffff",
  hurtbox: "#ff3b6b",
  playerBullet: "#aef7ff",
  enemy: "#ff5bd0",
  enemyBullet: "#ffcf5b",
  boss: "#ff6b6b",
  bossBullet: "#ff9a3b",
  text: "#e6e9ff",
  textDim: "rgba(230, 233, 255, 0.6)",
  accent: "#8f7bff",
  good: "#7bffca",
  eat: "#ff9d5c",
} as const;
