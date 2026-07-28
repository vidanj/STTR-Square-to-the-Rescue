import { DT } from "../config";
import { cutsceneForRoom } from "../content/cutscenes";
import type { PowerUp } from "../content/powerups";
import { STAGES } from "../content/stages";
import type { Renderer } from "../render/Renderer";
import { CutscenePlayer } from "../ui/CutscenePlayer";
import { Hud } from "../ui/Hud";
import { MapScreen } from "../ui/MapScreen";
import { Overlay } from "../ui/Overlay";
import type { Input } from "./Input";
import { randomSeed } from "./RNG";
import { RunState } from "./RunState";
import { World } from "./World";

const enum State {
  Menu,
  Map,
  Cutscene,
  Playing,
  Powerup,
  Paused,
  GameOver,
  Win,
}

/**
 * Top-level state machine. Owns the run (RunState) and the current room
 * (World), and routes input + rendering per screen. The roguelike loop:
 * Menu → Map → Playing (room) → Powerup pick → Map … → Win/GameOver.
 * Gameplay only advances in the Playing state.
 */
export class Game {
  private state = State.Menu;
  private run: RunState | null = null;
  private world: World | null = null;
  private choices: PowerUp[] = [];
  private picksLeft = 0;
  private powerupTitle = "";
  private readonly hud = new Hud();
  private readonly overlay = new Overlay();
  private readonly mapScreen = new MapScreen();
  private readonly cutscene = new CutscenePlayer();

  constructor(
    private readonly input: Input,
    private readonly renderer: Renderer,
  ) {}

  private startRun(): void {
    // A fresh seed per run — the map layout and upgrade rolls derive from it.
    this.run = new RunState(randomSeed());
    this.world = null;
    this.mapScreen.reset();
    this.state = State.Map;
  }

  private enterRoom(nodeId: number): void {
    const run = this.run!;
    run.map.enter(nodeId);
    run.player.resetForRoom();
    this.world = new World(run, STAGES[run.map.currentNode!.stageId], this.renderer);
    // Story beats interrupt on the way in: the room freezes behind the dialog.
    const scene = cutsceneForRoom(this.world.stage, run.seenCutscenes);
    if (scene) {
      run.seenCutscenes.add(scene.id);
      this.cutscene.start(scene);
      this.state = State.Cutscene;
    } else {
      this.state = State.Playing;
    }
  }

  private onRoomCleared(): void {
    const run = this.run!;
    run.map.markCleared();
    if (run.map.onFinalNode) {
      this.state = State.Win;
      return;
    }
    // Elite rooms pay double picks plus a bomb; every other room pays one pick.
    if (this.world!.stage.difficulty === "elite") {
      run.player.stats.bombs += 1;
      this.picksLeft = 2;
      this.powerupTitle = "ELITE DOWN (+1 BOMB) — CHOOSE TWO UPGRADES";
    } else {
      this.picksLeft = 1;
      this.powerupTitle = "ROOM CLEARED — CHOOSE AN UPGRADE";
    }
    this.choices = run.powerups.rollChoices(3);
    this.state = State.Powerup;
  }

  step(): void {
    const input = this.input;
    switch (this.state) {
      case State.Menu:
        if (input.pressed("Enter", "KeyZ")) this.startRun();
        break;

      case State.Map: {
        const node = this.mapScreen.step(input, this.run!.map);
        if (node) this.enterRoom(node.id);
        break;
      }

      case State.Cutscene:
        if (this.cutscene.step(input)) this.state = State.Playing;
        break;

      case State.Playing: {
        if (input.pressed("Escape")) {
          this.state = State.Paused;
          break;
        }
        const ev = this.world!.update(DT, input);
        if (ev === "win") this.onRoomCleared();
        else if (ev === "gameover") this.state = State.GameOver;
        break;
      }

      case State.Powerup: {
        const idx = input.pressed("Digit1") ? 0 : input.pressed("Digit2") ? 1 : input.pressed("Digit3") ? 2 : -1;
        if (idx >= 0 && idx < this.choices.length) {
          this.run!.powerups.choose(this.choices[idx], this.run!.player);
          this.picksLeft -= 1;
          if (this.picksLeft > 0) {
            this.choices = this.run!.powerups.rollChoices(3);
          } else {
            // Back to the map; the cleared room's World is done with.
            this.world = null;
            this.mapScreen.reset();
            this.state = State.Map;
          }
        }
        break;
      }

      case State.Paused:
        if (input.pressed("Escape")) this.state = State.Playing;
        break;

      case State.GameOver:
      case State.Win:
        if (input.pressed("Enter", "KeyZ")) {
          this.run = null;
          this.world = null;
          this.state = State.Menu;
        }
        break;
    }
    input.endFrame();
  }

  render(): void {
    const r = this.renderer;
    r.begin();

    if (this.world) {
      this.world.draw(r);
      // The HUD makes way for the dialog while a cutscene plays.
      if (this.state !== State.Cutscene) this.hud.draw(r, this.world);
    }

    switch (this.state) {
      case State.Menu:
        this.overlay.menu(r);
        break;
      case State.Map:
        this.mapScreen.draw(r, this.run!.map, this.run!);
        break;
      case State.Cutscene:
        this.cutscene.draw(r);
        break;
      case State.Powerup:
        this.overlay.powerup(r, this.choices, this.powerupTitle);
        break;
      case State.Paused:
        this.overlay.paused(r);
        break;
      case State.GameOver:
        this.overlay.gameOver(r, this.run?.score ?? 0);
        break;
      case State.Win:
        this.overlay.win(r, this.run?.score ?? 0);
        break;
      case State.Playing:
        break;
    }

    r.end();
  }
}
