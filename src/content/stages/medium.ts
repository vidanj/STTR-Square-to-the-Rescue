import { AIMED, ARC, BURST, RING, SPIRAL, group, type StageDef } from "../stagekit";

/**
 * Medium rooms — the map's middle layers. Two waves of mixed-shape formations
 * in the old stage-1 wave 3–5 range: real pattern reading, but survivable with
 * one or two upgrades banked.
 */
export const MEDIUM_STAGES: readonly StageDef[] = [
  {
    id: "medium-rings",
    name: "PENTAGON BATTERY",
    difficulty: "medium",
    preview: ["pentagon", "circle"],
    script: [
      {
        kind: "wave",
        enemies: [
          ...group("pentagon", 3, 100, 11, { ...RING, count: 9 }),
          ...group("circle", 4, 170, 7, { ...AIMED, interval: 1.4, speed: 130 }, { sway: 22 }),
        ],
      },
      { kind: "wait", time: 0.5 },
      {
        kind: "wave",
        enemies: [
          ...group("pentagon", 3, 100, 12, { ...RING, count: 11, angleStep: 0.3 }),
          ...group("circle", 4, 170, 8, { ...AIMED, interval: 1.2, speed: 140 }, { sway: 26 }),
        ],
      },
    ],
  },
  {
    id: "medium-spirals",
    name: "HEXAGON SPIN",
    difficulty: "medium",
    preview: ["hexagon", "diamond"],
    script: [
      {
        kind: "wave",
        enemies: [
          ...group("hexagon", 4, 100, 11, SPIRAL, { sway: 22 }),
          ...group("diamond", 3, 170, 8, { ...BURST, count: 5, spread: 0.7, speed: 150 }, { sway: 28 }),
        ],
      },
      { kind: "wait", time: 0.5 },
      {
        kind: "wave",
        enemies: [
          ...group("hexagon", 5, 90, 12, { ...SPIRAL, interval: 0.23, speed: 130 }, { sway: 20 }),
          ...group("diamond", 4, 170, 9, { ...BURST, count: 5, spread: 0.75, speed: 155 }, { sway: 30 }),
        ],
      },
    ],
  },
  {
    id: "medium-mixed",
    name: "MIXED ASSAULT",
    difficulty: "medium",
    preview: ["circle", "triangle", "diamond"],
    script: [
      // Twin-shot circles up top, triangle curtains below (old wave 4).
      {
        kind: "wave",
        enemies: [
          ...group("circle", 6, 80, 8, { ...AIMED, count: 2, spread: 0.3, interval: 1.1, speed: 140 }, { sway: 24 }),
          ...group("triangle", 4, 150, 11, { ...ARC, count: 7, spread: 1.6 }),
        ],
      },
      { kind: "wait", time: 0.5 },
      // Three-shape mix (old wave 5, triangles standing in for pentagons).
      {
        kind: "wave",
        enemies: [
          ...group("circle", 4, 70, 8, { ...AIMED, interval: 1.2, speed: 150 }, { sway: 26 }),
          ...group("diamond", 4, 130, 10, { ...BURST, count: 6, speed: 160 }, { sway: 30 }),
          ...group("triangle", 3, 190, 12, { ...ARC, count: 7, spread: 1.7 }),
        ],
      },
    ],
  },
];
