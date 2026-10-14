import { test, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { RoomManager } from "../../server/rooms";
import { startServer } from "../../server/index";
import { createFixture } from "../helpers/fixture";
import { spawn } from "../../src/game/world";
import { encodeSave } from "../../src/game/save";
test("independent online teammates gather, share their bank, finish one site and damage only an enemy", async ({
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "One three-client integration fixture; device controls have separate journeys.",
  );
  test.setTimeout(90000);
  const data = await mkdtemp(join(tmpdir(), "hearthguard-team-")),
    contexts = [];
  let server;
  try {
    const manager = new RoomManager(),
      room = manager.create("host", "Host", "teams", "easy", 42);
    manager.join("ally", "Ally", room.code);
    manager.join("enemy", "Enemy", room.code);
    manager.team("host", room.code, "ally", 0);
    manager.team("host", room.code, "enemy", 1);
    for (const seat of room.seats) manager.ready(seat.id, room.code, true);
    const config = manager.start("host", room.code).config!;
    const r = await createFixture(config);
    const p = r.state.players[1],
      ally = r.state.players[2],
      enemy = r.state.players[3];
    p.pos = { x: 16, y: 0, z: 21 };
    ally.pos = { x: 17.2, y: 0, z: 21 };
    enemy.pos = { x: 18, y: 0, z: 24 };
    p.weapons = ["sword", null];
    for (const actor of [p, ally, enemy])
      r.physics.teleport(actor.id, actor.pos);
    for (const e of Object.values(r.state.entities))
      if (e.faction < 0 && Math.hypot(e.pos.x - 16, e.pos.z - 23) < 10) {
        r.physics.removeEntity(e.id);
        delete r.state.entities[e.id];
      }
    const tree = spawn(r.state, "tree", -1, { x: 16, y: 0, z: 23 });
    tree.amount = 30;
    r.physics.addEntity(tree);
    const farm = spawn(r.state, "farm", 0, { x: 16, y: 0, z: 26 });
    farm.progress = 0.25;
    farm.hp = 60;
    r.physics.step(1 / 60);
    const tokens = room.seats.map((seat, i) => [
        seat.id,
        String(i + 1).repeat(64),
      ]),
      save = encodeSave(r);
    r.physics.dispose();
    await writeFile(
      join(data, room.code + ".json"),
      JSON.stringify({ room, tokens, sequences: [], save }),
    );
    server = await startServer({
      port: 5201,
      host: "127.0.0.1",
      dataDir: data,
    });
    const pages = [];
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({
        ...info.project.use,
        viewport: { width: 1000, height: 700 },
      });
      contexts.push(context);
      await context.addInitScript(
        ({ code, token }) => {
          sessionStorage.setItem(
            "hearthguard-seat",
            JSON.stringify({ code, token }),
          );
          const Native = window.WebSocket;
          window.WebSocket = class extends Native {
            constructor(...args: ConstructorParameters<typeof WebSocket>) {
              super(...args);
              this.addEventListener("message", (event) => {
                const m = JSON.parse(event.data);
                if (m.type === "snapshot") (window as any).permitted = m.view;
              });
            }
          } as typeof WebSocket;
        },
        { code: room.code, token: tokens[i][1] },
      );
      const page = await context.newPage();
      pages.push(page);
      page.setDefaultTimeout(5000);
      await page.goto("http://127.0.0.1:5201");
      await expect(page.getByTestId("lives")).toContainText("3 lives");
      await page.getByRole("button", { name: "Dismiss tutorial" }).click();
    }
    for (const page of pages.slice(0, 2))
      await page.getByRole("button", { name: "Use", exact: true }).click();
    await expect(pages[0].locator(".backpack")).not.toContainText("0/90");
    await pages[0].waitForTimeout(5500);
    async function face(page: any, yaw: number) {
      await page
        .locator("canvas[data-engine]")
        .click({ position: { x: 500, y: 300 } });
      await page.waitForFunction(() => document.pointerLockElement !== null);
      const delta = await page.evaluate((yaw: number) => {
        const v = (window as any).permitted,
          p = v.players.find((p: any) => p.id === v.playerId);
        return Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw));
      }, yaw);
      await page
        .locator("canvas[data-engine]")
        .evaluate(
          (el: Element, delta: number) =>
            el.dispatchEvent(
              new PointerEvent("pointermove", {
                pointerType: "mouse",
                movementX: delta / 0.0027,
                movementY: 0,
                bubbles: true,
              }),
            ),
          delta,
        );
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        if (document.pointerLockElement) document.exitPointerLock();
      });
    }
    for (const page of pages.slice(0, 2)) {
      await face(page, 0);
      await page
        .getByRole("button", { name: "Craft menu", exact: true })
        .click();
      await page.getByRole("button", { name: "Deposit backpack" }).click();
      await page.getByRole("button", { name: "Close panel" }).click();
    }
    await expect(pages[0].locator(".bank")).toContainText("30");
    await expect(pages[1].locator(".bank")).toContainText("30");
    for (const page of pages.slice(0, 2)) {
      await face(page, Math.PI);
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(400);
      await page.keyboard.up("KeyW");
      await page.getByRole("button", { name: "Use", exact: true }).click();
    }
    await expect(pages[0].locator(".interact-hint")).toContainText(
      "Plant crops",
      { timeout: 10000 },
    );
    await expect(pages[1].locator(".interact-hint")).toContainText(
      "Plant crops",
    );
    const host = pages[0];
    await host.keyboard.down("KeyW");
    await host.waitForTimeout(350);
    await host.keyboard.up("KeyW");
    await host
      .locator("canvas[data-engine]")
      .click({ position: { x: 500, y: 300 } });
    await host.waitForTimeout(100);
    const delta = await host.evaluate(() => {
      const v = (window as any).permitted,
        p = v.players.find((p: any) => p.id === 1),
        enemy = v.players.find((p: any) => p.id === 3);
      const desired = Math.atan2(
        enemy.pos.x - p.pos.x,
        -(enemy.pos.z - p.pos.z),
      );
      return Math.atan2(Math.sin(desired - p.yaw), Math.cos(desired - p.yaw));
    });
    await host.locator("canvas[data-engine]").evaluate(
      (el, delta) =>
        el.dispatchEvent(
          new PointerEvent("pointermove", {
            pointerType: "mouse",
            movementX: delta / 0.0027,
            movementY: 0,
            bubbles: true,
          }),
        ),
      delta,
    );
    await host.mouse.down();
    await host.waitForTimeout(1100);
    await host.mouse.up();
    await expect(pages[2].locator(".vitals-title")).not.toContainText(
      "100 / 100",
    );
    await expect(pages[1].locator(".vitals-title")).toContainText("100 / 100");
    await host.evaluate(() => {
      if (document.pointerLockElement) document.exitPointerLock();
    });
    await pages[2]
      .getByRole("button", { name: "Pause match", exact: true })
      .click();
    await pages[2]
      .getByRole("button", { name: "Return to main menu", exact: true })
      .click();
    await expect(
      host.getByRole("heading", { name: "Your hearth endures." }),
    ).toBeVisible();
    await host.screenshot({ path: "docs/evidence/online-team-actions.png" });
  } finally {
    await Promise.allSettled(contexts.map((c) => c.close()));
    await server?.close();
    const absolute = resolve(data);
    if (!absolute.startsWith(resolve(tmpdir()) + sep + "hearthguard-team-"))
      throw Error("Unsafe cleanup path");
    await rm(absolute, { recursive: true, force: true });
  }
});
