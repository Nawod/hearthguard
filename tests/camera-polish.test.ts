import { it, expect } from "vitest";
import { FollowCamera } from "../src/render/camera";
import { emptyInput } from "../src/game/types";
it("camera projection exposes depth so labels behind the camera can be rejected", () => {
  const camera = new FollowCamera();
  camera.camera.position.set(0, 1, 0);
  camera.camera.lookAt(0, 1, -5);
  camera.camera.updateMatrixWorld();
  const front = camera.project({ x: 0, y: 1, z: -5 }) as {
      x: number;
      y: number;
      z: number;
    },
    behind = camera.project({ x: 0, y: 1, z: 5 }) as typeof front;
  expect(front.z).toBeGreaterThan(-1);
  expect(front.z).toBeLessThan(1);
  expect(behind.z).toBeGreaterThan(1);
});
it("resetting a camera starts at the new world instead of flying through the old location", () => {
  const camera = new FollowCamera(),
    view = { size: 96, heights: Array(97 * 97).fill(0), entities: [] } as any,
    p = { pos: { x: 20, y: 0, z: 20 }, input: emptyInput() } as any;
  camera.update(p, view, 0, 0, 0.016);
  (camera as FollowCamera & { reset(): void }).reset();
  camera.update({ ...p, pos: { x: 75, y: 0, z: 75 } }, view, 0, 0, 0.016);
  expect(camera.camera.position.x).toBeGreaterThan(70);
  expect(camera.camera.position.z).toBeGreaterThan(75);
});
