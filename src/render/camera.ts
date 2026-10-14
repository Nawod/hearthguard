import { PerspectiveCamera, Vector3, Ray, Box3 } from "three";
import type { PlayerView, Player, Vec3 } from "../game/types";
import { BUILDINGS } from "../game/balance";
import { lookDirection } from "../game/aim";
export class FollowCamera {
  distanceOverride?: number;
  readonly camera = new PerspectiveCamera(58, 1, 0.08, 220);
  private ray = new Ray();
  private box = new Box3();
  private point = new Vector3();
  private current = new Vector3();
  private ready = false;
  reset(): void {
    this.ready = false;
  }
  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  update(
    p: Player,
    view: PlayerView,
    yaw: number,
    pitch: number,
    dt: number,
  ): void {
    const rangedAim =
        p.input.aim && ["bow", "crossbow"].includes(p.weapons?.[p.slot] ?? ""),
      distance = this.distanceOverride ?? (rangedAim ? 3 : 5.5),
      center = new Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z),
      look = lookDirection(yaw, pitch),
      offset = rangedAim
        ? new Vector3(
            -look.x * distance + Math.cos(yaw) * 0.65,
            -look.y * distance + 0.2,
            -look.z * distance + Math.sin(yaw) * 0.65,
          )
        : new Vector3(
            -Math.sin(yaw) * distance + Math.cos(yaw) * 0.65,
            2.1 + pitch * 2,
            Math.cos(yaw) * distance + Math.sin(yaw) * 0.65,
          ),
      desired = center.clone().add(offset),
      direction = desired.clone().sub(center),
      length = direction.length();
    this.ray.set(center, direction.normalize());
    let limit = length;
    for (const e of view.entities) {
      const d =
        BUILDINGS[e.type as keyof typeof BUILDINGS] ??
        (e.type === "tree" ? { size: 2.6, height: 6 } : undefined);
      if (!d || e.hp <= 0 || e.ghost) continue;
      const reach = length + d.size + 1;
      if ((e.pos.x - center.x) ** 2 + (e.pos.z - center.z) ** 2 > reach * reach)
        continue;
      this.box.min.set(
        e.pos.x - d.size / 2 - 0.15,
        e.pos.y - 0.2,
        e.pos.z - d.size / 2 - 0.15,
      );
      this.box.max.set(
        e.pos.x + d.size / 2 + 0.15,
        e.pos.y + d.height + 1,
        e.pos.z + d.size / 2 + 0.15,
      );
      if (this.ray.intersectBox(this.box, this.point)) {
        const hit = center.distanceTo(this.point);
        if (hit < limit) limit = Math.max(0.7, hit - 0.2);
      }
    }
    desired.copy(center).addScaledVector(direction, limit);
    const ground = (x: number, z: number) => {
      const n = view.size,
        xx = Math.max(0, Math.min(n, Math.round(x))),
        zz = Math.max(0, Math.min(n, Math.round(z)));
      return view.heights[zz * (n + 1) + xx] ?? 0;
    };
    desired.y = Math.max(desired.y, ground(desired.x, desired.z) + 0.35);
    if (!this.ready) {
      this.current.copy(desired);
      this.ready = true;
    }
    this.current.lerp(desired, 1 - Math.exp(-dt * 18));
    this.current.y = Math.max(
      this.current.y,
      ground(this.current.x, this.current.z) + 0.35,
    );
    this.camera.position.copy(this.current);
    const fov =
      this.camera.fov +
      ((rangedAim ? 48 : 58) - this.camera.fov) * (1 - Math.exp(-dt * 12));
    if (Math.abs(fov - this.camera.fov) > 0.001) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    if (rangedAim)
      this.camera.lookAt(
        this.current.x + look.x * 60,
        this.current.y + look.y * 60,
        this.current.z + look.z * 60,
      );
    else
      this.camera.lookAt(
        center.x + Math.sin(yaw) * 8,
        center.y - Math.sin(pitch) * 8,
        center.z - Math.cos(yaw) * 8,
      );
    this.camera.updateMatrixWorld();
  }
  project(p: Vec3): { x: number; y: number; z: number } {
    const v = this.point.set(p.x, p.y, p.z).project(this.camera);
    return { x: v.x, y: v.y, z: v.z };
  }
}

export function cameraSubject(view: PlayerView, predicted?: Vec3): Player {
  const self =
    view.players.find((p) => p.id === view.playerId) ?? view.players[0];
  const target = self.eliminated
    ? (view.players.find(
        (p) => p.faction === self.faction && !p.dead && !p.eliminated,
      ) ?? self)
    : self;
  return {
    ...target,
    pos:
      target.id === self.id && !self.dead && !self.eliminated
        ? (predicted ?? target.pos)
        : target.pos,
  };
}
