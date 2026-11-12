/**
 * Keyboard input. Tracks held state for continuous actions (movement, fire,
 * focus) and edge-triggered "pressed" events for discrete actions (bomb,
 * confirm, pause). Call endFrame() once per logical step to clear edges.
 */
export class Input {
  private held = new Set<string>();
  private pressedThisFrame = new Set<string>();

  constructor(target: Window | HTMLElement = window) {
    target.addEventListener("keydown", (e) => this.onKey(e as KeyboardEvent, true));
    target.addEventListener("keyup", (e) => this.onKey(e as KeyboardEvent, false));

    // Mouse: left button (Mouse0) is a second fire key, right button (Mouse2)
    // is a second bomb key. Suppress the right-click context menu.
    window.addEventListener("mousedown", (e) => this.onMouse(e, true));
    window.addEventListener("mouseup", (e) => this.onMouse(e, false));
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    // Drop all held inputs if focus is lost so the player doesn't "run away".
    window.addEventListener("blur", () => {
      this.held.clear();
      this.pressedThisFrame.clear();
    });
  }

  private onMouse(e: MouseEvent, down: boolean): void {
    const code = `Mouse${e.button}`;
    if (e.button === 2) e.preventDefault();
    if (down) {
      if (!this.held.has(code)) this.pressedThisFrame.add(code);
      this.held.add(code);
    } else {
      this.held.delete(code);
    }
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const code = e.code;
    // Prevent scrolling / browser shortcuts for keys we use.
    if (GAME_KEYS.has(code)) e.preventDefault();
    if (down) {
      if (!this.held.has(code)) this.pressedThisFrame.add(code);
      this.held.add(code);
    } else {
      this.held.delete(code);
    }
  }

  /** True while any of the given key codes is held. */
  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.held.has(c));
  }

  /** True only on the frame a key transitions from up to down. */
  pressed(...codes: string[]): boolean {
    return codes.some((c) => this.pressedThisFrame.has(c));
  }

  /** Movement axes in [-1, 1] from WASD / arrow keys (not normalised). */
  get axisX(): number {
    return (this.isDown("ArrowRight", "KeyD") ? 1 : 0) - (this.isDown("ArrowLeft", "KeyA") ? 1 : 0);
  }
  get axisY(): number {
    return (this.isDown("ArrowDown", "KeyS") ? 1 : 0) - (this.isDown("ArrowUp", "KeyW") ? 1 : 0);
  }

  get fire(): boolean {
    return this.isDown("KeyZ", "Space", "Mouse0");
  }
  get focus(): boolean {
    return this.isDown("ShiftLeft", "ShiftRight");
  }

  /** Clear per-frame edges. Call at the end of each fixed step. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}

const GAME_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyZ",
  "KeyX",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "Enter",
  "Escape",
  "Digit1",
  "Digit2",
  "Digit3",
  // Sound: mute and volume.
  "KeyM",
  "Minus",
  "Equal",
  "NumpadSubtract",
  "NumpadAdd",
]);
