import { COLORS } from "../config";
import { MAX_BOMBS, MAX_LIVES, type Player } from "../entities/Player";

/**
 * The Bar's stock. Score doubles as currency, so every purchase is paid for
 * out of the run's final score — buying survival costs you the scoreboard.
 *
 * Adding an item later is just another entry in `SHOP_STOCK`: give it a price,
 * a `soldOut` rule (what makes it unavailable), and a `buy` effect. The shop
 * screen lays out however many items the list holds and the ShopSystem handles
 * pricing, affordability and purchase counts generically.
 */
export interface ShopItem {
  id: string;
  name: string;
  /** One line under the name. May depend on the player (e.g. "3/5 held"). */
  desc: string | ((player: Player) => string);
  color: string;
  /** Cost of the FIRST purchase this run. */
  price: number;
  /** Added to the price for each earlier purchase of this item this run. */
  priceStep: number;
  /** Why the item can't be bought right now (null = it can). */
  soldOut?: (player: Player) => string | null;
  buy: (player: Player) => void;
}

/** Resolve an item's description for the player standing at the counter. */
export function itemDesc(item: ShopItem, player: Player): string {
  return typeof item.desc === "string" ? item.desc : item.desc(player);
}

/**
 * Prices are steep on purpose: an easy room pays roughly 1.2k, so a first
 * visit buys one thing, maybe two, and never a full restock. Each repeat
 * purchase costs more still (see `priceStep`).
 */
export const SHOP_STOCK: readonly ShopItem[] = [
  {
    id: "repair",
    name: "Repair Plating",
    desc: (p) => `+1 life  ·  ${p.lives}/${MAX_LIVES} held`,
    color: COLORS.boss,
    price: 2500,
    priceStep: 900,
    soldOut: (p) => (p.lives >= MAX_LIVES ? `WELDED SHUT (${MAX_LIVES} MAX)` : null),
    buy: (p) => (p.lives = Math.min(MAX_LIVES, p.lives + 1)),
  },
  {
    id: "bomb",
    name: "Bomb Cache",
    desc: (p) => `+1 bomb  ·  ${p.stats.bombs}/${MAX_BOMBS} held`,
    color: COLORS.enemyBullet,
    price: 1200,
    priceStep: 400,
    soldOut: (p) => (p.stats.bombs >= MAX_BOMBS ? `CELLAR EMPTY (${MAX_BOMBS} MAX)` : null),
    buy: (p) => (p.stats.bombs = Math.min(MAX_BOMBS, p.stats.bombs + 1)),
  },
];
