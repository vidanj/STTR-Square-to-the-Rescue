import { COLORS, type Shape } from "../../config";
import type { Weapon } from "../patterns";
import { AIMED, BURST, SPIRAL, group, type StageDef } from "../stagekit";

/**
 * The final room — every run map converges here. A lone star with three
 * escalating phases; each phase break brings a tougher squad of reinforcements.
 */

/** Per-phase reinforcement tiers: circles → diamonds → hexagons. */
const ADD_TIERS: { shape: Shape; hp: number; weapon: Partial<Weapon> }[] = [
  { shape: "circle", hp: 5, weapon: { ...AIMED, interval: 1.3, speed: 130 } },
  { shape: "diamond", hp: 9, weapon: { ...BURST, count: 4, spread: 0.6, interval: 1.4, speed: 150 } },
  { shape: "hexagon", hp: 13, weapon: { ...SPIRAL, count: 3, interval: 0.25, speed: 130 } },
];

export const BOSS_STAGES: readonly StageDef[] = [
  {
    id: "boss-astra",
    name: "STAR NEXUS",
    difficulty: "boss",
    preview: ["star"],
    script: [
      { kind: "wait", time: 1 },
      {
        kind: "boss",
        boss: {
          name: "ASTRA, THE FIVE-POINT",
          shape: "star",
          color: COLORS.boss,
          r: 30,
          phases: [
            {
              name: "Overture",
              hp: 360,
              weapons: [{ pattern: "aimed", count: 5, spread: 0.9, interval: 0.9, speed: 150, r: 6, glow: 6 }],
            },
            {
              name: "Spin Cycle",
              hp: 510,
              weapons: [
                { pattern: "spiral", count: 5, interval: 0.12, speed: 140, angleStep: 0.35, r: 6, glow: 6 },
              ],
            },
            {
              // Finale — Spin Cycle's spiral AND Supernova's ring at once.
              name: "Supernova",
              hp: 660,
              weapons: [
                { pattern: "spiral", count: 5, interval: 0.12, speed: 140, angleStep: 0.35, r: 6, glow: 6 },
                { pattern: "ring", count: 14, interval: 1.0, speed: 120, angleStep: 0.2, r: 6, glow: 6 },
              ],
            },
          ],
        },
      },
    ],
    bossAdds: (phase) => {
      const tier = ADD_TIERS[Math.min(phase, ADD_TIERS.length - 1)];
      return group(tier.shape, 5, 55, tier.hp, tier.weapon, { sway: 18, entrySpeed: 110 });
    },
  },
];
