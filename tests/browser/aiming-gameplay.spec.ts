import { test, expect } from "@playwright/test";
import { createFixture } from "../helpers/fixture";
import { savedFixture } from "./helpers";
import { encodeSave } from "../../src/game/save";

test("hold aiming steadies ranged weapons; cancellation clears input and damaged buildings can be repaired", async ({
  page,
}, info) => {
  await page.route("**/models/character.glb", async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  const r = await createFixture();
  const p = r.state.players[1];
  p.weapons = ["bow", "crossbow"];
  p.input.weaponSlot = 1;
  p.slot = 1;
  r.state.factions[0].stock.wood = 10;
  p.yaw = 0;
  p.input.yaw = 0;
  r.state.players[2].controller = "human";
  const hall = r.state.entities[r.state.factions[0].townhall];
  hall.hp = hall.maxHp - 90;
  const save = encodeSave(r);
  r.physics.dispose();
  await savedFixture(page, save);
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await expect(
    page.getByRole("button", { name: "Weapon slot 2", exact: true }),
  ).toHaveClass(/equipped/);
  const reticle = page.getByTestId("aim-reticle");
  let touch: any;
  let aimPoint: { x: number; y: number } | undefined;
  if (info.project.name === "desktop") {
    await page.locator("canvas[data-engine]").click({
      button: "right",
      position: { x: 700, y: 400 },
      noWaitAfter: true,
    });
    await page.mouse.down({ button: "right" });
  } else {
    if (info.project.name === "phone")
      await page.setViewportSize({ width: 844, height: 390 });
    const viewport = page.viewportSize()!;
    await page.touchscreen.tap(viewport.width * 0.45, viewport.height * 0.4);
    await page.waitForTimeout(250);
    await expect(page.getByTestId("combat-state")).not.toContainText(
      "Reloading",
    );
    touch = await page.context().newCDPSession(page);
    const box = (await page
      .getByRole("button", { name: "Aim or block" })
      .boundingBox())!;
    aimPoint = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...aimPoint, id: 1 }],
    });
  }
  await expect(reticle).toHaveClass(/aiming/);
  await expect(page.getByTestId("combat-state")).toContainText("Steady ·");
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-steady-aim.png`,
  });
  if (info.project.name === "desktop") {
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(80);
    await page.mouse.up({ button: "left" });
  } else {
    const box = (await page
        .getByRole("button", { name: "Attack", exact: true })
        .boundingBox())!,
      point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 2 };
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...aimPoint, id: 1 }, point],
    });
    await page.waitForTimeout(100);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [{ ...aimPoint, id: 1 }],
    });
  }
  await expect(page.getByTestId("combat-state")).toContainText("Reloading");
  if (touch) {
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await touch.detach();
  }
  if (info.project.name === "desktop") {
    await page.keyboard.press("Escape");
    await page.mouse.up({ button: "right" });
  } else
    await page
      .getByRole("button", { name: "Pause match", exact: true })
      .click();
  await page.getByRole("button", { name: "Resume journey" }).click();
  await expect(reticle).not.toHaveClass(/aiming/);
  await expect(
    page.getByRole("button", { name: "Repair building", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Repair building", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop current task", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hall-health b")).toHaveText("1800", {
    timeout: 10000,
  });
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-aiming-gameplay.png`,
  });
});
