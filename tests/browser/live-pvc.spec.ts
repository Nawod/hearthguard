import { mkdir, writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { findRoute } from "../../src/game/navigation";
import { makeView } from "../../src/game/visibility";
import type { GameState } from "../../src/game/types";
test("an unmodified empty-start PvC round completes through browser movement and combat", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "The unmodified PvC round is exercised once; other projects run complete controlled city journeys.",
  );
  test.setTimeout(180000);
  await page.goto("/");
  await page.getByLabel("Difficulty", { exact: true }).selectOption("hard");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  await expect(page.getByTestId("lives")).toContainText("1 lives");
  const canvas = page.locator("canvas[data-engine]");
  await canvas.click({ position: { x: 700, y: 380 } });
  await page.waitForTimeout(100);
  async function state(): Promise<GameState> {
    await page
      .getByRole("button", { name: "Save match", exact: true })
      .evaluate((el) => (el as HTMLButtonElement).click());
    await page.waitForTimeout(70);
    return await page.evaluate(
      async () =>
        await new Promise<GameState>((resolve) => {
          const request = indexedDB.open("hearthguard-saves", 1);
          request.onsuccess = () => {
            const db = request.result,
              q = db
                .transaction("matches")
                .objectStore("matches")
                .get("manual");
            q.onsuccess = () => {
              resolve(q.result.save.state);
              db.close();
            };
          };
        }),
    );
  }
  async function face(yaw: number, current: number): Promise<void> {
    const delta = Math.atan2(Math.sin(yaw - current), Math.cos(yaw - current));
    await canvas.evaluate(
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
  }
  let result: GameState["result"] = null,
    last: GameState | undefined;
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline) {
    last = await state();
    const p = last.players[1];
    if (last.result) {
      result = last.result;
      break;
    }
    const view = makeView(last, 1),
      enemy = view.players.find(
        (v) => v.id !== p.id && !v.dead && !v.eliminated,
      ),
      hall = last.entities[last.factions[1].townhall],
      goal = enemy?.pos ?? { ...hall.pos, z: hall.pos.z + 5 };
    if (
      enemy &&
      Math.hypot(enemy.pos.x - p.pos.x, enemy.pos.z - p.pos.z) < 2.2
    ) {
      await face(
        Math.atan2(enemy.pos.x - p.pos.x, -(enemy.pos.z - p.pos.z)),
        p.yaw,
      );
      await page.mouse.down();
      await page.waitForTimeout(650);
      await page.mouse.up();
      continue;
    }
    const disclosed = {
        ...last,
        entities: Object.fromEntries(
          view.entities.filter((e) => !e.ghost).map((e) => [e.id, e]),
        ),
      },
      route = findRoute(disclosed, p.pos, goal, p.faction);
    while (
      route.length > 1 &&
      Math.hypot(route[0].x - p.pos.x, route[0].z - p.pos.z) < 0.6
    )
      route.shift();
    const next = route[0] ?? goal,
      distance = Math.hypot(next.x - p.pos.x, next.z - p.pos.z);
    await face(Math.atan2(next.x - p.pos.x, -(next.z - p.pos.z)), p.yaw);
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(
      Math.min(220, Math.max(70, (distance / 5.8) * 800)),
    );
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ShiftLeft");
  }
  await page.evaluate(() => {
    if (document.pointerLockElement) document.exitPointerLock();
  });
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    "docs/evidence/unmodified-pvc-round.json",
    JSON.stringify(
      {
        config: last?.config,
        result,
        tick: last?.tick,
        humanLives: last?.players[1].lives,
        humanHP: last?.players[1].hp,
        aiLives: last?.players[2].lives,
        method:
          "Browser input automation, unmodified empty start; read-only saves for observation",
      },
      null,
      2,
    ),
  );
  await info.attach("unmodified-pvc-round.json", {
    body: JSON.stringify(
      {
        config: last?.config,
        result,
        tick: last?.tick,
        humanLives: last?.players[1].lives,
        humanHP: last?.players[1].hp,
        aiLives: last?.players[2].lives,
        method:
          "Browser input automation; read-only manual saves for route observation; no injected starting state or resources",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(result).not.toBeNull();
  await expect(page.locator(".results")).toBeVisible();
  await page.screenshot({ path: "test-results/unmodified-pvc-result.png" });
});
