import { it, expect } from "vitest";
import {
  Scene,
  BoxGeometry,
  MeshStandardMaterial,
  Matrix4,
  InstancedMesh,
} from "three";
import { ModelBatches } from "../src/render/batches";
import type { ModelPart } from "../src/render/models";
it("static instance buffers stay uploaded until a transform changes", () => {
  const scene = new Scene(),
    batch = new ModelBatches(scene),
    part: ModelPart = {
      geometry: new BoxGeometry(),
      material: new MeshStandardMaterial(),
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
  const draw = (matrix: Matrix4) => {
    batch.begin();
    batch.add(part, matrix, 0xffffff, 0, 0, false, false, false, 1);
    batch.end();
  };
  draw(new Matrix4().makeTranslation(0.3, 1.4, 2.7));
  const mesh = scene.children[0] as InstancedMesh,
    version = mesh.instanceMatrix.version;
  draw(new Matrix4().makeTranslation(0.3, 1.4, 2.7));
  expect(mesh.instanceMatrix.version).toBe(version);
  draw(new Matrix4().makeTranslation(0.4, 1.4, 2.7));
  expect(mesh.instanceMatrix.version).toBe(version + 1);
  batch.dispose();
  part.geometry.dispose();
  part.material.dispose();
});
