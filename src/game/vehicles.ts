import type { GameRuntime, CommandResult } from "./types";
import { actor, fail, ok } from "./rules";
import { distance, ground } from "./world";
export function enterVehicle(
  r: GameRuntime,
  id: number,
  target: number,
): CommandResult {
  const p = actor(r, id),
    e = r.state.entities[target];
  if (
    !p ||
    !e ||
    !["horse", "catapult"].includes(e.type) ||
    e.owner !== id ||
    e.faction !== p.faction ||
    e.hp <= 0 ||
    distance(p.pos, e.pos) > 3
  )
    return fail("Approach your own horse or catapult.");
  if (e.occupant && e.occupant !== id) return fail("That vehicle is occupied.");
  e.occupant = id;
  p.vehicleId = e.id;
  p.action = undefined;
  r.physics.removeEntity(e.id);
  if (e.type === "catapult") r.physics.addVehicle(e);
  if (e.type === "horse") {
    r.physics.removeEntity(id);
    r.physics.addCharacter(id, p.pos, 0.65);
    e.speed = 0;
  }
  return ok();
}
export function leaveVehicle(r: GameRuntime, id: number): CommandResult {
  const p = r.state.players[id],
    e = r.state.entities[p?.vehicleId ?? -1];
  if (!p || !e || e.occupant !== id)
    return fail("You are not operating a vehicle.");
  const pos = {
    x: e.pos.x + 1.8,
    y: ground(r.state, e.pos.x + 1.8, e.pos.z),
    z: e.pos.z,
  };
  if (
    pos.x < 1 ||
    pos.z < 1 ||
    pos.x > r.state.size - 1 ||
    pos.z > r.state.size - 1
  )
    return fail("Move away from the map edge before dismounting.");
  const hit = r.physics.raycast(
    { x: pos.x, y: pos.y + 1, z: pos.z },
    { x: 0, y: -1, z: 0 },
    1.2,
    p.id,
  );
  if (hit?.entityId) return fail("Find clear ground before dismounting.");
  e.occupant = undefined;
  p.pos = pos;
  r.physics.removeEntity(id);
  r.physics.addCharacter(id, pos);
  r.physics.removeEntity(e.id);
  r.physics.addEntity(e);
  return ok();
}
export function updateVehicles(r: GameRuntime): void {
  for (const p of Object.values(r.state.players))
    if (p.vehicleId && !r.state.entities[p.vehicleId]) p.vehicleId = undefined;
}
