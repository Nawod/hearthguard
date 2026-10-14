import { parentPort } from "node:worker_threads";
import { createMatch } from "../src/game/world";
import { stepGame, applyInput, applyCommand } from "../src/game/engine";
import { makeView, updateVisibility } from "../src/game/visibility";
import { encodeSave, restoreSave } from "../src/game/save";
import { forfeitPlayer, resolveLifecycle } from "../src/game/lifecycle";
import type { GameRuntime } from "../src/game/types";
let runtime: GameRuntime | undefined;
function views() {
  if (runtime)
    parentPort?.postMessage({
      type: "views",
      views: Object.values(runtime.state.players).map((p) =>
        makeView(runtime!.state, p.id),
      ),
    });
}
parentPort!.on("message", async (m) => {
  try {
    if (m.type === "start") {
      runtime = m.save
        ? await restoreSave(m.save)
        : await createMatch(m.config);
      if (m.save)
        for (const p of Object.values(runtime.state.players)) {
          p.input.move = { x: 0, z: 0 };
          p.input.attack = false;
          p.input.jump = false;
          p.action = undefined;
        }
      runtime.state.paused = false;
      updateVisibility(runtime);
      views();
    }
    if (!runtime) return;
    if (m.type === "release") {
      const p = runtime.state.players[m.actor];
      if (p) {
        p.input.move = { x: 0, z: 0 };
        p.input.attack = false;
        p.input.jump = false;
        p.action = undefined;
      }
    }
    if (m.type === "input") applyInput(runtime, m.actor, m.input);
    if (m.type === "command") {
      const result = applyCommand(runtime, m.actor, m.command);
      parentPort!.postMessage({
        type: "result",
        actor: m.actor,
        seq: m.seq,
        result,
      });
      views();
    }
    if (m.type === "forfeit") {
      forfeitPlayer(runtime, m.actor);
      resolveLifecycle(runtime, 0);
      views();
    }
    if (m.type === "checkpoint")
      parentPort!.postMessage({
        type: "checkpoint",
        save: encodeSave(runtime),
      });
    if (m.type === "stop") {
      parentPort!.postMessage({
        type: "checkpoint",
        save: encodeSave(runtime),
      });
      runtime.physics.dispose();
      runtime = undefined;
    }
  } catch (e) {
    parentPort!.postMessage({ type: "error", message: (e as Error).message });
  }
});
let previous = performance.now(),
  accumulator = 0;
setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(0.25, (now - previous) / 1000);
  previous = now;
  if (!runtime || runtime.state.result) {
    accumulator = 0;
    return;
  }
  while (accumulator >= 1 / 30) {
    stepGame(runtime);
    accumulator -= 1 / 30;
    if (runtime.state.tick % 2 === 0 || runtime.state.result) views();
    if (runtime.state.tick % 1800 === 0)
      parentPort!.postMessage({
        type: "checkpoint",
        save: encodeSave(runtime),
      });
  }
}, 10);
