import { it, expect, vi } from "vitest";
import { LocalSession } from "../src/session/local";
import type { MatchConfig } from "../src/game/types";
it("replacement matches ignore old worker views and old saves", () => {
  let worker: any;
  class FakeWorker {
    onmessage?: any;
    onerror?: any;
    messages: any[] = [];
    constructor() {
      worker = this;
    }
    postMessage(message: any) {
      this.messages.push(message);
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", FakeWorker);
  try {
    const session = new LocalSession(),
      views: any[] = [],
      saves: any[] = [];
    session.onView = (v) => views.push(v);
    session.onSave = (_slot, save) => saves.push(save);
    const config = {
      mode: "single",
      difficulty: "easy",
      seed: 42,
      participants: [],
    } as MatchConfig;
    session.start(config);
    worker.onmessage({
      data: {
        type: "snapshot",
        generation: 1,
        view: { tick: 1, heights: [0], fog: [1] },
      },
    });
    session.start(config);
    worker.onmessage({
      data: { type: "snapshot", generation: 1, view: { tick: 1000 } },
    });
    worker.onmessage({
      data: { type: "save", generation: 1, slot: "auto", save: {} },
    });
    worker.onmessage({
      data: {
        type: "snapshot",
        generation: 2,
        view: { tick: 0, heights: [0], fog: [1] },
      },
    });
    expect(views.map((v) => v.tick)).toEqual([1, 0]);
    expect(saves).toHaveLength(0);
    session.dispose();
  } finally {
    vi.unstubAllGlobals();
  }
});
