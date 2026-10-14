import {
  PlaneGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Color,
  Texture,
} from "three";
import type { PlayerView } from "../game/types";
export function createTerrain(
  view: PlayerView,
  textures?: Map<string, Texture>,
): Mesh {
  const n = view.size,
    g = new PlaneGeometry(n, n, n, n);
  g.rotateX(-Math.PI / 2);
  g.translate(n / 2, 0, n / 2);
  const pos = g.getAttribute("position"),
    colors = new Float32Array(pos.count * 3),
    color = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = Math.round(pos.getX(i)),
      z = Math.round(pos.getZ(i)),
      h = view.heights[z * (n + 1) + x] ?? 0;
    pos.setY(i, h);
    const variation =
      (Math.sin(x * 0.8 + z * 0.72) + Math.sin(x * 0.24 - z * 0.33)) * 0.025;
    color.setRGB(
      0.25 + variation + h * 0.015,
      0.36 + variation + h * 0.01,
      0.19 + variation,
    );
    if (
      view.entities.some(
        (e) =>
          e.type === "townhall" && Math.hypot(e.pos.x - x, e.pos.z - z) < 7,
      )
    )
      color.setRGB(0.32 + variation, 0.33 + variation, 0.22 + variation);
    color.toArray(colors, i * 3);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return new Mesh(
    g,
    new MeshStandardMaterial({
      vertexColors: !textures,
      map: textures?.get("ground_diff"),
      normalMap: textures?.get("ground_normal"),
      aoMap: textures?.get("ground_arm"),
      roughnessMap: textures?.get("ground_arm"),
      roughness: 1,
      flatShading: false,
    }),
  );
}
