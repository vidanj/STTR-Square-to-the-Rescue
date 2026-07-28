/**
 * Lightweight 2D vector. Used for entity positions and one-off direction math.
 *
 * Hot paths (bullets, particles) deliberately store raw x/y/vx/vy numbers
 * instead of Vec2 instances to avoid per-frame allocation. Use the static
 * helpers here when you just need a scalar result from two points.
 */
export class Vec2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  add(x: number, y: number): this {
    this.x += x;
    this.y += y;
    return this;
  }

  scale(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  get length(): number {
    return Math.hypot(this.x, this.y);
  }

  /** Normalise in place; a zero vector stays zero. */
  normalize(): this {
    const len = this.length;
    if (len > 1e-6) {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }
}

/** Angle in radians from point a to point b. */
export function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/** Straight-line distance between two points. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

/** Clamp v to the inclusive range [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
