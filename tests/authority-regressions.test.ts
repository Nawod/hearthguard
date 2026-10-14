import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { spawn, ground } from "../src/game/world";
import { updateMovement } from "../src/game/movement";
import { emptyInput } from "../src/game/types";
import { updateVisibility, makeView } from "../src/game/visibility";
import { validateMessage } from "../server/validation";
import { encodeSave, restoreSave } from "../src/game/save";
import { applyCommand } from "../src/game/engine";
it("the nearby owner can lock a city gate but an enemy cannot control it", async () => {
  const r = await createFixture();
  try {
    const gate = spawn(r.state, "gate", 0, { x: 19, y: 0, z: 24 });
    r.physics.addEntity(gate);
    r.state.players[1].pos = { x: 19, y: 0, z: 20.5 };
    r.physics.teleport(1, r.state.players[1].pos);
    r.physics.step(1 / 60);
    expect(
      applyCommand(r, 1, { type: "gate", target: gate.id, open: false } as any)
        .ok,
    ).toBe(true);
    expect((gate as any).gateLocked).toBe(true);
    expect(
      applyCommand(r, 2, { type: "gate", target: gate.id, open: true } as any)
        .ok,
    ).toBe(false);
  } finally {
    r.physics.dispose();
  }
});
it("walls prevent gathering a nearby hidden resource through solid masonry", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1];
    p.pos = { x: 19, y: 0, z: 23 };
    r.physics.teleport(1, p.pos);
    const wall = spawn(r.state, "wall", 1, { x: 19, y: 0, z: 24.4 }),
      tree = spawn(r.state, "tree", -1, { x: 19, y: 0, z: 25.5 });
    r.physics.addEntity(wall);
    r.physics.addEntity(tree);
    r.physics.step(1 / 60);
    expect(applyCommand(r, 1, { type: "interact", target: tree.id }).ok).toBe(
      false,
    );
    expect(p.action).toBeUndefined();
  } finally {
    r.physics.dispose();
  }
});

it("a friendly character near a gate cannot open an enemy route", async () => {
  const r = await createFixture();
  try {
    const gate = spawn(r.state, "gate", 0, { x: 40, y: 0, z: 40 });
    r.physics.addEntity(gate);
    const friendly = r.state.players[1],
      enemy = r.state.players[2];
    friendly.pos = { x: 37, y: 0, z: 40 };
    enemy.pos = { x: 40, y: 0, z: 44 };
    friendly.pos.y = ground(r.state, friendly.pos.x, friendly.pos.z);
    enemy.pos.y = ground(r.state, enemy.pos.x, enemy.pos.z);
    r.physics.teleport(1, friendly.pos);
    r.physics.teleport(2, enemy.pos);
    r.physics.step(1 / 60);
    enemy.input = { ...emptyInput(), move: { x: 0, z: -1 } };
    for (let i = 0; i < 90; i++) updateMovement(r, 1 / 30);
    expect(enemy.pos.z).toBeGreaterThan(42.25);
    friendly.pos = { x: 40, y: 0, z: 44 };
    friendly.pos.y = ground(r.state, 40, 44);
    r.physics.teleport(1, friendly.pos);
    friendly.input = { ...emptyInput(), move: { x: 0, z: -1 } };
    enemy.pos = { x: 48, y: 0, z: 40 };
    enemy.pos.y = ground(r.state, 48, 40);
    r.physics.teleport(2, enemy.pos);
    r.physics.step(1 / 60);
    for (let i = 0; i < 90; i++) updateMovement(r, 1 / 30);
    expect(friendly.pos.z).toBeLessThan(40);
  } finally {
    r.physics.dispose();
  }
});
it("walls hide enemies and snapshots omit private plans and inventory", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      enemy = r.state.players[2];
    p.pos = { x: 42, y: 0, z: 44 };
    enemy.pos = { x: 42, y: 0, z: 36 };
    r.physics.teleport(1, p.pos);
    r.physics.teleport(2, enemy.pos);
    const wall = spawn(r.state, "gate", 1, { x: 42, y: 0, z: 40 });
    r.physics.addEntity(wall);
    r.physics.step(1 / 60);
    enemy.pack.ore = 77;
    enemy.ai.phase = "private";
    updateVisibility(r);
    expect(makeView(r.state, 1).players.some((v) => v.id === 2)).toBe(false);
    r.physics.removeEntity(wall.id);
    delete r.state.entities[wall.id];
    updateVisibility(r);
    const visible = makeView(r.state, 1).players.find((v) => v.id === 2)!;
    expect(visible.pack.ore).toBe(0);
    expect(visible.ai.phase).toBe("");
  } finally {
    r.physics.dispose();
  }
});
it("rejects caller-supplied positions and damage rather than accepting spoofed input", () => {
  expect(() =>
    validateMessage({
      type: "input",
      input: { ...emptyInput(), seq: 1, pos: { x: 99, y: 0, z: 99 } },
    }),
  ).toThrow();
  expect(() =>
    validateMessage({
      type: "command",
      seq: 1,
      actor: 2,
      command: { type: "eat", damage: 999 },
    }),
  ).toThrow();
});
it("rejects damaged saved resources before creating a physics world", async () => {
  const r = await createFixture();
  const save = encodeSave(r);
  r.physics.dispose();
  save.state.players[1].pack.wood = -50;
  let rejected = false;
  try {
    const invalid = await restoreSave(save);
    invalid.physics.dispose();
  } catch (e) {
    rejected = /invalid|damaged/i.test(String(e));
  }
  expect(rejected).toBe(true);
});
