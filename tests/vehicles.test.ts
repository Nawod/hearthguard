import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { spawn } from "../src/game/world";
import { applyCommand, applyInput, stepGame } from "../src/game/engine";
import { emptyInput } from "../src/game/types";
import { fire } from "../src/game/combat";
import { updateCrafting } from "../src/game/crafting";
it.each(["easy", "medium", "hard"] as const)(
  "an operated catapult uses the shared %s ammunition rules",
  async (difficulty) => {
    const r = await createFixture({ difficulty });
    try {
      const p = r.state.players[1],
        catapult = spawn(r.state, "catapult", 0, p.pos);
      catapult.owner = 1;
      p.vehicleId = catapult.id;
      r.physics.addEntity(catapult);
      expect(
        applyCommand(r, 1, { type: "operate", target: catapult.id }).ok,
      ).toBe(true);
      if (difficulty === "hard") {
        expect(fire(r, 1).ok).toBe(false);
        p.ammo.catapult = 1;
      }
      expect(fire(r, 1).ok).toBe(true);
      expect(r.state.projectiles[0].kind).toBe("catapult");
      expect(p.ammo.catapult).toBe(0);
      expect(fire(r, 1).ok).toBe(false);
      expect(
        Object.values(r.state.entities).filter((e) => e.type === "catapult"),
      ).toHaveLength(1);
    } finally {
      r.physics.dispose();
    }
  },
);
it("crafted vehicles use clear workshop-front land and reserve only one personal slot", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      station = spawn(r.state, "stable", 0, { x: 20, y: 0, z: 21 });
    p.pos = { x: 17, y: 0, z: 21 };
    r.state.factions[0].stock = { wood: 60, food: 90, stone: 0, ore: 0 };
    expect(
      applyCommand(r, 1, { type: "craft", target: station.id, recipe: "horse" })
        .ok,
    ).toBe(true);
    expect(
      applyCommand(r, 1, { type: "craft", target: station.id, recipe: "horse" })
        .ok,
    ).toBe(false);
    updateCrafting(r, 11);
    const horse = r.state.entities[p.vehicleId!]!;
    expect(horse.type).toBe("horse");
    expect(horse.pos.z).toBeGreaterThan(station.pos.z);
    expect(
      Math.hypot(horse.pos.x - station.pos.x, horse.pos.z - station.pos.z),
    ).toBeGreaterThan(4);
    expect(
      applyCommand(r, 1, { type: "craft", target: station.id, recipe: "horse" })
        .ok,
    ).toBe(false);
  } finally {
    r.physics.dispose();
  }
});
