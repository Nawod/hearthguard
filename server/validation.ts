import type { ClientMessage } from "../src/session/protocol";
import type { Command } from "../src/game/types";
import { BUILDINGS, RECIPES, WEAPONS } from "../src/game/balance";
const bad = (): never => {
  throw new Error("Invalid request. Check your settings or reconnect.");
};
const obj = (v: any) =>
  v && typeof v === "object" && !Array.isArray(v) ? v : bad();
const finite = (v: any, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? v
    : bad();
const int = (v: any, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(v) && v >= min && v <= max ? v : bad();
const one = (v: any, values: string[]) =>
  typeof v === "string" && values.includes(v) ? v : bad();
const text = (v: any, n = 32) =>
  typeof v === "string" && v.trim() && v.length <= n && !/[<>\x00-\x1f]/.test(v)
    ? v.trim()
    : bad();
const bool = (v: any) => (typeof v === "boolean" ? v : bad());
const keys = (v: any, allowed: string[]) => {
  if (Object.keys(v).some((k) => !allowed.includes(k))) bad();
};
const commandKeys: Record<string, string[]> = {
  gate: ["target", "open"],
  deposit: ["target", "amounts"],
  withdraw: ["target", "amounts"],
  build: ["building", "pos", "yaw"],
  craft: ["target", "recipe"],
  equip: ["target", "weapon", "slot"],
  trap: ["pos"],
  eat: [],
  dismount: [],
  stop: [],
};
export function validateCommand(value: unknown): Command {
  const v = obj(value);
  keys(v, ["type", ...(commandKeys[v.type] ?? ["target"])]);
  const target = () => int(v.target, 1),
    pos = () => {
      const p = obj(v.pos);
      keys(p, ["x", "y", "z"]);
      return {
        x: finite(p.x, 0, 200),
        y: finite(p.y, -10, 30),
        z: finite(p.z, 0, 200),
      };
    };
  switch (v.type) {
    case "gate":
      return { type: "gate", target: target(), open: bool(v.open) };
    case "deposit":
    case "withdraw": {
      const amounts = v.amounts === undefined ? undefined : obj(v.amounts);
      if (amounts)
        for (const [k, n] of Object.entries(amounts)) {
          one(k, ["food", "wood", "stone", "ore"]);
          finite(n, 0, 1e6);
        }
      return { type: v.type, target: target(), amounts };
    }
    case "interact":
    case "work":
    case "repair":
    case "loot":
    case "mount":
    case "operate":
    case "disarm":
    case "plant":
    case "harvest":
      return { type: v.type, target: target() };
    case "build":
      return {
        type: "build",
        building: one(v.building, Object.keys(BUILDINGS)) as any,
        pos: pos(),
        yaw: finite(v.yaw, -100, 100),
      };
    case "craft":
      return {
        type: "craft",
        target: target(),
        recipe: one(v.recipe, Object.keys(RECIPES)),
      };
    case "equip":
      return {
        type: "equip",
        target: target(),
        weapon: one(v.weapon, Object.keys(WEAPONS)) as any,
        slot: int(v.slot, 0, 1) as 0 | 1,
      };
    case "trap":
      return { type: "trap", pos: pos() };
    case "eat":
    case "dismount":
    case "stop":
      return { type: v.type };
    default:
      return bad();
  }
}
export function validateMessage(value: unknown): ClientMessage {
  const v = obj(value);
  const fields: Record<string, string[]> = {
    create: ["name", "mode", "difficulty", "seed"],
    settings: ["mode", "difficulty", "seed"],
    join: ["name", "code"],
    queue: ["name", "mode", "difficulty", "count"],
    team: ["id", "team"],
    ready: ["ready"],
    resume: ["code", "token"],
    command: ["seq", "command"],
    input: ["input"],
    start: [],
    leave: [],
    cancel: [],
  };
  keys(v, ["type", ...(fields[v.type] ?? [])]);
  switch (v.type) {
    case "create":
    case "settings":
      return {
        type: v.type,
        ...(v.type === "create" ? { name: text(v.name) } : {}),
        mode: one(v.mode, ["ffa", "teams"]) as any,
        difficulty: one(v.difficulty, ["easy", "medium", "hard"]) as any,
        seed: int(v.seed, 0, 0xffffffff),
      } as ClientMessage;
    case "join":
      return {
        type: "join",
        name: text(v.name),
        code: text(v.code, 6).toUpperCase(),
      };
    case "queue":
      return {
        type: "queue",
        name: text(v.name),
        mode: one(v.mode, ["ffa", "teams"]) as any,
        difficulty: one(v.difficulty, ["easy", "medium", "hard"]) as any,
        count: int(v.count, 2, 8),
      };
    case "team":
      return {
        type: "team",
        id: text(v.id, 64),
        team: int(v.team, 0, 1) as 0 | 1,
      };
    case "ready":
      return { type: "ready", ready: bool(v.ready) };
    case "start":
    case "leave":
    case "cancel":
      return { type: v.type };
    case "resume":
      return {
        type: "resume",
        code: text(v.code, 6),
        token:
          typeof v.token === "string" && /^[a-f0-9]{64}$/.test(v.token)
            ? v.token
            : bad(),
      };
    case "command":
      return {
        type: "command",
        seq: int(v.seq, 1),
        command: validateCommand(v.command),
      };
    case "input": {
      const i = obj(v.input),
        move = obj(i.move);
      keys(i, [
        "seq",
        "move",
        "yaw",
        "pitch",
        "jump",
        "sprint",
        "attack",
        "aim",
        "interact",
        "weaponSlot",
        "aimOrigin",
      ]);
      keys(move, ["x", "z"]);
      const origin = i.aimOrigin === undefined ? undefined : obj(i.aimOrigin);
      if (origin) keys(origin, ["x", "y", "z"]);
      return {
        type: "input",
        input: {
          seq: int(i.seq, 1),
          move: { x: finite(move.x, -1, 1), z: finite(move.z, -1, 1) },
          yaw: finite(i.yaw, -1e6, 1e6),
          pitch: finite(i.pitch, -1.1, 1.1),
          jump: bool(i.jump),
          sprint: bool(i.sprint),
          attack: bool(i.attack),
          aim: bool(i.aim),
          interact: bool(i.interact),
          weaponSlot: int(i.weaponSlot, 0, 1) as 0 | 1,
          ...(origin
            ? {
                aimOrigin: {
                  x: finite(origin.x, -16, 216),
                  y: finite(origin.y, -16, 40),
                  z: finite(origin.z, -16, 216),
                },
              }
            : {}),
        },
      };
    }
    default:
      return bad();
  }
}
