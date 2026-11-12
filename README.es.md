# Square to the Rescue (STTR)

[English](README.md) · **Español**

Un **bullet-hell roguelike** al estilo Touhou en el que eres un simple **Cuadrado** y
cada enemigo es *cualquier otra figura*. El giro que mantiene la pantalla legible:
**cada bala toma la forma de quien la disparó** — tus disparos son cuadraditos y los de
un enemigo tienen la forma de ese enemigo. Se distingue amigo de enemigo de un vistazo.

Cada partida es un **mapa de sector generado aleatoriamente a partir de una semilla**
(al estilo Slay the Spire): elige una ruta, supera cada sala como una fase de
bullet-hell, toma una mejora y avanza hasta el jefe.

Hecho con **TypeScript + HTML5 Canvas** (Vite). Sin motor ni recursos gráficos — todo se
dibuja por código con figuras, resplandor y partículas.

## Cómo ejecutarlo

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Otros scripts: `npm run build` (verificación de tipos + paquete de producción),
`npm run typecheck`, `npm test` (Vitest), `npm run preview` (sirve el `dist/` compilado).

Cada push a `main` se compila y se publica en **GitHub Pages** mediante
`.github/workflows/deploy.yml`. La página muestra una pantalla de carga mientras el
juego arranca.

## Controles

| Acción | Teclas |
| --- | --- |
| Moverse | WASD / Flechas |
| Disparar | Z / Espacio / **Clic izquierdo** |
| Enfoque (lento + muestra el hitbox) | Shift |
| Bomba (cuadrado que crece) | X / **Clic derecho** |
| Pausa | Esc |
| Confirmar / empezar / reintentar | Enter |
| Elegir mejora | 1 / 2 / 3 |
| Mapa: seleccionar sala | ← / → (o A / D) |
| Mapa: entrar a la sala | Enter / Z / Espacio |
| Escena: avanzar diálogo | Z / Enter / Espacio / Clic izquierdo |

Tu hitbox real es el pequeño punto en tu centro — mantén **Enfoque** para verlo y
esquivar patrones densos. Rozar las balas cerca de tu nave es seguro. Recibir un golpe
cuesta una vida pero otorga **3 segundos de invencibilidad parpadeante** (las balas
*no* se eliminan — aprovecha ese margen para escapar).

**La bomba** es un cuadrado que lanzas hacia arriba: empieza pequeño y **crece
exponencialmente mientras avanza**, borrando todas las balas enemigas que abarca y
dañando a los enemigos que envuelve. Lánzala desde *muy* abajo de una oleada para que
llegue casi al ancho de la pantalla — a quemarropa apenas crece.

## La partida

1. **El mapa del sector.** La partida empieza en un mapa de salas por capas, generado
   a partir de una semilla (fácil → media → media → difícil → difícil → jefe). Elige tu
   camino entre las salas conectadas.
2. **Salas.** Cada sala es una fase de bullet-hell con enemigos no cuadrados (círculos,
   triángulos, diamantes, pentágonos, hexágonos…). Supérala para ganar **una mejora**.
3. **El mini-jefe.** Una sala por sector alberga a **Prism, el Prisimp** (sala élite,
   **dos** mejoras). Todas las rutas ofrecen el combate — y si lo evitas, Prism te sigue
   y aparece justo antes del jefe final.
4. **The Bar.** Un nodo por partida es una tienda atendida por **Bar** (un rectángulo
   amistoso). En lugar de combatir, puedes gastar tu **puntuación** en vidas y bombas.
5. **El jefe.** **Astra, la de Cinco Puntas** — una jefa estrella de tres fases que
   pide refuerzos en cada cambio de fase. Los jefes tienen una entrada: llegan, muestran
   su barra de vida y son inmunes un momento antes de empezar la pelea. Derrota a Astra
   para ganar.

Las mejoras son **solo para la partida actual** (roguelike): se acumulan durante la
partida y se pierden al morir.

### Mejoras y flujos de disparo

Las cartas de mejora incluyen mejoras de estadísticas (**Rapid Fire**,
**Sharpened Edge**) y nuevos tipos de disparo: **Piercing Rounds**, **Ricochet**,
**Rotating Shot**, **Scatter**, **Homing Splinter** y **Orbit Shield**.

Los disparos **primero se profundizan y luego se amplían**: elegir un disparo que ya
tienes sube de nivel ese flujo en su escalera (hasta el nivel 4; el Orbit Shield llega
a 6), y cada nivel cambia cómo se comporta el disparo. Solo cuando todos los flujos de
ese tipo están al máximo, una nueva elección añade un flujo nuevo de nivel 1. Ninguna
elección se desperdicia y puedes apostar por un solo disparo toda la partida.

### La puntuación es la moneda

Las vidas y las bombas **nunca** son mejoras ni recompensas de sala — se compran en
The Bar con tu puntuación:

| Artículo | Efecto | Precio | Máximo |
| --- | --- | --- | --- |
| Repair Plating | +1 vida | 2.500 (+900 por cada compra repetida) | 5 vidas |
| Bomb Cache | +1 bomba | 1.200 (+400 por cada compra repetida) | 6 bombas |

### Historia

Breves **escenas** estilo novela visual presentan al elenco — Squero (tú), Bar, Prism y
Astra — en los primeros encuentros, las entradas y las derrotas de los jefes. Cada una
se reproduce una vez por partida. Guía para escribirlas:
[DOCS/cutscenes.md](DOCS/cutscenes.md) (en inglés).

## Arquitectura (dónde está cada cosa)

- `src/core/` — `Loop` de paso fijo, `Input`, `RNG` con semilla, `Pool` de objetos, la
  máquina de estados principal `Game`, `RunState` (todo lo que dura una partida
  completa) y el `World` que ejecuta una sola sala.
- `src/map/` — `GameMap` (grafo de salas por capas) y `MapGen` (generación con semilla).
- `src/entities/` — `Player`, `Enemy`, `Boss`, `BombSquare` y el modelo de datos `Bullet`.
- `src/systems/` — `BulletSystem` (con pool), `CollisionSystem`, `ParticleSystem`,
  `WaveManager`, `PowerUpSystem`, `ShopSystem`.
- `src/content/` — contenido basado en datos: `patterns`, `powerups`, `shots`
  (escaleras de disparo), `shop`, `sectors`, `cutscenes` y los grupos de fases en
  `stages/` (`easy`, `medium`, `elite`, `hard`, `boss`). Ajusta el juego aquí sin tocar
  el código del motor.
- `src/ui/` — `Hud`, `Overlay`, `MapScreen`, `ShopScreen`, `CutscenePlayer`.
- `src/render/Renderer.ts` — canvas, escalado, sacudida de pantalla y el dibujo de
  figuras/resplandor que todo comparte.

Más detalle (en inglés): [.CLAUDE/structure.md](.CLAUDE/structure.md),
[.CLAUDE/design-rules.md](.CLAUDE/design-rules.md),
[.CLAUDE/commands.md](.CLAUDE/commands.md).

### Reglas de diseño a respetar al ampliar el juego

- El jugador y sus balas son **siempre cuadrados**; los enemigos usan cualquier figura de
  `ENEMY_SHAPES` (nunca un cuadrado). La `shape` de una bala copia la de quien dispara.
  Los rectángulos están reservados para personajes amistosos (Bar).
- Toda la aleatoriedad que afecta al juego pasa por el `RNG` con semilla — nunca
  `Math.random` en la lógica del juego — para que una partida sea reproducible a partir
  de su semilla. (Las partículas son cosméticas y quedan exentas a propósito.)
- La lógica corre a un paso fijo de 60 Hz; las balas y partículas usan pools.
- Las mejoras de disparo se profundizan antes de ampliarse (ver arriba).
- Las vidas y bombas solo se obtienen en The Bar, pagadas con puntuación.
- **Sin resplandor en las balas** — los proyectiles son rellenos nítidos para que una
  pantalla llena siga siendo legible.

## Cambios recientes

- **Rebalanceo de disparos** — cada tipo de disparo tiene ahora una escalera de niveles
  (`src/content/shots.ts`); elegirlo de nuevo mejora un flujo en lugar de apilar copias.
  Nuevas mejoras **Scatter**, **Homing Splinter** y **Orbit Shield**; se eliminó
  **Swift Frame**. Las balas ya no brillan.
- **The Bar** — un nodo de tienda donde la puntuación compra vidas y bombas
  (`src/content/shop.ts`, `src/ui/ShopScreen.ts`). Las vidas y bombas se quitaron de
  las mejoras.
- **Sectores** — la profundidad del mapa, la capa del mini-jefe y las capas de la tienda
  se definen por sector (`src/content/sectors.ts`). Un mini-jefe evitado regresa antes
  del jefe final.
- **Escenas** — escenas de novela visual para Bar, Prism y Astra, con diálogos pulidos.
- **Entradas de jefe** — los jefes llegan y son inmunes un momento antes de atacar.
- **Pantalla de carga** y **despliegue en GitHub Pages**.
