import { test, expect } from "@playwright/test";
import { createFixture } from "../helpers/fixture";
import { encodeSave } from "../../src/game/save";
import { savedFixture, touchHold } from "./helpers";
test("a personally placed site is finished with Use and farming needs a manual harvest", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const r = await createFixture();
  r.state.players[2].controller = "human";
  const p = r.state.players[1];
  p.pos = { x: 18, y: 0, z: 23 };
  r.physics.teleport(1, p.pos);
  r.state.factions[0].stock = { wood: 100, stone: 100, ore: 60, food: 30 };
  for (const e of Object.values(r.state.entities))
    if (e.faction < 0 && Math.hypot(e.pos.x - 18, e.pos.z - 30) < 6) {
      r.physics.removeEntity(e.id);
      delete r.state.entities[e.id];
    }
  r.physics.step(1 / 60);
  const save = encodeSave(r);
  r.physics.dispose();
  await savedFixture(page, save);
  await page.getByRole("button", { name: "Build menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Build Cultivation plot", exact: true })
    .click();
  await page.getByRole("button", { name: "Place", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("construction started");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  if (info.project.name === "desktop") {
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(700);
    await page.keyboard.up("KeyW");
  } else await touchHold(page, ".joystick", "move", 0, -35, 700);
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(page.locator(".interact-hint")).toContainText("Plant crops", {
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await page.waitForTimeout(31000);
  await expect(page.locator(".backpack")).toContainText("0/90");
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(page.locator(".backpack")).toContainText("35/90");
  await page.screenshot({ path: `test-results/${info.project.name}-farm.png` });
});
