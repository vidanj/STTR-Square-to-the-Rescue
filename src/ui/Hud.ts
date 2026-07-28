import { COLORS, HEIGHT, WIDTH } from "../config";
import type { World } from "../core/World";
import type { Renderer } from "../render/Renderer";

/** In-game heads-up display: score, boss bar, lives, bombs, acquired upgrades. */
export class Hud {
  draw(r: Renderer, world: World): void {
    const { player, boss } = world;

    // Current room name, top-left (hidden while a boss banner is up).
    if (!boss || !boss.alive) {
      r.text(world.stage.name, 12, 22, { size: 12, bold: true, color: COLORS.textDim });
    }

    // Score, top-right.
    r.text(`SCORE ${world.score.toLocaleString()}`, WIDTH - 10, 22, {
      align: "right",
      size: 15,
      bold: true,
    });

    // Boss banner + health bar, top.
    if (boss && boss.alive) {
      r.text(boss.name, WIDTH / 2, 22, { align: "center", size: 13, color: COLORS.boss, bold: true });
      r.bar(30, 30, WIDTH - 60, 6, boss.healthFrac, COLORS.boss);
      r.text(`PHASE ${boss.phaseNumber}/${boss.phaseCount}`, 30, 50, {
        size: 11,
        color: COLORS.textDim,
      });
    }

    // Lives, bottom-left (little squares — the hero is a square).
    r.text("LIVES", 12, HEIGHT - 30, { size: 11, color: COLORS.textDim });
    for (let i = 0; i < player.lives; i++) {
      r.glowShape("square", 20 + i * 18, HEIGHT - 14, 6, 0, COLORS.player, 4);
    }

    // Bombs, bottom-right.
    r.text("BOMBS", WIDTH - 12, HEIGHT - 30, { size: 11, color: COLORS.textDim, align: "right" });
    for (let i = 0; i < player.stats.bombs; i++) {
      r.glowShape("circle", WIDTH - 18 - i * 18, HEIGHT - 14, 5, 0, COLORS.enemyBullet, 4);
    }

    // Acquired upgrades, bottom-centre row.
    const ups = world.powerups.acquired;
    const startX = WIDTH / 2 - (ups.length - 1) * 7;
    for (let i = 0; i < ups.length; i++) {
      r.glowShape("square", startX + i * 14, HEIGHT - 14, 4.5, 0, ups[i].color, 3);
    }
  }
}
