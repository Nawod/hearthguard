import { it, expect, vi } from "vitest";
import { readSave } from "../src/platform/storage";
it("unavailable browser storage reports an actionable error", async () => {
  vi.stubGlobal("indexedDB", undefined);
  try {
    await expect(readSave("manual")).rejects.toThrow(/unavailable/i);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("a failed WASM initialization rejects before allocating a physics world", async () => {
  vi.resetModules();
  vi.doMock("@dimforge/rapier3d-compat", () => ({
    default: { init: () => Promise.reject(new Error("WASM unavailable")) },
  }));
  try {
    const { PhysicsPort } = await import("../src/game/physics");
    await expect(PhysicsPort.create({} as any)).rejects.toThrow(
      /Enable WebAssembly/,
    );
  } finally {
    vi.doUnmock("@dimforge/rapier3d-compat");
    vi.resetModules();
  }
});
