import { COLORS, HEIGHT, WIDTH, type Shape } from "../config";

/**
 * Owns the canvas + 2D context and all low-level drawing. Everything that wants
 * to appear on screen goes through the helpers here so the neon look (radial
 * glow) stays consistent. Also handles window-fit scaling and screen shake.
 */
export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  private shakeX = 0;
  private shakeY = 0;
  private shakeAmount = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  /** Scale the canvas element to fit the window while preserving aspect. */
  private resize(): void {
    const scale = Math.max(1, Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT));
    this.canvas.style.width = `${Math.floor(WIDTH * scale)}px`;
    this.canvas.style.height = `${Math.floor(HEIGHT * scale)}px`;
  }

  /** Add a screen-shake impulse; decays over subsequent frames. */
  shake(amount: number): void {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
  }

  /** Advance shake decay by one fixed step. */
  updateShake(): void {
    this.shakeAmount *= 0.86;
    if (this.shakeAmount < 0.1) this.shakeAmount = 0;
    this.shakeX = (Math.random() * 2 - 1) * this.shakeAmount;
    this.shakeY = (Math.random() * 2 - 1) * this.shakeAmount;
  }

  /** Clear the frame, paint the background grid, apply shake transform. */
  begin(): void {
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.setTransform(1, 0, 0, 1, Math.round(this.shakeX), Math.round(this.shakeY));
    this.drawGrid();
  }

  end(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawGrid(): void {
    const { ctx } = this;
    ctx.strokeStyle = COLORS.bgGrid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
    }
    for (let y = 0; y <= HEIGHT; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
    }
    ctx.stroke();
  }

  /** Filled circle with an additive glow halo — the workhorse draw call. */
  glowCircle(x: number, y: number, r: number, color: string, glow = r * 1.6): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r + glow);
    grad.addColorStop(0, color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r + glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  circle(x: number, y: number, r: number, color: string): void {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ring(x: number, y: number, r: number, color: string, width = 2): void {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** Trace (but do not fill) a shape's outline as the current path. */
  private traceShape(shape: Shape, x: number, y: number, r: number, rot: number): void {
    const { ctx } = this;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      return;
    }
    if (shape === "star") {
      const points = 5;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + rot + (i / (points * 2)) * Math.PI * 2;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      return;
    }
    // Regular polygons. `start` orients each shape so it reads "upright".
    const sides = shape === "triangle" ? 3 : shape === "pentagon" ? 5 : shape === "hexagon" ? 6 : 4;
    const start =
      shape === "square" ? Math.PI / 4 : shape === "diamond" || shape === "hexagon" ? 0 : -Math.PI / 2;
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = start + rot + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /** A filled shape with a soft additive glow halo — the main actor/bullet draw. */
  glowShape(shape: Shape, x: number, y: number, r: number, rot: number, color: string, glow = r * 1.4): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r + glow);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r + glow, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    this.traceShape(shape, x, y, r, rot);
    ctx.fill();
  }

  /** Outlined shape (used for the player's protective outline / telegraphs). */
  strokeShape(shape: Shape, x: number, y: number, r: number, rot: number, color: string, width = 2): void {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    this.traceShape(shape, x, y, r, rot);
    ctx.stroke();
  }

  /**
   * Crisp filled shape with no glow halo, optionally outlined. Used for the
   * player and enemies so their silhouettes stay distinct — glow is reserved
   * for the boss and bullets.
   */
  fillShape(
    shape: Shape,
    x: number,
    y: number,
    r: number,
    rot: number,
    color: string,
    outline?: string,
    outlineWidth = 1.5,
  ): void {
    const { ctx } = this;
    this.traceShape(shape, x, y, r, rot);
    ctx.fillStyle = color;
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = outlineWidth;
      ctx.stroke();
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 2): void {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  /** Horizontal progress/health bar. */
  bar(x: number, y: number, w: number, h: number, frac: number, color: string): void {
    const { ctx } = this;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  text(
    str: string,
    x: number,
    y: number,
    opts: { size?: number; color?: string; align?: CanvasTextAlign; bold?: boolean } = {},
  ): void {
    const { ctx } = this;
    const { size = 14, color = COLORS.text, align = "left", bold = false } = opts;
    ctx.font = `${bold ? "700 " : ""}${size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
  }

  /** Split `str` into lines that fit `maxW` pixels at the given font size. */
  wrapText(str: string, size: number, maxW: number, bold = false): string[] {
    this.ctx.font = `${bold ? "700 " : ""}${size}px "Segoe UI", system-ui, sans-serif`;
    const lines: string[] = [];
    let current = "";
    for (const word of str.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && this.ctx.measureText(candidate).width > maxW) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  /** Full-screen translucent overlay (menus, flashes). */
  overlay(color: string): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}
