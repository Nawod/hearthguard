import type { GameRuntime, CommandResult, Vec3, Entity } from "./types";
import { BUILDINGS, WEAPONS, COMBAT } from "./balance";
import {
  ballisticVelocity,
  combatState,
  lookDirection,
  validAimOrigin,
} from "./aim";
import { consumeAmmo } from "./crafting";
import { actor, ok, fail, pay, event } from "./rules";
import { distance, random } from "./world";
function meleePoint(from: Vec3, e: Entity): Vec3 {
  const building = BUILDINGS[e.type as keyof typeof BUILDINGS];
  if (!building) return e.pos;
  const c = Math.cos(e.yaw),
    s = Math.sin(e.yaw),
    dx = from.x - e.pos.x,
    dz = from.z - e.pos.z,
    half = building.size / 2,
    x = Math.max(-half, Math.min(half, c * dx - s * dz)),
    z = Math.max(-half, Math.min(half, s * dx + c * dz));
  return { x: e.pos.x + c * x + s * z, y: e.pos.y, z: e.pos.z - s * x + c * z };
}
export function queueDamage(
  r: GameRuntime,
  target: number,
  amount: number,
  source: number,
  context?: { origin?: Vec3; blockable?: boolean },
): void {
  if (Number.isFinite(amount) && amount > 0)
    r.state.damage.push({ target, amount, source, ...context });
}
export function eat(r: GameRuntime, id: number): CommandResult {
  const p = actor(r, id),
    s = r.state;
  if (!p || p.hp >= 100 || s.tick < p.eatReady)
    return fail("Food restores missing health; wait for the eating cooldown.");
  if (!pay(p.pack, { food: 10 })) return fail("Carry 10 food to eat.");
  p.heal = 25;
  p.healUntil = s.tick + 60;
  p.eatReady = s.tick + 240;
  return ok();
}
export function fire(r: GameRuntime, id: number): CommandResult {
  const p = actor(r, id),
    s = r.state;
  if (!p || p.cooldown > 0) return fail("Wait for the weapon to recover.");
  const vehicle = s.entities[p.vehicleId ?? -1],
    siege = vehicle?.type === "catapult" && vehicle.occupant === id,
    w = p.weapons[p.slot],
    def = w
      ? WEAPONS[w]
      : {
          name: "Fists",
          damage: 7,
          range: 2.2,
          cooldown: 0.55,
          ammo: undefined,
        },
    origin = siege
      ? { x: vehicle.pos.x, y: vehicle.pos.y + 2.3, z: vehicle.pos.z }
      : { x: p.pos.x, y: p.pos.y + 1.25, z: p.pos.z },
    direction = lookDirection(p.yaw, p.pitch);
  if (s.projectiles.length >= 160)
    return fail("Too many projectiles are currently in flight.");
  if (siege || def.ammo) {
    const ammo = consumeAmmo(r, id, siege ? "catapult" : def.ammo!);
    if (!ammo.ok) return ammo;
    const state = combatState(p),
      focus = p.input.aim ? state.focus : 0,
      moving = Math.hypot(p.vel.x, p.vel.z) > 0.3,
      spread = p.input.aim
        ? COMBAT.aimedSpread +
          (1 - focus) * COMBAT.hipSpread +
          (moving ? COMBAT.movingSpread : 0)
        : COMBAT.hipSpread,
      shotDirection = siege
        ? direction
        : lookDirection(
            p.yaw + (random(s) - 0.5) * spread * 2,
            p.pitch + (random(s) - 0.5) * spread * 2,
          ),
      speed = siege ? 23 : w === "crossbow" ? 42 : 34 * (0.65 + 0.35 * focus);
    let vel = {
      x: direction.x * speed,
      y: siege ? Math.max(7, direction.y * speed) : direction.y * speed + 1,
      z: direction.z * speed,
    };
    if (!siege) {
      const sight =
          p.input.aim && validAimOrigin(p.input.aimOrigin, p.pos)
            ? p.input.aimOrigin!
            : origin,
        ignored = new Set<number>();
      if (vehicle?.occupant === id) ignored.add(vehicle.id);
      const hit = r.physics.raycast(
        sight,
        shotDirection,
        def.range,
        id,
        ignored,
      );
      let target = hit?.point ?? {
        x: sight.x + shotDirection.x * def.range,
        y: sight.y + shotDirection.y * def.range,
        z: sight.z + shotDirection.z * def.range,
      };
      // A camera behind an obstruction must never redirect a shot backwards.
      if (
        (target.x - origin.x) * shotDirection.x +
          (target.y - origin.y) * shotDirection.y +
          (target.z - origin.z) * shotDirection.z <=
        0.05
      )
        target = {
          x: origin.x + shotDirection.x,
          y: origin.y + shotDirection.y,
          z: origin.z + shotDirection.z,
        };
      vel = ballisticVelocity(origin, target, speed);
    }
    s.projectiles.push({
      id: s.nextId++,
      owner: id,
      faction: p.faction,
      pos: origin,
      vel,
      damage: siege ? 90 : def.damage * (w === "bow" ? 0.65 + 0.35 * focus : 1),
      life: siege ? 6 : 3,
      kind: siege ? "catapult" : def.ammo!,
    });
  } else {
    const candidates = [
      ...Object.values(s.players)
        .filter(
          (v) =>
            v.id !== id && !v.dead && !v.eliminated && v.faction !== p.faction,
        )
        .map((v) => ({ id: v.id, pos: v.pos })),
      ...Object.values(s.entities)
        .filter(
          (e) =>
            e.hp > 0 &&
            ((e.faction >= 0 && e.faction !== p.faction) || e.type === "deer"),
        )
        .map((e) => ({
          id: e.id,
          pos: meleePoint(p.pos, e),
        })),
    ]
      .map((t) => ({ ...t, distance: distance(p.pos, t.pos) }))
      .filter((t) => {
        const angle = Math.atan2(t.pos.x - p.pos.x, -(t.pos.z - p.pos.z)),
          delta = Math.atan2(Math.sin(angle - p.yaw), Math.cos(angle - p.yaw));
        return (
          t.distance <= def.range &&
          (Math.hypot(t.pos.x - p.pos.x, t.pos.z - p.pos.z) < 0.001 ||
            Math.abs(delta) <= 0.85)
        );
      })
      .sort((a, b) => a.distance - b.distance || a.id - b.id);
    for (const t of candidates) {
      const targetPoint = { x: t.pos.x, y: t.pos.y + 1, z: t.pos.z },
        len = Math.hypot(
          targetPoint.x - origin.x,
          targetPoint.y - origin.y,
          targetPoint.z - origin.z,
        ),
        hit = r.physics.raycast(
          origin,
          {
            x: (targetPoint.x - origin.x) / len,
            y: (targetPoint.y - origin.y) / len,
            z: (targetPoint.z - origin.z) / len,
          },
          len,
          p.id,
        );
      if (hit && hit.entityId !== t.id) continue;
      const target = s.players[t.id],
        mount = s.entities[target?.vehicleId ?? -1],
        ridingHorse = mount?.type === "horse" && mount.occupant === target?.id;
      queueDamage(
        r,
        t.id,
        def.damage * (w === "spear" && ridingHorse ? 1.6 : 1),
        id,
        { origin: { ...p.pos }, blockable: true },
      );
      break;
    }
  }
  event(
    s,
    siege ? "Catapult fired." : w ? `${def.name} attack.` : "Unarmed attack.",
    "attack",
    p.faction,
    p.pos,
  );
  p.cooldown = siege ? 3 : def.cooldown;
  p.protectionUntil = 0;
  p.action = undefined;
  if (w === "bow" && p.combat) p.combat.focus = 0;
  return ok();
}
function explode(
  r: GameRuntime,
  p: { pos: Vec3; faction: number; owner: number; damage: number },
  hitId?: number,
): void {
  for (const target of [
    ...Object.values(r.state.players),
    ...Object.values(r.state.entities),
  ]) {
    if (
      ("dead" in target && (target.dead || target.eliminated)) ||
      target.faction < 0 ||
      target.faction === p.faction
    )
      continue;
    const d = distance(target.pos, p.pos);
    if (d < 5 || target.id === hitId)
      queueDamage(
        r,
        target.id,
        p.damage * ("progress" in target ? 3 : 1) * Math.max(0.2, 1 - d / 6),
        p.owner,
        { origin: { ...p.pos }, blockable: false },
      );
  }
}
export function updateCombat(r: GameRuntime, dt: number): void {
  const s = r.state;
  for (const p of Object.values(s.players)) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    const state = combatState(p),
      weapon = p.weapons[p.slot],
      ranged = weapon === "bow" || weapon === "crossbow";
    if (state.weapon !== weapon) {
      state.focus = 0;
      state.weapon = weapon;
    }
    if (p.dead || p.eliminated) {
      state.focus = 0;
      state.triggerHeld = p.input.attack;
      continue;
    }
    state.focus =
      ranged && p.input.aim && !p.action && !p.input.jump
        ? Math.min(1, state.focus + dt / COMBAT.focusSeconds[weapon])
        : 0;
    if (p.heal > 0 && s.tick <= p.healUntil) {
      const n = Math.min(p.heal, dt * 12.5, 100 - p.hp);
      p.hp += n;
      p.heal -= n;
    }
    const vehicle = s.entities[p.vehicleId ?? -1],
      siege = vehicle?.type === "catapult" && vehicle.occupant === p.id;
    if (p.input.attack && (!ranged || siege || !state.triggerHeld)) {
      const result = fire(r, p.id);
      if (!result.ok && result.code === "ammo" && s.tick % 60 === 0)
        event(s, result.message, "error", p.faction, p.pos);
    }
    state.triggerHeld = p.input.attack;
  }
  const remaining = [];
  for (const shot of s.projectiles) {
    shot.life -= dt;
    const owner = s.players[shot.owner],
      vehicle = s.entities[owner?.vehicleId ?? -1],
      ignored = new Set<number>();
    if (vehicle?.occupant === shot.owner) ignored.add(vehicle.id);
    const delta = {
        x: shot.vel.x * dt,
        y: shot.vel.y * dt,
        z: shot.vel.z * dt,
      },
      length = Math.hypot(delta.x, delta.y, delta.z),
      hit = r.physics.raycast(
        shot.pos,
        { x: delta.x / length, y: delta.y / length, z: delta.z / length },
        length,
        shot.owner,
        ignored,
      );
    const incoming = { ...shot.pos };
    shot.pos = {
      x: shot.pos.x + delta.x,
      y: shot.pos.y + delta.y,
      z: shot.pos.z + delta.z,
    };
    shot.vel.y -= 9.81 * dt;
    if (hit) {
      shot.pos = hit.point;
      if (shot.kind === "catapult") explode(r, shot, hit.entityId);
      else if (hit.entityId) {
        const target = s.players[hit.entityId] ?? s.entities[hit.entityId];
        if (
          target &&
          target.faction !== shot.faction &&
          (target.faction >= 0 || ("type" in target && target.type === "deer"))
        )
          queueDamage(r, target.id, shot.damage, shot.owner, {
            origin: incoming,
            blockable: true,
          });
      }
      continue;
    }
    if (shot.life > 0 && shot.pos.y > -10) remaining.push(shot);
    else if (shot.kind === "catapult") explode(r, shot);
  }
  s.projectiles = remaining;
}
