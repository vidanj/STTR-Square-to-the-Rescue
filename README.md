# Square to the Rescue (STTR)

A Touhou-style **roguelike bullet-hell** where you are a plain **Square** and every
enemy is *some other shape*. The twist that keeps the screen readable: **every bullet
takes the shape of whoever fired it** — your shots are little squares, an enemy's shots
match that enemy. Friend or foe is legible at a glance.

Built with **TypeScript + HTML5 Canvas** (Vite). No engine, no art assets — everything
is drawn in code with glow and particles.

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

### Design rules to preserve when extending

- The player and its bullets are **always squares**; enemies use anything in
  `ENEMY_SHAPES` (never a square). A bullet's `shape` copies its shooter.
- All randomness that affects gameplay goes through the seeded `RNG` — never
  `Math.random` in game logic — so a run is reproducible from its seed. (Particles are
  cosmetic and intentionally exempt.)
