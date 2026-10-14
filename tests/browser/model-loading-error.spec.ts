import { test, expect } from "@playwright/test";
test("a missing model shows a persistent retry message and prevents an empty battlefield start", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.route("**/models/character.glb", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".loading-realm")).toContainText(
    "Unable to load the local 3D models. Reload to retry.",
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("button", { name: "Play against the computer" }),
  ).toBeDisabled();
});
