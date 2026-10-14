import type { GameRuntime, SaveEnvelope } from "./types";
import { PhysicsPort } from "./physics";
import { validateConfig } from "./world";
import { BUILDINGS, RECIPES } from "./balance";
export function encodeSave(r: GameRuntime): SaveEnvelope {
  return {
    version: 1,
    balance: 1,
    state: structuredClone(r.state),
    physics: [...r.physics.serialize()],
    handles: r.physics.handles(),
  };
}
export async function restoreSave(save: SaveEnvelope): Promise<GameRuntime> {
  if (!save || save.version !== 1 || save.balance !== 1)
    throw new Error("This save version is incompatible with Hearthguard.");
  const s = structuredClone(save.state),
    bad = () => {
      throw new Error("This save contains invalid or damaged data.");
    };
  if (!s || !s.config) bad();
  validateConfig(s.config);
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v),
    vector = (v: any) => v && [v.x, v.y, v.z].every(finite);
  const stock = (v: any) =>
    v &&
    ["food", "wood", "stone", "ore"].every((k) => finite(v[k]) && v[k] >= 0);
  const input = (i: any) =>
    i &&
    i.move &&
    [i.move.x, i.move.z, i.yaw, i.pitch].every(finite) &&
    Number.isSafeInteger(i.seq) &&
    i.seq >= 0 &&
    [0, 1].includes(i.weaponSlot) &&
    ["jump", "sprint", "attack", "aim", "interact"].every(
      (k) => typeof i[k] === "boolean",
    ) &&
    (i.aimOrigin === undefined || vector(i.aimOrigin));
  if (
    s.version !== 1 ||
    !Number.isSafeInteger(s.tick) ||
    s.tick < 0 ||
    !Number.isInteger(s.size) ||
    s.size < 32 ||
    s.size > 200 ||
    !Array.isArray(s.heights) ||
    s.heights.length !== (s.size + 1) ** 2 ||
    !s.heights.every(finite) ||
    !Array.isArray(save.physics) ||
    !save.physics.length ||
    save.physics.length > 5e7 ||
    !save.physics.every((n) => Number.isInteger(n) && n >= 0 && n < 256) ||
    !save.handles ||
    !s.players ||
    !s.factions ||
    !s.entities
  )
    bad();
  for (const p of Object.values(s.players))
    if (
      !vector(p.pos) ||
      !vector(p.vel) ||
      !input(p.input) ||
      (p.combat !== undefined &&
        (!p.combat ||
          ![null, "sword", "spear", "bow", "crossbow"].includes(
            p.combat.weapon,
          ) ||
          !finite(p.combat.focus) ||
          p.combat.focus < 0 ||
          p.combat.focus > 1 ||
          typeof p.combat.triggerHeld !== "boolean" ||
          !Number.isSafeInteger(p.combat.lastHitTick))) ||
      !Number.isSafeInteger(p.lastSeq) ||
      p.lastSeq < 0 ||
      !p.ai ||
      !finite(p.ai.next) ||
      typeof p.ai.phase !== "string" ||
      (p.ai.route !== undefined &&
        (!Array.isArray(p.ai.route) || !p.ai.route.every(vector))) ||
      (p.ai.goalPoint !== undefined && !vector(p.ai.goalPoint)) ||
      (p.ai.site !== undefined && !vector(p.ai.site)) ||
      (p.action !== undefined &&
        (!["gather", "work", "repair", "disarm"].includes(p.action.kind) ||
          !Number.isSafeInteger(p.action.target))) ||
      ![0, 1].includes(p.slot) ||
      ![0, 1].includes(p.tools) ||
      ![0, 1].includes(p.armor) ||
      typeof p.dead !== "boolean" ||
      typeof p.eliminated !== "boolean" ||
      typeof p.name !== "string" ||
      !["human", "ai"].includes(p.controller) ||
      ![
        p.hp,
        p.lives,
        p.cooldown,
        p.heal,
        p.respawnAt,
        p.protectionUntil,
      ].every(finite) ||
      !Number.isInteger(p.lives) ||
      p.lives < 0 ||
      p.lives > 3 ||
      !s.factions[p.faction] ||
      !stock(p.pack) ||
      !Array.isArray(p.weapons) ||
      p.weapons.length !== 2 ||
      p.weapons.some(
        (w) => w !== null && !["sword", "spear", "bow", "crossbow"].includes(w),
      ) ||
      !p.ammo ||
      !Object.values(p.ammo).every((n) => Number.isInteger(n) && n >= 0)
    )
      bad();
  for (const e of Object.values(s.entities))
    if (
      !vector(e.pos) ||
      ![
        ...Object.keys(BUILDINGS),
        "tree",
        "stone",
        "ore",
        "deer",
        "bag",
        "horse",
        "catapult",
        "trap",
      ].includes(e.type) ||
      !finite(e.yaw) ||
      !Array.isArray(e.equipment) ||
      e.equipment.some(
        (w) => !["sword", "spear", "bow", "crossbow"].includes(w),
      ) ||
      ![e.hp, e.maxHp, e.progress, e.amount, e.cropAt, e.cooldown].every(
        finite,
      ) ||
      e.progress < 0 ||
      e.progress > 1 ||
      e.amount < 0 ||
      !stock(e.stock) ||
      !Array.isArray(e.queue) ||
      e.queue.some(
        (q) =>
          !s.players[q.actor] ||
          !RECIPES[q.recipe] ||
          !finite(q.remaining) ||
          q.remaining < 0,
      )
    )
      bad();
  for (const f of Object.values(s.factions))
    if (
      !stock(f.stock) ||
      !s.entities[f.townhall] ||
      !Array.isArray(f.explored) ||
      typeof f.alive !== "boolean" ||
      !Array.isArray(f.members) ||
      !f.explored.every((n) => n === 0 || n === 1) ||
      f.explored.length !== s.size ** 2 ||
      !f.members.every((id) => s.players[id]?.faction === f.id)
    )
      bad();
  if (
    Object.keys(s.players).length !== s.config.participants.length ||
    !Array.isArray(s.projectiles) ||
    s.projectiles.length > 160 ||
    s.projectiles.some(
      (p) =>
        !vector(p.pos) ||
        !vector(p.vel) ||
        ![p.id, p.owner, p.faction, p.damage, p.life].every(finite) ||
        !["arrow", "bolt", "catapult", "tower"].includes(p.kind),
    ) ||
    !Array.isArray(s.events) ||
    s.events.length > 64 ||
    !Array.isArray(s.damage) ||
    s.damage.some(
      (hit) =>
        !hit ||
        ![hit.target, hit.amount, hit.source].every(finite) ||
        hit.amount <= 0 ||
        (hit.origin !== undefined && !vector(hit.origin)) ||
        (hit.blockable !== undefined && typeof hit.blockable !== "boolean"),
    ) ||
    !Number.isSafeInteger(s.rng) ||
    s.rng < 0 ||
    s.rng > 0xffffffff ||
    !Number.isSafeInteger(s.nextId) ||
    typeof s.paused !== "boolean"
  )
    bad();
  for (const list of [save.handles.bodies, save.handles.colliders])
    if (
      !Array.isArray(list) ||
      list.some(
        (pair) =>
          !Array.isArray(pair) ||
          pair.length !== 2 ||
          !Number.isSafeInteger(pair[0]) ||
          !finite(pair[1]),
      )
    )
      bad();
  s.intel ??= {};
  s.visibleIds ??= {};
  for (const f of Object.values(s.factions)) {
    s.intel[f.id] ??= {};
    s.visibleIds[f.id] ??= [];
  }
  s.paused = true;
  try {
    return {
      state: s,
      physics: await PhysicsPort.create(s, save.physics, save.handles),
    };
  } catch {
    throw new Error("This save contains a damaged physics snapshot.");
  }
}
