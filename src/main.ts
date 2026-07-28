import { Game } from "./core/Game";
import { Input } from "./core/Input";
import { Loop } from "./core/Loop";
import { Renderer } from "./render/Renderer";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("#game canvas not found");

const renderer = new Renderer(canvas);
const input = new Input();
const game = new Game(input, renderer);

const loop = new Loop(
  () => game.step(),
  () => game.render(),
);
loop.start();

const loading = document.getElementById("loading");
if (loading) {
  loading.classList.add("done");
  loading.addEventListener("transitionend", () => loading.remove(), { once: true });
}
