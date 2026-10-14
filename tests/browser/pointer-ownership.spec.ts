import { test, expect } from "@playwright/test";
test("a second finger cannot steal or release the active movement joystick", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "desktop",
    "Touch overlay is tested on phone and tablet emulation.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Play against the computer" }).click();
  await page.getByRole("button", { name: "Dismiss tutorial" }).click();
  const stick = page.locator(".joystick"),
    knob = stick.locator("span");
  // Synthetic pointer ids isolate ownership; native touch/cancel is covered by controls-audio.
  await stick.evaluate((e) => {
    e.setPointerCapture = () => {};
  });
  await stick.dispatchEvent("pointerdown", {
    pointerId: 11,
    clientX: 100,
    clientY: 100,
  });
  await stick.dispatchEvent("pointermove", {
    pointerId: 11,
    clientX: 125,
    clientY: 100,
  });
  await expect(knob).toHaveAttribute("style", /25px/);
  await stick.dispatchEvent("pointerdown", {
    pointerId: 22,
    clientX: 200,
    clientY: 100,
  });
  await stick.dispatchEvent("pointerup", { pointerId: 22 });
  await expect(knob).toHaveAttribute("style", /25px/);
  await stick.dispatchEvent("pointermove", {
    pointerId: 11,
    clientX: 130,
    clientY: 100,
  });
  await expect(knob).toHaveAttribute("style", /30px/);
  await stick.dispatchEvent("pointercancel", { pointerId: 11 });
  await expect(knob).toHaveAttribute("style", /0px, 0px/);
});
