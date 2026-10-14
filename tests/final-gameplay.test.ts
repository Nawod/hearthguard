import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { spawn, ground } from "../src/game/world";
import { updateMovement } from "../src/game/movement";
import { enterVehicle, leaveVehicle } from "../src/game/vehicles";
import { resolveLifecycle } from "../src/game/lifecycle";
import { placeBuilding } from "../src/game/construction";
import { emptyInput } from "../src/game/types";
import { updateVisibility, makeView } from "../src/game/visibility";
import { Prediction } from "../src/session/prediction";
it.each(["horse", "catapult"] as const)(
  "owned parked %s stays parked while owner walks, dismounts and respawns",
  async (type) => {
    const r = await createFixture();
    try {
      const p = r.state.players[1];
      p.pos = { x: 40, y: ground(r.state, 40, 40), z: 40 };
      r.physics.teleport(1, p.pos);
      const v = spawn(r.state, type, 0, { x: 42, y: 0, z: 40 });
      v.owner = 1;
      p.vehicleId = v.id;
      r.physics.addEntity(v);
      r.physics.step(1 / 60);
      const original = { ...v.pos };
      p.input = { ...emptyInput(), move: { x: 0, z: -1 } };
      updateMovement(r, 1 / 30);
      expect(v.pos).toEqual(original);
      expect(p.pos.z).toBeLessThan(40);
      expect(p.pos.x).toBeCloseTo(40, 1);
      expect(enterVehicle(r, 1, v.id).ok).toBe(true);
      expect(leaveVehicle(r, 1).ok).toBe(true);
      const parked = { ...v.pos };
      updateMovement(r, 1 / 30);
      expect(v.pos).toEqual(parked);
      r.state.damage.push({ target: 1, source: 2, amount: 1000 });
      resolveLifecycle(r, 1 / 30);
      r.state.tick = p.respawnAt;
      resolveLifecycle(r, 1 / 30);
      const fresh = { ...p.pos };
      updateMovement(r, 1 / 30);
      expect(v.pos).toEqual(parked);
      expect(Math.hypot(p.pos.x - fresh.x, p.pos.z - fresh.z)).toBeLessThan(
        0.3,
      );
    } finally {
      r.physics.dispose();
    }
  },
);
it("operated catapult moves at bounded walking speed, keeps a hittable collider and stops at walls", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1];
    p.pos = { x: 40, y: ground(r.state, 40, 40), z: 40 };
    r.physics.teleport(1, p.pos);
    const v = spawn(r.state, "catapult", 0, { x: 42, y: 0, z: 40 });
    v.owner = 1;
    p.vehicleId = v.id;
    r.physics.addEntity(v);
    r.physics.step(1 / 60);
    expect(enterVehicle(r, 1, v.id).ok).toBe(true);
    p.input = { ...emptyInput(), move: { x: 0, z: -1 } };
    for (let n = 0; n < 30; n++) updateMovement(r, 1 / 30);
    expect(v.pos.z).toBeLessThan(39.5);
    expect(v.pos.z).toBeGreaterThan(38);
    expect(
      r.physics.raycast(
        { x: v.pos.x - 3, y: v.pos.y + 0.6, z: v.pos.z },
        { x: 1, y: 0, z: 0 },
        6,
        1,
      )?.entityId,
    ).toBe(v.id);
    updateVisibility(r);
    const prediction = new Prediction();
    prediction.accept(makeView(r.state, 1));
    const before = prediction.position!.z;
    prediction.record({ ...p.input, seq: 1 });
    expect(prediction.position!.z).toBeLessThan(before);
    const wall = spawn(r.state, "wall", 1, {
      x: v.pos.x,
      y: 0,
      z: v.pos.z - 4,
    });
    r.physics.addEntity(wall);
    r.physics.step(1 / 60);
    for (let n = 0; n < 120; n++) updateMovement(r, 1 / 30);
    expect(
      Math.max(Math.abs(v.pos.x - wall.pos.x), Math.abs(v.pos.z - wall.pos.z)),
    ).toBeGreaterThan(1.94);
  } finally {
    r.physics.dispose();
  }
});
it("all townhall exits reject hostile construction and respawn searches around new physical obstructions", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      hall = r.state.entities[r.state.factions[0].townhall];
    const exit = { x: hall.pos.x - 1.65, y: 0, z: hall.pos.z + 5 };
    p.pos = { x: 40, y: ground(r.state, 40, 40), z: 40 };
    r.physics.teleport(1, p.pos);
    const enemy = r.state.players[2];
    enemy.pos = { x: exit.x, y: 0, z: exit.z + 3 };
    r.physics.teleport(2, enemy.pos);
    r.state.factions[1].stock = {
      wood: 1000,
      stone: 1000,
      ore: 1000,
      food: 1000,
    };
    expect(placeBuilding(r, 2, "wall", exit, 0).ok).toBe(false);
    const wall = spawn(r.state, "wall", 1, exit);
    r.physics.addEntity(wall);
    r.physics.step(1 / 60);
    r.state.damage.push({ target: 1, source: 2, amount: 1000 });
    resolveLifecycle(r, 1 / 30);
    r.state.tick = p.respawnAt;
    resolveLifecycle(r, 1 / 30);
    expect(p.dead).toBe(false);
    expect(Math.hypot(p.pos.x - exit.x, p.pos.z - exit.z)).toBeGreaterThan(1.4);
  } finally {
    r.physics.dispose();
  }
});

it("operated siege physics remains continuous after save/load and becomes parked on death", async () => {
  const { encodeSave, restoreSave } = await import("../src/game/save");
  const r = await createFixture();
  let loaded;
  try {
    const p = r.state.players[1];
    p.pos = { x: 40, y: ground(r.state, 40, 40), z: 40 };
    r.physics.teleport(1, p.pos);
    const v = spawn(r.state, "catapult", 0, { x: 42, y: 0, z: 40 });
    v.owner = 1;
    p.vehicleId = v.id;
    r.physics.addEntity(v);
    r.physics.step(1 / 60);
    enterVehicle(r, 1, v.id);
    p.input = { ...emptyInput(), move: { x: 0, z: -1 } };
    updateMovement(r, 1 / 30);
    loaded = await restoreSave(encodeSave(r));
    for (let n = 0; n < 30; n++) {
      updateMovement(r, 1 / 30);
      updateMovement(loaded, 1 / 30);
    }
    expect(loaded.state.entities[v.id].pos.z).toBeCloseTo(v.pos.z, 5);
    r.state.damage.push({ target: 1, source: 2, amount: 1000 });
    resolveLifecycle(r, 1 / 30);
    expect(v.occupant).toBeUndefined();
    expect(r.physics.handles().bodies.some(([id]) => id === v.id)).toBe(false);
    expect(r.physics.handles().colliders.some(([id]) => id === v.id)).toBe(
      true,
    );
  } finally {
    r.physics.dispose();
    loaded?.physics.dispose();
  }
});
