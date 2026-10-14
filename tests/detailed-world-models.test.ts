import { describe, expect, it, vi } from "vitest";
import {
  Box3,
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BUILDINGS } from "../src/game/balance";
import { DetailedWorldModels } from "../src/render/world-models";

function fixture() {
  const source = new Group();
  const geometry = new BoxGeometry(2, 3, 0.3);
  const material = new MeshStandardMaterial({
    color: "#876954",
    map: new Texture(),
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.set(4, 1.5, -3);
  source.add(mesh);
  const assets = new Map<string, GLTF>();
  for (const name of [
    "Wall_Plaster_Straight",
    "Wall_Plaster_Door_Round",
    "Wall_Plaster_Window_Wide_Round",
    "Wall_UnevenBrick_Straight",
    "Wall_UnevenBrick_Window_Thin_Round",
    "DoorFrame_Round_WoodDark",
    "Door_2_Round",
    "Roof_RoundTiles_4x4",
    "Roof_RoundTiles_6x6",
    "Roof_Tower_RoundTiles",
    "Prop_Chimney",
    "Prop_Crate",
    "Prop_Wagon",
    "Prop_WoodenFence_Single",
    "Prop_MetalFence_Ornament",
    "Floor_WoodDark",
    "Window_Thin_Round1",
  ])
    assets.set(`village-${name}`, { scene: source } as GLTF);
  assets.set("rock", { scene: source } as GLTF);
  return { assets, geometry, material };
}
function bounds(parts: NonNullable<ReturnType<DetailedWorldModels["get"]>>) {
  const box = new Box3();
  for (const p of parts) {
    const m = new Mesh(p.geometry);
    m.position.fromArray(p.position);
    m.scale.fromArray(p.scale);
    m.rotation.set(...p.rotation);
    m.updateMatrixWorld();
    box.union(new Box3().setFromObject(m));
  }
  return box;
}
describe("detailed static world models", () => {
  it("coalesces equivalent imported PBR materials into one architecture batch", () => {
    const f = fixture();
    const secondScene = new Group();
    secondScene.add(new Mesh(f.geometry, f.material.clone()));
    f.assets.set("village-Floor_WoodDark", { scene: secondScene } as GLTF);
    const lib = new DetailedWorldModels(f.assets, new Map());
    const textured = lib
      .get("townhall")!
      .filter((p) => p.material.map === f.material.map);
    expect(textured).toHaveLength(1);
  });
  it("anchors and centers every building within its collision footprint and height", () => {
    const lib = new DetailedWorldModels(fixture().assets, new Map());
    for (const [type, def] of Object.entries(BUILDINGS)) {
      const b = bounds(lib.get(type)!);
      const size = b.getSize(new Vector3());
      expect(b.min.y).toBeCloseTo(0, 4);
      expect(size.x).toBeLessThanOrEqual(def.size + 0.001);
      expect(size.z).toBeLessThanOrEqual(def.size + 0.001);
      // Wheat stands above the low soil collision bed, while architecture fits its envelope.
      if (type !== "farm") expect(size.y).toBeCloseTo(def.height, 3);
      expect(Math.abs(b.getCenter(new Vector3()).x)).toBeLessThan(0.001);
      expect(Math.abs(b.getCenter(new Vector3()).z)).toBeLessThan(0.001);
    }
  });
  it("shares architecture across faction colors and animates only the gate leaf", () => {
    const lib = new DetailedWorldModels(fixture().assets, new Map());
    const a = lib.get("townhall", "#ff0000")!,
      b = lib.get("townhall", "#0000ff")!;
    expect(a.filter((p) => !p.motion).map((p) => p.geometry)).toEqual(
      b.filter((p) => !p.motion).map((p) => p.geometry),
    );
    expect(a.find((p) => p.motion === "flag")!.material.color.getHex()).toBe(
      0xff0000,
    );
    const gate = lib.get("gate")!;
    expect(gate.some((p) => p.motion !== "gate")).toBe(true);
    expect(gate.filter((p) => p.motion === "gate")).toHaveLength(1);
    expect(
      bounds(gate.filter((p) => p.motion !== "gate")).getSize(new Vector3()).x,
    ).toBeGreaterThan(3);
  });
  it("uses real bark and masked twig materials on an efficient branching tree", () => {
    const bark = new Texture(),
      twig = new Texture(),
      alpha = new Texture();
    const lib = new DetailedWorldModels(
      fixture().assets,
      new Map([
        ["bark_diff", bark],
        ["twig_diff", twig],
        ["twig_alpha", alpha],
      ]),
    );
    const tree = lib.get("tree")!;
    expect(tree).toHaveLength(2);
    expect(tree.some((p) => p.material.map === bark)).toBe(true);
    expect(
      tree.some(
        (p) =>
          p.material.map === twig &&
          p.material.alphaMap === alpha &&
          p.material.alphaTest > 0,
      ),
    ).toBe(true);
    expect(
      tree.reduce((n, p) => n + p.geometry.getAttribute("position").count, 0),
    ).toBeLessThan(25000);
    expect(bounds(tree).min.y).toBeCloseTo(0, 4);
  });
  it("owns its baked geometry and cloned materials without disposing imported resources", () => {
    const f = fixture(),
      sourceG = vi.spyOn(f.geometry, "dispose"),
      sourceM = vi.spyOn(f.material, "dispose");
    const lib = new DetailedWorldModels(f.assets, new Map());
    const parts = lib.get("stone")!;
    const owned = vi.spyOn(parts[0].geometry, "dispose");
    lib.dispose();
    expect(owned).toHaveBeenCalledOnce();
    expect(sourceG).not.toHaveBeenCalled();
    expect(sourceM).not.toHaveBeenCalled();
  });
  it("covers scenery and props while leaving unsupported actors to the rig renderer", () => {
    const lib = new DetailedWorldModels(fixture().assets, new Map());
    for (const type of ["stone", "ore", "catapult", "trap", "bag", "farm"])
      expect(lib.get(type)!.length).toBeGreaterThan(0);
    expect(lib.get("deer")).toBeUndefined();
  });
});
