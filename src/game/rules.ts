import type {
  GameRuntime,
  GameState,
  Player,
  CommandResult,
  Stock,
  Resource,
  Entity,
} from "./types";
import { BUILDINGS } from "./balance";
import { distance } from "./world";
export const ok = (): CommandResult => ({ ok: true });
export const fail = (message: string, code = "invalid"): CommandResult => ({
  ok: false,
  code,
  message,
});
export function actor(r: GameRuntime, id: number): Player | undefined {
  const p = r.state.players[id];
  return p &&
    !p.dead &&
    !p.eliminated &&
    r.state.factions[p.faction]?.alive &&
    !r.state.result
    ? p
    : undefined;
}
export function close(p: Player, e: Entity): boolean {
  return (
    distance(p.pos, e.pos) <
    (BUILDINGS[e.type as keyof typeof BUILDINGS]?.size ?? 1) / 2 + 2.8
  );
}
export function canReach(r: GameRuntime, p: Player, e: Entity): boolean {
  const origin = { ...p.pos, y: p.pos.y + 1.3 },
    point = { ...e.pos, y: e.pos.y + 0.7 },
    dx = point.x - origin.x,
    dy = point.y - origin.y,
    dz = point.z - origin.z,
    len = Math.hypot(dx, dy, dz);
  if (len < 0.1) return true;
  const hit = r.physics.raycast(
    origin,
    { x: dx / len, y: dy / len, z: dz / len },
    len,
    p.id,
    new Set(
      Object.values(r.state.entities)
        .filter((other) => other.type === "deer" && other.id !== e.id)
        .map((other) => other.id),
    ),
  );
  return !hit || hit.entityId === e.id;
}
export function pay(stock: Stock, cost: Partial<Stock>): boolean {
  if (
    Object.entries(cost).some(
      ([k, v]) => !Number.isFinite(v) || v! < 0 || stock[k as Resource] < v!,
    )
  )
    return false;
  for (const [k, v] of Object.entries(cost)) stock[k as Resource] -= v!;
  return true;
}
export function event(
  s: GameState,
  text: string,
  kind: "info" | "attack" | "death" | "complete" | "error" = "info",
  faction?: number,
  pos?: Entity["pos"],
): void {
  s.events.push({ id: s.nextEvent++, tick: s.tick, kind, text, faction, pos });
  if (s.events.length > 64) s.events.splice(0, s.events.length - 64);
}
export function station(
  r: GameRuntime,
  id: number,
  target: number,
): { p: Player; e: Entity } | undefined {
  const p = actor(r, id),
    e = r.state.entities[target];
  return p &&
    e &&
    e.faction === p.faction &&
    e.hp > 0 &&
    e.progress === 1 &&
    close(p, e) &&
    canReach(r, p, e)
    ? { p, e }
    : undefined;
}
