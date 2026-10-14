import {
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  DodecahedronGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
} from "three";
import { BUILDINGS } from "../game/balance";
export interface ModelPart {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  motion?: "legL" | "legR" | "arm" | "weapon" | "flag" | "gate";
}
export class ModelLibrary {
  private cache = new Map<string, ModelPart[]>();
  private materials = new Map<string, MeshStandardMaterial>();
  private shapes = {
    box: new BoxGeometry(1, 1, 1),
    sphere: new SphereGeometry(0.5, 10, 8),
    cylinder: new CylinderGeometry(0.5, 0.5, 1, 10),
    cone: new ConeGeometry(0.5, 1, 8),
    rock: new DodecahedronGeometry(0.5, 0),
    roof: this.roof(),
  };
  private roof(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute(
        [
          -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0,
          1, 0.5,
        ],
        3,
      ),
    );
    g.setIndex([
      0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3,
    ]);
    g.computeVertexNormals();
    return g;
  }
  material(color: string): MeshStandardMaterial {
    let m = this.materials.get(color);
    if (!m) {
      m = new MeshStandardMaterial({
        color,
        roughness: 0.9,
        flatShading: true,
        metalness: color === "#9baaaa" ? 0.5 : 0,
      });
      this.materials.set(color, m);
    }
    return m;
  }
  get(type: string, color = "#73b0bd"): ModelPart[] {
    const key = type + color,
      old = this.cache.get(key);
    if (old) return old;
    const parts: ModelPart[] = [];
    const add = (
      shape: keyof typeof this.shapes,
      c: string,
      p: [number, number, number],
      s: [number, number, number],
      r: [number, number, number] = [0, 0, 0],
      motion?: ModelPart["motion"],
    ) =>
      parts.push({
        geometry: this.shapes[shape],
        material: this.material(c),
        position: p,
        scale: s,
        rotation: r,
        motion,
      });
    const box = (
      c: string,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
      motion?: ModelPart["motion"],
    ) => add("box", c, [x, y, z], [w, h, d], [0, 0, 0], motion);
    const flag = (x: number, z: number, h: number) => {
      box("#82633e", x, h / 2, z, 0.08, h, 0.08);
      box(color, x + 0.35, h - 0.25, z, 0.7, 0.45, 0.035, "flag");
    };
    if (type === "tree") {
      add("cylinder", "#6c5138", [0, 1.5, 0], [0.5, 3, 0.5]);
      for (let i = 0; i < 4; i++)
        add(
          "cone",
          ["#365844", "#416c4d", "#537c52", "#6b895b"][i],
          [0, 2.2 + i * 0.9, 0],
          [3 - i * 0.5, 3 - i * 0.3, 3 - i * 0.5],
        );
    } else if (type === "stone" || type === "ore") {
      for (let i = 0; i < 5; i++)
        add(
          "rock",
          type === "ore" ? (i % 2 ? "#ae8864" : "#717c75") : "#87968b",
          [
            ((i % 3) - 1) * 0.45,
            0.35 + (i % 2) * 0.25,
            (Math.floor(i / 3) - 0.5) * 0.7,
          ],
          [1.05, 0.8, 1.1],
          [0, i, 0.1],
        );
    } else if (type === "deer" || type === "horse") {
      const horse = type === "horse";
      box(
        horse ? "#99754e" : "#a6835c",
        0,
        horse ? 0.95 : 0.75,
        0,
        horse ? 0.65 : 0.42,
        horse ? 0.65 : 0.4,
        horse ? 1.7 : 1.1,
      );
      for (const x of [-0.23, 0.23])
        for (const z of [-0.55, 0.55])
          box("#5a4938", x, 0.4, z, 0.12, 0.8, 0.14, z < 0 ? "legL" : "legR");
      box("#ab875b", 0, 1.3, -0.6, 0.25, 0.6, 0.3);
      add("sphere", "#af8a61", [0, 1.65, -0.77], [0.4, 0.4, 0.62]);
      if (horse) {
        box(color, 0, 1.27, 0.05, 0.76, 0.18, 0.9);
        box("#4a4333", 0, 1.53, 0.08, 0.53, 0.28, 0.5);
      } else
        for (const x of [-0.16, 0.16])
          add(
            "cylinder",
            "#685741",
            [x, 1.93, -0.8],
            [0.05, 0.65, 0.05],
            [0, 0, x > 0 ? -0.3 : 0.3],
          );
    } else if (type === "hero" || type === "heroArmor") {
      const armor = type === "heroArmor";
      box("#473a2e", 0, 0.48, 0, 0.42, 0.78, 0.24);
      for (const x of [-0.12, 0.12]) {
        box("#554838", x, 0.48, 0, 0.18, 0.8, 0.24, x < 0 ? "legL" : "legR");
        box("#393a30", x, 0.13, -0.06, 0.23, 0.25, 0.39);
      }
      box(armor ? "#9baaaa" : "#725439", 0, 1.05, 0, 0.56, 0.6, 0.34);
      box(color, 0, 1.13, -0.186, 0.42, 0.36, 0.025);
      box("#4c3b2e", 0, 0.78, 0, 0.59, 0.1, 0.39);
      box("#c6b485", 0.06, 0.79, -0.21, 0.13, 0.14, 0.05);
      for (const side of [-1, 1]) {
        add("sphere", color, [side * 0.33, 1.3, 0], [0.29, 0.28, 0.3]);
        box("#896446", side * 0.34, 1.05, 0, 0.18, 0.5, 0.22, "arm");
        add("sphere", "#d3b58e", [side * 0.35, 0.76, 0], [0.2, 0.2, 0.22]);
      }
      add("sphere", "#d9bb95", [0, 1.56, 0], [0.42, 0.45, 0.39]);
      add(
        "sphere",
        armor ? "#9baaaa" : "#514333",
        [0, 1.73, 0],
        [0.45, 0.22, 0.41],
      );
      box("#574432", 0, 1.61, 0.16, 0.4, 0.22, 0.08);
      box("#b69a78", 0, 1.55, -0.205, 0.095, 0.12, 0.06);
      box("#5d4a38", 0, 1.43, -0.16, 0.26, 0.12, 0.1);
      for (const side of [-1, 1]) {
        add(
          "sphere",
          "#292d24",
          [side * 0.085, 1.59, -0.177],
          [0.042, 0.04, 0.025],
        );
        box("#66503b", side * 0.083, 1.635, -0.173, 0.075, 0.018, 0.025);
      }
      add("cylinder", "#a18b5e", [0, 1.44, 0], [0.25, 0.1, 0.25]);
      box("#b19664", 0.21, 1.03, 0.1, 0.07, 0.65, 0.08);
      box("#69573b", 0, 1.07, 0.2, 0.43, 0.44, 0.16);
    } else if (
      type === "sword" ||
      type === "spear" ||
      type === "bow" ||
      type === "crossbow"
    ) {
      const h = type === "spear" ? 2.4 : type === "sword" ? 1.1 : 0.8;
      box(
        type === "sword" ? "#9baaaa" : "#826541",
        0.38,
        0.92,
        -0.24,
        0.075,
        h,
        0.075,
        "weapon",
      );
      if (type === "spear")
        add("cone", "#9baaaa", [0.38, 2.2, -0.24], [0.15, 0.4, 0.15]);
      if (type === "sword")
        box("#d3b879", 0.38, 0.62, -0.24, 0.35, 0.075, 0.12);
      if (type === "bow")
        add(
          "cylinder",
          "#aa8557",
          [0.38, 1.05, -0.35],
          [0.05, 1.1, 0.05],
          [0.35, 0, 0],
          "weapon",
        );
      if (type === "crossbow")
        box("#9baaaa", 0.38, 1.13, -0.48, 0.7, 0.08, 0.14, "weapon");
    } else if (type === "bag") {
      add("sphere", "#9b8057", [0, 0.3, 0], [0.65, 0.6, 0.65]);
      box("#66503a", 0, 0.61, 0, 0.32, 0.12, 0.32);
    } else if (type === "trap") {
      box("#647271", 0, 0.05, 0, 0.85, 0.08, 0.8);
      for (const x of [-0.35, 0.35])
        for (let i = 0; i < 4; i++)
          add("cone", "#9baaaa", [x, 0.14, (i - 1.5) * 0.2], [0.08, 0.2, 0.08]);
    } else if (type === "catapult") {
      box("#866238", 0, 0.6, 0, 1.8, 0.28, 2.4);
      for (const x of [-1, 1])
        for (const z of [-0.8, 0.8])
          add(
            "cylinder",
            "#564532",
            [x, 0.4, z],
            [0.8, 0.18, 0.8],
            [0, 0, Math.PI / 2],
          );
      for (const x of [-0.6, 0.6])
        add("box", "#8b6c42", [x, 1.4, 0], [0.2, 2.3, 0.2], [0.28, 0, 0]);
      add(
        "box",
        "#b39b69",
        [0, 2.3, -0.1],
        [0.2, 0.2, 3.6],
        [0.4, 0, 0],
        "weapon",
      );
      box("#746c55", 0, 1.8, 1.1, 0.75, 0.8, 0.6);
      flag(0.75, 0.4, 2.6);
    } else if (type in BUILDINGS) {
      const d = BUILDINGS[type as keyof typeof BUILDINGS],
        n = d.size,
        h = d.height;
      box("#869482", 0, 0.1, 0, n, 0.2, n);
      if (type === "farm") {
        box("#715c3b", 0, 0.15, 0, n * 0.95, 0.1, n * 0.95);
        for (let i = 0; i < 7; i++) {
          box("#566d3e", (i - 3) * 0.48, 0.23, 0, 0.22, 0.09, 3.6);
          for (let j = 0; j < 5; j++)
            add(
              "cone",
              "#c8bb70",
              [(i - 3) * 0.48, 0.5, (j - 2) * 0.6],
              [0.12, 0.45, 0.12],
            );
        }
      } else if (type === "wall") {
        box("#a1a695", 0, 1.25, 0, n * 0.95, 2.5, n * 0.48);
        for (let i = 0; i < 5; i++)
          box("#c4c2ae", (i - 2) * 0.38, 2.65, 0, 0.25, 0.35, n * 0.51);
        for (let y = 0; y < 4; y++)
          box("#838e7d", 0, 0.35 + y * 0.56, 0.505, n, 0.025, 0.018);
      } else if (type === "gate") {
        for (const x of [-1.65, 1.65]) box("#a0a796", x, 1.6, 0, 0.7, 3.2, 1.2);
        box("#b7b8a1", 0, 2.9, 0, 4, 0.45, 1.2);
        box("#775435", 0, 1.25, 0, 2.7, 2.5, 0.3, "gate");
        flag(1.7, 0, 4);
      } else if (type === "tower") {
        box("#a5ad9b", 0, 2.7, 0, 2.3, 5.4, 2.3);
        box("#788876", 0, 0.25, 0, 2.7, 0.5, 2.7);
        box("#d4ceb1", 0, 5.25, 0, 3, 0.4, 3);
        for (const x of [-1.3, 0, 1.3])
          for (const z of [-1.3, 1.3]) box("#bec0a6", x, 5.7, z, 0.5, 0.6, 0.5);
        flag(0, 0, 7.1);
      } else {
        box("#c7b98f", 0, h * 0.39, 0, n * 0.83, h * 0.76, n * 0.8);
        for (const x of [-1, 1])
          for (const z of [-1, 1])
            box(
              "#79583a",
              x * n * 0.415,
              h * 0.4,
              z * n * 0.405,
              0.17,
              h * 0.8,
              0.18,
            );
        box("#6e5737", 0, 0.2, -n * 0.41, n * 0.86, 0.22, 0.16);
        add(
          "roof",
          "#915839",
          [0, h * 0.77, 0],
          [n * 0.99, h * 0.35, n * 0.99],
        );
        box("#393e32", 0, 0.7, n * 0.408, 0.7, 1.4, 0.045);
        for (const x of [-1, 1]) {
          box("#516e68", x * n * 0.25, h * 0.43, n * 0.408, 0.55, 0.65, 0.06);
          box("#957448", x * n * 0.25, h * 0.4, n * 0.449, 0.63, 0.035, 0.09);
        }
        flag(n * 0.25, 0, h * 1.28);
        if (type === "townhall") {
          box("#bbae88", n * 0.33, h * 0.82, 0, 1.1, 1.8, 1.1);
          add("roof", "#8e5134", [n * 0.33, h * 1.01, 0], [1.45, 1.0, 1.45]);
          for (let i = 0; i < 3; i++)
            box(
              "#93997e",
              0,
              0.16 + i * 0.08,
              -n * 0.45 - i * 0.2,
              1.5,
              0.2,
              0.5,
            );
        }
        if (type === "smithy") {
          box("#827d67", n * 0.3, h * 0.7, n * 0.25, 0.65, h, 0.65);
          box("#555e52", -n * 0.3, 0.7, -n * 0.55, 0.7, 0.4, 0.65);
        }
        if (type === "armory") {
          for (let i = 0; i < 4; i++)
            box("#a7986a", (i - 1.5) * 0.25, 0.9, -n * 0.5, 0.045, 1.8, 0.045);
        }
        if (type === "stable")
          for (const x of [-n * 0.35, n * 0.35])
            box("#80603d", x, 0.5, -n * 0.65, 0.1, 1, n * 0.4);
      }
    }
    this.cache.set(key, parts);
    return parts;
  }
  dispose(): void {
    for (const shape of Object.values(this.shapes)) shape.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.cache.clear();
  }
}
