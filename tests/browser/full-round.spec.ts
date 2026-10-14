import { test, expect } from "@playwright/test";
import { createFixture } from "../helpers/fixture";
import { spawn } from "../../src/game/world";
import { encodeSave } from "../../src/game/save";
import { savedFixture, touchHold } from "./helpers";
test("real workshop crafts two weapons, food heals, and a destroyed hall wins", async ({
  page,
}, info) => {
  const r = await createFixture();
  r.state.players[2].controller = "human";
  const p = r.state.players[1];
  p.pos = { x: 16, y: 0, z: 21 };
  p.hp = 60;
  p.pack.food = 10;
  r.physics.teleport(1, p.pos);
  r.state.factions[0].stock = { food: 60, wood: 160, stone: 100, ore: 80 };
  const armory = spawn(r.state, "armory", 0, { x: 20, y: 0, z: 21 });
  r.physics.addEntity(armory);
  const enemy = r.state.entities[r.state.factions[1].townhall];
  r.physics.removeEntity(enemy.id);
  enemy.pos = { x: 16, y: 0, z: 29 };
  enemy.hp = 20;
  r.physics.addEntity(enemy);
  for (const e of Object.values(r.state.entities))
    if (
      e.faction < 0 &&
      Math.abs(e.pos.x - 16) < 2 &&
      e.pos.z > 22 &&
      e.pos.z < 33
    ) {
      r.physics.removeEntity(e.id);
      delete r.state.entities[e.id];
    }
  r.physics.step(1 / 60);
  const save = encodeSave(r);
  r.physics.dispose();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await savedFixture(page, save);
  await page.locator(".backpack button").click();
  await expect(page.locator(".vitals-title")).toContainText("85 / 100", {
    timeout: 6000,
  });
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Barracks & armory" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Forge sword", exact: true }).click();
  await page
    .getByRole("button", { name: "Craft longbow", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Equip 1", exact: true }),
  ).toHaveCount(2, { timeout: 16000 });
  await page
    .getByRole("button", { name: "Equip 1", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Equip 1", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Equip 2", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.locator(".loadout")).toContainText("Sword");
  await expect(page.locator(".loadout")).toContainText("Longbow");
  await expect(page.locator(".loadout")).toContainText("∞");
  if (info.project.name === "desktop") {
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(850);
    await page.keyboard.up("KeyW");
    const field = page.locator("canvas").first(),
      box = await field.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1200);
    await page.mouse.up();
  } else {
    await touchHold(page, ".joystick", "move", 0, -35, 850);
    await touchHold(page, ".touch-attack", "attack", 0, 0, 1200);
  }
  await expect(
    page.getByRole("heading", { name: "Your hearth endures." }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${info.project.name}-victory.png`,
  });
  expect(errors).toEqual([]);
});
test("a depleted resource is gathered personally and deposited at the hall", async ({
  page,
}) => {
  const r = await createFixture();
  r.state.players[2].controller = "human";
  const p = r.state.players[1];
  p.pos = { x: 16, y: 0, z: 21 };
  r.physics.teleport(1, p.pos);
  const tree = spawn(r.state, "tree", -1, { x: 16, y: 0, z: 23.5 });
  tree.amount = 4;
  r.physics.addEntity(tree);
  r.physics.step(1 / 60);
  const save = encodeSave(r);
  r.physics.dispose();
  await savedFixture(page, save);
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(page.locator(".backpack")).toContainText("4", { timeout: 5000 });
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(page.locator(".bank")).toContainText("4");
});
