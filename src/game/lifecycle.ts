import type { GameRuntime, Player } from "./types";
import { spawn, ground } from "./world";
import { event } from "./rules";
import { COMBAT } from "./balance";
import { combatState } from "./aim";
function die(r: GameRuntime, p: Player): void {
  const s = r.state;
  if (p.dead || p.eliminated) return;
  p.dead = true;
  p.lives--;
  p.deathTick = s.tick;
  p.respawnAt = p.lives > 0 ? s.tick + 150 : 0;
  p.action = undefined;
  p.heal = 0;
  if (p.combat) {
    p.combat.focus = 0;
    p.combat.triggerHeld = false;
  }
  p.input.attack = false;
  p.input.move = { x: 0, z: 0 };
  r.physics.removeEntity(p.id);
  if (Object.values(p.pack).some((n) => n > 0)) {
    const bag = spawn(s, "bag", -1, p.pos);
    bag.stock = { ...p.pack };
  }
  p.pack = { food: 0, wood: 0, stone: 0, ore: 0 };
  const vehicle = s.entities[p.vehicleId ?? -1];
  if (vehicle?.occupant === p.id) {
    vehicle.occupant = undefined;
    r.physics.removeEntity(vehicle.id);
    r.physics.addEntity(vehicle);
  }
  if (p.lives <= 0) p.eliminated = true;
  event(
    s,
    `${p.name} has fallen${p.lives > 0 ? ` · ${p.lives} lives remain` : "."}`,
    "death",
    p.faction,
    p.pos,
  );
}
export function forfeitPlayer(r: GameRuntime, id: number): void {
  const p = r.state.players[id];
  if (!p || p.eliminated) return;
  if (!p.dead) {
    p.lives = 1;
    die(r, p);
  }
  p.lives = 0;
  p.eliminated = true;
  p.respawnAt = 0;
}
export function resolveLifecycle(r: GameRuntime, dt: number): void {
  const s = r.state;
  for (const hit of s.damage) {
    const p = s.players[hit.target],
      e = s.entities[hit.target],
      source = s.players[hit.source] ?? s.entities[hit.source];
    if (p) {
      if (
        p.dead ||
        p.eliminated ||
        s.tick < p.protectionUntil ||
        source?.faction === p.faction
      )
        continue;
      const incoming = hit.origin ?? source?.pos,
        delta =
          incoming && Math.atan2(incoming.x - p.pos.x, -(incoming.z - p.pos.z)),
        facing =
          delta !== undefined &&
          Math.abs(
            Math.atan2(Math.sin(delta - p.yaw), Math.cos(delta - p.yaw)),
          ) <= COMBAT.guardHalfAngle,
        guard =
          p.input.aim &&
          !p.input.attack &&
          ["sword", "spear"].includes(p.weapons[p.slot] ?? "") &&
          facing &&
          (hit.blockable ??
            (!!source &&
              !["trap", "catapult"].includes(
                s.entities[hit.source]?.type ?? "",
              )));
      p.hp -=
        Math.max(1, hit.amount - (p.armor ? 5 : 0)) *
        (guard ? COMBAT.guardedDamage : 1);
      const attacker = s.players[hit.source];
      if (attacker && attacker.faction !== p.faction)
        combatState(attacker).lastHitTick = s.tick;
      const faction = s.factions[p.faction];
      if (s.tick - (faction.lastAttackTick ?? -30) >= 30) {
        faction.lastAttackTick = s.tick;
        event(
          s,
          "Your travelers are under attack.",
          "attack",
          p.faction,
          p.pos,
        );
      }
      p.heal = 0;
      if (p.hp <= 0) die(r, p);
    } else if (e && e.hp > 0 && source?.faction !== e.faction) {
      const faction = s.factions[e.faction];
      if (faction && s.tick - (faction.lastAttackTick ?? -30) >= 30) {
        faction.lastAttackTick = s.tick;
        event(s, "Your city is under attack.", "attack", e.faction, e.pos);
      }
      e.hp -= hit.amount;
      const attacker = s.players[hit.source];
      if (attacker && (e.faction >= 0 || e.type === "deer"))
        combatState(attacker).lastHitTick = s.tick;
      if (e.hp <= 0) {
        r.physics.removeEntity(e.id);
        e.queue = [];
        if (e.type === "deer" && e.amount > 0) {
          const bag = spawn(s, "bag", -1, e.pos);
          bag.stock.food = e.amount;
        }
        if (e.type !== "townhall") {
          if (e.type === "horse" || e.type === "catapult") {
            const owner = s.players[e.owner ?? -1];
            if (owner) {
              owner.vehicleId = undefined;
              if (!owner.dead && !owner.eliminated) {
                r.physics.removeEntity(owner.id);
                r.physics.addCharacter(owner.id, owner.pos);
              }
            }
          }
          delete s.entities[e.id];
        }
      }
    }
  }
  s.damage = [];
  for (const f of Object.values(s.factions)) {
    if (!f.alive) continue;
    const hall = s.entities[f.townhall];
    if (
      !hall ||
      hall.hp <= 0 ||
      f.members.every((id) => s.players[id].eliminated)
    ) {
      f.alive = false;
      event(s, `${f.name}'s hearth has fallen.`, "death", f.id, hall?.pos);
      for (const id of f.members) {
        const p = s.players[id];
        die(r, p);
        p.eliminated = true;
        p.dead = true;
        p.respawnAt = 0;
        p.action = undefined;
        r.physics.removeEntity(id);
      }
      for (const e of Object.values(s.entities))
        if (e.faction === f.id) {
          e.queue = [];
          e.cooldown = 1e9;
        }
    }
  }
  for (const p of Object.values(s.players)) {
    if (!p.dead || p.eliminated || !p.respawnAt || s.tick < p.respawnAt)
      continue;
    const f = s.factions[p.faction],
      hall = s.entities[f.townhall];
    if (!f.alive || hall.hp <= 0) continue;
    const pos = {
      x: hall.pos.x + (f.members.indexOf(p.id) - 1.5) * 1.1,
      y: 0,
      z: hall.pos.z + 5,
    };
    const candidates = [pos];
    for (let radius = 1.5; radius <= 10; radius += 1.5)
      for (let n = 0; n < 16; n++)
        candidates.push({
          x: pos.x + Math.cos((n * Math.PI) / 8) * radius,
          y: 0,
          z: pos.z + Math.sin((n * Math.PI) / 8) * radius,
        });
    const clear = candidates.find((candidate) => {
      candidate.y = ground(s, candidate.x, candidate.z);
      return (
        candidate.x > 1 &&
        candidate.z > 1 &&
        candidate.x < s.size - 1 &&
        candidate.z < s.size - 1 &&
        r.physics.isClear(candidate) &&
        !Object.values(s.players).some(
          (other) =>
            other.id !== p.id &&
            !other.dead &&
            !other.eliminated &&
            Math.hypot(other.pos.x - candidate.x, other.pos.z - candidate.z) <
              0.8,
        )
      );
    });
    if (!clear) continue;
    p.pos = clear;
    p.hp = 100;
    p.dead = false;
    p.respawnAt = 0;
    p.protectionUntil = s.tick + 90;
    p.vel = { x: 0, y: 0, z: 0 };
    r.physics.addCharacter(p.id, clear);
  }
  const alive = Object.values(s.factions).filter((f) => f.alive);
  if (alive.length <= 1 && !s.result)
    s.result = {
      winnerFactionId: alive[0]?.id ?? null,
      draw: alive.length === 0,
    };
}
