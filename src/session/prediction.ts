import type { PlayerView, InputFrame, Vec3 } from "../game/types";
import { BUILDINGS } from "../game/balance";
import { footSpeed } from "../game/aim";
/** Predict only movement against disclosed scenery. All actions remain authoritative. */
export class Prediction {
  private view?: PlayerView;
  private pending: InputFrame[] = [];
  position?: Vec3;
  private vertical = 0;
  private horseSpeed = 0;
  private horseYaw = 0;
  private siegePosition?: Vec3;
  get pendingCount(): number {
    return this.pending.length;
  }
  reset(): void {
    this.pending = [];
    this.view = undefined;
    this.position = undefined;
    this.vertical = 0;
  }
  accept(view: PlayerView): void {
    this.view = view;
    this.pending = this.pending.filter((i) => i.seq > view.ack);
    const p = view.players.find((p) => p.id === view.playerId);
    this.position = p ? { ...p.pos } : undefined;
    this.vertical = p?.vel.y ?? 0;
    const vehicle = view.entities.find(
      (e) => e.id === p?.vehicleId && e.occupant === p?.id,
    );
    this.horseSpeed = vehicle?.speed ?? 0;
    this.horseYaw = vehicle?.yaw ?? 0;
    this.siegePosition =
      vehicle?.type === "catapult" ? { ...vehicle.pos } : undefined;
    for (const input of this.pending) this.move(input);
  }
  record(input: InputFrame): void {
    if (!this.view) return;
    this.pending.push(structuredClone(input));
    if (this.pending.length > 90) this.pending.shift();
    this.move(input);
  }
  private floor(x: number, z: number): number {
    const v = this.view!,
      n = v.size,
      ix = Math.max(0, Math.min(n - 1, Math.floor(x))),
      iz = Math.max(0, Math.min(n - 1, Math.floor(z))),
      fx = Math.max(0, Math.min(1, x - ix)),
      fz = Math.max(0, Math.min(1, z - iz)),
      h = v.heights;
    return (
      h[iz * (n + 1) + ix] * (1 - fx) * (1 - fz) +
      h[iz * (n + 1) + ix + 1] * fx * (1 - fz) +
      h[(iz + 1) * (n + 1) + ix] * (1 - fx) * fz +
      h[(iz + 1) * (n + 1) + ix + 1] * fx * fz
    );
  }
  private clear(x: number, z: number, padding = 0.35): boolean {
    const v = this.view!,
      p = v.players.find((p) => p.id === v.playerId)!;
    if (x < 1 || z < 1 || x > v.size - 1 || z > v.size - 1) return false;
    return !v.entities.some((e) => {
      if (
        e.ghost ||
        e.hp <= 0 ||
        (e.type === "gate" && !e.gateLocked && e.faction === p.faction)
      )
        return false;
      const b = BUILDINGS[e.type as keyof typeof BUILDINGS];
      if (b && e.type !== "farm")
        return (
          Math.abs(x - e.pos.x) < b.size / 2 + padding &&
          Math.abs(z - e.pos.z) < b.size / 2 + padding
        );
      const radius =
        e.type === "tree"
          ? 0.67
          : e.type === "stone" || e.type === "ore"
            ? 1
            : e.type === "horse" || e.type === "catapult"
              ? 1.1
              : 0;
      return (
        radius > 0 &&
        e.id !== p.vehicleId &&
        Math.hypot(x - e.pos.x, z - e.pos.z) < radius
      );
    });
  }
  private move(i: InputFrame): void {
    const v = this.view,
      p = v?.players.find((p) => p.id === v.playerId),
      pos = this.position;
    if (!v || !p || !pos || p.dead || p.eliminated || v.paused || v.result)
      return;
    const vehicle = v.entities.find(
      (e) => e.id === p.vehicleId && e.occupant === p.id,
    );
    if (vehicle?.type === "catapult" && this.siegePosition) {
      const center = this.siegePosition,
        magnitude = Math.min(1, Math.hypot(i.move.x, i.move.z)),
        angle = Math.atan2(i.move.x, -i.move.z) + i.yaw;
      const turn = Math.atan2(
        Math.sin(angle - this.horseYaw),
        Math.cos(angle - this.horseYaw),
      );
      if (magnitude > 0.05)
        this.horseYaw += Math.max(-1.2 / 30, Math.min(1.2 / 30, turn));
      const speed =
          1.4 * magnitude * (v.tick < (p.trappedUntil ?? 0) ? 0.15 : 1),
        x = center.x + (Math.sin(this.horseYaw) * speed) / 30,
        z = center.z - (Math.cos(this.horseYaw) * speed) / 30;
      if (this.clear(x, z, 0.95)) {
        center.x = x;
        center.z = z;
        center.y = this.floor(x, z);
      }
      pos.x = center.x - Math.sin(this.horseYaw) * 1.6;
      pos.z = center.z + Math.cos(this.horseYaw) * 1.6;
      pos.y = center.y;
      return;
    }
    const len = Math.max(1, Math.hypot(i.move.x, i.move.z));
    let speed =
        (vehicle?.type === "horse" ? 8.5 : footSpeed(i)) *
        (v.tick < (p.trappedUntil ?? 0) ? 0.15 : 1),
      dx =
        ((i.move.x * Math.cos(i.yaw) - i.move.z * Math.sin(i.yaw)) * speed) /
        30 /
        len,
      dz =
        ((i.move.x * Math.sin(i.yaw) + i.move.z * Math.cos(i.yaw)) * speed) /
        30 /
        len;
    if (vehicle?.type === "horse") {
      const magnitude = Math.min(1, Math.hypot(i.move.x, i.move.z)),
        target = 8.5 * magnitude,
        accel = target > this.horseSpeed ? 4 : 8;
      this.horseSpeed += Math.max(
        -accel / 30,
        Math.min(accel / 30, target - this.horseSpeed),
      );
      const angle =
          magnitude > 0.05
            ? Math.atan2(i.move.x, -i.move.z) + i.yaw
            : this.horseYaw,
        delta = Math.atan2(
          Math.sin(angle - this.horseYaw),
          Math.cos(angle - this.horseYaw),
        );
      this.horseYaw += Math.max(-2.6 / 30, Math.min(2.6 / 30, delta));
      speed = this.horseSpeed * (v.tick < (p.trappedUntil ?? 0) ? 0.15 : 1);
      dx = (Math.sin(this.horseYaw) * speed) / 30;
      dz = (-Math.cos(this.horseYaw) * speed) / 30;
    }
    if (this.clear(pos.x + dx, pos.z)) pos.x += dx;
    if (this.clear(pos.x, pos.z + dz)) pos.z += dz;
    const floor = this.floor(pos.x, pos.z);
    if (i.jump && pos.y <= floor + 0.08) this.vertical = 5.2;
    this.vertical -= 9.81 / 30;
    pos.y = Math.max(floor, pos.y + this.vertical / 30);
    if (pos.y === floor) this.vertical = 0;
  }
}
