import type { GameRuntime, CommandResult, Vec3 } from "./types";
import { actor, fail, ok, pay } from "./rules";
import { distance, spawn } from "./world";
import { queueDamage } from "./combat";
export function placeTrap(
  r: GameRuntime,
  id: number,
  pos: Vec3,
): CommandResult {
  const p = actor(r, id);
  if (
    !p ||
    ![pos.x, pos.y, pos.z].every(Number.isFinite) ||
    distance(p.pos, pos) > 5 ||
    pos.x < 1 ||
    pos.z < 1 ||
    pos.x > r.state.size - 1 ||
    pos.z > r.state.size - 1
  )
    return fail("Place a trap close by on clear ground.");
  if (Object.values(r.state.entities).some((e) => distance(pos, e.pos) < 2))
    return fail("Choose clear ground.");
  if (!pay(p.pack, { wood: 5, ore: 5 }))
    return fail("Carry 5 wood and 5 ore for a bear trap.");
  const e = spawn(r.state, "trap", p.faction, pos);
  e.owner = id;
  return ok();
}
export function updateDefenses(r: GameRuntime, dt: number): void {
  const s = r.state;
  for (const e of Object.values(s.entities)) {
    if (e.hp <= 0 || !s.factions[e.faction]?.alive) continue;
    if (e.type === "trap" && !e.triggered) {
      const p = Object.values(s.players).find(
        (p) =>
          !p.dead &&
          !p.eliminated &&
          p.faction !== e.faction &&
          distance(p.pos, e.pos) < 0.9,
      );
      if (p) {
        queueDamage(r, p.id, 28, e.id, { blockable: false });
        p.trappedUntil = s.tick + 60;
        p.input.move = { x: 0, z: 0 };
        e.triggered = true;
        e.cooldown = 2;
      }
    }
    if (e.type === "trap" && e.triggered) {
      e.cooldown -= dt;
      if (e.cooldown <= 0) delete s.entities[e.id];
    }
    if (e.type === "tower" && e.progress === 1) {
      e.cooldown -= dt;
      if (e.cooldown > 0 || s.projectiles.length >= 160) continue;
      const target = Object.values(s.players)
        .filter(
          (p) =>
            !p.dead &&
            !p.eliminated &&
            p.faction !== e.faction &&
            distance(p.pos, e.pos) < 20,
        )
        .sort((a, b) => distance(a.pos, e.pos) - distance(b.pos, e.pos))[0];
      if (!target) continue;
      const origin = { x: e.pos.x, y: e.pos.y + 6, z: e.pos.z },
        dx = target.pos.x - origin.x,
        dy = target.pos.y + 1 - origin.y,
        dz = target.pos.z - origin.z,
        len = Math.hypot(dx, dy, dz),
        dir = { x: dx / len, y: dy / len, z: dz / len };
      const hit = r.physics.raycast(origin, dir, len, e.id);
      if (hit && hit.entityId !== target.id) continue;
      s.projectiles.push({
        id: s.nextId++,
        owner: e.id,
        faction: e.faction,
        pos: origin,
        vel: {
          x: dir.x * 40,
          y: dir.y * 40 + (9.81 * len) / 80,
          z: dir.z * 40,
        },
        damage: 18,
        life: 2,
        kind: "tower",
      });
      e.cooldown = 1.3;
    }
  }
}
