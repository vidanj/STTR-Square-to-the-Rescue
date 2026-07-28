import { DT } from "../config";
import { Pool } from "../core/Pool";
import type { Renderer } from "../render/Renderer";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
}

function makeParticle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 2, color: "#fff" };
}

/**
 * Purely cosmetic hit sparks / explosions. Uses Math.random deliberately —
 * particles never affect gameplay, so they stay out of the seeded RNG that
 * keeps runs reproducible.
 */
export class ParticleSystem {
  private readonly pool = new Pool<Particle>(makeParticle, () => {}, 256);

  burst(x: number, y: number, color: string, count: number, speed: number, spread = 1): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool.spawn();
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.3 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.maxLife = p.life = spread * (0.3 + Math.random() * 0.4);
      p.r = 1.5 + Math.random() * 2.5;
      p.color = color;
    }
  }

  update(): void {
    for (let i = this.pool.count - 1; i >= 0; i--) {
      const p = this.pool.items[i];
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
      p.life -= DT;
      if (p.life <= 0) this.pool.release(i);
    }
  }

  clear(): void {
    this.pool.clear();
  }

  draw(r: Renderer): void {
    const ctx = r.ctx;
    for (let i = 0; i < this.pool.count; i++) {
      const p = this.pool.items[i];
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      r.glowShape("circle", p.x, p.y, p.r, 0, p.color, p.r * 1.5);
    }
    ctx.globalAlpha = 1;
  }
}
