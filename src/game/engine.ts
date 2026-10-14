import { canReach } from "./rules";
import { validAimOrigin } from "./aim";
import type {
  GameRuntime,
  InputFrame,
  Command,
  CommandResult,
  Building,
  Stock,
} from "./types";
import { resourceOf, DT, BUILDINGS, PACK_CAPACITY } from "./balance";
import { actor, close, station, ok, fail, pay } from "./rules";
import { distance } from "./world";
import { updateMovement } from "./movement";
import { updateEconomy, transferResources, loot } from "./economy";
import { placeBuilding, updateConstruction } from "./construction";
import { reserveRecipe, equipWeapon, updateCrafting } from "./crafting";
import { updateCombat, eat } from "./combat";
import { updateDefenses, placeTrap } from "./defenses";
import { enterVehicle, leaveVehicle, updateVehicles } from "./vehicles";
import { resolveLifecycle } from "./lifecycle";
import { updateVisibility } from "./visibility";
import { updateAI } from "./ai";
export function applyInput(
  r: GameRuntime,
  id: number,
  input: InputFrame,
): CommandResult {
  const p = actor(r, id);
  if (!p) return fail("You cannot act while eliminated or respawning.");
  if (
    !input ||
    !Number.isSafeInteger(input.seq) ||
    input.seq <= p.lastSeq ||
    ![input.move?.x, input.move?.z, input.yaw, input.pitch].every(
      Number.isFinite,
    ) ||
    ![0, 1].includes(input.weaponSlot) ||
    (input.aimOrigin !== undefined && !validAimOrigin(input.aimOrigin, p.pos))
  )
    return fail("Invalid or stale input.");
  const len = Math.max(1, Math.hypot(input.move.x, input.move.z));
  p.input = {
    seq: input.seq,
    move: { x: input.move.x / len, z: input.move.z / len },
    yaw: input.yaw % (2 * Math.PI),
    pitch: Math.max(-1, Math.min(1, input.pitch)),
    jump: input.jump === true,
    sprint: input.sprint === true,
    attack: input.attack === true,
    aim: input.aim === true,
    interact: input.interact === true,
    weaponSlot: input.weaponSlot,
    ...(input.aim && input.aimOrigin
      ? { aimOrigin: { ...input.aimOrigin } }
      : {}),
  };
  p.lastSeq = input.seq;
  return ok();
}
export function applyCommand(
  r: GameRuntime,
  id: number,
  c: Command,
): CommandResult {
  const p = actor(r, id),
    s = r.state;
  if (!p) return fail("You cannot interact while eliminated or respawning.");
  if (!c || typeof c.type !== "string") return fail("Unknown command.");
  const target = "target" in c ? s.entities[c.target] : undefined;
  switch (c.type) {
    case "gate":
      if (
        !target ||
        target.type !== "gate" ||
        target.faction !== p.faction ||
        target.progress < 1 ||
        !close(p, target) ||
        !canReach(r, p, target)
      )
        return fail("Approach your own completed gate.");
      target.gateLocked = !c.open;
      return ok();
    case "deposit":
    case "withdraw":
      return transferResources(r, id, c.target, c.type, c.amounts);
    case "loot":
      return loot(r, id, c.target);
    case "build":
      return placeBuilding(r, id, c.building, c.pos, c.yaw);
    case "craft":
      return reserveRecipe(r, id, c.target, c.recipe);
    case "equip":
      return equipWeapon(r, id, c.target, c.weapon, c.slot);
    case "mount":
    case "operate":
      return enterVehicle(r, id, c.target);
    case "dismount":
      return leaveVehicle(r, id);
    case "eat":
      return eat(r, id);
    case "trap":
      return placeTrap(r, id, c.pos);
    case "stop":
      p.action = undefined;
      return ok();
    case "interact":
    case "work":
    case "repair":
    case "disarm": {
      if (
        !target ||
        target.hp <= 0 ||
        !close(p, target) ||
        !canReach(r, p, target)
      )
        return fail("Move closer to the target.");
      if (c.type === "disarm" && target.type === "trap") {
        delete s.entities[target.id];
        return ok();
      }
      if (resourceOf(target.type) && target.amount > 0) {
        p.action = { kind: "gather", target: target.id };
        return ok();
      }
      if (target.faction !== p.faction)
        return fail("This building belongs to another city.");
      if (target.progress < 1) {
        p.action = { kind: "work", target: target.id };
        return ok();
      }
      if (c.type === "repair") {
        if (target.type === "townhall" && target.hp <= 0)
          return fail("Destroyed town halls cannot be rebuilt.");
        if (!BUILDINGS[target.type as Building] || target.hp >= target.maxHp)
          return fail("This building does not need repairs.");
        if (s.factions[p.faction].stock.wood <= 0)
          return fail(
            "Deposit wood at your town hall or storehouse to repair.",
          );
        p.action = { kind: "repair", target: target.id };
        return ok();
      }
      if (["townhall", "storage"].includes(target.type))
        return transferResources(r, id, target.id, "deposit");
      if (["horse", "catapult"].includes(target.type))
        return enterVehicle(r, id, target.id);
      return ok();
    }
    case "plant":
    case "harvest": {
      const pair = station(r, id, c.target);
      if (!pair || pair.e.type !== "farm")
        return fail("Use your nearby cultivation plot.");
      if (c.type === "plant") {
        if (pair.e.cropAt || pair.e.amount > 0)
          return fail("This plot is already planted.");
        if (!pay(s.factions[p.faction].stock, { food: 3 }))
          return fail("Deposit 3 food to plant.");
        pair.e.cropAt = s.tick + 900;
        return ok();
      }
      if (pair.e.amount <= 0) return fail("Wait for the crops.");
      const n = Math.min(
        pair.e.amount,
        PACK_CAPACITY - Object.values(p.pack).reduce((a, b) => a + b, 0),
      );
      p.pack.food += n;
      pair.e.amount -= n;
      return ok();
    }
    default:
      return fail("Unknown command.");
  }
}
export function stepGame(r: GameRuntime, ticks = 1): void {
  for (let i = 0; i < ticks; i++) {
    const s = r.state;
    if (s.paused || s.result) return;
    s.tick++;
    updateAI(r, DT);
    updateMovement(r, DT);
    updateEconomy(r, DT);
    updateConstruction(r, DT);
    updateCrafting(r, DT);
    updateVehicles(r);
    updateCombat(r, DT);
    updateDefenses(r, DT);
    resolveLifecycle(r, DT);
    if (s.tick % 2 === 0) updateVisibility(r);
  }
}
