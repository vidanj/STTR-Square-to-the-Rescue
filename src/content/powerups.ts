import { COLORS } from "../config";
import type { Player } from "../entities/Player";

/** An in-run upgrade. `apply` mutates the player (stats and/or shot streams). */
export interface PowerUp {
  id: string;
  name: string;
  desc: string;
  color: string;
  apply(player: Player): void;
}

const MIN_FIRE_INTERVAL = 0.05;

/**
 * The full pool of power-ups, all repeatable across a run.
 *
 * Stat upgrades (rapid/power/swift) stack globally. Pierce/ricochet each ADD a
 * parallel shot stream fired from a nearby origin; the default stream is always
 * kept, so streams accumulate as you pick. Rotating is the exception — it
 * upgrades the default stream in place (spin + 1.5× damage, then growth,
 * then faster growth per repeat).
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
    name: "Piercing Rounds",
    desc: "Add a stream that pierces enemies.",
    color: COLORS.good,
    apply: (p) => p.addShotType("pierce"),
  },
  {
    id: "bounce",
    name: "Ricochet",
    desc: "Add a stream that bounces off walls.",
    color: COLORS.accent,
    apply: (p) => p.addShotType("ricochet"),
  },
  {
    id: "rotating",
    name: "Rotating Shot",
    desc: "Main shot spins for 1.5× damage; repeats make it grow in flight.",
    color: COLORS.eat,
    apply: (p) => p.addShotType("rotating"),
  },
  {
    id: "swift",
    name: "Swift Frame",
    desc: "Move faster.",
    color: COLORS.playerBullet,
    apply: (p) => {
      p.stats.moveSpeed += 45;
      p.stats.focusSpeed += 20;
    },
  },
  {
    id: "life",
    name: "Spare Square",
    desc: "+1 life.",
    color: COLORS.boss,
    apply: (p) => (p.lives += 1),
  },
  {
    id: "bomb",
    name: "Bomb Cache",
    desc: "+1 bomb.",
    color: COLORS.enemyBullet,
    apply: (p) => (p.stats.bombs += 1),
  },
];
