import { COLORS, HEIGHT, WIDTH } from "../config";
import type { Cutscene, CutsceneActor } from "../content/cutscenes";
import type { Input } from "../core/Input";
import type { Renderer } from "../render/Renderer";

// Visual-novel layout: big portraits above a bottom dialog box.
const BOX_X = 20;
const BOX_W = WIDTH - BOX_X * 2;
const BOX_H = 130;
const BOX_Y = HEIGHT - BOX_H - 70;
const PORTRAIT_Y = BOX_Y - 140;
const PORTRAIT_R = 62;
const TEXT_SIZE = 16;

/**
 * Plays one Cutscene: the frozen world sits behind a dim overlay while shape
 * portraits talk through a dialog box. The current speaker is lit and bobbing;
 * everyone else fades back. Confirm advances a line; the Game returns to
 * Playing when the last line is dismissed.
 */
export class CutscenePlayer {
  private scene: Cutscene | null = null;
  private line = 0;

  start(scene: Cutscene): void {
    this.scene = scene;
    this.line = 0;
  }

  /** Advance on confirm; true once the scene has finished. */
  step(input: Input): boolean {
    if (!this.scene) return true;
    if (input.pressed("Enter", "KeyZ", "Space", "Mouse0")) {
      this.line += 1;
      if (this.line >= this.scene.lines.length) {
        this.scene = null;
        return true;
      }
    }
    return false;
  }

  draw(r: Renderer): void {
    if (!this.scene) return;
    const line = this.scene.lines[this.line];
    const speaker = this.scene.actors.find((a) => a.id === line.actor);

    r.overlay("rgba(5,6,13,0.62)");

    for (const actor of this.scene.actors) this.portrait(r, actor, actor === speaker);

    // Dialog box.
    r.rect(BOX_X, BOX_Y, BOX_W, BOX_H, "rgba(8,10,22,0.92)");
    r.ctx.strokeStyle = speaker?.color ?? COLORS.text;
    r.ctx.lineWidth = 2;
    r.ctx.strokeRect(BOX_X, BOX_Y, BOX_W, BOX_H);

    if (speaker) this.nameTag(r, speaker);

    // Wrapped dialog text.
    const lines = r.wrapText(line.text, TEXT_SIZE, BOX_W - 48);
    lines.forEach((text, i) => {
      r.text(text, BOX_X + 24, BOX_Y + 38 + i * (TEXT_SIZE + 8), { size: TEXT_SIZE });
    });

    // Advance prompt, blinking in the box's corner.
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      r.text("Z ▶", BOX_X + BOX_W - 16, BOX_Y + BOX_H - 14, {
        align: "right",
        size: 13,
        bold: true,
        color: COLORS.textDim,
      });
    }
  }

  private portrait(r: Renderer, actor: CutsceneActor, speaking: boolean): void {
    const x = actor.side === "left" ? 115 : WIDTH - 115;
    const y = PORTRAIT_Y + (speaking ? Math.sin(performance.now() / 280) * 4 : 0);
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = speaking ? 1 : 0.22;
    if (speaking) {
      r.glowShape(actor.shape, x, y, PORTRAIT_R, 0, actor.color, 26);
    } else {
      r.fillShape(actor.shape, x, y, PORTRAIT_R, 0, actor.color);
    }
    r.strokeShape(actor.shape, x, y, PORTRAIT_R, 0, "rgba(255,255,255,0.55)", 2);
    ctx.restore();
  }

  private nameTag(r: Renderer, speaker: CutsceneActor): void {
    const ctx = r.ctx;
    ctx.font = `700 14px "Segoe UI", system-ui, sans-serif`;
    const w = ctx.measureText(speaker.name).width + 28;
    const x = speaker.side === "left" ? BOX_X + 8 : BOX_X + BOX_W - 8 - w;
    const y = BOX_Y - 14; // straddles the box's top edge
    r.rect(x, y, w, 28, "rgba(8,10,22,0.98)");
    ctx.strokeStyle = speaker.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, 28);
    r.text(speaker.name, x + w / 2, y + 19, { align: "center", size: 14, bold: true, color: speaker.color });
  }

}
