import { test, expect } from "@playwright/test";
test("eight real browser seats share a host-started round and receive the winning result", async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Eight-context admission is checked once; phone and tablet run the two-seat flows.",
  );
  test.setTimeout(180000);
  const contexts = [],
    pages = [page];
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await page.getByLabel("Online name").fill("Host");
    await page.getByLabel("Online match mode").selectOption("teams");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    const code = await page.locator(".room-code strong").textContent();
    for (let i = 1; i < 8; i++) {
      const context = await browser.newContext({
        ...info.project.use,
        viewport: { width: 800, height: 600 },
      });
      contexts.push(context);
      const friend = await context.newPage();
      pages.push(friend);
      await friend.goto(`/?room=${code}`);
      await friend.getByLabel("Online name").fill("Friend " + i);
      await friend
        .getByRole("button", { name: "Join room", exact: true })
        .click();
      await expect(friend.locator(".seats>div")).toHaveCount(i + 1);
    }
    await expect(page.locator(".seats>div")).toHaveCount(8);
    await page.getByLabel("Lobby difficulty").selectOption("medium");
    for (const p of pages)
      await p.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start round", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Start round", exact: true })
      .click();
    for (const p of pages)
      // Eight rendered contexts share one GPU; wait for the first authoritative snapshot.
      await expect(p.getByTestId("lives")).toContainText("2 lives", {
        timeout: 20000,
      });
    for (const p of pages.slice(1)) {
      await p.getByRole("button", { name: "Pause match", exact: true }).click();
      await p
        .getByRole("button", { name: "Return to main menu", exact: true })
        .click();
    }
    await expect(
      page.getByRole("heading", { name: "Your hearth endures." }),
    ).toBeVisible();
    await page.screenshot({
      path: "test-results/eight-player-team-victory.png",
    });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
test("friends join a host-started team match and reconnect", async ({
  page,
  browser,
}, info) => {
  const other = await browser.newContext(info.project.use),
    friend = await other.newPage();
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await page.getByLabel("Online name").fill("Aster");
    await page.getByLabel("Online match mode").selectOption("teams");
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    const code = (await page.locator(".room-code strong").textContent())!;
    await friend.goto("/");
    await friend
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await friend.getByLabel("Online name").fill("Briar");
    await friend.getByLabel("Room code").fill(code);
    await friend
      .getByRole("button", { name: "Join room", exact: true })
      .click();
    await expect(
      friend.getByRole("button", { name: "Start round", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start round", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Ready", exact: true }).click();
    await friend.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Start round", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Start round", exact: true })
      .click();
    for (const p of [page, friend])
      await expect(p.getByTestId("lives")).toContainText("3 lives");
    await friend.reload();
    await expect(friend.getByTestId("lives")).toContainText("3 lives");
    await page.screenshot({
      path: `test-results/${info.project.name}-online.png`,
    });
  } finally {
    await other.close();
  }
});
