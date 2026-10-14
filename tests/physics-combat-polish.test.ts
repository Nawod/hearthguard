import { expect, it } from "vitest";
import { createFixture } from "./helpers/fixture";
import { fire, updateCombat } from "../src/game/combat";
import { PhysicsPort } from "../src/game/physics";
import { updateMovement } from "../src/game/movement";
import { enterVehicle } from "../src/game/vehicles";
import { spawn } from "../src/game/world";
import type { MatchConfig } from "../src/game/types";

async function arena(options: Partial<MatchConfig> = {}) {
  const r = await createFixture(options);
  r.physics.dispose();
  r.state.entities = {};
  r.state.heights.fill(0);
  for (const p of Object.values(r.state.players)) {
    p.pos = { x: 10 + p.id * 10, y: 0, z: 40 };
    p.controller = "human";
    p.yaw = 0;
  }
  r.state.players[1].pos = { x: 20, y: 0, z: 22 };
  r.state.players[2].pos = { x: 20, y: 0, z: 20 };
  r.physics = await PhysicsPort.create(r.state);
  return r;
}

it.each([
  { type: "horse" as const, occupied: false, damage: 22 },
  { type: "horse" as const, occupied: true, damage: 35.2 },
  { type: "catapult" as const, occupied: false, damage: 22 },
  { type: "catapult" as const, occupied: true, damage: 22 },
])(
  "spear damage against $type (occupied: $occupied) reflects riding rather than ownership",
  async ({ type, occupied, damage }) => {
    const r = await arena();
    try {
      const p = r.state.players[1],
        target = r.state.players[2];
      p.weapons = ["spear", null];
      const vehicle = spawn(
        r.state,
        type,
        target.faction,
        occupied ? { x: 20, y: 0, z: 18.4 } : { x: 26, y: 0, z: 20 },
      );
      vehicle.owner = target.id;
      target.vehicleId = vehicle.id;
      r.physics.addEntity(vehicle);
      if (occupied)
        expect(enterVehicle(r, target.id, vehicle.id).ok).toBe(true);
      r.physics.step(1 / 60);
      expect(fire(r, p.id).ok).toBe(true);
      expect(r.state.damage).toHaveLength(1);
      expect(r.state.damage[0].target).toBe(target.id);
      expect(r.state.damage[0].amount).toBeCloseTo(damage);
    } finally {
      r.physics.dispose();
    }
  },
);

it("melee can damage an enemy farm while standing inside its passable plot", async () => {
  const r = await arena();
  try {
    const p = r.state.players[1],
      enemy = r.state.players[2];
    enemy.pos = { x: 40, y: 0, z: 40 };
    r.physics.teleport(enemy.id, enemy.pos);
    p.pos.z = 19;
    r.physics.teleport(p.id, p.pos);
    const farm = spawn(r.state, "farm", enemy.faction, { x: 20, y: 0, z: 18 });
    r.physics.step(1 / 60);
    expect(fire(r, p.id).ok).toBe(true);
    expect(r.state.damage).toMatchObject([
      { target: farm.id, amount: 7, source: p.id },
    ]);
  } finally {
    r.physics.dispose();
  }
});

it("foot movement settles, jumps once in the air and returns to the ground", async () => {
  const r = await arena();
  try {
    const p = r.state.players[1];
    for (let n = 0; n < 10; n++) updateMovement(r, 1 / 30);
    expect(p.pos.y).toBeCloseTo(0, 1);
    p.input.jump = true;
    for (let n = 0; n < 6; n++) updateMovement(r, 1 / 30);
    expect(p.pos.y).toBeGreaterThan(0.5);
    const airborneVelocity = p.vel.y;
    updateMovement(r, 1 / 30);
    expect(p.vel.y).toBeLessThan(airborneVelocity);
    p.input.jump = false;
    for (let n = 0; n < 60; n++) updateMovement(r, 1 / 30);
    expect(p.pos.y).toBeCloseTo(0, 1);
    expect(p.vel.y).toBe(0);
  } finally {
    r.physics.dispose();
  }
});

it("a mounted horse retains its wider collision clearance when approaching a wall", async () => {
  const r = await arena();
  try {
    const p = r.state.players[1],
      enemy = r.state.players[2];
    enemy.pos = { x: 40, y: 0, z: 40 };
    r.physics.teleport(enemy.id, enemy.pos);
    const wall = spawn(r.state, "wall", enemy.faction, { x: 20, y: 0, z: 18 });
    const horse = spawn(r.state, "horse", p.faction, p.pos);
    horse.owner = p.id;
    p.vehicleId = horse.id;
    r.physics.addEntity(wall);
    r.physics.addEntity(horse);
    expect(enterVehicle(r, p.id, horse.id).ok).toBe(true);
    r.physics.step(1 / 60);
    p.input.move = { x: 0, z: -1 };
    p.input.yaw = 0;
    for (let n = 0; n < 90; n++) updateMovement(r, 1 / 30);
    expect(p.pos.z).toBeLessThan(21);
    expect(p.pos.z).toBeGreaterThan(19.6);
    expect(horse.pos).toEqual(p.pos);
  } finally {
    r.physics.dispose();
  }
});

it("a fired arrow strikes its shooter's parked horse before reaching an enemy", async () => {
  const r = await arena({ difficulty: "hard" });
  try {
    const p = r.state.players[1],
      enemy = r.state.players[2];
    enemy.pos.z = 18;
    r.physics.teleport(enemy.id, enemy.pos);
    const horse = spawn(r.state, "horse", p.faction, { x: 20, y: 0, z: 20 });
    horse.owner = p.id;
    p.vehicleId = horse.id;
    p.weapons = ["bow", null];
    p.ammo.arrow = 1;
    p.pitch = 0.1;
    r.physics.addEntity(horse);
    r.physics.step(1 / 60);
    expect(fire(r, p.id).ok).toBe(true);
    expect(p.ammo.arrow).toBe(0);
    updateCombat(r, 0.2);
    expect(r.state.projectiles).toHaveLength(0);
    expect(r.state.damage).toHaveLength(0);
    expect(enemy.hp).toBe(100);
  } finally {
    r.physics.dispose();
  }
});

it("projectiles can leave the shooter's actually occupied catapult", async () => {
  const r = await arena();
  try {
    const p = r.state.players[1];
    const vehicle = spawn(r.state, "catapult", p.faction, {
      x: 20,
      y: 0,
      z: 21,
    });
    vehicle.owner = p.id;
    p.vehicleId = vehicle.id;
    r.physics.addEntity(vehicle);
    expect(enterVehicle(r, p.id, vehicle.id).ok).toBe(true);
    r.physics.step(1 / 60);
    r.state.projectiles.push({
      id: r.state.nextId++,
      owner: p.id,
      faction: p.faction,
      pos: { x: 20, y: 0.8, z: 21 },
      vel: { x: 0, y: 0, z: -34 },
      damage: 21,
      life: 3,
      kind: "arrow",
    });
    updateCombat(r, 1 / 60);
    expect(r.state.projectiles).toHaveLength(1);
    expect(r.state.projectiles[0].pos.z).toBeLessThan(21);
    expect(r.state.damage).toHaveLength(0);
  } finally {
    r.physics.dispose();
  }
});

it("terrain between two nearby enemies blocks melee damage", async () => {
  const r = await arena();
  try {
    for (let x = 0; x <= r.state.size; x++) {
      r.state.heights[21 * (r.state.size + 1) + x] = 2;
    }
    r.physics.dispose();
    r.physics = await PhysicsPort.create(r.state);
    expect(fire(r, 1).ok).toBe(true);
    expect(r.state.damage).toHaveLength(0);
  } finally {
    r.physics.dispose();
  }
});

it.each(["workshop", "stable", "armory", "farm", "townhall"] as const)(
  "melee reaches the nearby surface of an enemy %s without reaching its center",
  async (type) => {
    const r = await arena();
    try {
      const enemy = r.state.players[2];
      enemy.pos = { x: 40, y: 0, z: 40 };
      r.physics.teleport(enemy.id, enemy.pos);
      const building = spawn(r.state, type, enemy.faction, {
        x: 20,
        y: 0,
        z: 18,
      });
      r.physics.addEntity(building);
      r.physics.step(1 / 60);
      expect(fire(r, 1).ok).toBe(true);
      expect(r.state.damage).toMatchObject([
        { target: building.id, amount: 7, source: 1 },
      ]);
    } finally {
      r.physics.dispose();
    }
  },
);

it("melee respects rotated building corners and stops beyond weapon reach", async () => {
  const r = await arena();
  try {
    const enemy = r.state.players[2];
    enemy.pos = { x: 40, y: 0, z: 40 };
    r.physics.teleport(enemy.id, enemy.pos);
    const building = spawn(r.state, "stable", enemy.faction, {
      x: 20,
      y: 0,
      z: 18,
    });
    building.yaw = Math.PI / 4;
    r.physics.addEntity(building);
    r.physics.step(1 / 60);
    expect(fire(r, 1).ok).toBe(true);
    expect(r.state.damage).toMatchObject([
      { target: building.id, amount: 7, source: 1 },
    ]);
    r.state.damage = [];
    const p = r.state.players[1];
    p.cooldown = 0;
    p.pos.z = 24;
    r.physics.teleport(p.id, p.pos);
    r.physics.step(1 / 60);
    expect(fire(r, 1).ok).toBe(true);
    expect(r.state.damage).toHaveLength(0);
  } finally {
    r.physics.dispose();
  }
});

it("melee selects the nearest visible enemy independently of player ID order", async () => {
  const r = await arena({
    mode: "teams",
    participants: [
      { name: "A", controller: "human", team: 0 },
      { name: "B", controller: "human", team: 1 },
      { name: "C", controller: "human", team: 1 },
    ],
  });
  try {
    const farther = r.state.players[2],
      nearer = r.state.players[3];
    farther.pos = { x: 20.75, y: 0, z: 20.1 };
    nearer.pos = { x: 19.5, y: 0, z: 20.7 };
    r.physics.teleport(farther.id, farther.pos);
    r.physics.teleport(nearer.id, nearer.pos);
    r.physics.step(1 / 60);
    expect(fire(r, 1).ok).toBe(true);
    expect(r.state.damage).toMatchObject([
      { target: nearer.id, amount: 7, source: 1 },
    ]);
  } finally {
    r.physics.dispose();
  }
});
