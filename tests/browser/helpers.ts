import type { Page } from "@playwright/test";
import type { SaveEnvelope } from "../../src/game/types";
export async function savedFixture(
  page: Page,
  save: SaveEnvelope,
): Promise<void> {
  await page.goto("/");
  await page.evaluate(async (save) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("hearthguard-saves", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("matches", { keyPath: "slot" });
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction("matches", "readwrite");
        tx.objectStore("matches").put({
          slot: "manual",
          save,
          date: Date.now(),
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, save);
  await page.reload();
  await page.getByRole("button", { name: "Continue saved journey" }).click();
  await page.getByRole("button", { name: "Resume journey" }).click();
}
export async function touchHold(
  page: Page,
  selector: string,
  _key: string,
  dx = 0,
  dy = 0,
  duration = 700,
): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error("Touch control is not visible");
  const cdp = await page.context().newCDPSession(page),
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  if (dx || dy)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + dx, y: y + dy }],
    });
  await page.waitForTimeout(duration);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await cdp.detach();
}
