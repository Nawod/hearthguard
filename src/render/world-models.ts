import {
  Box3,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BUILDINGS } from "../game/balance";
import type { ModelPart } from "./models";

type Chunk = {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  motion?: ModelPart["motion"];
};
type Triple = [number, number, number];
const UP = new Vector3(0, 1, 0);
const STATIC_TYPES = new Set([
  "tree",
  "stone",
  "ore",
  "catapult",
  "trap",
  "bag",
  ...Object.keys(BUILDINGS),
]);

/** Bakes imported, textured architecture into small sets of instanceable material batches.
 * Source GLTFs and texture objects remain owned by the asset loader. */
export class DetailedWorldModels {
  private cache = new Map<string, ModelPart[]>();
  private base = new Map<string, ModelPart[]>();
  private geometries = new Set<BufferGeometry>();
  private materials = new Set<MeshStandardMaterial>();
  private sourceMaterials = new Map<
    MeshStandardMaterial,
    MeshStandardMaterial
  >();
  private canonicalMaterials = new Map<string, MeshStandardMaterial>();
  private named = new Map<string, MeshStandardMaterial>();

  constructor(
    private assets: Map<string, GLTF>,
    private textures: Map<string, Texture>,
  ) {}

  private material(
    name: string,
    color: string,
    metalness = 0,
  ): MeshStandardMaterial {
    let m = this.named.get(name);
    if (!m) {
      m = new MeshStandardMaterial({
        color,
        roughness: metalness ? 0.48 : 0.9,
        metalness,
      });
      if (name === "bark" || name === "wood") {
        m.map = this.textures.get("bark_diff") ?? null;
        m.normalMap = this.textures.get("bark_nor_gl") ?? null;
        m.roughnessMap = this.textures.get("bark_arm") ?? null;
        m.aoMap = this.textures.get("bark_arm") ?? null;
      }
      if (name === "needles") {
        m.map = this.textures.get("twig_diff") ?? null;
        m.normalMap = this.textures.get("twig_nor_gl") ?? null;
        m.alphaMap = this.textures.get("twig_alpha") ?? null;
        m.alphaTest = 0.45;
        m.side = DoubleSide;
      }
      if (name === "soil") {
        m.map = this.textures.get("ground_diff") ?? null;
        m.normalMap = this.textures.get("ground_normal") ?? null;
        m.roughnessMap = this.textures.get("ground_arm") ?? null;
      }
      this.named.set(name, m);
      this.materials.add(m);
    }
    return m;
  }

  private add(
    chunks: Chunk[],
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    position: Triple = [0, 0, 0],
    rotation: Triple = [0, 0, 0],
    motion?: ModelPart["motion"],
  ): void {
    const object = new Mesh(geometry);
    object.position.fromArray(position);
    object.rotation.set(...rotation);
    object.updateMatrix();
    geometry.applyMatrix4(object.matrix);
    chunks.push({ geometry, material, motion });
  }

  private beam(
    chunks: Chunk[],
    a: Triple,
    b: Triple,
    width: number,
    depth = width,
    material = this.material("wood", "#b19b7f"),
  ): void {
    const start = new Vector3(...a),
      end = new Vector3(...b),
      direction = end.clone().sub(start);
    const g = new RoundedBoxGeometry(
      width,
      direction.length(),
      depth,
      1,
      Math.min(width, depth) * 0.12,
    );
    const transform = new Matrix4().compose(
      start.add(end).multiplyScalar(0.5),
      new Quaternion().setFromUnitVectors(UP, direction.normalize()),
      new Vector3(1, 1, 1),
    );
    g.applyMatrix4(transform);
    chunks.push({ geometry: g, material });
  }

  /** Normalize each complete module, retaining mesh hierarchy transforms and UVs. */
  private module(
    chunks: Chunk[],
    name: string,
    size: Triple,
    position: Triple,
    yaw = 0,
    motion?: ModelPart["motion"],
    tint?: string,
  ): void {
    const source = this.assets.get(name === "rock" ? name : `village-${name}`);
    if (!source) throw new Error(`Missing detailed scenery asset: ${name}`);
    source.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(source.scene),
      extent = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    const normalize = new Matrix4()
      .makeScale(
        size[0] / Math.max(extent.x, 0.001),
        size[1] / Math.max(extent.y, 0.001),
        size[2] / Math.max(extent.z, 0.001),
      )
      .multiply(
        new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
      );
    const placement = new Matrix4()
      .makeTranslation(...position)
      .multiply(new Matrix4().makeRotationY(yaw))
      .multiply(normalize);
    source.scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const sourceList = Array.isArray(node.material)
        ? node.material
        : [node.material];
      const groups =
        node.geometry.groups.length && sourceList.length > 1
          ? node.geometry.groups
          : [{ start: 0, count: Infinity, materialIndex: 0 }];
      for (const group of groups) {
        const original = sourceList[group.materialIndex ?? 0];
        if (!(original instanceof MeshStandardMaterial)) continue;
        let material = this.sourceMaterials.get(original);
        if (!material) {
          // Assets have their own Material objects even when sharing the same
          // texture atlas. Reuse equal PBR states so the kit remains batchable.
          const signature = JSON.stringify([
            original.color.getHex(),
            original.emissive.getHex(),
            original.emissiveIntensity,
            Math.max(0.65, original.roughness),
            original.metalness,
            original.opacity,
            original.alphaTest,
            original.transparent,
            original.side,
            original.flatShading,
            original.vertexColors,
            original.normalScale.toArray(),
            original.aoMapIntensity,
            original.bumpScale,
            original.displacementScale,
            original.displacementBias,
            ...[
              original.map,
              original.normalMap,
              original.roughnessMap,
              original.metalnessMap,
              original.aoMap,
              original.alphaMap,
              original.emissiveMap,
              original.bumpMap,
              original.displacementMap,
            ].map((texture) => texture?.uuid ?? null),
          ]);
          material = this.canonicalMaterials.get(signature);
          if (!material) {
            material = original.clone();
            material.roughness = Math.max(0.65, original.roughness);
            this.materials.add(material);
            this.canonicalMaterials.set(signature, material);
          }
          this.sourceMaterials.set(original, material);
        }
        if (tint) {
          const key = `${original.uuid}:${tint}`;
          let colored = this.named.get(key);
          if (!colored) {
            colored = material.clone();
            colored.color.multiply(this.material(`tint-${tint}`, tint).color);
            this.materials.add(colored);
            this.named.set(key, colored);
          }
          material = colored;
        }
        let g = node.geometry.index
          ? node.geometry.toNonIndexed()
          : node.geometry.clone();
        if (groups.length > 1) {
          const sliced = new BufferGeometry();
          for (const attributeName of ["position", "normal", "uv"]) {
            const attr = g.getAttribute(attributeName);
            if (!attr) continue;
            const values: number[] = [];
            for (
              let vertex = group.start;
              vertex < group.start + group.count;
              vertex++
            )
              for (let component = 0; component < attr.itemSize; component++)
                values.push(attr.getComponent(vertex, component));
            sliced.setAttribute(
              attributeName,
              new Float32BufferAttribute(values, attr.itemSize),
            );
          }
          g.dispose();
          g = sliced;
        }
        g.applyMatrix4(placement.clone().multiply(node.matrixWorld));
        chunks.push({ geometry: g, material, motion });
      }
    });
  }

  private finish(
    chunks: Chunk[],
    fit?: { size: number; height: number },
  ): ModelPart[] {
    if (fit) {
      const box = new Box3();
      for (const c of chunks) {
        c.geometry.computeBoundingBox();
        box.union(c.geometry.boundingBox!);
      }
      const extent = box.getSize(new Vector3()),
        center = box.getCenter(new Vector3());
      const scale = new Vector3(
        Math.min(1, fit.size / extent.x),
        fit.height / extent.y,
        Math.min(1, fit.size / extent.z),
      );
      const matrix = new Matrix4()
        .makeScale(scale.x, scale.y, scale.z)
        .multiply(
          new Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
        );
      for (const c of chunks) c.geometry.applyMatrix4(matrix);
    }
    const groups = new Map<string, Chunk[]>();
    for (const c of chunks) {
      // Keep only standard vertex channels so imported and authored geometries merge consistently.
      for (const name of Object.keys(c.geometry.attributes))
        if (!["position", "normal", "uv"].includes(name))
          c.geometry.deleteAttribute(name);
      if (!c.geometry.getAttribute("normal")) c.geometry.computeVertexNormals();
      if (!c.geometry.getAttribute("uv"))
        c.geometry.setAttribute(
          "uv",
          new Float32BufferAttribute(
            new Float32Array(c.geometry.getAttribute("position").count * 2),
            2,
          ),
        );
      if (c.geometry.index) {
        const old = c.geometry;
        c.geometry = old.toNonIndexed();
        old.dispose();
      }
      const key = `${c.material.uuid}:${c.motion ?? "static"}`;
      const group = groups.get(key) ?? [];
      group.push(c);
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => {
      const geometry = mergeGeometries(
        group.map((c) => c.geometry),
        false,
      )!;
      for (const c of group) c.geometry.dispose();
      this.geometries.add(geometry);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return {
        geometry,
        material: group[0].material,
        motion: group[0].motion,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
    });
  }

  private tree(chunks: Chunk[]): void {
    const bark = this.material("bark", "#ffffff"),
      needles = this.material("needles", "#ffffff");
    const trunk = new CatmullRomCurve3([
      new Vector3(0, 0.18, 0),
      new Vector3(0.06, 1.7, 0.03),
      new Vector3(-0.08, 3.8, 0.08),
      new Vector3(0.02, 6, 0),
    ]);
    // Taper the curved trunk, retaining the tube's cylindrical bark UVs.
    const g = new TubeGeometry(trunk, 16, 0.26, 8, false),
      attr = g.getAttribute("position");
    for (let i = 0; i < attr.count; i++) {
      const t = Math.floor(i / 9) / 16,
        p = trunk.getPointAt(t),
        taper = 1 - t * 0.89;
      attr.setXYZ(
        i,
        p.x + (attr.getX(i) - p.x) * taper,
        attr.getY(i),
        p.z + (attr.getZ(i) - p.z) * taper,
      );
    }
    g.computeVertexNormals();
    chunks.push({ geometry: g, material: bark });
    for (let r = 0; r < 5; r++) {
      const angle = r * 2.399;
      const root = new CatmullRomCurve3([
        new Vector3(Math.cos(angle) * 0.7, 0.06, Math.sin(angle) * 0.7),
        new Vector3(Math.cos(angle) * 0.32, 0.2, Math.sin(angle) * 0.32),
        new Vector3(0, 0.65, 0),
      ]);
      chunks.push({
        geometry: new TubeGeometry(root, 5, 0.1, 5, false),
        material: bark,
      });
    }
    for (let layer = 0; layer < 8; layer++)
      for (let branch = 0; branch < 5; branch++) {
        const y = 1.15 + layer * 0.57,
          angle = branch * Math.PI * 0.4 + layer * 1.91;
        const reach = 1.9 * (1 - layer * 0.095),
          dir = new Vector3(Math.cos(angle), 0, Math.sin(angle));
        const curve = new CatmullRomCurve3([
          new Vector3(0, y, 0),
          dir
            .clone()
            .multiplyScalar(reach * 0.48)
            .add(new Vector3(0, y - 0.18, 0)),
          dir
            .clone()
            .multiplyScalar(reach)
            .add(new Vector3(0, y + 0.22, 0)),
        ]);
        chunks.push({
          geometry: new TubeGeometry(
            curve,
            5,
            0.043 * (1 - layer * 0.075),
            5,
            false,
          ),
          material: bark,
        });
        for (let tip = 0; tip < 4; tip++) {
          const p = curve.getPoint(0.35 + tip * 0.21);
          for (let cross = 0; cross < 2; cross++) {
            const card = new PlaneGeometry(1.05 - layer * 0.055, 0.7, 1, 2);
            // Select the needle sprig from the scanned atlas; the remaining atlas contains cones and opaque UV padding.
            const uv = card.getAttribute("uv");
            for (let i = 0; i < uv.count; i++)
              uv.setXY(i, uv.getX(i) * 0.235, 0.56 + uv.getY(i) * 0.43);
            this.add(
              chunks,
              card,
              needles,
              [p.x, p.y + 0.08, p.z],
              [
                -0.45 + cross * 0.9,
                -angle + Math.PI * 0.5 + cross * 0.8,
                0.18 * Math.sin(layer + tip),
              ],
            );
          }
        }
      }
    // Root flare reaches ground exactly; trees do not float on the resource marker.
    const box = new Box3();
    for (const c of chunks) {
      c.geometry.computeBoundingBox();
      box.union(c.geometry.boundingBox!);
    }
    for (const c of chunks) c.geometry.translate(0, -box.min.y, 0);
  }

  private building(type: string, chunks: Chunk[]): void {
    const def = BUILDINGS[type as keyof typeof BUILDINGS],
      s = def.size,
      h = def.height;
    if (type === "wall") {
      this.module(
        chunks,
        "Wall_UnevenBrick_Straight",
        [s, h * 0.92, 0.6],
        [0, 0, 0],
      );
      for (let i = 0; i < 4; i++)
        this.module(
          chunks,
          "Wall_UnevenBrick_Straight",
          [s / 5, h * 0.16, 0.62],
          [-s * 0.375 + i * s * 0.25, h * 0.84, 0],
        );
      return;
    }
    if (type === "gate") {
      for (const sign of [-1, 1])
        this.module(
          chunks,
          "Wall_UnevenBrick_Straight",
          [s * 0.2, h, 0.65],
          [sign * s * 0.4, 0, 0],
        );
      this.module(
        chunks,
        "Wall_UnevenBrick_Straight",
        [s * 0.65, h * 0.22, 0.65],
        [0, h * 0.78, 0],
      );
      this.module(
        chunks,
        "Door_2_Round",
        [s * 0.61, h * 0.79, 0.18],
        [0, 0, -0.08],
        0,
        "gate",
      );
      return;
    }
    const stone = type === "tower" || type === "armory" || type === "smithy";
    const levels = type === "tower" ? 3 : type === "townhall" ? 2 : 1;
    const wallHeight = h * (type === "tower" ? 0.76 : 0.63),
      panelHeight = wallHeight / levels;
    const width = s * 0.84,
      thickness = 0.15,
      segments = type === "townhall" || type === "workshop" ? 3 : 2;
    for (let level = 0; level < levels; level++)
      for (let side = 0; side < 4; side++)
        for (let panel = 0; panel < segments; panel++) {
          const angle = (side * Math.PI) / 2,
            along = ((panel - (segments - 1) / 2) * width) / segments;
          const front = side === 0 && level === 0 && panel === 0;
          const name = front
            ? "Wall_Plaster_Door_Round"
            : stone
              ? panel % 2
                ? "Wall_UnevenBrick_Window_Thin_Round"
                : "Wall_UnevenBrick_Straight"
              : panel % 2
                ? "Wall_Plaster_Window_Wide_Round"
                : "Wall_Plaster_Straight";
          const x = along * Math.cos(angle) + width * 0.5 * Math.sin(angle),
            z = -along * Math.sin(angle) + width * 0.5 * Math.cos(angle);
          this.module(
            chunks,
            name,
            [width / segments, panelHeight, thickness],
            [x, level * panelHeight, z],
            angle,
          );
          if (front) {
            this.module(
              chunks,
              "DoorFrame_Round_WoodDark",
              [(width / segments) * 0.6, panelHeight * 0.88, 0.12],
              [x, 0, z + 0.035],
            );
            this.module(
              chunks,
              "Door_2_Round",
              [(width / segments) * 0.5, panelHeight * 0.81, 0.075],
              [x, 0, z + 0.075],
            );
          }
        }
    this.module(chunks, "Floor_WoodDark", [width, 0.1, width], [0, 0, 0]);
    this.module(
      chunks,
      type === "tower"
        ? "Roof_Tower_RoundTiles"
        : s >= 5
          ? "Roof_RoundTiles_6x6"
          : "Roof_RoundTiles_4x4",
      [s, h - wallHeight, s],
      [0, wallHeight, 0],
    );
    for (const x of [-width / 2, width / 2])
      for (const z of [-width / 2, width / 2])
        this.beam(chunks, [x, 0, z], [x, wallHeight, z], 0.13);
    for (const y of [0.12, wallHeight])
      for (const z of [-width / 2, width / 2])
        this.beam(chunks, [-width / 2, y, z], [width / 2, y, z], 0.12);
    if (type === "smithy" || type === "townhall")
      this.module(
        chunks,
        "Prop_Chimney",
        [s * 0.13, h * 0.37, s * 0.13],
        [s * 0.24, h * 0.62, -s * 0.15],
      );
    if (type === "storage" || type === "workshop" || type === "stable")
      for (let i = 0; i < 3; i++)
        this.module(
          chunks,
          "Prop_Crate",
          [s * 0.12, s * 0.12, s * 0.12],
          [-s * 0.3 + i * s * 0.15, 0, s * 0.35],
        );
    if (type === "stable")
      this.module(
        chunks,
        "Prop_WoodenFence_Single",
        [width * 0.65, h * 0.3, 0.1],
        [0, 0, width * 0.48],
      );
    if (type === "workshop")
      this.module(
        chunks,
        "Prop_Wagon",
        [s * 0.3, h * 0.24, s * 0.35],
        [s * 0.24, 0, s * 0.17],
      );
    // Cloth panel remains inside the roof envelope and uses the faction color.
    this.add(
      chunks,
      new PlaneGeometry(s * 0.14, h * 0.17),
      this.material("flag-base", "#ffffff"),
      [0, wallHeight * 0.7, width * 0.5 + 0.08],
      [0, 0, 0],
      "flag",
    );
  }

  private farm(chunks: Chunk[]): void {
    const soil = this.material("soil", "#77563a"),
      wheat = this.material("wheat", "#baa362"),
      stems = this.material("stems", "#7e8945");
    this.add(
      chunks,
      new RoundedBoxGeometry(4, 0.12, 4, 1, 0.045),
      soil,
      [0, 0.06, 0],
    );
    for (let row = 0; row < 9; row++) {
      this.beam(
        chunks,
        [-1.8, 0.13, -1.75 + row * 0.43],
        [1.8, 0.13, -1.75 + row * 0.43],
        0.13,
        0.16,
        soil,
      );
      for (let col = 0; col < 12; col++) {
        const x = -1.7 + col * 0.3,
          z = -1.7 + row * 0.42,
          height = 0.55 + 0.14 * Math.sin(col * 3.1 + row * 2.7);
        this.beam(
          chunks,
          [x, 0.15, z],
          [x + 0.07, height, z],
          0.014,
          0.014,
          stems,
        );
        for (let grain = 0; grain < 4; grain++)
          for (const sign of [-1, 1])
            this.add(
              chunks,
              new SphereGeometry(0.032, 5, 4).scale(1, 1.8, 0.8),
              wheat,
              [x + 0.07 + sign * 0.022, height + grain * 0.037, z],
              [0, 0, sign * 0.4],
            );
      }
    }
  }

  private catapult(chunks: Chunk[]): void {
    const wood = this.material("wood", "#b19b7f"),
      iron = this.material("iron", "#5d6265", 0.75),
      rope = this.material("rope", "#bda884");
    this.module(chunks, "Prop_Wagon", [1.55, 0.9, 2.65], [0, 0, 0]);
    for (const x of [-0.56, 0.56]) {
      this.beam(chunks, [x, 0.55, -0.85], [x, 0.55, 0.85], 0.18);
      this.beam(chunks, [x, 0.6, 0.4], [x, 1.55, -0.15], 0.18);
      this.beam(chunks, [x, 0.6, -0.8], [x, 1.55, -0.15], 0.14);
    }
    this.beam(
      chunks,
      [-0.75, 1.4, -0.15],
      [0.75, 1.4, -0.15],
      0.12,
      0.12,
      iron,
    );
    this.beam(chunks, [0, 0.85, 0.4], [0, 2.2, -1.1], 0.16);
    const bowl = new LatheGeometry(
      [
        new Vector2(0.01, 0),
        new Vector2(0.22, 0.02),
        new Vector2(0.36, 0.15),
        new Vector2(0.39, 0.26),
        new Vector2(0.35, 0.26),
        new Vector2(0.3, 0.12),
        new Vector2(0.01, 0.07),
      ],
      12,
    );
    this.add(chunks, bowl, wood, [0, 2.15, -1.1], [-0.65, 0, 0]);
    for (let i = 0; i < 7; i++)
      this.add(
        chunks,
        new TorusGeometry(0.12, 0.016, 4, 10),
        rope,
        [-0.16 + i * 0.05, 1.42, -0.15],
        [0, Math.PI / 2, 0],
      );
    const cable = new CatmullRomCurve3([
      new Vector3(0, 1.3, -0.15),
      new Vector3(0, 0.75, 0.15),
      new Vector3(0, 0.65, 0.75),
    ]);
    chunks.push({
      geometry: new TubeGeometry(cable, 8, 0.018, 5, false),
      material: rope,
    });
  }

  private prop(type: string, chunks: Chunk[]): void {
    const iron = this.material("iron", "#5d6265", 0.75);
    if (type === "bag") {
      const sack = this.material("sack", "#aa9470");
      const profile = [
        new Vector2(0, 0),
        new Vector2(0.23, 0.025),
        new Vector2(0.34, 0.15),
        new Vector2(0.31, 0.45),
        new Vector2(0.19, 0.59),
        new Vector2(0.11, 0.65),
        new Vector2(0.17, 0.74),
        new Vector2(0.03, 0.77),
      ];
      this.add(chunks, new LatheGeometry(profile, 16), sack);
      this.add(
        chunks,
        new TorusGeometry(0.12, 0.025, 5, 16),
        this.material("rope", "#bda884"),
        [0, 0.65, 0],
        [Math.PI / 2, 0, 0],
      );
      return;
    }
    this.add(
      chunks,
      new TorusGeometry(0.42, 0.04, 6, 24),
      iron,
      [0, 0.05, 0],
      [Math.PI / 2, 0, 0],
    );
    for (const sign of [-1, 1]) {
      this.add(
        chunks,
        new TorusGeometry(0.43, 0.028, 5, 18, Math.PI),
        iron,
        [0, 0.06, 0],
        [Math.PI / 2 + sign * 0.28, 0, sign < 0 ? Math.PI : 0],
      );
      for (let i = 0; i < 9; i++) {
        const angle = (i * Math.PI) / 8;
        this.add(chunks, new CylinderGeometry(0, 0.027, 0.095, 4), iron, [
          Math.cos(angle) * 0.42,
          0.09,
          sign * Math.sin(angle) * 0.42,
        ]);
      }
    }
    this.add(
      chunks,
      new CylinderGeometry(0.13, 0.13, 0.02, 12),
      iron,
      [0, 0.065, 0],
    );
    const coil = new CatmullRomCurve3(
      Array.from(
        { length: 65 },
        (_, i) =>
          new Vector3(
            -0.14 + i * 0.0044,
            0.06 + Math.cos((i * Math.PI) / 4) * 0.045,
            0.5 + Math.sin((i * Math.PI) / 4) * 0.045,
          ),
      ),
    );
    chunks.push({
      geometry: new TubeGeometry(coil, 64, 0.012, 4, false),
      material: iron,
    });
  }

  get(type: string, color = "#73b0bd"): ModelPart[] | undefined {
    if (!STATIC_TYPES.has(type)) return undefined;
    const key = `${type}:${color}`,
      cached = this.cache.get(key);
    if (cached) return cached;
    let base = this.base.get(type);
    if (!base) {
      const chunks: Chunk[] = [];
      if (type === "tree") this.tree(chunks);
      else if (type === "stone" || type === "ore")
        this.module(
          chunks,
          "rock",
          [2.1, 1.45, 1.85],
          [0, 0, 0],
          0,
          undefined,
          type === "ore" ? "#a9a6a0" : undefined,
        );
      else if (type === "farm") this.farm(chunks);
      else if (type === "catapult") this.catapult(chunks);
      else if (type === "bag" || type === "trap") this.prop(type, chunks);
      else this.building(type, chunks);
      const def = BUILDINGS[type as keyof typeof BUILDINGS];
      base = this.finish(chunks, def && type !== "farm" ? def : undefined);
      this.base.set(type, base);
    }
    const parts = base.map((p) =>
      p.motion === "flag"
        ? { ...p, material: this.material(`flag-${color}`, color) }
        : p,
    );
    for (const p of parts)
      if (p.motion === "flag") p.material.side = DoubleSide;
    this.cache.set(key, parts);
    return parts;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.cache.clear();
    this.base.clear();
    this.sourceMaterials.clear();
    this.canonicalMaterials.clear();
    this.named.clear();
  }
}
