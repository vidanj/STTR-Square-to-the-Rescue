import { describe, expect, it } from "vitest";
import { MAX_BOMBS, MAX_LIVES, Player } from "../entities/Player";
import { ShopSystem } from "../systems/ShopSystem";
import { POWERUPS } from "./powerups";
import { SHOP_STOCK, itemDesc } from "./shop";

const item = (id: string) => SHOP_STOCK.find((i) => i.id === id)!;

describe("shop stock", () => {
  it("has unique ids and a readable card for any player state", () => {
    const ids = SHOP_STOCK.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of SHOP_STOCK) {
      expect(entry.price).toBeGreaterThan(0);
      expect(itemDesc(entry, new Player()).length).toBeGreaterThan(0);
    }
  });

  it("is the only source of lives and bombs — no upgrade grants either", () => {
    const before = new Player();
    for (const up of POWERUPS) {
      const p = new Player();
      // Apply each upgrade a few times; neither resource may move.
      for (let i = 0; i < 6; i++) up.apply(p);
      expect(p.lives, `${up.id} changed lives`).toBe(before.lives);
      expect(p.stats.bombs, `${up.id} changed bombs`).toBe(before.stats.bombs);
    }
  });
});

describe("the till", () => {
  it("refuses a purchase the player can't afford, and charges nothing", () => {
    const shop = new ShopSystem();
    const player = new Player();
    const bomb = item("bomb");
    expect(shop.buy(bomb, player, shop.priceOf(bomb) - 1)).toBe("too-poor");
    expect(player.stats.bombs).toBe(new Player().stats.bombs);
    expect(shop.timesBought("bomb")).toBe(0);
  });

  it("charges more for each repeat purchase", () => {
    const shop = new ShopSystem();
    const player = new Player();
    const bomb = item("bomb");
    const first = shop.priceOf(bomb);
    expect(shop.buy(bomb, player, 999_999)).toBe("ok");
    const second = shop.priceOf(bomb);
    expect(second).toBe(first + bomb.priceStep);
    expect(shop.buy(bomb, player, 999_999)).toBe("ok");
    expect(shop.priceOf(bomb)).toBe(first + bomb.priceStep * 2);
  });

  it("stops selling at the caps, even to a rich player", () => {
    const shop = new ShopSystem();
    const player = new Player();

    for (let i = 0; i < 20; i++) shop.buy(item("bomb"), player, 999_999);
    expect(player.stats.bombs).toBe(MAX_BOMBS);
    expect(shop.soldOutReason(item("bomb"), player)).not.toBeNull();
    expect(shop.buy(item("bomb"), player, 999_999)).toBe("sold-out");

    for (let i = 0; i < 20; i++) shop.buy(item("repair"), player, 999_999);
    expect(player.lives).toBe(MAX_LIVES);
    expect(shop.buy(item("repair"), player, 999_999)).toBe("sold-out");
  });

  it("prices a full restock well past one room's takings", () => {
    // An easy room pays roughly 1.2k; topping up must cost several rooms.
    const shop = new ShopSystem();
    const player = new Player();
    let spent = 0;
    while (shop.soldOutReason(item("repair"), player) === null) {
      spent += shop.priceOf(item("repair"));
      shop.buy(item("repair"), player, 999_999);
    }
    expect(spent).toBeGreaterThan(5000);
  });
});
