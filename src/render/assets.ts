import {
  Cache,
  TextureLoader,
  Texture,
  SRGBColorSpace,
  RepeatWrapping,
  Mesh,
  Material,
} from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
const modules = [
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
  "Roof_Wooden_2x1_Middle",
  "Floor_WoodDark",
  "Window_Thin_Round1",
];
export class RenderAssets {
  readonly models = new Map<string, GLTF>();
  readonly textures = new Map<string, Texture>();
  private allTextures = new Set<Texture>();
  private disposed = false;
  async load() {
    Cache.enabled = true;
    const loader = new GLTFLoader(),
      tl = new TextureLoader();
    const names = [
      "character",
      "ranger",
      "head",
      "hair",
      "animations",
      "actions",
      "deer",
      "horse",
      "rock",
      ...modules.map((n) => "village-" + n),
    ];
    const materials = [
      "bark_diff",
      "bark_nor_gl",
      "bark_arm",
      "twig_diff",
      "twig_nor_gl",
      "twig_alpha",
      "ground_diff",
      "ground_normal",
      "ground_arm",
    ];
    const results = await Promise.allSettled([
      ...names.map(async (name) => {
        const gltf = await loader.loadAsync(`/models/${name}.glb`);
        this.models.set(name, gltf);
      }),
      ...materials.map(async (name) => {
        const t = await tl.loadAsync(
          `/models/materials/${name}.${name.endsWith("alpha") ? "png" : "jpg"}`,
        );
        if (name.endsWith("diff")) t.colorSpace = SRGBColorSpace;
        if (name.startsWith("ground")) {
          t.wrapS = t.wrapT = RepeatWrapping;
          t.repeat.set(24, 24);
        }
        this.textures.set(name, t);
        this.allTextures.add(t);
      }),
    ]);
    // Canonicalize repeated source maps across independently loaded GLTF modules.
    const shared = new Map<string, Texture>();
    for (const gltf of this.models.values())
      gltf.scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        for (const mat of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          for (const [key, value] of Object.entries(mat))
            if (value instanceof Texture) {
              this.allTextures.add(value);
              const association = gltf.parser.associations.get(value);
              const ti = association?.textures;
              const image =
                ti === undefined
                  ? undefined
                  : gltf.parser.json.images?.[
                      gltf.parser.json.textures[ti].source
                    ];
              if (!image?.uri) continue;
              const signature = [
                image.uri,
                value.colorSpace,
                value.wrapS,
                value.wrapT,
                value.flipY,
                value.channel,
              ].join("|");
              const existing = shared.get(signature);
              if (existing)
                (mat as unknown as Record<string, unknown>)[key] = existing;
              else shared.set(signature, value);
            }
        }
      });
    const failure = results.find((r) => r.status === "rejected");
    if (this.disposed || failure) {
      this.dispose();
      if (failure?.status === "rejected")
        throw new Error("Unable to load the local 3D models. Reload to retry.");
    }
  }
  dispose() {
    this.disposed = true;
    const geos = new Set(),
      mats = new Set<Material>();
    for (const gltf of this.models.values())
      gltf.scene.traverse((node) => {
        if (node instanceof Mesh) {
          if (!geos.has(node.geometry)) {
            geos.add(node.geometry);
            node.geometry.dispose();
          }
          for (const m of Array.isArray(node.material)
            ? node.material
            : [node.material])
            mats.add(m);
        }
      });
    for (const m of mats) m.dispose();
    for (const t of this.allTextures) t.dispose();
    this.models.clear();
    this.textures.clear();
    this.allTextures.clear();
  }
}
