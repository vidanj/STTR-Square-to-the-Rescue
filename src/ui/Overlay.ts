import { COLORS, HEIGHT, SUBTITLE, TITLE, WIDTH } from "../config";
import { cardText, type PowerUp } from "../content/powerups";
import type { Player } from "../entities/Player";
import type { Renderer } from "../render/Renderer";

/** Full-screen menus and prompts drawn on top of the world. */
export class Overlay {
  private title(r: Renderer, text: string, color: string = COLORS.text): void {
    r.text(text, WIDTH / 2, HEIGHT * 0.34, { align: "center", size: 34, bold: true, color });
  }

  menu(r: Renderer): void {
    r.overlay("rgba(5,6,13,0.82)");
    // A big hero square as the emblem.
    r.glowShape("square", WIDTH / 2, HEIGHT * 0.2, 26, 0, COLORS.player, 16);
    this.title(r, TITLE, COLORS.player);
    r.text(`— ${SUBTITLE} —`, WIDTH / 2, HEIGHT * 0.34 + 26, {
      align: "center",
      size: 14,
      color: COLORS.textDim,
    });

    const lines = [
      "Move: WASD / Arrows      Focus: Shift",
      "Shoot: Z / Space / Left-Click",
      "Bomb: X / Right-Click     Pause: Esc",
      "Mute: M      Volume: − / +",
      "",
      "You are a Square. Everything else isn't.",
      "Chart your route on the sector map,",
      "clear room after room, beat the star.",
    ];
    lines.forEach((l, i) =>
      r.text(l, WIDTH / 2, HEIGHT * 0.52 + i * 24, { align: "center", size: 14, color: COLORS.textDim }),
    );

    this.blinkPrompt(r, "PRESS ENTER TO START");
  }

  powerup(
    r: Renderer,
    choices: PowerUp[],
    player: Player,
    title = "ROOM CLEARED — CHOOSE AN UPGRADE",
  ): void {
    r.overlay("rgba(5,6,13,0.86)");
    r.text(title, WIDTH / 2, 90, {
      align: "center",
      size: 16,
      bold: true,
      color: COLORS.good,
    });

    const cardW = 360;
    const cardH = 96;
    const x = (WIDTH - cardW) / 2;
    const top = 140;
    choices.forEach((p, i) => {
      const y = top + i * (cardH + 16);
      r.rect(x, y, cardW, cardH, "rgba(255,255,255,0.06)");
      r.ctx.strokeStyle = p.color;
      r.ctx.lineWidth = 2;
      r.ctx.strokeRect(x, y, cardW, cardH);

      r.glowShape("square", x + 40, y + cardH / 2, 16, 0, p.color, 10);
      r.text(`${i + 1}`, x + 40, y + cardH / 2 + 6, { align: "center", size: 18, bold: true, color: "#05060d" });
      // Shot cards name the level this pick would grant, so the card text is
      // resolved against the player it is being offered to.
      r.text(cardText(p.name, player), x + 74, y + 36, { size: 20, bold: true, color: p.color });
      // Wrap the description inside the card (long ones take two lines).
      r.wrapText(cardText(p.desc, player), 13, cardW - 74 - 18).forEach((line, j) => {
        r.text(line, x + 74, y + 58 + j * 17, { size: 13, color: COLORS.textDim });
      });
    });

    r.text("Press 1, 2 or 3", WIDTH / 2, top + choices.length * (cardH + 16) + 20, {
      align: "center",
      size: 13,
      color: COLORS.textDim,
    });
  }

  /** `sound` is the current level, e.g. "VOLUME 80%" or "SOUND OFF". */
  paused(r: Renderer, sound: string): void {
    r.overlay("rgba(5,6,13,0.7)");
    this.title(r, "PAUSED");
    r.text("Press ESC to resume", WIDTH / 2, HEIGHT * 0.5, {
      align: "center",
      size: 15,
      color: COLORS.textDim,
    });
    r.text(sound, WIDTH / 2, HEIGHT * 0.5 + 40, { align: "center", size: 14, bold: true });
    r.text("M mute    − / + volume", WIDTH / 2, HEIGHT * 0.5 + 62, {
      align: "center",
      size: 12,
      color: COLORS.textDim,
    });
  }

  gameOver(r: Renderer, score: number): void {
    r.overlay("rgba(20,4,10,0.86)");
    this.title(r, "GAME OVER", COLORS.hurtbox);
    r.text(`Score ${score.toLocaleString()}`, WIDTH / 2, HEIGHT * 0.48, {
      align: "center",
      size: 18,
    });
    this.blinkPrompt(r, "PRESS ENTER TO TRY AGAIN");
  }

  win(r: Renderer, score: number): void {
    r.overlay("rgba(6,16,12,0.86)");
    this.title(r, "SECTOR CLEARED!", COLORS.good);
    r.text("The Square saved every room on the map.", WIDTH / 2, HEIGHT * 0.46, {
      align: "center",
      size: 15,
      color: COLORS.textDim,
    });
    r.text(`Score ${score.toLocaleString()}`, WIDTH / 2, HEIGHT * 0.53, {
      align: "center",
      size: 20,
      bold: true,
    });
    this.blinkPrompt(r, "PRESS ENTER TO PLAY AGAIN");
  }

  private blinkPrompt(r: Renderer, text: string): void {
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      r.text(text, WIDTH / 2, HEIGHT * 0.82, { align: "center", size: 16, bold: true, color: COLORS.text });
    }
  }
}
