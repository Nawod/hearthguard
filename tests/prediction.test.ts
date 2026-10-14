import { it, expect } from "vitest";
import { Prediction } from "../src/session/prediction";
import { ViewStream } from "../src/session/stream";
import { createFixture } from "./helpers/fixture";
import { makeView, updateVisibility } from "../src/game/visibility";
import { emptyInput } from "../src/game/types";
it("replays unacknowledged movement without spending or firing and stops at permitted scenery", async () => {
  const r = await createFixture();
  try {
    updateVisibility(r);
    const view = makeView(r.state, 1);
    const predictor = new Prediction();
    predictor.accept(view);
    for (let seq = 1; seq <= 60; seq++)
      predictor.record({
        ...emptyInput(),
        seq,
        attack: true,
        move: { x: 0, z: -1 },
      });
    const pos = predictor.position!;
    expect(pos.z).toBeGreaterThan(19.3);
    expect(pos.z).toBeLessThan(view.players[0].pos.z);
    expect(view.players[0].pack.wood).toBe(0);
    expect(view.projectiles).toHaveLength(0);
    predictor.accept({ ...view, ack: 60 });
    expect(predictor.pendingCount).toBe(0);
    expect(predictor.position).toEqual(view.players[0].pos);
  } finally {
    r.physics.dispose();
  }
});
it("sends the map once and restores exploration deltas without revealing hidden entities", async () => {
  const r = await createFixture();
  try {
    updateVisibility(r);
    const view = makeView(r.state, 1),
      sender = new ViewStream(),
      receiver = new ViewStream();
    const first = sender.pack(view);
    expect(first.heights?.length).toBeGreaterThan(0);
    receiver.unpack(first);
    view.fog[0] = 1;
    view.tick++;
    const delta = sender.pack(view);
    expect(delta.heights).toBeUndefined();
    expect(delta.fog).toBeUndefined();
    expect(JSON.stringify(delta).length).toBeLessThan(22000);
    const restored = receiver.unpack(delta);
    expect(restored.heights).toHaveLength(view.heights.length);
    expect(restored.fog[0]).toBe(1);
    expect(restored.entities).toEqual(view.entities);
  } finally {
    r.physics.dispose();
  }
});
