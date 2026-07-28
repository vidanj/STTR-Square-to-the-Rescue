/**
 * Generic object pool. Bullets and particles are recycled through this so the
 * hot loop never allocates, avoiding GC hitches when the screen fills up.
 *
 * Usage: keep a live count and iterate `items[0..count)`. `spawn()` hands you a
 * reset object; `release(i)` swap-removes index i (order is not preserved).
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;

  constructor(
    private readonly factory: () => T,
    private readonly reset: (item: T) => void,
    initial = 0,
  ) {
    for (let i = 0; i < initial; i++) this.items.push(factory());
  }

  /** Get a reset object marked live at the end of the active range. */
  spawn(): T {
    let item: T;
    if (this.count < this.items.length) {
      item = this.items[this.count];
    } else {
      item = this.factory();
      this.items.push(item);
    }
    this.reset(item);
    this.count++;
    return item;
  }

  /**
   * Swap-remove the live item at index i. Because it swaps with the last live
   * item, a reverse iteration (i = count-1 .. 0) can release safely mid-loop.
   */
  release(i: number): void {
    this.count--;
    if (i !== this.count) {
      const tmp = this.items[i];
      this.items[i] = this.items[this.count];
      this.items[this.count] = tmp;
    }
  }

  clear(): void {
    this.count = 0;
  }
}
