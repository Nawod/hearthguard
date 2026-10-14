import { it, expect } from "vitest";
import { createMatch } from "../src/game/world";
it("seeded empty start creates equal factions and real collision", async () => {
  const c = {
      mode: "single" as const,
      difficulty: "easy" as const,
      seed: 42,
      participants: [
        { name: "You", controller: "human" as const },
        { name: "Rival", controller: "ai" as const },
      ],
    },
    a = await createMatch(c),
    b = await createMatch(c);
  try {
    expect(a.state).toEqual(b.state);
    expect(Object.values(a.state.players)).toHaveLength(2);
    expect(
      Object.values(a.state.entities).filter((e) => e.type === "townhall"),
    ).toHaveLength(2);
    for (const p of Object.values(a.state.players)) {
      expect(p.weapons).toEqual([null, null]);
      expect(p.lives).toBe(3);
      expect(Object.values(p.pack).every((n) => n === 0)).toBe(true);
    }
    const p = a.state.players[1];
    a.physics.moveCharacter(p.id, { x: 0, y: 0, z: -20 });
    const pos = a.physics.position(p.id);
    expect(pos.z).toBeGreaterThan(17);
  } finally {
    a.physics.dispose();
    b.physics.dispose();
  }
});
it("rejects a fifth teammate and extra single-player characters", async () => {
  await expect(
    createMatch({
      mode: "teams",
      difficulty: "hard",
      seed: 1,
      participants: Array.from({ length: 6 }, (_, i) => ({
        name: String(i),
        controller: "human",
        team: i < 5 ? 0 : 1,
      })),
    }),
  ).rejects.toThrow();
});
