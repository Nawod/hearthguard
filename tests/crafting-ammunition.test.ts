import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { consumeAmmo } from "../src/game/crafting";
it.each(["easy", "medium", "hard"] as const)(
  "ammunition follows %s difficulty",
  async (difficulty) => {
    const r = await createFixture({ difficulty });
    try {
      for (const kind of ["arrow", "bolt", "catapult"] as const) {
        expect(consumeAmmo(r, 1, kind).ok).toBe(difficulty !== "hard");
        r.state.players[1].ammo[kind] = 1;
        expect(consumeAmmo(r, 1, kind).ok).toBe(true);
        expect(r.state.players[1].ammo[kind]).toBe(
          difficulty === "hard" ? 0 : 1,
        );
      }
    } finally {
      r.physics.dispose();
    }
  },
);
