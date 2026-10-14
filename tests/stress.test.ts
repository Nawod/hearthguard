import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { applyCommand, stepGame } from "../src/game/engine";
import { spawn } from "../src/game/world";
import { encodeSave, restoreSave } from "../src/game/save";
import { queueDamage } from "../src/game/combat";
import { resolveLifecycle } from "../src/game/lifecycle";
it("simultaneous teammates cannot overdraw a shared workshop or duplicate vehicles", async () => {
  const r = await createFixture({
    mode: "teams",
    participants: [
      { name: "A", controller: "human", team: 0 },
      { name: "B", controller: "human", team: 0 },
      { name: "C", controller: "human", team: 1 },
    ],
  });
  try {
    const stable = spawn(r.state, "stable", 0, { x: 20, y: 0, z: 22 });
    r.state.factions[0].stock = { wood: 15, food: 30, stone: 0, ore: 0 };
    r.state.players[1].pos = { x: 17, y: 0, z: 22 };
    r.state.players[2].pos = { x: 17, y: 0, z: 23 };
    expect(
      applyCommand(r, 1, { type: "craft", target: stable.id, recipe: "horse" })
        .ok,
    ).toBe(true);
    expect(
      applyCommand(r, 2, { type: "craft", target: stable.id, recipe: "horse" })
        .ok,
    ).toBe(false);
    expect(
      applyCommand(r, 1, { type: "craft", target: stable.id, recipe: "horse" })
        .ok,
    ).toBe(false);
    expect(stable.queue).toHaveLength(1);
    expect(r.state.factions[0].stock.food).toBe(0);
  } finally {
    r.physics.dispose();
  }
});
it("mutual hall destruction draws and a lost hall never resurrects a respawning member", async () => {
  const r = await createFixture();
  try {
    queueDamage(r, 1, 1000, 2);
    resolveLifecycle(r, 0);
    expect(r.state.players[1].respawnAt).toBe(150);
    for (const f of Object.values(r.state.factions))
      r.state.entities[f.townhall].hp = 0;
    resolveLifecycle(r, 0);
    expect(r.state.result).toEqual({ winnerFactionId: null, draw: true });
    r.state.tick = 200;
    resolveLifecycle(r, 0);
    expect(r.state.players[1].eliminated).toBe(true);
    expect(r.state.players[1].dead).toBe(true);
    const restored = await restoreSave(
      JSON.parse(JSON.stringify(encodeSave(r))),
    );
    restored.physics.dispose();
  } finally {
    r.physics.dispose();
  }
});
