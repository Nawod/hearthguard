import { it, expect } from "vitest";
it("rejects damaged plans, reservations, projectiles and actor inputs", async () => {
  const r = await createFixture();
  try {
    const original = encodeSave(r);
    const mutations = [
      (s: any) => (s.state.players[1].input.move.x = Infinity),
      (s: any) =>
        s.state.entities[s.state.factions[0].townhall].queue.push({
          actor: 1,
          recipe: "unknown",
          remaining: 1,
          cost: {},
        }),
      (s: any) =>
        s.state.projectiles.push({
          id: 1000,
          owner: 1,
          faction: 0,
          pos: { x: 1, y: 1, z: 1 },
          vel: { x: NaN, y: 0, z: 0 },
          life: 1,
          damage: 1,
          kind: "arrow",
        }),
    ];
    for (const mutate of mutations) {
      const save = structuredClone(original);
      mutate(save);
      let rejected = false;
      try {
        const loaded = await restoreSave(save);
        loaded.physics.dispose();
      } catch {
        rejected = true;
      }
      expect(rejected).toBe(true);
    }
  } finally {
    r.physics.dispose();
  }
});
import { createFixture } from "./helpers/fixture";
import { stepGame } from "../src/game/engine";
import { encodeSave, restoreSave } from "../src/game/save";
import { writeSave, readSave } from "../src/platform/storage";
import { indexedDB } from "fake-indexeddb";
import { vi } from "vitest";
it("manual and rolling autosave slots persist independently and incompatible versions reject", async () => {
  vi.stubGlobal("indexedDB", indexedDB);
  const r = await createFixture();
  try {
    const save = encodeSave(r);
    await writeSave("manual", save);
    save.state.tick = 1800;
    await writeSave("auto", save);
    expect((await readSave("manual"))?.state.tick).toBe(0);
    expect((await readSave("auto"))?.state.tick).toBe(1800);
    await expect(restoreSave({ ...save, version: 99 } as any)).rejects.toThrow(
      /incompatible/i,
    );
  } finally {
    r.physics.dispose();
    vi.unstubAllGlobals();
  }
});
it("complete save restores resources, randomness, actors and physics continuity", async () => {
  const a = await createFixture();
  let b;
  try {
    stepGame(a, 60);
    a.state.players[1].weapons = ["sword", "bow"];
    a.state.players[1].pack.wood = 13;
    b = await restoreSave(encodeSave(a));
    expect(b.state.players[1].weapons).toEqual(["sword", "bow"]);
    b.state.paused = false;
    stepGame(a, 60);
    stepGame(b, 60);
    expect(b.state.players[1].pack.wood).toBe(13);
    expect(b.state.rng).toBe(a.state.rng);
    expect(b.state.players[2].pos.x).toBeCloseTo(a.state.players[2].pos.x, 5);
  } finally {
    a.physics.dispose();
    b?.physics.dispose();
  }
});
