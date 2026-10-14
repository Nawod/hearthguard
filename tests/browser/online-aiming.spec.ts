import { test, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { RoomManager } from "../../server/rooms";
import { startServer } from "../../server/index";
import { createFixture } from "../helpers/fixture";
import { encodeSave } from "../../src/game/save";
import { ground } from "../../src/game/world";

test("an online aimed crossbow shot passes through the real authority, spends one bolt and hits the rival", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "One real two-client authority fixture; touch aiming has separate journeys.",
  );
  test.setTimeout(90000);
  const data = await mkdtemp(join(tmpdir(), "hearthguard-aim-"));
  let server;
  const contexts = [];
  try {
    const manager = new RoomManager(),
      room = manager.create("host", "Archer", "ffa", "hard", 42);
    manager.join("enemy", "Rival", room.code);
    for (const seat of room.seats) manager.ready(seat.id, room.code, true);
    const r = await createFixture(manager.start("host", room.code).config!);
    for (const e of Object.values(r.state.entities))
      if (e.faction < 0) {
        r.physics.removeEntity(e.id);
        delete r.state.entities[e.id];
      }
    const archer = r.state.players[1],
      enemy = r.state.players[2];
    archer.pos = { x: 45, y: ground(r.state, 45, 45), z: 45 };
    enemy.pos = { x: 45, y: ground(r.state, 45, 30), z: 30 };
    archer.weapons = ["crossbow", null];
    archer.ammo.bolt = 3;
    archer.yaw = 0;
    archer.input.yaw = 0;
    for (const p of [archer, enemy]) r.physics.teleport(p.id, p.pos);
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
      port: 5202,
      host: "127.0.0.1",
      dataDir: data,
    });
    const friendContext = await browser.newContext(info.project.use);
    contexts.push(friendContext);
    const friend = await friendContext.newPage();
    for (const [i, p] of [page, friend].entries()) {
      await p.addInitScript(
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
      await p.goto("http://127.0.0.1:5202");
      await expect(p.getByTestId("lives")).toContainText("1 lives");
      await p.getByRole("button", { name: "Dismiss tutorial" }).click();
    }
    await page
      .locator("canvas[data-engine]")
      .click({ button: "right", position: { x: 700, y: 400 } });
    await page.mouse.down({ button: "right" });
    await expect(page.getByTestId("combat-state")).toContainText("Steady ·");
    await page.waitForFunction(() => {
      const v = (window as any).permitted,
        p = v?.players.find((p: any) => p.id === v.playerId);
      return !!p?.input.aimOrigin;
    });
    const delta = await page.evaluate(() => {
      const v = (window as any).permitted,
        p = v.players.find((p: any) => p.id === v.playerId),
        e = v.players.find((p: any) => p.id !== v.playerId),
        o = p.input.aimOrigin;
      return {
        yaw: Math.atan2(e.pos.x - o.x, -(e.pos.z - o.z)) - p.yaw,
        pitch:
          Math.atan2(
            o.y - (e.pos.y + 1),
            Math.hypot(e.pos.x - o.x, e.pos.z - o.z),
          ) - p.pitch,
      };
    });
    await page
      .locator("canvas[data-engine]")
      .evaluate(
        (el, delta) =>
          el.dispatchEvent(
            new PointerEvent("pointermove", {
              pointerType: "mouse",
              movementX: delta.yaw / 0.0018,
              movementY: delta.pitch / 0.0018,
              bubbles: true,
            }),
          ),
        delta,
      );
    await page.waitForTimeout(400);
    await page.mouse.down({ button: "left" });
    await page.waitForTimeout(100);
    await page.mouse.up({ button: "left" });
    await expect(page.getByTestId("combat-state")).toContainText("Reloading");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const v = (window as any).permitted;
          return v.players.find((p: any) => p.id === v.playerId).ammo.bolt;
        }),
      )
      .toBe(2);
    await expect
      .poll(() =>
        friend.evaluate(() => {
          const v = (window as any).permitted;
          return v.players.find((p: any) => p.id === v.playerId).hp;
        }),
      )
      .toBeLessThan(100);
    await page.screenshot({ path: "docs/evidence/online-aimed-crossbow.png" });
    await page.keyboard.press("Escape");
    await page.mouse.up({ button: "right" });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await page.goto("about:blank");
    await server?.close();
    if (!resolve(data).startsWith(resolve(tmpdir()) + sep))
      throw new Error("Unexpected fixture cleanup path");
    await rm(data, { recursive: true, force: true });
  }
});
