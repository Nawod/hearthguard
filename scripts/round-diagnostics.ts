import { createMatch } from "../src/game/world";
import { applyInput, stepGame } from "../src/game/engine";
import { forfeitPlayer, resolveLifecycle } from "../src/game/lifecycle";
import { emptyInput } from "../src/game/types";
import { mkdir, writeFile } from "node:fs/promises";
const reports = [];
for (const config of [
  {
    mode: "ffa" as const,
    difficulty: "hard" as const,
    seed: 17,
    participants: Array.from({ length: 2 }, (_, i) => ({
      name: `Seat ${i}`,
      controller: "human" as const,
    })),
  },
  {
    mode: "ffa" as const,
    difficulty: "easy" as const,
    seed: 42,
    participants: Array.from({ length: 8 }, (_, i) => ({
      name: `Seat ${i}`,
      controller: "human" as const,
    })),
  },
  {
    mode: "teams" as const,
    difficulty: "medium" as const,
    seed: 73,
    participants: Array.from({ length: 7 }, (_, i) => ({
      name: `Seat ${i}`,
      controller: "human" as const,
      team: i < 3 ? (0 as const) : (1 as const),
    })),
  },
]) {
  const r = await createMatch(config);
  try {
    for (let tick = 0; tick < 240; tick++) {
      for (const p of Object.values(r.state.players)) {
        const seq = tick * 3 + 3;
        if (
          !applyInput(r, p.id, {
            ...emptyInput(),
            seq,
            move: { x: Math.sin(tick / 30), z: -0.2 },
            yaw: p.yaw,
          }).ok
        )
          throw Error("Valid input rejected");
        if (applyInput(r, p.id, { ...emptyInput(), seq: seq - 1 }).ok)
          throw Error("Reordered input accepted");
      }
      stepGame(r);
    }
    for (const p of Object.values(r.state.players))
      if (p.faction !== 0) forfeitPlayer(r, p.id);
    resolveLifecycle(r, 0);
    if (r.state.result?.winnerFactionId !== 0)
      throw Error("Round did not complete");
    reports.push({
      config,
      ticks: r.state.tick,
      result: r.state.result,
      method:
        "Seeded headless human-seat input/reordering and explicit forfeit diagnostics; not a natural PvP combat round",
    });
  } finally {
    r.physics.dispose();
  }
}
await mkdir("docs/evidence", { recursive: true });
await writeFile(
  "docs/evidence/seeded-online-diagnostics.json",
  JSON.stringify(reports, null, 2),
);
console.log(
  JSON.stringify(
    reports.map((r) => ({
      mode: r.config.mode,
      players: r.config.participants.length,
      difficulty: r.config.difficulty,
      result: r.result,
    })),
    null,
    2,
  ),
);
