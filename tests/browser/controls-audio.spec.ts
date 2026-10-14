import { test, expect } from "@playwright/test";
import { touchHold } from "./helpers";
test("held controls stop when menus open, and first interaction unlocks an audio signal", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    class ObservedAudio extends Native {
      constructor(...args: any[]) {
        super(...args);
        const analyser = this.createAnalyser();
        analyser.connect(this.destination);
        (window as any).audioEvidence = { context: this, analyser };
        const create = this.createGain.bind(this);
        this.createGain = () => {
          const gain = create(),
            connect = gain.connect.bind(gain);
          gain.connect = ((target: AudioNode, ...rest: any[]) =>
            connect(
              target === this.destination ? analyser : target,
              ...rest,
            )) as typeof gain.connect;
          return gain;
        };
      }
    }
    window.AudioContext = ObservedAudio as typeof AudioContext;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator(".joystick")).toBeVisible();
    await expect(page.locator(".portrait-prompt")).toBeHidden();
  }
  if (info.project.name === "desktop") {
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(200);
    await page
      .getByRole("button", { name: "Pause match", exact: true })
      .click();
    await page.keyboard.up("KeyD");
  } else {
    await touchHold(page, ".joystick", "move", 35, 0, 400);
    await page
      .getByRole("button", { name: "Pause match", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "The hearth can wait." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume journey" }).click();
  await page.getByRole("button", { name: "Save match", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  const held = await page.evaluate(
    async () =>
      await new Promise<any>((resolve) => {
        const request = indexedDB.open("hearthguard-saves", 1);
        request.onsuccess = () => {
          const db = request.result,
            q = db.transaction("matches").objectStore("matches").get("manual");
          q.onsuccess = () => {
            resolve(q.result.save.state.players[1].input);
            db.close();
          };
        };
      }),
  );
  expect(held.move).toEqual({ x: 0, z: 0 });
  expect(held.attack).toBe(false);
  if (info.project.name === "phone")
    await page.screenshot({ path: "docs/evidence/phone-landscape.png" });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Test sound" }).click();
  const signal = await page.evaluate(async () => {
    const { context, analyser } = (window as any).audioEvidence;
    let peak = 0;
    for (let i = 0; i < 12; i++) {
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      peak = Math.max(peak, ...Array.from(samples, Math.abs));
      await new Promise((r) => setTimeout(r, 15));
    }
    return { state: context.state, peak };
  });
  expect(signal.state).toBe("running");
  expect(signal.peak).toBeGreaterThan(0.001);
  await info.attach("audio-signal.json", {
    body: JSON.stringify(signal),
    contentType: "application/json",
  });
});
