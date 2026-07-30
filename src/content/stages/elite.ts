import { AIMED, BURST, group, SHAPE_COLOR, type StageDef } from "../stagekit";


/**
 * Elite rooms — one per run map, on the sector's elite layer, reachable from
 * every route. A two-phase mini-boss that pays out double upgrade picks, so
 * taking the harder branch is a real choice. Skip it and it turns up again as
 * the finale's opening act (see `withEscapedElite`).
 *
 * Prism guards a corridor Astra has never asked him to guard, and has been
 * doing so for six hundred cycles. See the `prism-simp` / `prism-showoff`
 * cutscenes for what that sounds like.
 */
export const ELITE_STAGES: readonly StageDef[] = [
  {
    id: "elite-prism",
    name: "THE PRISIMP'S CORRIDOR",
    difficulty: "elite",
    preview: ["hexagon", "diamond"],
    script: [
      // The devotee's guard squad softens the player up first.
      { kind: "wave", enemies: group("diamond", 4, 120, 9, { ...BURST, count: 5, spread: 0.7, speed: 150 }, { sway: 26 }) },
      { kind: "wait", time: 0.8 },
      {
        kind: "boss",
        boss: {
          name: "PRISM, THE PRISIMP",
          shape: "hexagon",
          color: SHAPE_COLOR.hexagon,
          r: 24,
          phases: [
            {
              name: "Facets",
              hp: 300,
              weapons: [{ pattern: "spiral", count: 4, interval: 0.18, speed: 130, angleStep: 0.45, r: 6 }],
            },
            {
              name: "Refraction",
              hp: 380,
              weapons: [
                { pattern: "ring", count: 12, interval: 1.3, speed: 115, angleStep: 0.24, r: 6 },
                { pattern: "aimed", count: 3, spread: 0.5, interval: 1.1, speed: 145, r: 6 },
              ],
            },
          ],
        },
      },
    ],
    bossAdds: () => group("diamond", 4, 55, 8, { ...AIMED, interval: 1.4, speed: 135 }, { sway: 20, entrySpeed: 110 }),
  },
];
