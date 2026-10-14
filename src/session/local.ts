import { ViewStream } from "./stream";
import type { GameSession } from "./protocol";
import type {
  MatchConfig,
  InputFrame,
  Command,
  PlayerView,
  SaveEnvelope,
} from "../game/types";
export class LocalSession implements GameSession {
  onView?: GameSession["onView"];
  onResult?: GameSession["onResult"];
  onSave?: (slot: "manual" | "auto", save: SaveEnvelope) => void;
  private generation = 0;
  private stream = new ViewStream();
  private worker = new Worker(
    new URL("../worker/game.worker.ts", import.meta.url),
    { type: "module" },
  );
  constructor() {
    this.worker.onmessage = (e) => {
      const m = e.data;
      if (m.generation !== this.generation) return;
      if (m.type === "snapshot") this.onView?.(this.stream.unpack(m.view));
      if (m.type === "result" && !m.result.ok)
        this.onResult?.(m.result.message);
      if (m.type === "error") this.onResult?.(m.message);
      if (m.type === "save") this.onSave?.(m.slot, m.save);
    };
    this.worker.onerror = () =>
      this.onResult?.("The game could not start. Reload to retry.");
  }
  start(config: MatchConfig): void {
    this.generation++;
    this.stream.reset();
    this.worker.postMessage({
      type: "start",
      config,
      generation: this.generation,
    });
  }
  load(save: SaveEnvelope): void {
    this.generation++;
    this.stream.reset();
    this.worker.postMessage({
      type: "load",
      save,
      generation: this.generation,
    });
  }
  pause(paused: boolean): void {
    this.worker.postMessage({ type: "pause", paused });
  }
  save(): void {
    this.worker.postMessage({ type: "save" });
  }
  submitInput(input: InputFrame): void {
    this.worker.postMessage({ type: "input", input });
  }
  sendCommand(command: Command): void {
    this.worker.postMessage({ type: "command", command });
  }
  dispose(): void {
    this.worker.terminate();
  }
}
