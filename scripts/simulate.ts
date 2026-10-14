import { createMatch } from "../src/game/world";
import { stepGame } from "../src/game/engine";
import { mkdir, writeFile } from "node:fs/promises";
import type { Difficulty } from "../src/game/types";
const option = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const seed = Number(option("--seed", "42")),
  difficulty = option("--difficulty", "easy") as Difficulty;
const r = await createMatch({
  mode: "single",
  difficulty,
  seed,
  participants: [
    { name: "Idle human diagnostic seat", controller: "human" },
    { name: "AI rival", controller: "ai" },
  ],
});
try {
  for (let i = 0; i < 36000 && !r.state.result; i++) stepGame(r);
  const p = r.state.players[2],
    report = {
      seed,
      difficulty,
      ticks: r.state.tick,
      simulationSeconds: r.state.tick / 30,
      result: r.state.result,
      ai: {
        hp: p.hp,
        lives: p.lives,
        weapons: p.weapons,
        tools: p.tools,
        armor: p.armor,
        phase: p.ai.phase,
      },
      buildings: Object.values(r.state.entities)
        .filter((e) => e.faction === 1)
        .map((e) => ({ type: e.type, progress: e.progress })),
      stock: r.state.factions[1].stock,
    };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    `docs/evidence/seed-${seed}-${difficulty}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!r.state.result) process.exitCode = 1;
} finally {
  r.physics.dispose();
}
