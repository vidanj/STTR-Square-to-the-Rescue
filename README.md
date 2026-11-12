# Square to the Rescue (STTR)

**English** · [Español](README.es.md)

A Touhou-style **roguelike bullet-hell** where you are a plain **Square** and every
enemy is *some other shape*. The twist that keeps the screen readable: **every bullet
takes the shape of whoever fired it** — your shots are little squares, an enemy's shots
match that enemy. Friend or foe is legible at a glance.

Each run is a **seeded, randomly generated sector map** (Slay-the-Spire style): pick a
route, clear each room as a bullet-hell stage, take an upgrade, and push on to the boss.

Built with **TypeScript + HTML5 Canvas** (Vite). No engine, no art assets — everything
is drawn in code with shapes, glow and particles, and every sound and note of music is
**synthesized in code** with the Web Audio API. The audio follows the same rule as the
bullets: **every sound takes the waveform of its shape** — the Square is a square wave,
circles hum sines, triangles buzz triangle waves — so friend or foe reads by ear too.

## Run it

```bash
npm install
npm run dev      # opens http://localhost:5173
```

Other scripts: `npm run build` (type-check + production bundle), `npm run typecheck`,
`npm test` (Vitest), `npm run preview` (serve the built `dist/`).

Every push to `main` is built and deployed to **GitHub Pages** by
`.github/workflows/deploy.yml`. The page shows a loading screen while the game boots.

## Controls

| Action | Keys |
| --- | --- |
| Move | WASD / Arrow keys |
| Shoot | Z / Space / **Left-click** |
| Focus (slow + show hitbox) | Shift |
| Bomb (growing square) | X / **Right-click** |
| Pause | Esc |
| Confirm / start / retry | Enter |
| Pick upgrade | 1 / 2 / 3 |
| Map: select room | ← / → (or A / D) |
| Map: enter room | Enter / Z / Space |
| Cutscene: advance dialog | Z / Enter / Space / Left-click |
| Mute / unmute | M |
| Volume down / up | − / + (also numpad) |

Sound starts on your first key press or click (browsers block audio until then), and
your mute/volume choice is remembered.

Your true hitbox is the tiny dot at your centre — hold **Focus** to see it and thread
through dense patterns. Grazing near your ship is safe. Getting hit costs a life but grants
**3 seconds of blinking invincibility** (bullets are *not* cleared — use the window to
escape).

**The bomb** is a square you launch upward that starts small and **grows exponentially as
it travels**, erasing every enemy bullet inside it and chipping engulfed enemies. Fire it
from *far* below a wave so it balloons to near screen-width before arriving — point-blank
bombs barely grow.

## The run

1. **The sector map.** A run starts on a seeded map of rooms in layers
   (easy → medium → medium → hard → hard → boss). Choose your path through the
   connected rooms.
2. **Rooms.** Each room is a bullet-hell stage of non-square enemies (circles,
   triangles, diamonds, pentagons, hexagons…). Clear it to earn **one upgrade pick**.
3. **The mini-boss.** One room per sector holds **Prism, the Prisimp** (elite room,
   **two** upgrade picks). Every route is offered the fight — and if you dodge it, Prism
   follows you and jumps in right before the final boss.
4. **The Bar.** One node per run is a shop run by **Bar** (a friendly rectangle).
   Instead of a fight you can spend your **score** on lives and bombs.
5. **The boss.** **Astra, the Five-Point** — a three-phase star boss with
   reinforcements at each phase break. Bosses get an entrance: they arrive, show their
   health bar and stay immune for a moment before the fight begins. Beat Astra to win.

Power-ups are **in-run only** (roguelike): they stack during a run and reset on death.

### Upgrades and shot streams

Upgrade cards include stat boosts (**Rapid Fire**, **Sharpened Edge**) and new shot
types: **Piercing Rounds**, **Ricochet**, **Rotating Shot**, **Scatter**,
**Homing Splinter** and **Orbit Shield**.

Shots **deepen first, then widen**: picking a shot you already own levels that stream
up its ladder (up to level 4; the Orbit Shield goes to 6), and each level changes how
the shot behaves. Only once every stream of that type is maxed does a pick add a fresh
level-1 stream. No pick is ever wasted, and you can commit to one shot for a whole run.

### Score is the currency

Lives and bombs are **never** upgrades or room rewards — you buy them at The Bar with
your score:

| Item | Effect | Price | Cap |
| --- | --- | --- | --- |
| Repair Plating | +1 life | 2,500 (+900 per repeat) | 5 lives |
| Bomb Cache | +1 bomb | 1,200 (+400 per repeat) | 6 bombs |

### Story

Short visual-novel **cutscenes** introduce the cast — Squero (you), Bar, Prism and
Astra — on first meetings, boss entrances and defeats. Each plays once per run.
Authoring guide: [DOCS/cutscenes.md](DOCS/cutscenes.md).

## Architecture (where things live)

- `src/core/` — fixed-timestep `Loop`, `Input`, seeded `RNG`, object `Pool`, the
  top-level `Game` state machine, `RunState` (everything that lasts a whole run) and
  the `World` that runs a single room.
- `src/map/` — `GameMap` (layered room graph) and `MapGen` (seeded generation).
- `src/entities/` — `Player`, `Enemy`, `Boss`, `BombSquare`, and the `Bullet` data model.
- `src/systems/` — `BulletSystem` (pooled), `CollisionSystem`, `ParticleSystem`,
  `WaveManager`, `PowerUpSystem`, `ShopSystem`.
- `src/content/` — data-driven content: `patterns`, `powerups`, `shots` (shot ladders),
  `shop`, `sectors`, `cutscenes`, and the stage pools in `stages/`
  (`easy`, `medium`, `elite`, `hard`, `boss`). Tune the game here without touching
  engine code.
- `src/ui/` — `Hud`, `Overlay`, `MapScreen`, `ShopScreen`, `CutscenePlayer`.
- `src/render/Renderer.ts` — canvas, scaling, screen shake, and the shape/glow drawing
  everything shares.
- `src/audio/` — all sound, synthesized (no audio files):
  - `AudioEngine` — the context, mix buses, unlock-on-first-gesture, mute/volume, ducking.
  - `sfx.ts` — the sound-effect catalog, with per-effect rate limits and a voice cap.
  - `tracks.ts` — the soundtrack as text patterns (one token per 16th note; the notation
    is documented at the top of the file).
  - `MusicPlayer` — a lookahead sequencer that crossfades loops and plays stings.
  - `instruments.ts`, `timbres.ts`, `synth.ts` — the instruments, the shape→waveform
    map, and the two primitives everything is built from.

  `Game.syncMusic` picks the music per screen. Menu and map play a calm loop, rooms play
  a combat loop that drives harder with difficulty, and bosses play a track that
  escalates with each phase. The Bar plays a lounge loop. World, CollisionSystem and
  BombSquare cue effects right beside their particle bursts.

More detail: [.CLAUDE/structure.md](.CLAUDE/structure.md),
[.CLAUDE/design-rules.md](.CLAUDE/design-rules.md),
[.CLAUDE/commands.md](.CLAUDE/commands.md).

### Design rules to preserve when extending

- The player and its bullets are **always squares**; enemies use anything in
  `ENEMY_SHAPES` (never a square). A bullet's `shape` copies its shooter. Rectangles are
  reserved for friendly NPCs (Bar).
- All randomness that affects gameplay goes through the seeded `RNG` — never
  `Math.random` in game logic — so a run is reproducible from its seed. (Particles and
  audio are cosmetic and intentionally exempt — and audio must **never** draw from the
  run's `RNG`, or playing with sound on would change the run.)
- **A sound takes its shape's waveform** (`SHAPE_TIMBRE` in `src/audio/timbres.ts`). The
  Square is always a square wave and no enemy shape may share it. Cue a new effect by
  name from where the event happens (`world.audio.sfx.play("kill", { shape })`), and
  keep the recipe in `sfx.ts`.
- Logic runs on a fixed 60 Hz timestep; bullets and particles are pooled.
- Shot upgrades deepen before they widen (see above).
- Lives and bombs come only from The Bar, paid for in score.
- **No glow on bullets** — projectiles are crisp fills so a full screen stays readable.

## Recent changes

- **Audio** — synthesized sound effects (shots, hits, kills, hurt, bomb, boss beats, UI)
  and per-screen looping music: a calm grid theme, a combat loop that intensifies with
  room difficulty, a boss track that escalates each phase, and a lounge loop at The Bar,
  plus room-clear / game-over / win stings. **M** mutes, **− / +** set the volume.
- **Shot rebalance** — every shot type now has a level ladder (`src/content/shots.ts`);
  repeat picks upgrade a stream instead of stacking copies. New **Scatter**,
  **Homing Splinter** and **Orbit Shield** upgrades; **Swift Frame** was removed.
  Bullets no longer glow.
- **The Bar** — a shop node where score buys lives and bombs (`src/content/shop.ts`,
  `src/ui/ShopScreen.ts`). Lives and bombs were removed from upgrades.
- **Sectors** — map depth, mini-boss layer and shop layers are now defined per sector
  (`src/content/sectors.ts`). A skipped mini-boss returns before the final boss.
- **Cutscenes** — visual-novel scenes for Bar, Prism and Astra, with dialog polish.
- **Boss entrances** — bosses arrive and stay immune briefly before attacking.
- **Loading screen** and **GitHub Pages deployment**.
