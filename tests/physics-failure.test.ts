import { it, expect, vi } from "vitest";
const { init, world } = vi.hoisted(() => ({
  init: vi.fn().mockRejectedValue(Error("WASM blocked")),
  world: vi.fn(),
}));
vi.mock("@dimforge/rapier3d-compat", () => ({
  default: { init, World: world },
}));
import { PhysicsPort } from "../src/game/physics";
it("blocked WASM reports an actionable failure, allocates no world and allows another attempt", async () => {
  await expect(PhysicsPort.create({} as any)).rejects.toThrow(/WebAssembly/);
  await expect(PhysicsPort.create({} as any)).rejects.toThrow(/WebAssembly/);
  expect(init).toHaveBeenCalledTimes(2);
  expect(world).not.toHaveBeenCalled();
});
