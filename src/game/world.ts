import { PhysicsPort } from "./physics";
import type {
  GameState,
  GameRuntime,
  MatchConfig,
  Entity,
  EntityType,
  Vec3,
} from "./types";
import { emptyStock, emptyInput } from "./types";
import { BUILDINGS, LIVES, COLORS } from "./balance";
export function random(s: GameState): number {
  let v = s.rng | 0;
  v ^= v << 13;
  v ^= v >>> 17;
  v ^= v << 5;
  s.rng = v >>> 0;
  return s.rng / 4294967296;
}
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
export function ground(s: GameState, x: number, z: number): number {
  const n = s.size,
    xx = Math.max(0, Math.min(n - 1, x)),
    zz = Math.max(0, Math.min(n - 1, z)),
    ix = Math.floor(xx),
    iz = Math.floor(zz),
    fx = xx - ix,
    fz = zz - iz;
  const a = s.heights[iz * (n + 1) + ix],
    b = s.heights[iz * (n + 1) + ix + 1],
    c = s.heights[(iz + 1) * (n + 1) + ix],
    d = s.heights[(iz + 1) * (n + 1) + ix + 1];
  return (
    a * (1 - fx) * (1 - fz) +
    b * fx * (1 - fz) +
    c * (1 - fx) * fz +
    d * fx * fz
  );
}
export function spawn(
  s: GameState,
  type: EntityType,
  faction: number,
  pos: Vec3,
): Entity {
  const def = BUILDINGS[type as keyof typeof BUILDINGS],
    e: Entity = {
      id: s.nextId++,
      type,
      faction,
      pos: { ...pos, y: ground(s, pos.x, pos.z) },
      yaw: 0,
      hp: def?.hp ?? (type === "horse" ? 220 : type === "catapult" ? 300 : 100),
      maxHp:
        def?.hp ?? (type === "horse" ? 220 : type === "catapult" ? 300 : 100),
      progress: 1,
      amount:
        type === "tree"
          ? 80
          : type === "deer"
            ? 35
            : type === "stone" || type === "ore"
              ? 100
              : 0,
      cropAt: 0,
      queue: [],
      stock: emptyStock(),
      equipment: [],
      cooldown: 0,
    };
  s.entities[e.id] = e;
  return e;
}
export function validateConfig(c: MatchConfig): void {
  if (
    !c ||
    !["single", "ffa", "teams"].includes(c.mode) ||
    !["easy", "medium", "hard"].includes(c.difficulty) ||
    !Number.isSafeInteger(c.seed) ||
    !Array.isArray(c.participants) ||
    c.participants.length < 2 ||
    c.participants.length > 8
  )
    throw new Error("Choose a valid match with 2–8 participants.");
  if (
    c.participants.some(
      (p) => !p.name || !["human", "ai"].includes(p.controller),
    )
  )
    throw new Error("Invalid participants.");
  if (c.mode === "single") {
    if (
      c.participants.length !== 2 ||
      c.participants[0].controller !== "human" ||
      c.participants[1].controller !== "ai"
    )
      throw new Error("Single-player is one human versus one AI.");
  } else if (c.participants.some((p) => p.controller !== "human"))
    throw new Error("Online seats are human players.");
  if (c.mode === "teams") {
    const counts = [0, 0];
    for (const p of c.participants) {
      if (p.team !== 0 && p.team !== 1) throw new Error("Choose a team.");
      counts[p.team]++;
    }
    if (counts.some((n) => n < 1 || n > 4))
      throw new Error("Each team needs 1–4 players.");
  }
}
export async function createMatch(config: MatchConfig): Promise<GameRuntime> {
  validateConfig(config);
  const factions = config.mode === "teams" ? 2 : config.participants.length,
    size = factions <= 2 ? 96 : factions <= 4 ? 128 : 160;
  const s: GameState = {
    version: 1,
    config: structuredClone(config),
    tick: 0,
    rng: config.seed >>> 0 || 1,
    nextId: 100,
    nextEvent: 1,
    size,
    heights: [],
    players: {},
    factions: {},
    entities: {},
    projectiles: [],
    events: [],
    paused: false,
    result: null,
    intel: {},
    visibleIds: {},
    damage: [],
  };
  const starts = Array.from({ length: factions }, (_, i) => {
    if (factions === 2)
      return i === 0
        ? { x: 16, y: 0, z: 16 }
        : { x: size - 16, y: 0, z: size - 16 };
    const angle = -Math.PI * 0.75 + (i * 2 * Math.PI) / factions,
      r = size / 2 - 17;
    return {
      x: Math.round(size / 2 + Math.cos(angle) * r),
      y: 0,
      z: Math.round(size / 2 + Math.sin(angle) * r),
    };
  });
  for (let z = 0; z <= size; z++)
    for (let x = 0; x <= size; x++) {
      const near = Math.min(...starts.map((p) => Math.hypot(p.x - x, p.z - z)));
      s.heights.push(
        near < 15
          ? 0
          : Math.min(1, (near - 15) / 10) *
              (1.1 + Math.sin(x * 0.07) * 0.9 + Math.cos(z * 0.06) * 0.6),
      );
    }
  starts.forEach((p, i) => {
    s.intel[i] = {};
    s.visibleIds[i] = [];
    const hall = spawn(s, "townhall", i, p);
    s.factions[i] = {
      id: i,
      name:
        config.mode === "teams"
          ? ["Azure hearth", "Ember hearth"][i]
          : config.participants[i].name,
      color: COLORS[i],
      alive: true,
      townhall: hall.id,
      stock: emptyStock(),
      members: [],
      explored: Array(size * size).fill(0),
    };
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI * 2) / 12;
      spawn(s, "tree", -1, {
        x: p.x + Math.cos(a) * 10,
        y: 0,
        z: p.z + Math.sin(a) * 10,
      });
    }
    for (let j = 0; j < 4; j++) {
      spawn(s, "stone", -1, { x: p.x - 7 + j, y: 0, z: p.z - 7 });
      spawn(s, "ore", -1, { x: p.x + 7 + j, y: 0, z: p.z - 6 });
      spawn(s, "deer", -1, { x: p.x + 7 + j, y: 0, z: p.z + 7 });
    }
  });
  config.participants.forEach((v, i) => {
    const id = i + 1,
      f = config.mode === "teams" ? v.team! : i,
      h = s.entities[s.factions[f].townhall],
      pos = {
        x: h.pos.x + (s.factions[f].members.length - 1.5) * 1.2,
        y: h.pos.y,
        z: h.pos.z + 5,
      };
    s.players[id] = {
      id,
      name: v.name,
      controller: v.controller,
      faction: f,
      pos,
      vel: { x: 0, y: 0, z: 0 },
      yaw: Math.PI,
      pitch: 0,
      hp: 100,
      lives: LIVES[config.difficulty],
      dead: false,
      eliminated: false,
      respawnAt: 0,
      protectionUntil: 0,
      pack: emptyStock(),
      weapons: [null, null],
      slot: 0,
      ammo: { arrow: 0, bolt: 0, catapult: 0 },
      tools: 0,
      armor: 0,
      cooldown: 0,
      heal: 0,
      healUntil: 0,
      eatReady: 0,
      input: { ...emptyInput(), yaw: Math.PI },
      lastSeq: 0,
      ai: { next: 0, phase: "gather", raid: false },
      deathTick: -1,
    };
    s.factions[f].members.push(id);
  });
  for (let i = 0; i < size * 2; i++) {
    const x = 5 + random(s) * (size - 10),
      z = 5 + random(s) * (size - 10);
    if (starts.some((p) => Math.hypot(p.x - x, p.z - z) < 17)) continue;
    spawn(s, random(s) < 0.7 ? "tree" : random(s) < 0.5 ? "stone" : "ore", -1, {
      x,
      y: 0,
      z,
    });
  }
  return { state: s, physics: await PhysicsPort.create(s) };
}
