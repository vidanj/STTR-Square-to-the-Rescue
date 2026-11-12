# Square to the Rescue (STTR)

A Touhou-style **roguelike bullet-hell** where you are a plain **Square** and every
enemy is *some other shape*. The twist that keeps the screen readable: **every bullet
takes the shape of whoever fired it** — your shots are little squares, an enemy's shots
match that enemy. Friend or foe is legible at a glance.

Built with **TypeScript + HTML5 Canvas** (Vite). No engine, no art assets — everything
is drawn in code with glow and particles, and every sound and note of music is
**synthesized in code** with the Web Audio API. The audio follows the same rule as the
bullets: **every sound takes the waveform of its shape** — the Square is a square wave,
circles hum sines, triangles buzz triangle waves — so friend or foe reads by ear too.

## Run it

```bash
npm install
npm run dev      # opens http://localhost:5173
```

Other scripts: `npm run build` (type-check + production bundle), `npm run typecheck`,
`npm test` (Vitest).

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

Three waves of increasingly nasty non-square enemies (circles → triangles/diamonds →
pentagons/hexagons), a **power-up pick after every wave**, then a three-phase **star
boss**. Power-ups are in-run only (roguelike): they stack during a run and reset on
death. Clear the boss to win.

## Architecture (where things live)

- `src/core/` — fixed-timestep `Loop`, `Input`, seeded `RNG`, object `Pool`, the
  top-level `Game` state machine, and the `World` that owns a single run.
- `src/entities/` — `Player`, `Enemy`, `Boss`, and the `Bullet` data model.
- `src/systems/` — `BulletSystem` (pooled), `CollisionSystem`, `ParticleSystem`,
  `WaveManager`, `PowerUpSystem`.
- `src/content/` — data-driven `patterns`, `powerups`, and the `stage1` script. Tune
  the game here without touching engine code.
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

### Design rules to preserve when extending

- The player and its bullets are **always squares**; enemies use anything in
  `ENEMY_SHAPES` (never a square). A bullet's `shape` copies its shooter.
- All randomness that affects gameplay goes through the seeded `RNG` — never
  `Math.random` in game logic — so a run is reproducible from its seed. (Particles and
  audio are cosmetic and intentionally exempt — and audio must **never** draw from the
  run's `RNG`, or playing with sound on would change the run.)
- **A sound takes its shape's waveform** (`SHAPE_TIMBRE` in `src/audio/timbres.ts`). The
  Square is always a square wave and no enemy shape may share it. Cue a new effect by
  name from where the event happens (`world.audio.sfx.play("kill", { shape })`), and
  keep the recipe in `sfx.ts`.
