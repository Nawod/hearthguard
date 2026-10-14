import { mkdir, writeFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test("independent browsers join through the host IPv4 address", async ({
  page,
  browser,
}, info) => {
  const response = await page.request.get("/lan"),
    addresses = (await response.json()).addresses as string[];
  test.skip(!addresses.length, "No non-loopback IPv4 adapter is available.");
  const base = addresses[0],
    context = await browser.newContext(info.project.use),
    friend = await context.newPage();
  try {
    await page.goto(base);
    await page
      .getByRole("button", { name: "Play with friends", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create room", exact: true })
      .click();
    const code = await page.locator(".room-code strong").textContent();
    await friend.goto(`${base}/?room=${code}`);
    await expect(
      friend.getByRole("textbox", { name: "Room code", exact: true }),
    ).toHaveValue(code!);
    await friend
      .getByRole("button", { name: "Join room", exact: true })
      .click();
    await expect(page.locator(".seats>div")).toHaveCount(2);
    await mkdir("docs/evidence", { recursive: true });
    await writeFile(
      `docs/evidence/${info.project.name}-lan.json`,
      JSON.stringify(
        {
          testedOrigin: base,
          separateBrowserContexts: true,
          physicalWifiDevices: false,
        },
        null,
        2,
      ),
    );
    await info.attach("lan-address.json", {
      body: JSON.stringify({
        testedOrigin: base,
        separateBrowserContexts: true,
        physicalWifiDevices: false,
      }),
      contentType: "application/json",
    });
  } finally {
    await context.close();
  }
});
test("LAN guidance, invalid addresses and invite code prefill work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Local Wi-Fi", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gather around one hearth." }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Host server address" })
    .fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Connect to local server" }).click();
  await expect(page.getByRole("status")).toContainText("valid http");
  await page.goto("/?room=ABC123");
  await expect(
    page.getByRole("heading", { name: "Share the realm." }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Room code", exact: true }),
  ).toHaveValue("ABC123");
});
