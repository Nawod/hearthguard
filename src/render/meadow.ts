import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Color,
} from "three";
import type { PlayerView } from "../game/types";
/** Seeded, non-interactive vegetation; no external textures or assets. */
export function createMeadow(view: PlayerView): InstancedMesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -0.025, 0, 0, 0.02, 0.22, 0, 0.025, 0, 0, -0.025, 0, 0, -0.012, 0.2,
        0.015, 0.02, 0.22, 0, -0.012, 0.2, 0.015, 0.025, 0.42, 0.04, 0.02, 0.22,
        0, 0, 0, -0.02, 0.012, 0.16, -0.007, 0, 0, 0.02, 0.012, 0.16, -0.007,
        0.025, 0.33, 0.04, 0, 0, 0.02,
      ],
      3,
    ),
  );
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({
      color: "#7d995a",
      roughness: 1,
      side: 2,
    }),
    count = view.size * 20,
    mesh = new InstancedMesh(geometry, material, count),
    object = new Object3D(),
    color = new Color();
  let seed = view.config.seed >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let i = 0; i < count; i++) {
    const x = 1 + random() * (view.size - 2),
      z = 1 + random() * (view.size - 2),
      y = view.heights[Math.round(z) * (view.size + 1) + Math.round(x)] ?? 0;
    object.position.set(x, y - 0.03, z);
    object.rotation.y = random() * Math.PI;
    object.scale.setScalar(0.6 + random() * 0.7);
    object.updateMatrix();
    mesh.setMatrixAt(i, object.matrix);
    color.setHSL(0.2 + random() * 0.06, 0.25, 0.25 + random() * 0.09);
    mesh.setColorAt(i, color);
  }
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}
