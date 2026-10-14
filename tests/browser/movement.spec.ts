import { test, expect } from "@playwright/test";
test("starts a third-person empty-start match and menus work", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Your hands/ })).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-menu.png` });
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await expect(page.getByTestId("lives")).toContainText("3 lives");
  await expect(page.locator(".bank")).toContainText("0");
  await page.getByRole("button", { name: "Build menu", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Build your city." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByRole("button", { name: "Pause match", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The hearth can wait." }),
  ).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-game.png` });
  expect(errors).toEqual([]);
});
