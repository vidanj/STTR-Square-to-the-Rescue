import { AIMED, ARC, BURST, group, type StageDef } from "../stagekit";

/**
 * Easy rooms — the map's first layer. One or two light waves of slow, sparse
 * fire so a fresh run can bank an upgrade or two before things get serious.
 */
export const EASY_STAGES: readonly StageDef[] = [
  {
    id: "easy-circles",
    name: "CIRCLE PATROL",
    difficulty: "easy",
    preview: ["circle"],
    script: [
      { kind: "wave", enemies: group("circle", 5, 95, 5, { ...AIMED, interval: 1.7, speed: 110 }, { sway: 16 }) },
      { kind: "wait", time: 0.5 },
      {
        kind: "wave",
        enemies: [
          ...group("circle", 4, 80, 5, { ...AIMED, interval: 1.5, speed: 115 }, { sway: 22 }),
          ...group("circle", 3, 150, 5, { ...AIMED, interval: 1.7, speed: 110 }, { sway: 18 }),
        ],
      },
    ],
  },
  {
    id: "easy-triangles",
    name: "TRIANGLE DRIFT",
    difficulty: "easy",
    preview: ["triangle", "circle"],
    script: [
      { kind: "wave", enemies: group("triangle", 4, 90, 6, { ...ARC, count: 4, spread: 1.2, interval: 2.0, speed: 100 }) },
      { kind: "wait", time: 0.5 },
      {
        kind: "wave",
        enemies: [
          ...group("triangle", 3, 80, 6, { ...ARC, count: 4, spread: 1.3, interval: 1.9, speed: 105 }),
          ...group("circle", 4, 150, 5, { ...AIMED, interval: 1.6, speed: 115 }, { sway: 20 }),
        ],
      },
    ],
  },
  {
    id: "easy-diamonds",
    name: "DIAMOND DUST",
    difficulty: "easy",
    preview: ["diamond"],
    script: [
      { kind: "wave", enemies: group("diamond", 4, 100, 6, { ...BURST, count: 4, spread: 0.6, interval: 1.9, speed: 120 }, { sway: 24 }) },
      { kind: "wait", time: 0.5 },
      {
        kind: "wave",
        enemies: [
          ...group("diamond", 4, 85, 6, { ...BURST, count: 4, spread: 0.65, interval: 1.8, speed: 125 }, { sway: 26 }),
          ...group("diamond", 3, 160, 6, { ...BURST, count: 4, spread: 0.6, interval: 1.9, speed: 120 }, { sway: 20 }),
        ],
      },
    ],
  },
];
