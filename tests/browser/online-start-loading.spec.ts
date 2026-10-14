import { test, expect } from "@playwright/test";
test("an online start waits for its actual snapshot rather than displaying the setup lives", async ({
  page,
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop");
  await page.addInitScript(() => {
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      set onmessage(
        handler: ((this: WebSocket, ev: MessageEvent) => any) | null,
      ) {
        super.onmessage = handler
          ? (event: MessageEvent) => {
              const message = JSON.parse(event.data);
              if (message.type === "snapshot")
                setTimeout(() => handler.call(this, event), 2000);
              else handler.call(this, event);
            }
          : null;
      }
    } as typeof WebSocket;
  });
  const friend = await browser.newPage();
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    const code = await page.locator(".room-code strong").textContent();
    await friend.goto(`/?room=${code}`);
    await friend
      .getByRole("button", { name: "Join room", exact: true })
      .click();
    await expect(page.locator(".seats>div")).toHaveCount(2);
    await page.getByLabel("Lobby difficulty").selectOption("medium");
    for (const p of [page, friend])
      await p.getByRole("button", { name: "Ready", exact: true }).click();
    await page
      .getByRole("button", { name: "Start round", exact: true })
      .click();
    await expect(page.locator(".loading-realm")).toContainText(
      "Preparing your realm",
    );
    await expect(page.getByTestId("lives")).toHaveCount(0);
    await expect(page.getByTestId("lives")).toContainText("2 lives", {
      timeout: 15000,
    });
  } finally {
    await friend.close();
  }
});
