import { createMatch, spawn, ground } from "../src/game/world";
import { enterVehicle } from "../src/game/vehicles";
import { stepGame } from "../src/game/engine";
import { updateVisibility, makeView } from "../src/game/visibility";
import { ViewStream } from "../src/session/stream";
import { writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
const r = await createMatch({
  mode: "ffa",
  difficulty: "easy",
  seed: 42,
  participants: Array.from({ length: 8 }, (_, i) => ({
    name: "Traveler " + (i + 1),
    controller: "human",
  })),
});
try {
  for (const p of Object.values(r.state.players)) {
    for (const [j, type] of (
      [
        "armory",
        "smithy",
        "storage",
        "stable",
        "workshop",
        "tower",
        "wall",
        "gate",
      ] as const
    ).entries()) {
      const angle = (p.faction * Math.PI) / 4 + j * 0.1,
        pos = {
          x: 80 + Math.sin(angle) * 22,
          y: 0,
          z: 80 + Math.cos(angle) * 22,
        },
        e = spawn(r.state, type, p.faction, pos);
      r.physics.addEntity(e);
    }
    const horse = spawn(
      r.state,
      p.id % 2 === 0 ? "catapult" : "horse",
      p.faction,
      p.pos,
    );
    horse.owner = p.id;
    p.vehicleId = horse.id;
    r.physics.addEntity(horse);
    if (!enterVehicle(r, p.id, horse.id).ok)
      throw new Error("Stress vehicle did not activate.");
    r.physics.addEntity(
      spawn(r.state, "trap", p.faction, { ...p.pos, x: p.pos.x + 3 }),
    );
    p.input.move = { x: 0.1, z: -0.1 };
    p.input.yaw = (p.faction * Math.PI) / 4;
  }
  for (let i = 0; i < 80; i++)
    r.state.projectiles.push({
      id: r.state.nextId++,
      owner: 1,
      faction: 0,
      pos: { x: 80 + (i % 8), y: 18, z: 80 + Math.floor(i / 8) },
      vel: { x: 2, y: 6, z: 1 },
      damage: 1,
      life: 8,
      kind: "arrow",
    });
  const times: number[] = [];
  for (let i = 0; i < 600; i++) {
    const before = performance.now();
    stepGame(r);
    times.push(performance.now() - before);
  }
  updateVisibility(r);
  const stream = new ViewStream(),
    view = makeView(r.state, 1);
  stream.pack(view);
  const bytes = Buffer.byteLength(JSON.stringify(stream.pack(view)));
  times.sort((a, b) => a - b);
  const report = {
    hardware: {
      cpu: os.cpus()[0].model,
      logicalCores: os.cpus().length,
      memoryGB: Math.round(os.totalmem() / 2 ** 30),
      platform: os.platform(),
    },
    scenario: {
      players: 8,
      vehicles: 8,
      operatedHorses: 4,
      operatedCatapults: 4,
      traps: 8,
      entities: Object.keys(r.state.entities).length,
      initialProjectiles: 80,
      gameplayHz: 30,
      physicsHz: 60,
      snapshotsHz: 15,
    },
    simulation: {
      meanMs: times.reduce((a, b) => a + b, 0) / times.length,
      p95Ms: times[Math.floor(times.length * 0.95)],
      maxMs: times.at(-1),
    },
    steadySnapshotBytes: bytes,
  };
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/authority-performance.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.simulation.p95Ms > 33.33) process.exitCode = 1;
} finally {
  r.physics.dispose();
}
