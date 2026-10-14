import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { applyCommand } from "../src/game/engine";
import { updateConstruction } from "../src/game/construction";
import { spawn, ground } from "../src/game/world";
import {
  updateCrafting,
  reserveRecipe,
  equipWeapon,
} from "../src/game/crafting";
import { enterVehicle, leaveVehicle } from "../src/game/vehicles";
import { updateMovement } from "../src/game/movement";
import { emptyInput } from "../src/game/types";
it("sites charge once, require personal work, and farms grow without auto harvesting", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      bank = r.state.factions[0].stock;
    bank.wood = 100;
    bank.food = 10;
    p.pos = { x: 16, y: 0, z: 23 };
    r.physics.teleport(1, p.pos);
    expect(
      applyCommand(r, 1, {
        type: "build",
        building: "farm",
        pos: { x: 17, y: 0, z: 23 },
        yaw: 0,
      }).ok,
    ).toBe(false);
    expect(bank.wood).toBe(100);
    expect(
      applyCommand(r, 1, {
        type: "build",
        building: "farm",
        pos: { x: 19, y: 0, z: 28 },
        yaw: 0,
      }).ok,
    ).toBe(true);
    const farm = Object.values(r.state.entities).find(
      (e) => e.type === "farm",
    )!;
    expect(bank.wood).toBe(82);
    p.pos = { ...farm.pos, x: farm.pos.x + 2.6 };
    expect(applyCommand(r, 1, { type: "work", target: farm.id }).ok).toBe(true);
    updateConstruction(r, 7);
    expect(farm.progress).toBe(1);
    expect(bank.wood).toBe(82);
    expect(applyCommand(r, 1, { type: "plant", target: farm.id }).ok).toBe(
      true,
    );
    expect(bank.food).toBe(4);
    r.state.tick += 900;
    updateConstruction(r, 1 / 30);
    expect(farm.amount).toBe(35);
    expect(p.pack.food).toBe(0);
    expect(applyCommand(r, 1, { type: "harvest", target: farm.id }).ok).toBe(
      true,
    );
    expect(p.pack.food).toBe(35);
    expect(applyCommand(r, 1, { type: "plant", target: farm.id }).ok).toBe(
      true,
    );
    expect(bank.food).toBe(1);
  } finally {
    r.physics.dispose();
  }
});
it("craft reservations spend once and preserve exchanged weapons", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      e = spawn(r.state, "armory", 0, { x: 20, y: 0, z: 20 });
    p.pos = { x: 23, y: 0, z: 20 };
    r.state.factions[0].stock = { wood: 8, ore: 12, stone: 0, food: 0 };
    expect(reserveRecipe(r, 1, e.id, "sword").ok).toBe(true);
    expect(reserveRecipe(r, 1, e.id, "sword").ok).toBe(false);
    updateCrafting(r, 7);
    expect(e.equipment).toEqual(["sword"]);
    p.weapons = ["bow", null];
    expect(equipWeapon(r, 1, e.id, "sword", 0).ok).toBe(true);
    expect(e.equipment).toEqual(["bow"]);
    expect(equipWeapon(r, 1, e.id, "bow", 1).ok).toBe(true);
    e.equipment.push("sword");
    expect(equipWeapon(r, 1, e.id, "sword", 1).ok).toBe(false);
    expect(p.weapons).toEqual(["sword", "bow"]);
  } finally {
    r.physics.dispose();
  }
});
it("mount ownership and one vehicle slot hold; horses accelerate and turn gradually", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      horse = spawn(r.state, "horse", 0, { x: 19, y: 0, z: 22 });
    horse.owner = 1;
    p.vehicleId = horse.id;
    p.pos = { ...horse.pos };
    r.physics.teleport(1, p.pos);
    expect(enterVehicle(r, 2, horse.id).ok).toBe(false);
    expect(enterVehicle(r, 1, horse.id).ok).toBe(true);
    p.input = { ...emptyInput(), yaw: 0, move: { x: 0, z: -1 } };
    const before = p.pos.z;
    updateMovement(r, 1 / 30);
    expect(before - p.pos.z).toBeLessThan(0.04);
    p.input.yaw = Math.PI;
    updateMovement(r, 1 / 30);
    expect(Math.abs(horse.yaw)).toBeLessThan(0.2);
    expect(leaveVehicle(r, 1).ok).toBe(true);
    expect(horse.occupant).toBeUndefined();
    expect(p.vehicleId).toBe(horse.id);
  } finally {
    r.physics.dispose();
  }
});
