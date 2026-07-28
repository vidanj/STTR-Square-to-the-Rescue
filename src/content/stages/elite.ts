import { AIMED, BURST, group, SHAPE_COLOR, type StageDef } from "../stagekit";


/**
 * Elite rooms — one per run map, placed on a mid layer. A guarded mini-boss
 * (a two-phase Boss with a small radius) that pays out double upgrade picks
 * plus a bomb, so taking the harder branch is a real choice.
 */
export const ELITE_STAGES: readonly StageDef[] = [
  {
    id: "elite-prism",
    name: "PRISM WARDEN",
    difficulty: "elite",
    preview: ["hexagon", "diamond"],
    script: [
      // The warden's guard squad softens the player up first.
      { kind: "wave", enemies: group("diamond", 4, 120, 9, { ...BURST, count: 5, spread: 0.7, speed: 150 }, { sway: 26 }) },
      { kind: "wait", time: 0.8 },
      {
        kind: "boss",
        boss: {
          name: "PRISM, THE WARDEN",
          shape: "hexagon",
          color: SHAPE_COLOR.hexagon,
          r: 24,
          phases: [
            {
              name: "Facets",
              hp: 300,
              weapons: [{ pattern: "spiral", count: 4, interval: 0.18, speed: 130, angleStep: 0.45, r: 6, glow: 6 }],
            },
            {
              name: "Refraction",
              hp: 380,
              weapons: [
                { pattern: "ring", count: 12, interval: 1.3, speed: 115, angleStep: 0.24, r: 6, glow: 6 },
                { pattern: "aimed", count: 3, spread: 0.5, interval: 1.1, speed: 145, r: 6, glow: 6 },
              ],
            },
          ],
        },
      },
    ],
    bossAdds: () => group("diamond", 4, 55, 8, { ...AIMED, interval: 1.4, speed: 135 }, { sway: 20, entrySpeed: 110 }),
  },
];
