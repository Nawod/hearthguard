import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { stepGame } from "../src/game/engine";
import { updateVisibility } from "../src/game/visibility";
import { updateAI } from "../src/game/ai";
it("an empty-handed AI defends itself against a close visible attacker", async () => {
  const r = await createFixture();
  try {
    const bot = r.state.players[2],
      human = r.state.players[1];
    bot.pos = { x: 78, y: 0, z: 85 };
    human.pos = { x: 78, y: 0, z: 83.2 };
    r.physics.teleport(2, bot.pos);
    r.physics.teleport(1, human.pos);
    r.physics.step(1 / 60);
    updateVisibility(r);
    updateAI(r, 1 / 30);
    expect(bot.ai.phase).toBe("defend");
    expect(bot.input.attack).toBe(true);
  } finally {
    r.physics.dispose();
  }
});
it.each(["easy", "medium", "hard"] as const)(
  "the %s AI develops a defended city and completes a rules-valid match",
  async (difficulty) => {
    const r = await createFixture({ difficulty, seed: 42 });
    try {
      for (let i = 0; i < 24000 && !r.state.result; i++) stepGame(r);
      const own = Object.values(r.state.entities).filter(
        (e) => e.faction === 1,
      );
      expect(own.some((e) => e.type === "farm" && e.progress === 1)).toBe(true);
      expect(own.some((e) => e.type === "tower" && e.progress === 1)).toBe(
        true,
      );
      expect(r.state.players[2].weapons[0]).toBe("sword");
      expect(r.state.result?.winnerFactionId).toBe(1);
      for (const f of Object.values(r.state.factions))
        expect(Object.values(f.stock).every((n) => n >= -1e-8)).toBe(true);
      expect(Object.values(r.state.players)).toHaveLength(2);
    } finally {
      r.physics.dispose();
    }
  },
  30000,
);
