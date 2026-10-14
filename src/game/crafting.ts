import type { GameRuntime, CommandResult, Ammo, Weapon } from "./types";
import { RECIPES } from "./balance";
import { station, pay, ok, fail, event } from "./rules";
import { spawn, ground } from "./world";
import { BUILDINGS } from "./balance";
import type { Vec3, Entity } from "./types";
function vehicleSpawn(r: GameRuntime, station: Entity): Vec3 | undefined {
  for (const radius of [
    BUILDINGS[station.type as keyof typeof BUILDINGS].size / 2 + 2,
    7,
    9,
  ])
    for (let i = 0; i < 12; i++) {
      const angle = station.yaw + (i * Math.PI) / 6,
        pos = {
          x: station.pos.x + Math.sin(angle) * radius,
          y: 0,
          z: station.pos.z + Math.cos(angle) * radius,
        };
      if (
        pos.x < 2 ||
        pos.z < 2 ||
        pos.x > r.state.size - 2 ||
        pos.z > r.state.size - 2
      )
        continue;
      if (
        Object.values(r.state.players).some(
          (p) => !p.dead && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) < 1.5,
        )
      )
        continue;
      if (
        Object.values(r.state.entities).some((e) => {
          const d = BUILDINGS[e.type as keyof typeof BUILDINGS];
          return (
            e.hp > 0 &&
            (d
              ? Math.abs(pos.x - e.pos.x) < d.size / 2 + 1.2 &&
                Math.abs(pos.z - e.pos.z) < d.size / 2 + 1.2
              : !["deer", "bag", "trap"].includes(e.type) &&
                Math.hypot(pos.x - e.pos.x, pos.z - e.pos.z) < 1.8)
          );
        })
      )
        continue;
      pos.y = ground(r.state, pos.x, pos.z);
      return pos;
    }
}
export function consumeAmmo(
  r: GameRuntime,
  id: number,
  kind: Ammo,
): CommandResult {
  const p = r.state.players[id];
  if (!p) return fail("Unknown player.");
  if (r.state.config.difficulty !== "hard") return ok();
  if (p.ammo[kind] < 1)
    return fail("Craft ammunition at your workshop.", "ammo");
  p.ammo[kind]--;
  return ok();
}
export function reserveRecipe(
  r: GameRuntime,
  id: number,
  target: number,
  recipe: string,
): CommandResult {
  const pair = station(r, id, target),
    d = RECIPES[recipe],
    s = r.state;
  if (!pair || !d || d.station !== pair.e.type)
    return fail("Use the appropriate nearby friendly workshop.");
  if (pair.e.queue.length >= 4) return fail("This workshop queue is full.");
  if (d.ammo && s.config.difficulty !== "hard")
    return fail("Ammunition is unlimited at this difficulty.");
  if (
    d.upgrade &&
    (pair.p[d.upgrade] >= 1 ||
      Object.values(s.entities).some((e) =>
        e.queue.some(
          (q) => q.actor === id && RECIPES[q.recipe]?.upgrade === d.upgrade,
        ),
      ))
  )
    return fail("That upgrade is already equipped.");
  if (
    d.vehicle &&
    (pair.p.vehicleId ||
      Object.values(s.entities).some((e) =>
        e.queue.some((q) => q.actor === id && RECIPES[q.recipe].vehicle),
      ))
  )
    return fail("You already own or are crafting a vehicle.");
  if (!pay(s.factions[pair.p.faction].stock, d.cost))
    return fail("Deposit the required materials first.");
  pair.e.queue.push({ recipe, actor: id, remaining: d.seconds, cost: d.cost });
  return ok();
}
export function equipWeapon(
  r: GameRuntime,
  id: number,
  target: number,
  weapon: Weapon,
  slot: 0 | 1,
): CommandResult {
  const pair = station(r, id, target);
  if (!pair || !["armory", "smithy", "storage"].includes(pair.e.type))
    return fail("Use a nearby friendly armory.");
  if (slot !== 0 && slot !== 1) return fail("Choose a weapon slot.");
  const index = pair.e.equipment.indexOf(weapon);
  if (index < 0) return fail("Craft that weapon first.");
  if (pair.p.weapons[slot === 0 ? 1 : 0] === weapon)
    return fail("Choose two distinct weapon categories.");
  const old = pair.p.weapons[slot];
  if (old) pair.e.equipment.push(old);
  pair.e.equipment.splice(index, 1);
  pair.p.weapons[slot] = weapon;
  return ok();
}
export function updateCrafting(r: GameRuntime, dt: number): void {
  const s = r.state;
  for (const e of Object.values(s.entities)) {
    if (
      e.hp <= 0 ||
      e.progress < 1 ||
      !s.factions[e.faction]?.alive ||
      !e.queue.length
    )
      continue;
    const job = e.queue[0],
      p = s.players[job.actor];
    job.remaining -= dt;
    if (job.remaining > 0) continue;
    const d = RECIPES[job.recipe];
    const spawnPosition = d.vehicle ? vehicleSpawn(r, e) : undefined;
    if (d.vehicle && !spawnPosition) {
      job.remaining = 0;
      continue;
    }
    if (!p || p.eliminated) {
      e.queue.shift();
      continue;
    }
    if (d.weapon) e.equipment.push(d.weapon);
    if (d.ammo) p.ammo[d.ammo] += d.quantity ?? 1;
    if (d.upgrade) p[d.upgrade] = 1;
    if (d.vehicle) {
      if (p.vehicleId) {
        e.queue.shift();
        continue;
      }
      const vehicle = spawn(s, d.vehicle, p.faction, spawnPosition!);
      vehicle.owner = p.id;
      p.vehicleId = vehicle.id;
      r.physics.addEntity(vehicle);
    }
    event(s, `${d.name} ready.`, "complete", p.faction, e.pos);
    e.queue.shift();
  }
}
