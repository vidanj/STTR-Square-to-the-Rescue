import { SHOP_STOCK, type ShopItem } from "../content/shop";
import type { Player } from "../entities/Player";

/** Why a purchase couldn't happen, or "ok" when it did. */
export type BuyResult = "ok" | "sold-out" | "too-poor";

/**
 * Bar's till. Tracks what has been bought this run so repeat purchases get
 * pricier, and is the single place that decides whether a purchase is legal.
 * Lives on the RunState, so a visit to a second Bar remembers the first.
 */
export class ShopSystem {
  /** Purchases made this run, by item id. */
  private readonly bought = new Map<string, number>();
  /** The last thing that happened at the counter, for the shop screen to show. */
  lastMessage = "";

  /** Everything Bar stocks, in display order. */
  get stock(): readonly ShopItem[] {
    return SHOP_STOCK;
  }

  timesBought(id: string): number {
    return this.bought.get(id) ?? 0;
  }

  /** Current price: the base, plus one step for each earlier purchase. */
  priceOf(item: ShopItem): number {
    return item.price + item.priceStep * this.timesBought(item.id);
  }

  /** Why `item` is unavailable right now, or null if it can be bought. */
  soldOutReason(item: ShopItem, player: Player): string | null {
    return item.soldOut?.(player) ?? null;
  }

  canAfford(item: ShopItem, score: number): boolean {
    return score >= this.priceOf(item);
  }

  /**
   * Attempt a purchase. Returns what happened; on "ok" the caller deducts
   * `priceOf(item)` from the run score (the shop never touches the score
   * itself, so the run stays the single owner of it).
   */
  buy(item: ShopItem, player: Player, score: number): BuyResult {
    const reason = this.soldOutReason(item, player);
    if (reason) {
      this.lastMessage = reason;
      return "sold-out";
    }
    if (!this.canAfford(item, score)) {
      this.lastMessage = "NOT ENOUGH POINTS";
      return "too-poor";
    }
    item.buy(player);
    this.bought.set(item.id, this.timesBought(item.id) + 1);
    this.lastMessage = `BOUGHT ${item.name.toUpperCase()}`;
    return "ok";
  }
}
