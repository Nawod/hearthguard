import { canReach } from "./rules";
import type { GameRuntime, Building, Vec3, CommandResult } from "./types";
import { BUILDINGS } from "./balance";
import { actor, close, pay, ok, fail, event } from "./rules";
import { distance, ground, spawn } from "./world";
export function placeBuilding(
  r: GameRuntime,
  id: number,
  type: Building,
  pos: Vec3,
  yaw: number,
): CommandResult {
  const p = actor(r, id),
    d = BUILDINGS[type],
    s = r.state;
  if (!p || !d || type === "townhall")
    return fail("Choose an available building.");
  if (
    !pos ||
    ![pos.x, pos.z, yaw].every(Number.isFinite) ||
    distance(p.pos, pos) > 10 ||
    pos.x < d.size ||
    pos.z < d.size ||
    pos.x > s.size - d.size ||
    pos.z > s.size - d.size
  )
    return fail("Place nearby on clear land.");
  if (
    d.requires?.some(
      (t) =>
        !Object.values(s.entities).some(
          (e) =>
            e.faction === p.faction &&
            e.type === t &&
            e.progress === 1 &&
            e.hp > 0,
        ),
    )
  )
    return fail("Build the required workshop first.");
  if (
    Object.values(s.entities).some(
      (e) =>
        e.hp > 0 &&
        e.type in BUILDINGS &&
        Math.abs(e.pos.x - pos.x) <
          (BUILDINGS[e.type as Building].size + d.size) / 2 + 0.3 &&
        Math.abs(e.pos.z - pos.z) <
          (BUILDINGS[e.type as Building].size + d.size) / 2 + 0.3,
    )
  )
    return fail("The footprint overlaps another building.");
  if (
    Object.values(s.players).some(
      (v) =>
        !v.dead &&
        Math.abs(v.pos.x - pos.x) < d.size / 2 + 0.5 &&
        Math.abs(v.pos.z - pos.z) < d.size / 2 + 0.5,
    )
  )
    return fail("Leave room for the character.");
  if (Object.values(s.entities).some((e) => resourceCollision(e, pos, d.size)))
    return fail("Clear the resource from this footprint first.");
  if (
    type !== "farm" &&
    Object.values(s.factions).some((f) => {
      const h = s.entities[f.townhall];
      return (
        f.alive &&
        h &&
        Math.abs(pos.x - h.pos.x) < 3 + d.size / 2 &&
        Math.abs(pos.z - (h.pos.z + 5)) < 2 + d.size / 2
      );
    })
  )
    return fail("Keep every town hall respawn exit clear.");
  const hall = s.entities[s.factions[p.faction].townhall];
  if (distance(hall.pos, pos) < 8 && type !== "farm")
    return fail("Keep the town hall entrance clear.");
  if (!pay(s.factions[p.faction].stock, d.cost))
    return fail("Deposit enough materials in your city bank.");
  const e = spawn(s, type, p.faction, pos);
  e.yaw = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
  e.progress = 0;
  e.hp = 1;
  r.physics.addEntity(e);
  p.action = { kind: "work", target: e.id };
  event(s, `${d.name} construction started.`, "info", p.faction, e.pos);
  return ok();
}
function resourceCollision(
  e: GameRuntime["state"]["entities"][number],
  pos: Vec3,
  size: number,
): boolean {
  return (
    ["tree", "stone", "ore"].includes(e.type) &&
    e.amount > 0 &&
    Math.abs(e.pos.x - pos.x) < size / 2 + 0.6 &&
    Math.abs(e.pos.z - pos.z) < size / 2 + 0.6
  );
}
export function updateConstruction(r: GameRuntime, dt: number): void {
  const s = r.state;
  for (const p of Object.values(s.players)) {
    if (
      p.dead ||
      p.eliminated ||
      !p.action ||
      !["work", "repair"].includes(p.action.kind)
    )
      continue;
    const e = s.entities[p.action.target],
      d = e && BUILDINGS[e.type as Building];
    if (
      !e ||
      !d ||
      e.faction !== p.faction ||
      e.hp <= 0 ||
      !close(p, e) ||
      !canReach(r, p, e)
    ) {
      p.action = undefined;
      continue;
    }
    if (p.action.kind === "work") {
      if (e.progress >= 1) {
        p.action = undefined;
        continue;
      }
      e.progress = Math.min(1, e.progress + dt / d.seconds);
      e.hp = Math.max(e.hp, e.maxHp * e.progress);
      if (e.progress === 1) {
        p.action = undefined;
        event(s, `${d.name} is ready.`, "complete", p.faction, e.pos);
      }
    } else if (e.progress === 1) {
      const restored = Math.min(dt * 18, e.maxHp - e.hp);
      if (
        restored > 0 &&
        pay(s.factions[p.faction].stock, { wood: restored / 36 })
      )
        e.hp = Math.min(e.maxHp, e.hp + restored);
      else if (restored > 0) {
        p.action = undefined;
        event(
          s,
          "Repairs paused: deposit more wood in your city.",
          "error",
          p.faction,
          e.pos,
        );
      }
      if (e.hp >= e.maxHp) {
        p.action = undefined;
        event(
          s,
          `${d.name} repairs are complete.`,
          "complete",
          p.faction,
          e.pos,
        );
      }
    }
  }
  for (const e of Object.values(s.entities))
    if (
      e.type === "farm" &&
      e.hp > 0 &&
      s.factions[e.faction]?.alive &&
      e.progress === 1 &&
      e.cropAt &&
      s.tick >= e.cropAt
    ) {
      e.amount = 35;
      e.cropAt = 0;
      event(
        s,
        "Your crops are ready to harvest.",
        "complete",
        e.faction,
        e.pos,
      );
    }
}
