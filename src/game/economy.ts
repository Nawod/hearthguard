import { canReach } from "./rules";
import type { GameRuntime, Stock, Resource, CommandResult } from "./types";
import { PACK_CAPACITY, resourceOf } from "./balance";
import { actor, station, fail, ok } from "./rules";
import { distance, random, ground } from "./world";
export function transferResources(
  r: GameRuntime,
  id: number,
  target: number,
  direction: "deposit" | "withdraw",
  amounts?: Partial<Stock>,
): CommandResult {
  const pair = station(r, id, target);
  if (!pair || !["townhall", "storage"].includes(pair.e.type))
    return fail("Use a nearby friendly town hall or storehouse.");
  const bank = r.state.factions[pair.p.faction].stock,
    pack = pair.p.pack,
    source = direction === "deposit" ? pack : bank,
    dest = direction === "deposit" ? bank : pack,
    request = amounts ?? { ...source };
  let count = 0;
  for (const [key, value] of Object.entries(request)) {
    if (
      !["food", "wood", "stone", "ore"].includes(key) ||
      !Number.isFinite(value) ||
      value < 0
    )
      return fail("Choose valid resource quantities.");
    const k = key as Resource;
    if (value > source[k]) return fail("Not enough resources.");
    count += value;
  }
  if (
    direction === "withdraw" &&
    Object.values(pack).reduce((a, b) => a + b, 0) + count > PACK_CAPACITY
  )
    return fail("Your backpack is full.");
  for (const [key, value] of Object.entries(request)) {
    const k = key as Resource;
    source[k] -= value!;
    dest[k] += value!;
  }
  return ok();
}
export function loot(
  r: GameRuntime,
  id: number,
  target: number,
): CommandResult {
  const p = actor(r, id),
    e = r.state.entities[target];
  if (
    !p ||
    !e ||
    e.type !== "bag" ||
    distance(p.pos, e.pos) > 3 ||
    !canReach(r, p, e)
  )
    return fail("Move closer to the loot.");
  let capacity =
    PACK_CAPACITY - Object.values(p.pack).reduce((a, b) => a + b, 0);
  for (const k of ["food", "wood", "stone", "ore"] as const) {
    const n = Math.min(capacity, e.stock[k]);
    e.stock[k] -= n;
    p.pack[k] += n;
    capacity -= n;
  }
  if (Object.values(e.stock).every((n) => n < 0.001))
    delete r.state.entities[e.id];
  return ok();
}
export function updateEconomy(r: GameRuntime, dt: number): void {
  const s = r.state;
  const players = Object.values(s.players);
  for (const e of Object.values(s.entities))
    if (e.type === "deer" && e.amount > 0 && e.hp > 0) {
      e.home ??= { ...e.pos };
      if (
        players.some(
          (p) =>
            !p.dead &&
            !p.eliminated &&
            p.action?.target === e.id &&
            distance(p.pos, e.pos) < 3,
        )
      )
        continue;
      if (
        s.tick >= (e.nextMove ?? 0) &&
        (!e.goal || distance(e.pos, e.goal) < 0.2)
      ) {
        const a = random(s) * Math.PI * 2,
          d = 1 + random(s) * 3;
        e.goal = {
          x: Math.max(1, Math.min(s.size - 1, e.home.x + Math.sin(a) * d)),
          y: 0,
          z: Math.max(1, Math.min(s.size - 1, e.home.z + Math.cos(a) * d)),
        };
        e.nextMove = s.tick + 60 + Math.floor(random(s) * 120);
      }
      if (e.goal) {
        const d = distance(e.pos, e.goal);
        if (d > 0.2) {
          const move = Math.min(dt * 0.7, d);
          const candidate = {
            x: e.pos.x + ((e.goal.x - e.pos.x) * move) / d,
            y: e.pos.y,
            z: e.pos.z + ((e.goal.z - e.pos.z) * move) / d,
          };
          candidate.y = ground(s, candidate.x, candidate.z);
          if (!r.physics.isClear(candidate, new Set([e.id]))) {
            e.goal = undefined;
            e.nextMove = s.tick + 30;
            continue;
          }
          e.yaw = Math.atan2(candidate.x - e.pos.x, -(candidate.z - e.pos.z));
          e.pos = candidate;
          r.physics.updateEntity(e);
        }
      }
    }
  for (const p of players) {
    if (p.dead || p.eliminated || p.action?.kind !== "gather") continue;
    const e = s.entities[p.action.target],
      resource = e && resourceOf(e.type);
    if (
      !e ||
      !resource ||
      e.amount <= 0 ||
      distance(p.pos, e.pos) > 3 ||
      !canReach(r, p, e)
    ) {
      p.action = undefined;
      continue;
    }
    const space =
        PACK_CAPACITY - Object.values(p.pack).reduce((a, b) => a + b, 0),
      n = Math.min(space, e.amount, dt * (p.tools ? 6 : 3));
    e.amount -= n;
    p.pack[resource] += n;
    if (e.amount < 0.001) {
      e.amount = 0;
      r.physics.removeEntity(e.id);
    }
    if (space <= 0.001) p.action = undefined;
  }
}
