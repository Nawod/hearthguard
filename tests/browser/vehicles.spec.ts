import { test, expect } from "@playwright/test";
import { createFixture } from "../helpers/fixture";
import { spawn } from "../../src/game/world";
import { encodeSave } from "../../src/game/save";
import { savedFixture, touchHold } from "./helpers";
for (const difficulty of ["medium", "hard"] as const)
  test(`catapult mount, transport, ${difficulty} ammo and dismount work through actual controls`, async ({
    page,
  }, info) => {
    const r = await createFixture({ difficulty });
    r.state.players[2].controller = "human";
    const p = r.state.players[1];
    const siege = spawn(r.state, "catapult", p.faction, {
      ...p.pos,
      z: p.pos.z + 2,
    });
    siege.owner = p.id;
    p.vehicleId = siege.id;
    if (difficulty === "hard") p.ammo.catapult = 1;
    for (const e of Object.values(r.state.entities))
      if (
        e.faction < 0 &&
        Math.hypot(e.pos.x - siege.pos.x, e.pos.z - siege.pos.z) < 6
      ) {
        r.physics.removeEntity(e.id);
        delete r.state.entities[e.id];
      }
    r.physics.addEntity(siege);
    r.physics.step(1 / 60);
    const original = { ...siege.pos },
      save = encodeSave(r);
    r.physics.dispose();
    await savedFixture(page, save);
    await page.getByRole("button", { name: "Dismiss tutorial" }).click();
    await page.getByRole("button", { name: "Mount or dismount" }).click();
    await expect(page.locator(".siege-ammo")).toContainText(
      difficulty === "hard" ? "1 ammunition" : "∞ ammunition",
    );
    if (info.project.name === "desktop") {
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(1000);
      await page.keyboard.up("KeyW");
      await page.mouse.move(700, 380);
      await page.mouse.down();
      await page.waitForTimeout(150);
      await page.mouse.up();
    } else {
      await touchHold(page, ".joystick", "move", 0, -35, 1000);
      await touchHold(page, ".touch-attack", "attack", 0, 0, 100);
    }
    if (difficulty === "hard")
      await expect(page.locator(".siege-ammo")).toContainText("0 ammunition");
    await page.evaluate(() => {
      if (document.pointerLockElement) document.exitPointerLock();
    });
    await page.getByRole("button", { name: "Save match", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    const entity = await page.evaluate(
      async (id) =>
        await new Promise<any>((resolve) => {
          const q = indexedDB.open("hearthguard-saves", 1);
          q.onsuccess = () => {
            const db = q.result,
              req = db
                .transaction("matches")
                .objectStore("matches")
                .get("manual");
            req.onsuccess = () => {
              resolve(req.result.save.state.entities[id]);
              db.close();
            };
          };
        }),
      siege.id,
    );
    expect(
      Math.hypot(entity.pos.x - original.x, entity.pos.z - original.z),
    ).toBeGreaterThan(0.2);
    expect(entity.occupant).toBe(1);
    await page.getByRole("button", { name: "Mount or dismount" }).click();
    await expect(page.locator(".siege-ammo")).toBeHidden();
    await expect(page.locator(".vehicle-status")).toContainText("Ready");
    if (difficulty === "medium")
      await page.screenshot({
        path: `docs/evidence/${info.project.name}-catapult.png`,
      });
  });
