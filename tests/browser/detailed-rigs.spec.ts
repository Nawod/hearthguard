import { test, expect } from "@playwright/test";
test("local skeletal models load and mouse turning immediately rotates the character", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/models/character.glb", async (route) => {
    await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await page.goto("/");
  const play = page.getByRole("button", { name: "Play against the computer" });
  await expect(play).toBeDisabled();
  await expect(play).toBeEnabled({ timeout: 45000 });
  await play.click();
  await expect(page.getByTestId("lives")).toBeVisible();
  const canvas = page.locator("canvas[data-engine]");
  await expect
    .poll(() => canvas.getAttribute("data-rig-bones"))
    .toMatch(/^[1-9]\d+$/);
  await expect
    .poll(() => canvas.getAttribute("data-rigged-characters"))
    .toBe("1");
  if (info.project.name === "desktop") {
    const before = Number(await canvas.getAttribute("data-facing"));
    await canvas.click({ position: { x: 700, y: 450 } });
    await page.mouse.move(900, 450);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-facing")))
      .not.toBe(before);
    await expect
      .poll(async () => {
        const intended = Number(await canvas.getAttribute("data-facing")),
          actual = Number(await canvas.getAttribute("data-character-heading"));
        return Math.abs(
          Math.atan2(Math.sin(actual - intended), Math.cos(actual - intended)),
        );
      })
      .toBeLessThan(0.001);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Resume journey" }).click();
  }
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-detailed-rigs.png`,
  });
  expect(errors).toEqual([]);
});
