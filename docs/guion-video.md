# Guion del video explicativo — Square to the Rescue (STTR)

Video corto (≈ 5 minutos) que muestra el juego funcionando y explica cómo está hecho
el código.

- **Jugar en línea:** <https://vidanj.github.io/STTR-Square-to-the-Rescue/>
- **Repositorio:** <https://github.com/vidanj/STTR-Square-to-the-Rescue>
- **Propuesta:** [Propuesta-STTR.pdf](Propuesta-STTR.pdf)

## Resumen de escenas

| # | Tiempo | Qué se muestra | De qué se habla |
|---|---|---|---|
| 1 | 0:00–0:20 | Página del repositorio en GitHub | Presentación |
| 2 | 0:20–1:05 | El juego en GitHub Pages | Cómo se juega; regla "forma = bando" |
| 3 | 1:05–1:25 | Carpetas, `index.html`, `package.json` | Tecnología: TypeScript → JavaScript, Vite, Canvas |
| 4 | 1:25–1:55 | `src/main.ts`, `src/core/Loop.ts` | Arranque y bucle de paso fijo a 60 Hz |
| 5 | 1:55–2:20 | `src/core/Game.ts` | Máquina de estados |
| 6 | 2:20–3:00 | `World.ts`, `Pool.ts`, `CollisionSystem.ts` | Una sala por paso, pools, colisiones |
| 7 | 3:00–3:20 | `content/stages/easy.ts`, `content/patterns.ts` | Niveles como datos |
| 8 | 3:20–3:40 | `core/RNG.ts`, `map/MapGen.ts` | Semilla y mapa reproducible |
| 9 | 3:40–4:25 | `audio/timbres.ts`, `synth.ts`, `sfx.ts` + demo | Audio sintetizado y efectos |
| 10 | 4:25–4:45 | Terminal, `deploy.yml`, Actions, `LICENSE` | Pruebas, despliegue y licencia |
| 11 | 4:45–5:00 | El juego en línea | Cierre |

## Guion detallado

> **Cómo leerlo:** en **Mostrar** está lo que debe verse en pantalla, en orden. **Decir**
> es la narración lista para leer; puedes decirla con tus palabras, pero cuida los
> tiempos.

### 1. Presentación (0:00–0:20)

**Mostrar**
- La página del repositorio en GitHub, con el README visible (los enlaces de la parte
  de arriba: *Jugar en línea*, *Propuesta*, *Licencia MIT*).

**Decir**
> "Hola, soy Efrén Campuzano. Este es *Square to the Rescue*, o STTR: un juego web
> indie minimalista hecho en JavaScript —escrito en TypeScript— que se juega directo
> en el navegador desde GitHub Pages. En este video les muestro cómo se juega y cómo
> está construido el código."

### 2. Demostración del juego (0:20–1:05)

**Mostrar**
1. Clic en **▶ Jugar en línea**. Se ve la pantalla de carga (el cuadrado girando).
2. En el menú, **Enter** para empezar.
3. En el mapa, **← / →** para elegir una sala y **Enter** para entrar. Si aparece una
   escena, avanzar con **Z**.
4. En la sala: moverse con **WASD/flechas**, disparar con **Z**, mantener **Shift**
   (se ve el hitbox) y lanzar una bomba con **X** desde abajo de una oleada.
5. Al terminar la sala, elegir una mejora con **1 / 2 / 3**.

**Decir**
> "Eres un cuadrado y todos los enemigos son otras figuras: círculos, triángulos,
> diamantes, hexágonos. La regla que hace legible la pantalla es que cada bala toma la
> forma de quien la disparó: mis disparos son cuadrados y los del enemigo tienen su
> figura. Cada partida genera un mapa de salas a partir de una semilla; elijo mi ruta,
> supero cada sala como una fase de *bullet-hell* y gano una mejora. Con Shift me muevo
> lento y veo mi hitbox, que es solo el punto del centro. Con X lanzo la bomba: un
> cuadrado que crece mientras sube y borra las balas enemigas. Al terminar escojo una
> mejora que dura solo esta partida, porque es un *roguelike*."

### 3. Tecnología y estructura (1:05–1:25)

**Mostrar**
- En el editor, el explorador con `src/` abierto un nivel: `core`, `map`, `entities`,
  `systems`, `content`, `ui`, `render`, `audio`.
- `index.html`: el `<canvas id="game">` y el `<div id="loading">`.
- `package.json`: los scripts y las tres dependencias de desarrollo.

**Decir**
> "El proyecto no usa motor de juego, ni imágenes, ni archivos de audio. Está escrito en
> TypeScript, que es JavaScript con tipos, y Vite lo compila a JavaScript normal. El
> HTML solo tiene un canvas y la pantalla de carga. Las únicas dependencias son de
> desarrollo: TypeScript, Vite y Vitest para las pruebas. El código está dividido por
> responsabilidad: núcleo, mapa, entidades, sistemas, contenido, interfaz, render y
> audio."

### 4. Punto de entrada y bucle de juego (1:25–1:55)

**Mostrar**
- `src/main.ts` completo (29 líneas). Resaltar `new Renderer`, `new Input`,
  `new AudioEngine`, `new Game` y `new Loop(() => game.step(), () => game.render())`.
- `src/core/Loop.ts`, método `frame`: el acumulador, el `while (this.accumulator >= DT)`
  y la llamada a `render`.
- En `src/config.ts`, la línea `export const DT = 1 / 60;`.

**Decir**
> "`main.ts` es el punto de entrada: crea el renderer del canvas, el lector de teclado,
> el motor de audio y el juego, y arranca el bucle. El bucle en `Loop.ts` es de paso
> fijo: acumula el tiempo real de cada cuadro y avanza la lógica en pasos exactos de un
> sesentavo de segundo. Así los patrones de balas se comportan igual en un monitor de 60
> que en uno de 144 hertz, y el dibujo se hace una sola vez por cuadro."

### 5. Máquina de estados (1:55–2:20)

**Mostrar**
- `src/core/Game.ts`: el `enum State` (línea 19) y luego el método `step()` (línea 208),
  recorriendo el `switch`.

**Decir**
> "`Game.ts` es una máquina de estados: menú, mapa, escena, sala, tienda, mejora, pausa,
> derrota y victoria. Cada estado decide qué teclas atiende y qué se dibuja. La lógica
> de combate solo avanza en el estado de juego, y aquí mismo, con `syncMusic`, se elige
> la música de cada pantalla."

### 6. Una sala: World, pools y colisiones (2:20–3:00)

**Mostrar**
- `src/core/World.ts`, método `update` (línea 65): el orden de los pasos (jugador →
  enemigos → balas → bombas → partículas → colisiones → oleadas).
- `src/core/Pool.ts`: los métodos `spawn()` y `release(i)`.
- `src/systems/CollisionSystem.ts`: la función `circleHit`.

**Decir**
> "Cada sala es un `World`. Su método `update` corre una vez por paso: mueve al jugador,
> deja disparar a los enemigos, actualiza balas, bombas y partículas y al final resuelve
> las colisiones. Como puede haber cientos de balas en pantalla, no se crean objetos
> nuevos: se reciclan con un *pool*. `spawn` reutiliza un objeto libre y `release` lo
> retira intercambiándolo con el último, sin generar basura para el recolector. Las
> colisiones tratan todas las figuras como círculos: si la distancia al cuadrado es
> menor que la suma de radios al cuadrado, hay impacto."

### 7. Los niveles son datos (3:00–3:20)

**Mostrar**
- `src/content/stages/easy.ts`: la primera sala, `CIRCLE PATROL`.
- `src/content/patterns.ts`: la tabla `PATTERNS` con `aimed`, `ring`, `spiral`, `arc` y
  `burst`.

**Decir**
> "Los niveles no se programan, se describen como datos. Una sala es un guion de
> oleadas: qué figuras aparecen, cuántas y con qué arma. Las armas usan cinco patrones:
> apuntado, anillo, espiral, abanico y ráfaga. Para ajustar la dificultad solo se
> cambian estos números."

### 8. Semilla y mapa reproducible (3:20–3:40)

**Mostrar**
- `src/core/RNG.ts`: el método `next()` (mulberry32).
- `src/map/MapGen.ts`: la función `generateMap`.

**Decir**
> "Toda la aleatoriedad del juego pasa por un generador con semilla, mulberry32, y nunca
> por `Math.random`. Con la misma semilla sale exactamente el mismo mapa: rutas, salas,
> dónde está el mini-jefe y dónde la tienda. Así las partidas son reproducibles y se
> pueden probar."

### 9. Audio: sencillo, sintetizado y con efectos (3:40–4:25)

**Mostrar**
1. `src/audio/timbres.ts`: el objeto `SHAPE_TIMBRE` (square → `"square"`,
   circle → `"sine"`, triangle → `"triangle"`…).
2. `src/audio/synth.ts`: la función `tone()` (oscilador → filtro → ganancia con
   envolvente → salida).
3. `src/audio/sfx.ts`: la receta `shoot` y el método `play()` con el `Throttle`.
4. `src/audio/tracks.ts`: el comentario con la notación de los patrones.
5. **Demo en el juego:** dentro de una sala, presionar **M** (silencio) y luego
   **−** y **+** (aparece el aviso de volumen).

**Decir**
> "El audio es sencillo pero completo, y todo se sintetiza en código con la Web Audio
> API: no hay un solo archivo de sonido. Sigue la misma regla que las balas: cada figura
> suena con su forma de onda. El cuadrado es una onda cuadrada, el círculo una senoidal
> y el triángulo una onda triangular. Todos los efectos se construyen con dos piezas:
> una nota de oscilador con envolvente y filtro, y un golpe de ruido filtrado. El
> catálogo de efectos limita cuántas veces puede sonar cada uno, para que una pantalla
> llena de balas no se vuelva puro ruido. La música también es código: patrones de
> texto, un símbolo por semicorchea. Con M silencio el juego y con menos y más ajusto
> el volumen."

### 10. Pruebas, despliegue y licencia (4:25–4:45)

**Mostrar**
- La terminal con `npm test`: *13 archivos, 108 pruebas* en verde.
- `.github/workflows/deploy.yml`.
- La pestaña **Actions** del repositorio con la última ejecución en verde.
- El archivo `LICENSE` (MIT).

**Decir**
> "El proyecto tiene 108 pruebas unitarias con Vitest. Con cada push a `main`, GitHub
> Actions compila el juego y lo publica en GitHub Pages automáticamente. El código está
> liberado con licencia MIT: cualquiera puede jugarlo, estudiarlo y modificarlo."

### 11. Cierre (4:45–5:00)

**Mostrar**
- El juego en línea (el menú o una sala con mucha acción) y, si quieres, un texto
  sobrepuesto con la URL.

**Decir**
> "Eso es *Square to the Rescue*: un juego minimalista hecho solo con figuras, código y
> ondas de sonido. El enlace para jugar y el repositorio están en la descripción.
> ¡Gracias por ver!"

## Preparación antes de grabar

- [ ] Pestañas abiertas en este orden: repositorio, juego en línea, pestaña *Actions*.
- [ ] Editor con los archivos abiertos en el orden del guion. Fuente grande (18–20 pt) y
      tema oscuro.
- [ ] Una terminal en la carpeta del proyecto con `npm test` listo para ejecutar (antes,
      `npm install` una vez).
- [ ] Notificaciones del sistema desactivadas.
- [ ] Practicar una o dos partidas para llegar rápido a una sala con buena acción.

## Consejos de grabación

- **OBS Studio** (gratuito): lienzo de 1920×1080 a 30 fps, captura de pantalla completa.
- Graba también el **audio del escritorio** para que se oigan los efectos del juego.
  Sube el micrófono por encima del juego.
- El sonido del juego empieza con la primera tecla o clic: presiona una tecla en el menú
  antes de la demo.
- Graba por escenas y únelas después; es más fácil repetir una parte que todo el video.
- Si te pasas de tiempo, acorta primero la escena 8 y luego la 7.

## Texto sugerido para la descripción del video

```
Square to the Rescue (STTR) — juego web indie minimalista en JavaScript/TypeScript.
Bullet-hell roguelike: eres un cuadrado y cada bala toma la forma de quien la dispara.
Todo se dibuja y se sintetiza en código (Canvas + Web Audio API).

▶ Jugar: https://vidanj.github.io/STTR-Square-to-the-Rescue/
Código (MIT): https://github.com/vidanj/STTR-Square-to-the-Rescue
```
