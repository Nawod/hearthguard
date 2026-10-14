import { ViewStream } from "../session/stream";
import { createMatch } from "../game/world";
import { stepGame, applyInput, applyCommand } from "../game/engine";
import { makeView, updateVisibility } from "../game/visibility";
import { encodeSave, restoreSave } from "../game/save";
import type { GameRuntime } from "../game/types";
const stream = new ViewStream();
let runtime: GameRuntime | undefined,
  generation = 0;
const post = (m: object, packetGeneration = generation) =>
  self.postMessage({ ...m, generation: packetGeneration });
function view() {
  if (runtime)
    post({ type: "snapshot", view: stream.pack(makeView(runtime.state, 1)) });
}
self.onmessage = async (e) => {
  const m = e.data;
  const requestGeneration = m.generation ?? generation;
  try {
    if (m.type === "start" || m.type === "load") {
      const gen = ++generation,
        previousRuntime = runtime;
      runtime = undefined;
      previousRuntime?.physics.dispose();
      const next =
        m.type === "start"
          ? await createMatch(m.config)
          : await restoreSave(m.save);
      if (gen !== generation) {
        next.physics.dispose();
        return;
      }
      runtime = next;
      stream.reset();
      updateVisibility(runtime);
      view();
    } else if (runtime) {
      if (m.type === "input") applyInput(runtime, 1, m.input);
      if (m.type === "command") {
        const result = applyCommand(runtime, 1, m.command);
        post({ type: "result", result });
        view();
      }
      if (m.type === "pause") {
        runtime.state.paused = m.paused;
        view();
      }
      if (m.type === "save")
        post({ type: "save", slot: "manual", save: encodeSave(runtime) });
    }
  } catch (error) {
    post(
      {
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The game could not process that action.",
      },
      requestGeneration,
    );
  }
};
let previous = performance.now(),
  accumulator = 0;
setInterval(() => {
  const now = performance.now();
  accumulator += Math.min(0.25, (now - previous) / 1000);
  previous = now;
  if (!runtime || runtime.state.paused || runtime.state.result) {
    accumulator = 0;
    return;
  }
  while (accumulator >= 1 / 30) {
    stepGame(runtime);
    accumulator -= 1 / 30;
    if (runtime.state.tick % 2 === 0 || runtime.state.result) view();
    if (runtime.state.tick % 1800 === 0)
      post({ type: "save", slot: "auto", save: encodeSave(runtime) });
  }
}, 10);
