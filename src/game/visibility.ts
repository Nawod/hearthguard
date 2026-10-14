import type { GameRuntime, GameState, PlayerView, Player } from "./types";
import { distance } from "./world";
export function visible(
  s: GameState,
  faction: number,
  pos: { x: number; y: number; z: number },
  id?: number,
): boolean {
  if (id !== undefined) return s.visibleIds[faction]?.includes(id) ?? false;
  return (
    Object.values(s.players).some(
      (p) =>
        p.faction === faction &&
        !p.dead &&
        !p.eliminated &&
        distance(p.pos, pos) < 36,
    ) ||
    Object.values(s.entities).some(
      (e) =>
        e.faction === faction &&
        e.hp > 0 &&
        e.progress === 1 &&
        distance(e.pos, pos) < 16,
    )
  );
}
type Observer = {
  id: number;
  pos: { x: number; y: number; z: number };
  range: number;
};
const exploredPositions = new WeakMap<GameState, Map<number, string>>();
function observersFor(r: GameRuntime, faction: number): Observer[] {
  return [
    ...Object.values(r.state.players)
      .filter((p) => p.faction === faction && !p.dead && !p.eliminated)
      .map((p) => ({
        id: p.id,
        pos: { ...p.pos, y: p.pos.y + 1.4 },
        range: 36,
      })),
    ...Object.values(r.state.entities)
      .filter(
        (e) =>
          e.faction === faction &&
          e.hp > 0 &&
          e.progress === 1 &&
          ["townhall", "tower"].includes(e.type),
      )
      .map((e) => ({ id: e.id, pos: { ...e.pos, y: e.pos.y + 6 }, range: 16 })),
  ];
}
function lineOfSight(
  r: GameRuntime,
  faction: number,
  pos: { x: number; y: number; z: number },
  targetId?: number,
  observers = observersFor(r, faction),
): boolean {
  return observers.some((o) => {
    const d = distance(o.pos, pos);
    if (d > o.range) return false;
    const delta = {
        x: pos.x - o.pos.x,
        y: pos.y + 1 - o.pos.y,
        z: pos.z - o.pos.z,
      },
      length = Math.hypot(delta.x, delta.y, delta.z);
    if (length < 0.1) return true;
    const hit = r.physics.raycast(
      o.pos,
      { x: delta.x / length, y: delta.y / length, z: delta.z / length },
      length + 0.05,
      o.id,
    );
    return !hit || hit.entityId === targetId;
  });
}
export function updateVisibility(r: GameRuntime): void {
  const s = r.state,
    targets = [...Object.values(s.players), ...Object.values(s.entities)];
  for (const f of Object.values(s.factions)) {
    const ids: number[] = [],
      observers = observersFor(r, f.id);
    for (const target of targets)
      if (
        target.faction === f.id ||
        lineOfSight(r, f.id, target.pos, target.id, observers)
      ) {
        ids.push(target.id);
        if (
          "progress" in target &&
          target.faction !== f.id &&
          !["trap", "bag", "horse", "catapult"].includes(target.type)
        )
          s.intel[f.id][target.id] = {
            ...structuredClone(target),
            ghost: true,
          };
      }
    s.visibleIds[f.id] = ids;
    for (const [id, e] of Object.entries(s.intel[f.id])) {
      const live = s.entities[+id];
      if (
        lineOfSight(r, f.id, e.pos, +id, observers) &&
        (!live || (e.type === "deer" && distance(live.pos, e.pos) > 0.2))
      )
        delete s.intel[f.id][+id];
    }
  }
  let positions = exploredPositions.get(s);
  if (!positions) {
    positions = new Map();
    exploredPositions.set(s, positions);
  }
  for (const p of Object.values(s.players)) {
    if (p.dead || p.eliminated) continue;
    const key = `${Math.floor(p.pos.x)}:${Math.floor(p.pos.z)}`;
    if (positions.get(p.id) === key) continue;
    positions.set(p.id, key);
    const f = s.factions[p.faction];
    for (
      let z = Math.max(0, Math.floor(p.pos.z) - 36);
      z < Math.min(s.size, p.pos.z + 36);
      z++
    )
      for (
        let x = Math.max(0, Math.floor(p.pos.x) - 36);
        x < Math.min(s.size, p.pos.x + 36);
        x++
      )
        if (Math.hypot(x - p.pos.x, z - p.pos.z) < 36)
          f.explored[z * s.size + x] = 1;
  }
}

export function makeView(s: GameState, id: number): PlayerView {
  const p = s.players[id],
    f = s.factions[p.faction],
    players = Object.values(s.players)
      .filter(
        (v) =>
          v.id === id ||
          v.faction === p.faction ||
          (!v.dead && !v.eliminated && visible(s, p.faction, v.pos, v.id)),
      )
      .map((v) => {
        const c = structuredClone(v);
        if (v.id !== id) {
          c.input = {
            ...c.input,
            move: { x: 0, z: 0 },
            attack: false,
            interact: false,
          };
          c.ai = { next: 0, phase: "", raid: false };
          c.action = undefined;
          if (v.faction !== p.faction) {
            c.pack = { food: 0, wood: 0, stone: 0, ore: 0 };
            c.ammo = { arrow: 0, bolt: 0, catapult: 0 };
          }
        }
        return c;
      }),
    entities = Object.values(s.entities)
      .filter(
        (e) =>
          e.faction === p.faction ||
          (visible(s, p.faction, e.pos, e.id) &&
            !(
              e.type === "trap" &&
              e.faction !== p.faction &&
              distance(p.pos, e.pos) > 3
            )),
      )
      .map((e) => {
        const c = structuredClone(e);
        if (e.faction !== p.faction) {
          c.queue = [];
          c.stock = { food: 0, wood: 0, stone: 0, ore: 0 };
          c.equipment = [];
          c.goal = undefined;
          c.home = undefined;
        }
        return c;
      });
  for (const e of Object.values(s.intel[p.faction] ?? {}))
    if (!entities.some((v) => v.id === e.id)) {
      const copy = structuredClone(e);
      copy.queue = [];
      copy.stock = { food: 0, wood: 0, stone: 0, ore: 0 };
      copy.equipment = [];
      copy.goal = undefined;
      copy.home = undefined;
      entities.push(copy);
    }
  return {
    version: 1,
    tick: s.tick,
    playerId: id,
    size: s.size,
    heights: s.heights,
    config: s.config,
    players,
    entities,
    factions: Object.values(s.factions).map((v) => ({
      ...structuredClone({ ...v, explored: [] }),
      stock:
        v.id === p.faction ? v.stock : { food: 0, wood: 0, stone: 0, ore: 0 },
      explored: [],
    })),
    projectiles: s.projectiles.filter((v) => visible(s, p.faction, v.pos)),
    events: s.events
      .filter((e) => e.faction === undefined || e.faction === p.faction)
      .slice(-8),
    paused: s.paused,
    result: s.result,
    ack: p.lastSeq,
    fog: f.explored,
  };
}
