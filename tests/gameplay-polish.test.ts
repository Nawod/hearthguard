import { applyCommand } from "../src/game/engine";
import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { spawn, ground } from "../src/game/world";
import { updateEconomy } from "../src/game/economy";
import { updateConstruction } from "../src/game/construction";
const wild = async () => {
  const r = await createFixture();
  r.state.players[2].controller = "human";
  const d = spawn(r.state, "deer", -1, {
    x: 44,
    y: ground(r.state, 44, 44),
    z: 44,
  });
  d.home = { ...d.pos };
  d.goal = { x: 44, y: ground(r.state, 44, 46), z: 46 };
  d.nextMove = 9999;
  r.physics.addEntity(d);
  return { r, d };
};
it("a hunted deer corpse stays put for resource recovery", async () => {
  const { r, d } = await wild();
  try {
    d.hp = 0;
    const before = { ...d.pos };
    updateEconomy(r, 1);
    expect(d.pos).toEqual(before);
  } finally {
    r.physics.dispose();
  }
});
it("living wildlife faces the direction it actually travels", async () => {
  const { r, d } = await wild();
  try {
    updateEconomy(r, 1);
    expect(d.pos.z).toBeGreaterThan(44);
    expect(-Math.cos(d.yaw)).toBeCloseTo(1);
  } finally {
    r.physics.dispose();
  }
});
it("wildlife stops at solid structures instead of walking through them", async () => {
  const { r, d } = await wild();
  try {
    const wall = spawn(r.state, "wall", 0, { x: 44, y: d.pos.y, z: 44.8 });
    r.physics.addEntity(wall);
    r.physics.step(1 / 60);
    const before = { ...d.pos };
    updateEconomy(r, 1);
    expect(d.pos).toEqual(before);
  } finally {
    r.physics.dispose();
  }
});
it("completed repairs clear the task and charge only for the restored health", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      h = r.state.entities[r.state.factions[0].townhall];
    p.pos = { ...h.pos, z: h.pos.z + 5 };
    r.physics.teleport(p.id, p.pos);
    h.hp = h.maxHp - 1;
    r.state.factions[0].stock.wood = 10;
    p.action = { kind: "repair", target: h.id };
    updateConstruction(r, 1);
    expect(h.hp).toBe(h.maxHp);
    expect(p.action).toBeUndefined();
    expect(r.state.factions[0].stock.wood).toBeCloseTo(10 - 1 / 36);
  } finally {
    r.physics.dispose();
  }
});
it("a destroyed farm cannot grow another harvest", async () => {
  const r = await createFixture();
  try {
    const f = spawn(r.state, "farm", 0, { x: 44, y: 0, z: 44 });
    f.hp = 0;
    f.amount = 0;
    f.cropAt = r.state.tick || 1;
    r.state.tick = 2;
    updateConstruction(r, 1);
    expect(f.amount).toBe(0);
  } finally {
    r.physics.dispose();
  }
});

it("wildlife sensors do not prevent resource gathering but solid walls still block it", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1];
    p.pos = { x: 44, y: ground(r.state, 44, 44), z: 44 };
    r.physics.teleport(p.id, p.pos);
    const tree = spawn(r.state, "tree", -1, { ...p.pos, z: 42 }),
      deer = spawn(r.state, "deer", -1, { ...p.pos, z: 43 });
    r.physics.addEntity(tree);
    r.physics.addEntity(deer);
    r.physics.step(1 / 60);
    expect(
      applyCommand(r, p.id, { type: "interact", target: tree.id }).ok,
    ).toBe(true);
    const wall = spawn(r.state, "wall", 0, { ...p.pos, z: 43 });
    r.physics.addEntity(wall);
    r.physics.step(1 / 60);
    expect(
      applyCommand(r, p.id, { type: "interact", target: tree.id }).ok,
    ).toBe(false);
  } finally {
    r.physics.dispose();
  }
});
