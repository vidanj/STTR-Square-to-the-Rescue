import { COLORS, HEIGHT, WIDTH } from "../config";
import { SHAPE_COLOR } from "../content/stagekit";
import { STAGES, type Difficulty } from "../content/stages";
import type { Input } from "../core/Input";
import type { RunState } from "../core/RunState";
import type { GameMap, MapNode } from "../map/GameMap";
import type { Renderer } from "../render/Renderer";

/** Per-tier accent colour: how dangerous a room looks on the map. */
const TIER_COLOR: Record<Difficulty, string> = {
  easy: COLORS.good,
  medium: "#ffd76b",
  elite: COLORS.accent,
  hard: "#ff9a3b",
  boss: COLORS.boss,
};

const TIER_LABEL: Record<Difficulty, string> = {
  easy: "EASY",
  medium: "MEDIUM",
  elite: "ELITE — DOUBLE REWARD",
  hard: "HARD",
  boss: "FINAL BOSS",
};

/** The Bar reads as its own thing on the map: Bar's own colour and label. */
const SHOP_COLOR = SHAPE_COLOR.rect;
const SHOP_NAME = "THE BAR";
const SHOP_LABEL = "SHOP — SPEND YOUR SCORE";

const NODE_R = 20;
const TOP_Y = 150; // boss layer
const BOTTOM_Y = HEIGHT - 170; // first layer
const START_Y = HEIGHT - 92; // the hero square before the first room

/**
 * The between-rooms sector map: draws the run's room DAG bottom-to-top and
 * lets the player pick which reachable room to enter next. Each node previews
 * the enemy shapes waiting inside, so the route is an informed choice.
 */
export class MapScreen {
  private sel = 0;

  reset(): void {
    this.sel = 0;
  }

  /** Index of the highlighted room (the Game listens for it moving). */
  get selection(): number {
    return this.sel;
  }

  /** Advance one input step; returns the chosen room, or null while browsing. */
  step(input: Input, map: GameMap): MapNode | null {
    const reach = map.reachable;
    if (this.sel >= reach.length) this.sel = reach.length - 1;
    if (input.pressed("ArrowLeft", "KeyA")) this.sel = (this.sel + reach.length - 1) % reach.length;
    if (input.pressed("ArrowRight", "KeyD")) this.sel = (this.sel + 1) % reach.length;
    if (input.pressed("Enter", "KeyZ", "Space")) return reach[this.sel];
    return null;
  }

  draw(r: Renderer, map: GameMap, run: RunState): void {
    r.overlay("rgba(5,6,13,0.55)");

    r.text("SECTOR MAP", WIDTH / 2, 52, { align: "center", size: 24, bold: true, color: COLORS.player });
    r.text("— chart your route to the star —", WIDTH / 2, 74, {
      align: "center",
      size: 13,
      color: COLORS.textDim,
    });

    // Run status line.
    r.text(`SCORE ${run.score.toLocaleString()}`, WIDTH - 12, 26, { align: "right", size: 13, bold: true });
    r.text(`LIVES ${run.player.lives}   BOMBS ${run.player.stats.bombs}`, 12, 26, {
      size: 13,
      color: COLORS.textDim,
    });

    const reach = map.reachable;
    const selected = reach[Math.min(this.sel, reach.length - 1)];
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);

    // Edges first, under the nodes.
    for (const node of map.nodes) {
      const [x, y] = this.pos(map, node);
      for (const id of node.next) {
        const target = map.nodes[id];
        const [nx, ny] = this.pos(map, target);
        const active = node.id === map.current && reach.includes(target);
        const color = active
          ? target === selected
            ? "rgba(230,233,255,0.95)"
            : "rgba(230,233,255,0.45)"
          : "rgba(230,233,255,0.14)";
        r.line(x, y - NODE_R, nx, ny + NODE_R, color, active && target === selected ? 3 : 1.5);
      }
    }

    // Before the first room: the hero square sits below, linked to layer 0.
    if (map.current < 0) {
      for (const node of reach) {
        const [nx, ny] = this.pos(map, node);
        const color = node === selected ? "rgba(230,233,255,0.95)" : "rgba(230,233,255,0.45)";
        r.line(WIDTH / 2, START_Y - 16, nx, ny + NODE_R, color, node === selected ? 3 : 1.5);
      }
      r.glowShape("square", WIDTH / 2, START_Y, 12, 0, COLORS.player, 8);
    }

    for (const node of map.nodes) this.drawNode(r, map, node, reach, selected, pulse);

    this.infoPanel(r, selected);

    if (Math.floor(performance.now() / 500) % 2 === 0) {
      r.text("◀ ▶ CHOOSE A ROOM — ENTER TO FIGHT", WIDTH / 2, HEIGHT - 24, {
        align: "center",
        size: 14,
        bold: true,
      });
    }
  }

  private pos(map: GameMap, node: MapNode): [number, number] {
    const layerCount = map.layers.length;
    const y = BOTTOM_Y - (node.layer * (BOTTOM_Y - TOP_Y)) / (layerCount - 1);
    const n = map.layers[node.layer].length;
    const margin = 100;
    const x = n === 1 ? WIDTH / 2 : margin + ((WIDTH - margin * 2) * node.col) / (n - 1);
    return [x, y];
  }

  private drawNode(
    r: Renderer,
    map: GameMap,
    node: MapNode,
    reach: MapNode[],
    selected: MapNode | undefined,
    pulse: number,
  ): void {
    const [x, y] = this.pos(map, node);
    const shop = node.kind === "shop";
    const stage = shop ? null : STAGES[node.stageId];
    const tier = stage ? TIER_COLOR[stage.difficulty] : SHOP_COLOR;
    const reachable = reach.includes(node);
    const dim = node.cleared || (!reachable && node.id !== map.current);

    // Room ring, tinted by difficulty; cleared/unreachable rooms fade back.
    r.ring(x, y, NODE_R, dim ? "rgba(230,233,255,0.18)" : tier, node.id === map.current ? 3 : 2);

    if (stage) {
      // Preview: the enemy shapes waiting inside (up to 3 fit in the ring).
      const shapes = stage.preview.slice(0, 3);
      const gap = 12;
      const startX = x - ((shapes.length - 1) * gap) / 2;
      shapes.forEach((shape, i) => {
        const color = dim ? "rgba(230,233,255,0.25)" : tier;
        r.fillShape(shape, startX + i * gap, y, shape === "star" ? 7 : 5, 0, color);
      });
      if (stage.preview.length > 3 && !dim) {
        r.text("+", x + NODE_R - 4, y - NODE_R + 6, { size: 12, bold: true, color: tier });
      }
    } else {
      // The Bar: Bar's own silhouette, so a shop is unmistakable at a glance.
      r.fillShape("rect", x, y, 11, 0, dim ? "rgba(230,233,255,0.25)" : tier);
    }

    if (node.cleared) {
      // Stamp cleared rooms with the hero's mark.
      r.fillShape("square", x + NODE_R - 4, y + NODE_R - 4, 4, 0, COLORS.player);
    }

    if (reachable) {
      const focus = node === selected;
      const glow = focus ? 6 + pulse * 5 : 3;
      r.ring(x, y, NODE_R + glow, focus ? "#ffffff" : "rgba(230,233,255,0.35)", focus ? 2.5 : 1);
    }
  }

  private infoPanel(r: Renderer, selected: MapNode | undefined): void {
    if (!selected) return;
    const shop = selected.kind === "shop";
    const stage = shop ? null : STAGES[selected.stageId];
    const tier = stage ? TIER_COLOR[stage.difficulty] : SHOP_COLOR;
    const y = HEIGHT - 112;

    r.rect(40, y, WIDTH - 80, 58, "rgba(255,255,255,0.06)");
    r.ctx.strokeStyle = tier;
    r.ctx.lineWidth = 2;
    r.ctx.strokeRect(40, y, WIDTH - 80, 58);

    r.text(stage ? stage.name : SHOP_NAME, 56, y + 24, { size: 16, bold: true, color: tier });
    r.text(stage ? TIER_LABEL[stage.difficulty] : SHOP_LABEL, 56, y + 44, {
      size: 12,
      color: COLORS.textDim,
    });

    if (!stage) {
      r.fillShape("rect", WIDTH - 70, y + 29, 15, 0, tier, "rgba(255,255,255,0.4)");
      return;
    }

    // Full enemy roster for the selected room, right-aligned in the panel.
    const gap = 18;
    const rosterX = WIDTH - 56 - (stage.preview.length - 1) * gap;
    stage.preview.forEach((shape, i) => {
      r.fillShape(shape, rosterX + i * gap, y + 29, 7, 0, tier, "rgba(255,255,255,0.4)");
    });
  }
}
