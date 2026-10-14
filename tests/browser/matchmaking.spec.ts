import { test, expect } from "@playwright/test";
test("public matchmaking creates a lobby that waits for its host to start manually", async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext(info.project.use),
    friend = await context.newPage();
  try {
    for (const [i, p] of [page, friend].entries()) {
      await p.goto("/");
      await p
        .getByRole("button", { name: "Play with friends", exact: true })
        .click();
      await p.getByLabel("Online name").fill("Public " + i);
      await p.getByLabel("Online difficulty").selectOption("hard");
      await p.getByLabel("Matchmaking player count").selectOption("2");
      await p
        .getByRole("button", { name: "Find a match", exact: true })
        .click();
    }
    for (const p of [page, friend])
      await expect(p.locator(".seats>div")).toHaveCount(2);
    const start = page.getByRole("button", {
      name: "Start round",
      exact: true,
    });
    await expect(start).toBeDisabled();
    await expect(
      friend.getByRole("button", { name: "Start round", exact: true }),
    ).toHaveCount(0);
    for (const p of [page, friend])
      await p.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(start).toBeEnabled();
    await start.click();
    for (const p of [page, friend])
      await expect(p.getByTestId("lives")).toContainText("1 lives");
    await friend
      .getByRole("button", { name: "Pause match", exact: true })
      .click();
    await friend
      .getByRole("button", { name: "Return to main menu", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your hearth endures." }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
