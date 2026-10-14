import { it, expect, vi } from "vitest";
import { InputController } from "../src/input/controller";
it("a second scene finger cannot take over the camera until its current pointer releases", () => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("document", new EventTarget());
  const canvas = Object.assign(new EventTarget(), { setPointerCapture() {} });
  const input = new InputController(canvas as any, () => {});
  input.active = true;
  try {
    const preventDefault = vi.fn();
    const raw = input as any;
    raw.down({
      preventDefault,
      pointerType: "touch",
      pointerId: 11,
      clientX: 100,
      clientY: 100,
    });
    raw.down({
      preventDefault,
      pointerType: "touch",
      pointerId: 22,
      clientX: 200,
      clientY: 200,
    });
    raw.up({ pointerType: "touch", pointerId: 22 });
    raw.move({
      preventDefault,
      pointerType: "touch",
      pointerId: 11,
      clientX: 120,
      clientY: 100,
    });
    expect(input.frame.yaw).toBeCloseTo(0.12, 4);
    raw.up({ pointerType: "touch", pointerId: 11 });
    raw.down({
      preventDefault,
      pointerType: "touch",
      pointerId: 22,
      clientX: 200,
      clientY: 200,
    });
    raw.move({
      preventDefault,
      pointerType: "touch",
      pointerId: 22,
      clientX: 220,
      clientY: 200,
    });
    expect(input.frame.yaw).toBeCloseTo(0.24, 4);
    expect(preventDefault).toHaveBeenCalledTimes(3);
    input.releaseAll();
    expect(input.frame.move).toEqual({ x: 0, z: 0 });
  } finally {
    input.dispose();
    vi.unstubAllGlobals();
  }
});
