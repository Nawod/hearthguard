import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { applyCommand, stepGame } from "../src/game/engine";
import { spawn } from "../src/game/world";
it("empty start harvests and conserves resources through bank deposits", async () => {
  const r = await createFixture();
  try {
    const p = r.state.players[1],
      tree = spawn(r.state, "tree", -1, { x: p.pos.x + 1, y: 0, z: p.pos.z });
    expect(applyCommand(r, 1, { type: "interact", target: tree.id }).ok).toBe(
      true,
    );
    stepGame(r, 150);
    expect(p.pack.wood).toBeGreaterThan(0);
    expect(tree.amount + p.pack.wood).toBeCloseTo(80);
    const before = p.pack.wood;
    expect(
      applyCommand(r, 1, {
        type: "deposit",
        target: r.state.factions[0].townhall,
      }).ok,
    ).toBe(true);
    expect(p.pack.wood).toBe(0);
    expect(r.state.factions[0].stock.wood).toBeCloseTo(before);
  } finally {
    r.physics.dispose();
  }
});
