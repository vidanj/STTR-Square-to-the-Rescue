import type { AudioEngine } from "../audio/AudioEngine";
import { roomMusic } from "../audio/tracks";
import { AUDIO, DT, HEIGHT, WIDTH } from "../config";
import { cutsceneForRoom, cutsceneForShop } from "../content/cutscenes";
import type { PowerUp } from "../content/powerups";
import { withEscapedElite } from "../content/sectors";
import { STAGES, type StageDef } from "../content/stages";
import type { Renderer } from "../render/Renderer";
import { ADVANCE_KEYS, CutscenePlayer } from "../ui/CutscenePlayer";
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

/** Seconds the "VOLUME 70%" toast stays up after a sound key. */
const TOAST_TIME = 1.2;

/**
 * Top-level state machine. Owns the run (RunState) and the current room
 * (World), and routes input + rendering per screen. The roguelike loop:
 * Menu → Map → Playing (room) → Powerup pick → Map … → Win/GameOver.
 * Gameplay only advances in the Playing state.
 *
 * It also conducts the audio: which music loop suits the current screen (see
 * `syncMusic`), the stings on big transitions, and the interface blips.
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
  private toastTimer = 0;

  constructor(
    private readonly input: Input,
    private readonly renderer: Renderer,
    private readonly audio: AudioEngine,
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

    this.world = new World(run, this.stageFor(run.map.currentNode!.stageId), this.renderer, this.audio);
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
      this.audio.music.playSting("win");
      return;
    }
    this.audio.music.playSting("clear");
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

  /** Mute and volume work on every screen. */
  private handleSoundKeys(): void {
    const input = this.input;
    const mute = input.pressed("KeyM");
    const down = input.pressed("Minus", "NumpadSubtract");
    const up = input.pressed("Equal", "NumpadAdd");
    if (!mute && !down && !up) {
      if (this.toastTimer > 0) this.toastTimer -= DT;
      return;
    }
    if (mute) this.audio.toggleMute();
    if (down) this.audio.changeVolume(-AUDIO.volumeStep);
    if (up) this.audio.changeVolume(AUDIO.volumeStep);
    this.toastTimer = TOAST_TIME;
    if (!this.audio.muted) this.audio.sfx.play("move");
  }

  private soundLabel(): string {
    return this.audio.muted ? "SOUND OFF" : `VOLUME ${Math.round(this.audio.volume * 100)}%`;
  }

  /**
   * Point the music at whatever this screen wants. Called every step;
   * `MusicPlayer.play` only acts on a change, so this is cheap.
   *
   * A cutscene plays the music of where it leads (Bar's intro already has the
   * lounge going behind the dialog), and both dialog and pause muffle it.
   */
  private syncMusic(): void {
    const music = this.audio.music;
    const target = this.state === State.Cutscene ? this.afterCutscene : this.state;
    switch (target) {
      case State.Menu:
        music.play("grid", 1);
        break;
      case State.Map:
      case State.Powerup:
      case State.Win:
        music.play("grid", 2);
        break;
      case State.Shop:
        music.play("bar");
        break;
      case State.Playing:
      case State.Paused: {
        const world = this.world;
        if (!world) break;
        const { id, intensity } = roomMusic(world.stage.difficulty, world.boss ? world.boss.phaseNumber : null);
        music.play(id, intensity);
        break;
      }
      case State.GameOver:
        music.play(null);
        break;
      case State.Cutscene:
        break;
    }
    this.audio.setMuffled(this.state === State.Cutscene || this.state === State.Paused);
  }

  step(): void {
    const input = this.input;
    const sfx = this.audio.sfx;
    this.handleSoundKeys();

    switch (this.state) {
      case State.Menu:
        if (input.pressed("Enter", "KeyZ")) {
          sfx.play("confirm");
          this.startRun();
        }
        break;

      case State.Map: {
        const before = this.mapScreen.selection;
        const node = this.mapScreen.step(input, this.run!.map);
        if (node) {
          sfx.play("confirm");
          this.enterRoom(node.id);
        } else if (this.mapScreen.selection !== before) {
          sfx.play("move");
        }
        break;
      }

      case State.Cutscene:
        if (input.pressed(...ADVANCE_KEYS)) sfx.play("advance");
        if (this.cutscene.step(input)) this.state = this.afterCutscene;
        break;

      case State.Shop: {
        const leave = this.shopScreen.step(input, this.run!, DT);
        const bought = this.shopScreen.lastResult;
        if (bought) sfx.play(bought === "ok" ? "buy" : "deny");
        if (leave) {
          sfx.play("confirm");
          this.leaveShop();
        }
        break;
      }

      case State.Playing: {
        if (input.pressed("Escape")) {
          sfx.play("pause");
          this.state = State.Paused;
          break;
        }
        const ev = this.world!.update(DT, input);
        if (ev === "win") this.onRoomCleared();
        else if (ev === "gameover") {
          this.state = State.GameOver;
          this.audio.music.playSting("gameover");
        }
        // Something spawned or died that has a story beat attached: freeze the
        // room behind the dialog, then drop straight back into the fight.
        else if (ev === "cutscene") this.enterOrSkipCutscene(this.world!.takeCutscene(), State.Playing);
        break;
      }

      case State.Powerup: {
        const idx = input.pressed("Digit1") ? 0 : input.pressed("Digit2") ? 1 : input.pressed("Digit3") ? 2 : -1;
        if (idx >= 0 && idx < this.choices.length) {
          sfx.play("pick");
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
        if (input.pressed("Escape")) {
          sfx.play("pause");
          this.state = State.Playing;
        }
        break;

      case State.GameOver:
      case State.Win:
        if (input.pressed("Enter", "KeyZ")) {
          sfx.play("confirm");
          this.run = null;
          this.world = null;
          this.state = State.Menu;
        }
        break;
    }
    this.syncMusic();
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
        this.overlay.paused(r, this.soundLabel());
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

    // Volume/mute feedback, fading out over its last moments (hero cyan, or
    // hurtbox red for "off").
    if (this.toastTimer > 0) {
      const alpha = Math.min(1, this.toastTimer / 0.3).toFixed(2);
      r.text(this.soundLabel(), WIDTH / 2, HEIGHT - 52, {
        align: "center",
        size: 14,
        bold: true,
        color: this.audio.muted ? `rgba(255,59,107,${alpha})` : `rgba(108,240,255,${alpha})`,
      });
    }

    r.end();
  }
}
