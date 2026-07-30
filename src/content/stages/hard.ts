import { ARC, BURST, RING, SPIRAL, AIMED, group, type StageDef } from "../stagekit";

/**
 * Hard rooms — the last layers before the boss. Dense, tanky, every shape
 * firing at once. Two of them, so a sector's two hard layers never repeat the
 * same room side by side.
 */
export const HARD_STAGES: readonly StageDef[] = [
  {
    id: "hard-gauntlet",
    name: "THE GAUNTLET",
    difficulty: "hard",
    preview: ["triangle", "hexagon", "diamond", "pentagon", "circle"],
    script: [
      // Dense: triangles, spinning hexagons, aggressive diamonds.
      {
        kind: "wave",
        enemies: [
          ...group("triangle", 4, 75, 11, { ...ARC, count: 7, spread: 1.7, interval: 1.5, speed: 125 }),
          ...group("hexagon", 4, 140, 13, { ...SPIRAL, count: 4, interval: 0.22, speed: 130 }, { sway: 20 }),
          ...group("diamond", 3, 200, 10, { ...BURST, count: 6, spread: 0.9, interval: 1.3, speed: 165 }, { sway: 34 }),
        ],
      },
      { kind: "wait", time: 0.5 },
      // Heavy artillery: fat pentagon rings + fast hexagon spirals.
      {
        kind: "wave",
        enemies: [
          ...group("pentagon", 4, 95, 15, { ...RING, count: 14, interval: 1.5, speed: 110, angleStep: 0.28 }),
          ...group("hexagon", 5, 175, 14, { ...SPIRAL, count: 4, interval: 0.2, speed: 135, angleStep: 0.6 }, { sway: 24 }),
        ],
      },
      { kind: "wait", time: 0.5 },
      // Finale: all five shapes at once, tanky.
      {
        kind: "wave",
        enemies: [
          ...group("circle", 4, 65, 10, { ...AIMED, count: 2, spread: 0.35, interval: 1.0, speed: 150 }, { sway: 22 }),
          ...group("triangle", 3, 110, 13, { ...ARC, count: 8, spread: 1.8, interval: 1.4, speed: 130 }),
          ...group("diamond", 3, 150, 12, { ...BURST, count: 6, spread: 0.9, interval: 1.3, speed: 165 }, { sway: 30 }),
          ...group("pentagon", 3, 195, 16, { ...RING, count: 14, interval: 1.5, speed: 110, angleStep: 0.3 }),
          ...group("hexagon", 3, 235, 15, { ...SPIRAL, count: 4, interval: 0.2, speed: 135, angleStep: 0.6 }, { sway: 20 }),
        ],
      },
    ],
  },
  {
    id: "hard-crossfire",
    name: "THE CROSSFIRE",
    difficulty: "hard",
    preview: ["pentagon", "circle", "hexagon", "triangle", "diamond"],
    script: [
      // Opens wide: two pentagon ring emplacements with fast circles between
      // them, so the safe lanes are narrow from the first second.
      {
        kind: "wave",
        enemies: [
          ...group("pentagon", 2, 85, 16, { ...RING, count: 16, interval: 1.4, speed: 105, angleStep: 0.22 }),
          ...group("circle", 6, 150, 9, { ...AIMED, count: 2, spread: 0.3, interval: 0.9, speed: 165 }, { sway: 30 }),
        ],
      },
      { kind: "wait", time: 0.6 },
      // Counter-rotating hexagon spirals: the lanes sweep the opposite way.
      {
        kind: "wave",
        enemies: [
          ...group("hexagon", 3, 90, 16, { ...SPIRAL, count: 5, interval: 0.19, speed: 130, angleStep: 0.55 }, { sway: 26 }),
          ...group("hexagon", 3, 165, 16, { ...SPIRAL, count: 5, interval: 0.19, speed: 130, angleStep: -0.55 }, { sway: 26 }),
        ],
      },
      { kind: "wait", time: 0.6 },
      // Finale: heavy triangles walling the top while diamonds dive the gaps.
      {
        kind: "wave",
        enemies: [
          ...group("triangle", 5, 70, 14, { ...ARC, count: 9, spread: 2.0, interval: 1.3, speed: 135 }),
          ...group("diamond", 4, 145, 13, { ...BURST, count: 7, spread: 1.0, interval: 1.2, speed: 175 }, { sway: 38 }),
          ...group("pentagon", 2, 210, 18, { ...RING, count: 16, interval: 1.4, speed: 115, angleStep: 0.26 }),
        ],
      },
    ],
  },
];
