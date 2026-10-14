import { it, expect } from "vitest";
import { observedAnimalSpeed } from "../src/render/motion";
it("animates visible animal movement without private roaming goals", () => {
  expect(
    observedAnimalSpeed({ x: 1, y: 0, z: 1 }, { x: 1.1, y: 0, z: 1 }, 0.1),
  ).toBeCloseTo(1);
});
it("does not animate stationary animals or a new world teleport", () => {
  expect(
    observedAnimalSpeed({ x: 1, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, 0.1),
  ).toBe(0);
  expect(observedAnimalSpeed(undefined, { x: 1, y: 0, z: 1 }, 0.1)).toBe(0);
  expect(
    observedAnimalSpeed({ x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }, 0),
  ).toBe(0);
});
