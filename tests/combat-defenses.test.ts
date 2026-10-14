import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { fire, eat, queueDamage, updateCombat } from "../src/game/combat";
import { resolveLifecycle } from "../src/game/lifecycle";
import { spawn } from "../src/game/world";
import { placeTrap, updateDefenses } from "../src/game/defenses";
it("food costs ten, heals over two seconds and damage interrupts it", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1];
    p.pack.food = 20;
    expect(eat(r, 1).ok).toBe(false);
    p.hp = 50;
    expect(eat(r, 1).ok).toBe(true);
    expect(p.pack.food).toBe(10);
    updateCombat(r, 1);
    expect(p.hp).toBeCloseTo(62.5);
    queueDamage(r, 1, 7, 2);
    resolveLifecycle(r, 0);
    const hp = p.hp;
    updateCombat(r, 1);
    expect(p.hp).toBe(hp);
    expect(eat(r, 1).ok).toBe(false);
  } finally {
    r.physics.dispose();
  }
});
it("enemy bear traps trigger once; incomplete towers never shoot and walls obstruct tower shots", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      enemy = r.state.players[2];
    p.pos = { x: 16, y: 0, z: 23 };
    p.pack = { food: 0, wood: 5, stone: 0, ore: 5 };
    expect(placeTrap(r, 1, { x: 18, y: 0, z: 23 }).ok).toBe(true);
    const trap = Object.values(r.state.entities).find(
      (e) => e.type === "trap",
    )!;
    enemy.pos = { ...trap.pos };
    updateDefenses(r, 1 / 30);
    resolveLifecycle(r, 0);
    expect(enemy.hp).toBe(72);
    updateDefenses(r, 1 / 30);
    resolveLifecycle(r, 0);
    expect(enemy.hp).toBe(72);
    expect(enemy.trappedUntil).toBe(60);
    const tower = spawn(r.state, "tower", 0, { x: 19, y: 0, z: 19 });
    tower.progress = 0.5;
    r.physics.addEntity(tower);
    r.physics.teleport(2, enemy.pos);
    r.physics.step(1 / 60);
    updateDefenses(r, 1 / 30);
    expect(r.state.projectiles).toHaveLength(0);
    tower.progress = 1;
    updateDefenses(r, 1 / 30);
    expect(r.state.projectiles).toHaveLength(1);
    r.state.projectiles = [];
    tower.cooldown = 0;
    const wall = spawn(r.state, "townhall", 1, { x: 18, y: 0, z: 21 });
    r.physics.addEntity(wall);
    r.physics.step(1 / 60);
    updateDefenses(r, 1 / 30);
    expect(r.state.projectiles).toHaveLength(0);
  } finally {
    r.physics.dispose();
  }
});
it("hunted wildlife drops recoverable food and weapon switching cannot bypass cooldown", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1];
    p.pos = { x: 18, y: 0, z: 23 };
    r.physics.teleport(1, p.pos);
    const deer = spawn(r.state, "deer", -1, { x: 18, y: 0, z: 21.5 });
    r.physics.addEntity(deer);
    r.physics.step(1 / 60);
    p.weapons = ["sword", "bow"];
    p.yaw = 0;
    deer.hp = 20;
    expect(fire(r, 1).ok).toBe(true);
    resolveLifecycle(r, 0);
    expect(r.state.entities[deer.id]).toBeUndefined();
    expect(
      Object.values(r.state.entities).some(
        (e) => e.type === "bag" && e.stock.food === 35,
      ),
    ).toBe(true);
    p.slot = 1;
    expect(fire(r, 1).ok).toBe(false);
    expect(r.state.projectiles).toHaveLength(0);
  } finally {
    r.physics.dispose();
  }
});
it("friendly projectiles cannot damage teammates; Hard ammo is spent once per legal shot", async () => {
  const r = await createFixture({
    mode: "teams",
    difficulty: "hard",
    participants: [
      { name: "A", controller: "human", team: 0 },
      { name: "B", controller: "human", team: 0 },
      { name: "C", controller: "human", team: 1 },
    ],
  });
  try {
    const p = r.state.players[1],
      mate = r.state.players[2];
    p.weapons = ["bow", null];
    p.ammo.arrow = 1;
    p.pos = { x: 18, y: 0, z: 23 };
    mate.pos = { x: 18, y: 0, z: 21.5 };
    r.physics.teleport(1, p.pos);
    r.physics.teleport(2, mate.pos);
    r.physics.step(1 / 60);
    p.yaw = 0;
    expect(fire(r, 1).ok).toBe(true);
    expect(p.ammo.arrow).toBe(0);
    expect(fire(r, 1).ok).toBe(false);
    for (let i = 0; i < 30; i++) {
      updateCombat(r, 1 / 30);
      resolveLifecycle(r, 1 / 30);
    }
    expect(mate.hp).toBe(100);
    p.cooldown = 0;
    expect(fire(r, 1).ok).toBe(false);
  } finally {
    r.physics.dispose();
  }
});
