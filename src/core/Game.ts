import { DT } from "../config";
import { cutsceneForRoom, cutsceneForShop } from "../content/cutscenes";
import type { PowerUp } from "../content/powerups";
import { withEscapedElite } from "../content/sectors";
import { STAGES, type StageDef } from "../content/stages";
import type { Renderer } from "../render/Renderer";
import { CutscenePlayer } from "../ui/CutscenePlayer";
import { Hud } from "../ui/Hud";
import { MapScreen } from "../ui/MapScreen";
import { Overlay } from "../ui/Overlay";
import { ShopScreen } from "../ui/ShopScreen";
import type { Input } from "./Input";
import { randomSeed } from "./RNG";
import { RunState } from "./RunState";
import { World } from "./World";

const enum State {
  Menu,
  Map,
  Cutscene,
  Playing,
  Shop,
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
  private readonly shopScreen = new ShopScreen();
  private readonly cutscene = new CutscenePlayer();
  /** Where the Cutscene state returns to once the dialog is dismissed. */
  private afterCutscene = State.Playing;

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

    // The Bar is a room with no fight in it: no World, no upgrade pick.
    if (run.map.currentNode!.kind === "shop") {
      this.world = null;
      this.shopScreen.reset();
      this.enterOrSkipCutscene(cutsceneForShop(run.seenCutscenes), State.Shop);
      return;
    }

    this.world = new World(run, this.stageFor(run.map.currentNode!.stageId), this.renderer);
    this.enterOrSkipCutscene(cutsceneForRoom(this.world.stage, run.seenCutscenes), State.Playing);
  }

  /**
   * The stage to actually play for `stageId`. Normally that's the authored
   * stage — but if this is the sector's boss room and its mini-boss is still
   * alive out there, the mini-boss is spliced in just before the finale.
   */
  private stageFor(stageId: string): StageDef {
    const run = this.run!;
    const stage = STAGES[stageId];
    const elite = run.map.eliteNode;
    if (stage.difficulty !== "boss" || !run.map.eliteEscaped || !elite) return stage;
    return withEscapedElite(stage, STAGES[elite.stageId], run.map.sector.escapedEliteGap);
  }

  /**
   * Play `scene` (once per run) before landing in `next`, or go straight there
   * when there's nothing to say. Story beats interrupt on the way IN, so the
   * room or the shop sits frozen behind the dialog.
   */
  private enterOrSkipCutscene(scene: ReturnType<typeof cutsceneForShop>, next: State): void {
    this.afterCutscene = next;
    if (!scene) {
      this.state = next;
      return;
    }
    this.run!.seenCutscenes.add(scene.id);
    this.cutscene.start(scene);
    this.state = State.Cutscene;
  }

  /** Leaving The Bar: the room counts as done, but pays no upgrade. */
  private leaveShop(): void {
    this.run!.map.markCleared();
    this.mapScreen.reset();
    this.state = State.Map;
  }

  private onRoomCleared(): void {
    const run = this.run!;
    run.map.markCleared();
    if (run.map.onFinalNode) {
      this.state = State.Win;
      return;
    }
    // Elite rooms pay double picks; every other room pays one. Bombs and lives
    // are deliberately not a room reward any more — Bar sells those.
    if (this.world!.stage.difficulty === "elite") {
      this.picksLeft = 2;
      this.powerupTitle = "ELITE DOWN — CHOOSE TWO UPGRADES";
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
        if (this.cutscene.step(input)) this.state = this.afterCutscene;
        break;

      case State.Shop:
        if (this.shopScreen.step(input, this.run!, DT)) this.leaveShop();
        break;

      case State.Playing: {
        if (input.pressed("Escape")) {
          this.state = State.Paused;
          break;
        }
        const ev = this.world!.update(DT, input);
        if (ev === "win") this.onRoomCleared();
        else if (ev === "gameover") this.state = State.GameOver;
        // Something spawned or died that has a story beat attached: freeze the
        // room behind the dialog, then drop straight back into the fight.
        else if (ev === "cutscene") this.enterOrSkipCutscene(this.world!.takeCutscene(), State.Playing);
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
        // Bar's counter shows through his own intro; combat rooms show the world.
        if (this.afterCutscene === State.Shop) this.shopScreen.draw(r, this.run!);
        this.cutscene.draw(r);
        break;
      case State.Shop:
        this.shopScreen.draw(r, this.run!);
        break;
      case State.Powerup:
        this.overlay.powerup(r, this.choices, this.run!.player, this.powerupTitle);
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
