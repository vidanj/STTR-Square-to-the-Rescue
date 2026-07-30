import { COLORS, HEIGHT, WIDTH } from "../config";
import { itemDesc, type ShopItem } from "../content/shop";
import { SHAPE_COLOR } from "../content/stagekit";
import type { Input } from "../core/Input";
import type { RunState } from "../core/RunState";
import type { Renderer } from "../render/Renderer";

// Bar stands behind the counter; the stock is laid out below it.
const BAR_Y = 158;
const BAR_R = 74;
const COUNTER_Y = 214;
const CARD_TOP = 268;
const CARD_MAX_H = 84;
const CARD_MIN_H = 54;
const CARD_GAP = 12;
const CARD_X = 34;
const CARD_W = WIDTH - CARD_X * 2;
const CARDS_BOTTOM = HEIGHT - 62; // leaves room for Bar's remark + the prompt
const MESSAGE_TIME = 2.2; // seconds Bar's last remark stays up

/**
 * The Bar: the run's one shop. Score is the currency, so everything bought
 * here comes straight off the final score. The layout is driven by the stock
 * list, so adding items to `SHOP_STOCK` needs no changes in here.
 */
export class ShopScreen {
  private messageTimer = 0;
  private messageColor: string = COLORS.text;

  /** Called on entry so a fresh visit doesn't show the last one's message. */
  reset(): void {
    this.messageTimer = 0;
  }

  /** Advance one input step; true once the player is done shopping. */
  step(input: Input, run: RunState, dt: number): boolean {
    if (this.messageTimer > 0) this.messageTimer -= dt;

    const stock = run.shop.stock;
    for (let i = 0; i < stock.length && i < 9; i++) {
      if (!input.pressed(`Digit${i + 1}`)) continue;
      const item = stock[i];
      // Read the price before buying — a purchase raises it for next time.
      const price = run.shop.priceOf(item);
      const result = run.shop.buy(item, run.player, run.score);
      if (result === "ok") run.score -= price;
      this.messageTimer = MESSAGE_TIME;
      this.messageColor = result === "ok" ? COLORS.good : COLORS.hurtbox;
    }

    return input.pressed("Escape", "Enter", "KeyZ");
  }

  draw(r: Renderer, run: RunState): void {
    r.overlay("rgba(5,6,13,0.72)");

    r.text("THE BAR", WIDTH / 2, 52, { align: "center", size: 26, bold: true, color: SHAPE_COLOR.rect });
    r.text("— the only warm light in the sector —", WIDTH / 2, 74, {
      align: "center",
      size: 12,
      color: COLORS.textDim,
    });

    this.drawBar(r);

    // Purse, sitting on the counter.
    r.text("POINTS", CARD_X, COUNTER_Y + 32, { size: 12, color: COLORS.textDim });
    r.text(run.score.toLocaleString(), WIDTH - CARD_X, COUNTER_Y + 34, {
      align: "right",
      size: 20,
      bold: true,
      color: COLORS.good,
    });

    const cardH = this.cardHeight(run.shop.stock.length);
    run.shop.stock.forEach((item, i) => this.drawCard(r, run, item, i, cardH));

    // Bar's last remark, then the exit prompt.
    const footerY = CARD_TOP + run.shop.stock.length * (cardH + CARD_GAP) + 20;
    if (this.messageTimer > 0) {
      r.text(run.shop.lastMessage, WIDTH / 2, footerY, {
        align: "center",
        size: 14,
        bold: true,
        color: this.messageColor,
      });
    }
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      r.text("PRESS A NUMBER TO BUY — ESC TO LEAVE", WIDTH / 2, HEIGHT - 24, {
        align: "center",
        size: 14,
        bold: true,
      });
    }
  }

  /** Bar himself: a square who stretched, leaning over his counter. */
  private drawBar(r: Renderer): void {
    const breathe = Math.sin(performance.now() / 900) * 2;
    r.glowShape("rect", WIDTH / 2, BAR_Y + breathe, BAR_R, 0, SHAPE_COLOR.rect, 22);
    r.strokeShape("rect", WIDTH / 2, BAR_Y + breathe, BAR_R, 0, "rgba(255,255,255,0.55)", 2);

    // Name tag, straddling the counter like the cutscene box's.
    const label = "BAR";
    r.ctx.font = `700 13px "Segoe UI", system-ui, sans-serif`;
    const w = r.ctx.measureText(label).width + 24;
    const x = WIDTH / 2 - w / 2;
    r.rect(x, COUNTER_Y - 26, w, 24, "rgba(8,10,22,0.98)");
    r.ctx.strokeStyle = SHAPE_COLOR.rect;
    r.ctx.lineWidth = 2;
    r.ctx.strokeRect(x, COUNTER_Y - 26, w, 24);
    r.text(label, WIDTH / 2, COUNTER_Y - 9, {
      align: "center",
      size: 13,
      bold: true,
      color: SHAPE_COLOR.rect,
    });

    // The counter itself.
    r.rect(CARD_X, COUNTER_Y, CARD_W, 3, "rgba(255,157,92,0.55)");
  }

  /**
   * Card height for `count` items: full size while the stock is small, then
   * squeezed (down to a floor) so a longer stock list still fits one screen.
   */
  private cardHeight(count: number): number {
    if (count <= 0) return CARD_MAX_H;
    const available = CARDS_BOTTOM - CARD_TOP - CARD_GAP * (count - 1);
    return Math.max(CARD_MIN_H, Math.min(CARD_MAX_H, available / count));
  }

  private drawCard(r: Renderer, run: RunState, item: ShopItem, i: number, cardH: number): void {
    const y = CARD_TOP + i * (cardH + CARD_GAP);
    // Text sits against the card's top edge so a squeezed card still reads.
    const nameY = y + 30;
    const descY = y + 52;
    const price = run.shop.priceOf(item);
    const soldOut = run.shop.soldOutReason(item, run.player);
    const affordable = run.shop.canAfford(item, run.score);
    const available = !soldOut && affordable;
    const tint = soldOut ? "rgba(230,233,255,0.28)" : affordable ? item.color : "rgba(230,233,255,0.45)";

    r.rect(CARD_X, y, CARD_W, cardH, available ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)");
    r.ctx.strokeStyle = tint;
    r.ctx.lineWidth = 2;
    r.ctx.strokeRect(CARD_X, y, CARD_W, cardH);

    // Slot number, only lit while the item can actually be bought.
    r.glowShape("square", CARD_X + 34, y + cardH / 2, 15, 0, tint, available ? 9 : 2);
    r.text(`${i + 1}`, CARD_X + 34, y + cardH / 2 + 6, {
      align: "center",
      size: 17,
      bold: true,
      color: "#05060d",
    });

    r.text(item.name, CARD_X + 64, nameY, { size: 18, bold: true, color: tint });
    r.text(itemDesc(item, run.player), CARD_X + 64, descY, { size: 13, color: COLORS.textDim });

    // Price tag, or why you can't have it.
    if (soldOut) {
      r.text(soldOut, CARD_X + CARD_W - 16, nameY + 8, {
        align: "right",
        size: 12,
        bold: true,
        color: "rgba(230,233,255,0.45)",
      });
    } else {
      r.text(price.toLocaleString(), CARD_X + CARD_W - 16, nameY + 6, {
        align: "right",
        size: 19,
        bold: true,
        color: affordable ? COLORS.good : COLORS.hurtbox,
      });
      r.text("POINTS", CARD_X + CARD_W - 16, descY + 4, {
        align: "right",
        size: 11,
        color: COLORS.textDim,
      });
    }
  }
}
