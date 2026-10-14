import type { InputFrame, Player, Vec3 } from "./types";
import { COMBAT } from "./balance";

export function lookDirection(yaw: number, pitch: number): Vec3 {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export function footSpeed(input: InputFrame): number {
  return input.aim ? COMBAT.aimMoveSpeed : input.sprint ? 5.8 : 3.8;
}
export function validAimOrigin(origin: Vec3 | undefined, pos: Vec3): boolean {
  return (
    !!origin &&
    [origin.x, origin.y, origin.z].every(Number.isFinite) &&
    Math.hypot(origin.x - pos.x, origin.y - (pos.y + 1.25), origin.z - pos.z) <=
      COMBAT.maxCameraDistance
  );
}
export function combatState(p: Player): NonNullable<Player["combat"]> {
  return (p.combat ??= {
    weapon: p.weapons[p.slot],
    focus: 0,
    triggerHeld: false,
    lastHitTick: -100,
  });
}
/** Lower ballistic arc. The authority still sweeps every projectile step for collisions. */
export function ballisticVelocity(from: Vec3, to: Vec3, speed: number): Vec3 {
  const dx = to.x - from.x,
    dz = to.z - from.z,
    dy = to.y - from.y,
    d = Math.hypot(dx, dz),
    g = 9.81;
  const disc = speed ** 4 - g * (g * d * d + 2 * dy * speed * speed);
  if (d > 0.01 && disc >= 0) {
    const tangent = (speed * speed - Math.sqrt(disc)) / (g * d),
      horizontal = speed / Math.sqrt(1 + tangent * tangent);
    return {
      x: (dx / d) * horizontal,
      y: horizontal * tangent,
      z: (dz / d) * horizontal,
    };
  }
  const len = Math.max(0.001, Math.hypot(dx, dy, dz));
  return {
    x: (dx / len) * speed,
    y: (dy / len) * speed,
    z: (dz / len) * speed,
  };
}
