import {
  Scene,
  InstancedMesh,
  Matrix4,
  Object3D,
  Color,
  DynamicDrawUsage,
} from "three";
import type { ModelPart } from "./models";
interface Batch {
  mesh: InstancedMesh;
  capacity: number;
  count: number;
  part: ModelPart;
  ids: number[];
  colors: number[];
  colorDirty: boolean;
  matrixDirty: boolean;
}
export class ModelBatches {
  private batches = new Map<string, Batch>();
  private local = new Object3D();
  private world = new Matrix4();
  private tint = new Color();
  private transforms = new WeakMap<ModelPart, Matrix4>();
  private keys = new WeakMap<ModelPart, string>();
  private colors = new Map<number, Color>();
  constructor(private scene: Scene) {}
  begin(): void {
    for (const b of this.batches.values()) {
      b.count = 0;
      b.colorDirty = false;
      b.matrixDirty = false;
    }
  }
  add(
    part: ModelPart,
    root: Matrix4,
    tint: number,
    time: number,
    walk: number,
    work: boolean,
    attack: boolean,
    gateOpen: boolean,
    entityId = 0,
  ): void {
    let key = this.keys.get(part);
    if (!key) {
      key = `${part.geometry.uuid}:${part.material.uuid}`;
      this.keys.set(part, key);
    }
    let b = this.batches.get(key);
    if (!b || b.count === b.capacity) {
      const capacity = b ? b.capacity * 2 : 16,
        mesh = new InstancedMesh(part.geometry, part.material, capacity);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      if (b) {
        for (let i = 0; i < b.count; i++) {
          b.mesh.getMatrixAt(i, this.world);
          mesh.setMatrixAt(i, this.world);
          b.mesh.getColorAt(i, this.tint);
          mesh.setColorAt(i, this.tint);
        }
        this.scene.remove(b.mesh);
        b.mesh.dispose();
      }
      const next = {
        mesh,
        capacity,
        count: b?.count ?? 0,
        part,
        ids: b?.ids ?? [],
        colors: b?.colors ?? [],
        colorDirty: true,
        matrixDirty: true,
      };
      this.scene.add(mesh);
      this.batches.set(key, next);
      b = next;
    }
    let transform = this.transforms.get(part);
    if (!transform) {
      this.local.position.fromArray(part.position);
      this.local.scale.fromArray(part.scale);
      this.local.rotation.set(...part.rotation);
      this.local.updateMatrix();
      transform = this.local.matrix.clone();
      this.transforms.set(part, transform);
    }
    const animate =
      part.motion === "flag" ||
      (part.motion === "gate" && gateOpen) ||
      (part.motion === "weapon" && (attack || work)) ||
      ((part.motion === "legL" || part.motion === "legR") && walk > 0) ||
      (part.motion === "arm" && (walk > 0 || work || attack));
    if (animate) {
      this.local.position.fromArray(part.position);
      this.local.scale.fromArray(part.scale);
      this.local.rotation.set(...part.rotation);
      if (part.motion === "legL" || part.motion === "legR")
        this.local.rotation.x +=
          Math.sin(time + (part.motion === "legL" ? 0 : Math.PI)) * 0.55 * walk;
      if (part.motion === "arm")
        this.local.rotation.x +=
          Math.sin(time + (part.position[0] > 0 ? 0 : Math.PI)) *
          (work || attack ? 0.7 : 0.32 * walk);
      if (part.motion === "weapon" && (attack || work))
        this.local.rotation.x += Math.sin(time * 1.3) * 0.5;
      if (part.motion === "flag")
        this.local.rotation.y += Math.sin(time * 0.22) * 0.12;
      if (part.motion === "gate" && gateOpen) this.local.position.y += 1.5;
      this.local.updateMatrix();
      transform = this.local.matrix;
    }
    this.world.multiplyMatrices(root, transform);
    const matrix = b.mesh.instanceMatrix.array;
    let changed = false;
    for (let i = 0; i < 16; i++)
      if (matrix[b.count * 16 + i] !== Math.fround(this.world.elements[i])) {
        changed = true;
        break;
      }
    if (changed) {
      b.mesh.setMatrixAt(b.count, this.world);
      b.matrixDirty = true;
    }
    if (b.colors[b.count] !== tint) {
      let color = this.colors.get(tint);
      if (!color) {
        color = new Color(tint);
        this.colors.set(tint, color);
      }
      b.mesh.setColorAt(b.count, color);
      b.colors[b.count] = tint;
      b.colorDirty = true;
    }
    b.ids[b.count] = entityId;
    b.count++;
  }
  end(): void {
    for (const b of this.batches.values()) {
      b.mesh.count = b.count;
      b.mesh.visible = b.count > 0;
      if (b.count) {
        if (b.matrixDirty) b.mesh.instanceMatrix.needsUpdate = true;
        if (b.colorDirty && b.mesh.instanceColor)
          b.mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  dispose(): void {
    for (const b of this.batches.values()) {
      this.scene.remove(b.mesh);
      b.mesh.dispose();
    }
    this.batches.clear();
  }
  pick(ray: import("three").Raycaster): number | undefined {
    const meshes: InstancedMesh[] = [];
    for (const b of this.batches.values())
      if (b.count) {
        b.mesh.computeBoundingSphere();
        b.mesh.updateMatrixWorld();
        meshes.push(b.mesh);
      }
    for (const hit of ray.intersectObjects(meshes, false)) {
      if (hit.instanceId === undefined) continue;
      for (const b of this.batches.values())
        if (b.mesh === hit.object) return b.ids[hit.instanceId];
    }
    return undefined;
  }
  drawCalls(): number {
    return [...this.batches.values()].filter((b) => b.count > 0).length;
  }
}
