import { test, expect } from "@playwright/test";
import { createFixture } from "../helpers/fixture";
import { encodeSave } from "../../src/game/save";
import { ground, spawn } from "../../src/game/world";
import { updateVisibility } from "../../src/game/visibility";
import { savedFixture } from "./helpers";
test("detailed village, facing character, horse and equipment remain grounded", async ({
  page,
}, info) => {
  const r = await createFixture({
    mode: "teams",
    participants: [
      { name: "You", controller: "human", team: 0 },
      { name: "Companion", controller: "human", team: 0 },
      { name: "Rival", controller: "human", team: 1 },
    ],
  });
  const a = r.state.players[1],
    b = r.state.players[2];
  // Controlled artwork inspection clears foreground obstructions, without changing production world generation.
  for (const e of Object.values(r.state.entities))
    if (e.faction < 0 && Math.hypot(e.pos.x - 40, e.pos.z - 44) < 12) {
      r.physics.removeEntity(e.id);
      delete r.state.entities[e.id];
    }
  a.pos = { x: 40, y: ground(r.state, 40, 40), z: 40 };
  a.yaw = Math.PI;
  a.input.yaw = Math.PI;
  b.pos = { x: 40, y: ground(r.state, 40, 44), z: 44 };
  b.yaw = 0;
  b.input.yaw = 0;
  b.controller = "human";
  b.weapons = ["sword", "bow"];
  r.physics.teleport(a.id, a.pos);
  r.physics.teleport(b.id, b.pos);
  const horse = spawn(r.state, "horse", a.faction, {
    x: 43,
    y: ground(r.state, 43, 43),
    z: 43,
  });
  r.physics.addEntity(horse);
  for (const [type, x, z] of [
    ["armory", 33, 47],
    ["stable", 47, 47],
  ] as const) {
    const e = spawn(r.state, type, a.faction, {
      x,
      y: ground(r.state, x, z),
      z,
    });
    r.physics.addEntity(e);
  }
  updateVisibility(r);
  const save = encodeSave(r);
  r.physics.dispose();
  await savedFixture(page, save);
  await expect(page.locator("canvas[data-rigged-characters]")).toHaveAttribute(
    "data-rigged-characters",
    "2",
  );
  await page.waitForTimeout(500);
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 844, height: 390 });
  }
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-detailed-characters-front.png`,
  });
});
