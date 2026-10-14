import type { Vec3 } from "../game/types";
export interface MotionPose {
  id: number;
  pos: Vec3;
  yaw: number;
  snap?: boolean;
}
interface Track {
  from: MotionPose;
  to: MotionPose;
  started: number;
  duration: number;
}
/** Interpolate disclosed snapshots; never extrapolate unseen movement or smear a teleport. */
export class SnapshotMotion {
  private tracks = new Map<number, Track>();
  clear() {
    this.tracks.clear();
  }
  push(poses: MotionPose[], now: number, seconds: number) {
    const seen = new Set<number>();
    for (const pose of poses) {
      seen.add(pose.id);
      const prior = this.tracks.get(pose.id)?.to;
      const snap =
        pose.snap ||
        !prior ||
        seconds <= 0 ||
        Math.hypot(
          pose.pos.x - prior.pos.x,
          pose.pos.y - prior.pos.y,
          pose.pos.z - prior.pos.z,
        ) > 5;
      const target = { ...pose, pos: { ...pose.pos } };
      this.tracks.set(pose.id, {
        from: snap ? target : this.sample(pose.id, now)!,
        to: target,
        started: now,
        duration: snap ? 0 : Math.min(0.2, seconds) * 1000,
      });
    }
    for (const id of this.tracks.keys())
      if (!seen.has(id)) this.tracks.delete(id);
  }
  sample(id: number, now: number): MotionPose | undefined {
    const t = this.tracks.get(id);
    if (!t) return;
    const f =
      t.duration > 0
        ? Math.max(0, Math.min(1, (now - t.started) / t.duration))
        : 1;
    const angle = Math.atan2(
      Math.sin(t.to.yaw - t.from.yaw),
      Math.cos(t.to.yaw - t.from.yaw),
    );
    return {
      id,
      pos: {
        x: t.from.pos.x + (t.to.pos.x - t.from.pos.x) * f,
        y: t.from.pos.y + (t.to.pos.y - t.from.pos.y) * f,
        z: t.from.pos.z + (t.to.pos.z - t.from.pos.z) * f,
      },
      yaw: t.from.yaw + angle * f,
    };
  }
}
