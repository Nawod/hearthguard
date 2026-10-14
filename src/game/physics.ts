import RAPIER from "@dimforge/rapier3d-compat";
import type { Vec3, Entity, GameState } from "./types";
import { BUILDINGS } from "./balance";
let initialization: Promise<void> | undefined;
export class PhysicsPort {
  readonly world: RAPIER.World;
  private bodies = new Map<number, RAPIER.RigidBody>();
  private colliders = new Map<number, RAPIER.Collider>();
  private controller: RAPIER.KinematicCharacterController;
  private colliderIds = new Map<number, number>();
  private constructor(
    state: GameState,
    bytes?: number[],
    handles?: { bodies: [number, number][]; colliders: [number, number][] },
  ) {
    this.world = bytes
      ? RAPIER.World.restoreSnapshot(new Uint8Array(bytes))
      : new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.controller = this.world.createCharacterController(0.025);
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.35, 0.2, true);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle(0.65);
    if (bytes && handles) {
      for (const [id, h] of handles.bodies) {
        const body = this.world.getRigidBody(h);
        if (body) this.bodies.set(id, body);
      }
      for (const [id, h] of handles.colliders) {
        const col = this.world.getCollider(h);
        if (col) {
          this.colliders.set(id, col);
          this.colliderIds.set(h, id);
        }
      }
      if (
        Object.values(state.players).some(
          (p) =>
            !p.dead &&
            !p.eliminated &&
            (!this.bodies.has(p.id) || !this.colliders.has(p.id)),
        )
      ) {
        this.world.free();
        throw new Error("The character physics handles are incomplete.");
      }
      return;
    }
    const n = state.size,
      heights = new Float32Array((n + 1) * (n + 1));
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++)
        heights[x * (n + 1) + z] = state.heights[z * (n + 1) + x];
    this.world.createCollider(
      RAPIER.ColliderDesc.heightfield(n, n, heights, {
        x: n,
        y: 1,
        z: n,
      }).setTranslation(n / 2, 0, n / 2),
    );
    for (const e of Object.values(state.entities)) this.addEntity(e);
    for (const p of Object.values(state.players))
      if (!p.dead && !p.eliminated) this.addCharacter(p.id, p.pos);
    this.world.step();
  }
  static async create(
    state: GameState,
    bytes?: number[],
    handles?: { bodies: [number, number][]; colliders: [number, number][] },
  ): Promise<PhysicsPort> {
    initialization ??= RAPIER.init().catch(() => {
      initialization = undefined;
      throw new Error(
        "Physics could not start. Enable WebAssembly and reload Hearthguard.",
      );
    });
    await initialization;
    return new PhysicsPort(state, bytes, handles);
  }
  addCharacter(id: number, pos: Vec3, radius = 0.32): void {
    if (this.bodies.has(id)) return;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        pos.x,
        pos.y + 0.9,
        pos.z,
      ),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, radius),
      body,
    );
    this.bodies.set(id, body);
    this.colliders.set(id, collider);
    this.colliderIds.set(collider.handle, id);
  }
  addVehicle(e: Entity): void {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        e.pos.x,
        e.pos.y + 0.6,
        e.pos.z,
      ),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.6, 0.95),
      body,
    );
    this.bodies.set(e.id, body);
    this.colliders.set(e.id, collider);
    this.colliderIds.set(collider.handle, e.id);
  }
  isClear(pos: Vec3, ignoreIds: ReadonlySet<number> = new Set()): boolean {
    let clear = true;
    this.world.intersectionsWithShape(
      { x: pos.x, y: pos.y + 0.9, z: pos.z },
      { x: 0, y: 0, z: 0, w: 1 },
      new RAPIER.Capsule(0.55, 0.35),
      () => {
        clear = false;
        return false;
      },
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      undefined,
      (c) =>
        this.colliderIds.has(c.handle) &&
        !ignoreIds.has(this.colliderIds.get(c.handle)!),
    );
    return clear;
  }
  addEntity(e: Entity): void {
    if (
      this.colliders.has(e.id) ||
      e.hp <= 0 ||
      e.type === "farm" ||
      e.type === "bag" ||
      e.type === "trap"
    )
      return;
    const def = BUILDINGS[e.type as keyof typeof BUILDINGS],
      radius =
        e.type === "tree"
          ? 0.32
          : e.type === "stone" || e.type === "ore"
            ? 0.65
            : e.type === "horse"
              ? 0.6
              : 0.95,
      height = def?.height ?? (e.type === "tree" ? 4 : 1.2);
    const desc = (
      def
        ? RAPIER.ColliderDesc.cuboid(def.size / 2, height / 2, def.size / 2)
        : RAPIER.ColliderDesc.cylinder(height / 2, radius)
    )
      .setSensor(e.type === "deer")
      .setTranslation(e.pos.x, e.pos.y + height / 2, e.pos.z)
      .setRotation({
        x: 0,
        y: Math.sin(e.yaw / 2),
        z: 0,
        w: Math.cos(e.yaw / 2),
      });
    const collider = this.world.createCollider(desc);
    this.colliders.set(e.id, collider);
    this.colliderIds.set(collider.handle, e.id);
  }
  updateEntity(e: Entity): void {
    this.colliders
      .get(e.id)
      ?.setTranslation({ x: e.pos.x, y: e.pos.y + 0.6, z: e.pos.z });
  }
  setGate(id: number, open: boolean): void {
    this.colliders.get(id)?.setEnabled(!open);
  }
  removeEntity(id: number): void {
    const body = this.bodies.get(id),
      col = this.colliders.get(id);
    if (col) this.colliderIds.delete(col.handle);
    if (body) {
      this.world.removeRigidBody(body);
      this.bodies.delete(id);
    } else if (col) this.world.removeCollider(col, true);
    this.colliders.delete(id);
  }
  position(id: number): Vec3 {
    const p = this.bodies.get(id)?.translation();
    return p ? { x: p.x, y: p.y - 0.9, z: p.z } : { x: 0, y: 0, z: 0 };
  }
  teleport(id: number, p: Vec3): void {
    this.bodies.get(id)?.setTranslation({ x: p.x, y: p.y + 0.9, z: p.z }, true);
  }
  moveCharacter(
    id: number,
    desired: Vec3,
    ignoreIds: ReadonlySet<number> = new Set(),
    offset = 0.9,
  ): { position: Vec3; grounded: boolean } {
    const body = this.bodies.get(id),
      col = this.colliders.get(id);
    if (!body || !col) return { position: this.position(id), grounded: false };
    this.controller.computeColliderMovement(
      col,
      desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      (c) => !ignoreIds.has(this.colliderIds.get(c.handle) ?? -1),
    );
    const d = this.controller.computedMovement(),
      p = body.translation();
    body.setNextKinematicTranslation({
      x: p.x + d.x,
      y: p.y + d.y,
      z: p.z + d.z,
    });
    return {
      position: { x: p.x + d.x, y: p.y + d.y - offset, z: p.z + d.z },
      grounded: this.controller.computedGrounded(),
    };
  }
  raycast(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
    ignoreId?: number,
    ignoreIds: ReadonlySet<number> = new Set(),
  ): { entityId?: number; point: Vec3 } | null {
    const hit = this.world.castRay(
      new RAPIER.Ray(origin, direction),
      maxDistance,
      true,
      undefined,
      undefined,
      this.colliders.get(ignoreId ?? -1),
      undefined,
      (c) => !ignoreIds.has(this.colliderIds.get(c.handle) ?? -1),
    );
    return hit
      ? {
          entityId: this.colliderIds.get(hit.collider.handle),
          point: {
            x: origin.x + direction.x * hit.timeOfImpact,
            y: origin.y + direction.y * hit.timeOfImpact,
            z: origin.z + direction.z * hit.timeOfImpact,
          },
        }
      : null;
  }
  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }
  handles(): { bodies: [number, number][]; colliders: [number, number][] } {
    return {
      bodies: [...this.bodies].map(([id, b]) => [id, b.handle]),
      colliders: [...this.colliders].map(([id, c]) => [id, c.handle]),
    };
  }
  serialize(): Uint8Array {
    return this.world.takeSnapshot();
  }
  dispose(): void {
    this.world.free();
    this.bodies.clear();
    this.colliders.clear();
    this.colliderIds.clear();
  }
}
