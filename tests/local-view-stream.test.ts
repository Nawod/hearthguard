import { it, expect, vi, afterEach } from "vitest";
import { LocalSession } from "../src/session/local";
import { ViewStream } from "../src/session/stream";
import type { PlayerView } from "../src/game/types";
afterEach(() => vi.unstubAllGlobals());
it("local worker terrain and fog deltas reconstruct the full view and reset on a new generation", () => {
  let worker: any;
  class WorkerStub {
    onmessage?: Function;
    constructor() {
      worker = this;
    }
    postMessage() {}
    terminate() {}
  }
  vi.stubGlobal("Worker", WorkerStub);
  const session = new LocalSession(),
    sender = new ViewStream(),
    received: PlayerView[] = [];
  session.onView = (v) => received.push(v);
  const view = {
    config: { seed: 12 },
    size: 2,
    playerId: 1,
    heights: [1, 2, 3],
    fog: [0, 1, 0, 0],
    tick: 0,
  } as unknown as PlayerView;
  const deliver = (v: PlayerView, generation: number) =>
    worker.onmessage({
      data: {
        type: "snapshot",
        generation,
        view: structuredClone(sender.pack(v)),
      },
    });
  session.start({} as any);
  deliver(view, 1);
  deliver({ ...view, fog: [1, 1, 0, 0], tick: 2 }, 1);
  expect(received[1].heights).toEqual([1, 2, 3]);
  expect(received[1].fog).toEqual([1, 1, 0, 0]);
  session.start({} as any);
  sender.reset();
  deliver({ ...view, heights: [9, 8, 7], fog: [0, 0, 0, 0] }, 2);
  expect(received[2].heights).toEqual([9, 8, 7]);
  expect(received[2].fog).toEqual([0, 0, 0, 0]);
  deliver({ ...view, tick: 4 }, 1);
  expect(received).toHaveLength(3);
  session.dispose();
});
