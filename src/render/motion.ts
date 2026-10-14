import type { Vec3 } from "../game/types";
/** Visible motion is enough to animate wildlife; private AI destinations stay hidden. */
export function observedAnimalSpeed(
  previous: Vec3 | undefined,
  current: Vec3,
  seconds: number,
): number {
  if (!previous || seconds <= 0) return 0;
  const distance = Math.hypot(current.x - previous.x, current.z - previous.z);
  return distance > 5 ? 0 : Math.min(12, distance / seconds);
}
