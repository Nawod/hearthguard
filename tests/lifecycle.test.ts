import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { resolveLifecycle } from "../src/game/lifecycle";
import { spawn } from "../src/game/world";
it("hall loss drops resources once and parks a mounted vehicle during simultaneous death", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      horse = spawn(r.state, "horse", 0, p.pos);
    horse.owner = 1;
    horse.occupant = 1;
    p.vehicleId = horse.id;
    p.pack.ore = 10;
    r.state.entities[r.state.factions[0].townhall].hp = 0;
    resolveLifecycle(r, 0);
    expect(
      Object.values(r.state.entities).filter((e) => e.type === "bag"),
    ).toHaveLength(1);
    expect(horse.occupant).toBeUndefined();
    expect(p.pack.ore).toBe(0);
    const lives = p.lives;
    resolveLifecycle(r, 0);
    expect(p.lives).toBe(lives);
  } finally {
    r.physics.dispose();
  }
});
it.each(["easy", "medium", "hard"] as const)(
  "death obeys %s lives, retains weapons, drops resources once",
  async (difficulty) => {
    const r = await createFixture({ difficulty });
    try {
      const p = r.state.players[1],
        lives = p.lives;
      p.weapons = ["sword", "bow"];
      p.pack.wood = 20;
      r.state.damage.push({ target: 1, amount: 1000, source: 2 });
      resolveLifecycle(r, 1 / 30);
      expect(p.lives).toBe(lives - 1);
      expect(p.weapons).toEqual(["sword", "bow"]);
      expect(
        Object.values(r.state.entities).filter((e) => e.type === "bag"),
      ).toHaveLength(1);
      resolveLifecycle(r, 1 / 30);
      expect(p.lives).toBe(lives - 1);
      r.state.entities[r.state.factions[0].townhall].hp = 0;
      resolveLifecycle(r, 1 / 30);
      expect(r.state.factions[0].alive).toBe(false);
      expect(p.eliminated).toBe(true);
    } finally {
      r.physics.dispose();
    }
  },
);
