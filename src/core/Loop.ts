import { DT, MAX_STEPS } from "../config";

/**
 * Fixed-timestep loop with an accumulator. Logic advances in whole DT steps so
 * bullet patterns are deterministic and difficulty is frame-rate independent;
 * rendering happens once per animation frame with an interpolation alpha.
 */
export class Loop {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;

  constructor(
    private readonly step: () => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    // Clamp elapsed to avoid a huge catch-up burst after a tab was backgrounded.
    let frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frameTime > 0.25) frameTime = 0.25;

    this.accumulator += frameTime;

    let steps = 0;
    while (this.accumulator >= DT && steps < MAX_STEPS) {
      this.step();
      this.accumulator -= DT;
      steps++;
    }
    // If we hit the step cap, drop the backlog rather than accumulating lag.
    if (steps === MAX_STEPS) this.accumulator = 0;

    this.render(this.accumulator / DT);
  };
}
