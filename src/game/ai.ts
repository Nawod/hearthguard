import { canReach } from "./rules";
import type {
  GameRuntime,
  Player,
  Resource,
  Entity,
  Vec3,
  Building,
  Stock,
} from "./types";
import { resourceOf, BUILDINGS, RECIPES } from "./balance";
import { distance, random } from "./world";
import { findRoute } from "./navigation";
import { visible } from "./visibility";
import { applyCommand, applyInput } from "./engine";
function steer(r: GameRuntime, p: Player, goal: Vec3): void {
  if (
    !p.ai.goalPoint ||
    distance(p.ai.goalPoint, goal) > 1 ||
    !p.ai.route?.length ||
    r.state.tick >= (p.ai.nextPath ?? 0)
  ) {
    const known = Object.values(r.state.entities).filter(
        (e) =>
          e.faction === p.faction || visible(r.state, p.faction, e.pos, e.id),
      ),
      remembered = Object.values(r.state.intel[p.faction] ?? {}).filter(
        (e) =>
          !known.some((v) => v.id === e.id) &&
          !["deer", "horse", "catapult"].includes(e.type),
      );
    p.ai.route = findRoute(
      {
        ...r.state,
        entities: Object.fromEntries(
          [...known, ...remembered].map((e) => [e.id, e]),
        ),
      },
      p.pos,
      goal,
      p.faction,
    );
    p.ai.goalPoint = { ...goal };
    p.ai.nextPath = r.state.tick + 150;
  }
  while (p.ai.route.length && distance(p.pos, p.ai.route[0]) < 0.5)
    p.ai.route.shift();
  const pos = p.ai.route[0] ?? goal,
    yaw = Math.atan2(pos.x - p.pos.x, -(pos.z - p.pos.z));
  applyInput(r, p.id, {
    ...p.input,
    seq: p.lastSeq + 1,
    move: { x: 0, z: -1 },
    yaw,
    jump: false,
    attack: false,
    aim: false,
    sprint: false,
  });
}
function stand(r: GameRuntime, p: Player): void {
  applyInput(r, p.id, {
    ...p.input,
    seq: p.lastSeq + 1,
    move: { x: 0, z: 0 },
    attack: false,
    aim: false,
    jump: false,
  });
}
function canPay(bank: Stock, cost: Partial<Stock>): boolean {
  return Object.entries(cost).every(([k, n]) => bank[k as Resource] >= n!);
}
function buildSite(
  r: GameRuntime,
  p: Player,
  type: Building,
): Vec3 | undefined {
  const s = r.state,
    hall = s.entities[s.factions[p.faction].townhall],
    d = BUILDINGS[type];
  for (const radius of [13, 19, 25])
    for (let j = 0; j < 16; j++) {
      const angle = (j * Math.PI) / 8,
        pos = {
          x: Math.round(hall.pos.x + Math.sin(angle) * radius),
          y: 0,
          z: Math.round(hall.pos.z + Math.cos(angle) * radius),
        };
      if (
        pos.x < d.size ||
        pos.z < d.size ||
        pos.x > s.size - d.size ||
        pos.z > s.size - d.size
      )
        continue;
      if (
        Object.values(s.entities).some((e) => {
          const def = BUILDINGS[e.type as Building];
          return (
            e.hp > 0 &&
            (def
              ? Math.abs(e.pos.x - pos.x) < (def.size + d.size) / 2 + 0.4 &&
                Math.abs(e.pos.z - pos.z) < (def.size + d.size) / 2 + 0.4
              : ["tree", "stone", "ore"].includes(e.type) &&
                e.amount > 0 &&
                Math.abs(e.pos.x - pos.x) < d.size / 2 + 0.7 &&
                Math.abs(e.pos.z - pos.z) < d.size / 2 + 0.7)
          );
        })
      )
        continue;
      return pos;
    }
}
function fight(r: GameRuntime, p: Player, target: Player | Entity): void {
  const dist = distance(p.pos, target.pos),
    ranged =
      "dead" in target &&
      dist > 5 &&
      p.weapons[1] === "bow" &&
      (r.state.config.difficulty !== "hard" || p.ammo.arrow > 0),
    range = ranged ? 16 : "dead" in target ? 2 : 5;
  if (dist > range) {
    steer(r, p, target.pos);
    return;
  }
  const jitter =
      (random(r.state) - 0.5) *
      (r.state.config.difficulty === "easy"
        ? 0.12
        : r.state.config.difficulty === "medium"
          ? 0.045
          : 0.008),
    yaw =
      Math.atan2(target.pos.x - p.pos.x, -(target.pos.z - p.pos.z)) + jitter;
  applyInput(r, p.id, {
    ...p.input,
    seq: p.lastSeq + 1,
    yaw,
    pitch: ranged
      ? Math.atan2(
          p.pos.y + 1.25 - (target.pos.y + 1),
          Math.hypot(target.pos.x - p.pos.x, target.pos.z - p.pos.z),
        )
      : 0,
    weaponSlot: ranged ? 1 : 0,
    attack: ranged
      ? p.cooldown <= 0 && (p.combat?.focus ?? 0) >= 0.8 && !p.input.attack
      : true,
    aim: ranged,
    move: { x: 0, z: 0 },
    sprint: false,
  });
}
export function updateAI(r: GameRuntime, _dt: number): void {
  const s = r.state;
  for (const p of Object.values(s.players)) {
    if (p.controller !== "ai" || p.dead || p.eliminated) continue;
    if (s.tick < p.ai.next) {
      if (
        p.ai.route?.length &&
        Math.hypot(p.input.move.x, p.input.move.z) > 0.1
      ) {
        while (p.ai.route.length && distance(p.pos, p.ai.route[0]) < 0.5)
          p.ai.route.shift();
        const point = p.ai.route[0];
        if (point)
          applyInput(r, p.id, {
            ...p.input,
            seq: p.lastSeq + 1,
            yaw: Math.atan2(point.x - p.pos.x, -(point.z - p.pos.z)),
          });
        else p.input.move = { x: 0, z: 0 };
      }
      continue;
    }
    p.ai.next =
      s.tick +
      (s.config.difficulty === "easy"
        ? 20
        : s.config.difficulty === "medium"
          ? 10
          : 5);
    const faction = s.factions[p.faction],
      hall = s.entities[faction.townhall],
      bank = faction.stock,
      own = Object.values(s.entities).filter(
        (e) => e.faction === p.faction && e.hp > 0,
      ),
      finished = (type: Building) =>
        own.find((e) => e.type === type && e.progress === 1),
      armory = finished("armory"),
      farm = finished("farm"),
      smithy = finished("smithy");
    if (p.hp < 80 && p.pack.food >= 10) applyCommand(r, p.id, { type: "eat" });
    const enemies = Object.values(s.players).filter(
        (e) =>
          e.faction !== p.faction &&
          !e.dead &&
          !e.eliminated &&
          visible(s, p.faction, e.pos, e.id),
      ),
      threat = enemies
        .filter(
          (e) => distance(e.pos, hall.pos) < 20 || distance(e.pos, p.pos) < 12,
        )
        .sort((a, b) => distance(p.pos, a.pos) - distance(p.pos, b.pos))[0];
    if (threat && (p.weapons[0] || distance(p.pos, threat.pos) < 3)) {
      p.ai.phase = "defend";
      fight(r, p, threat);
      continue;
    }
    const site = own.find((e) => e.progress < 1);
    if (site) {
      p.ai.phase = "construct";
      const size = BUILDINGS[site.type as Building].size;
      if (distance(p.pos, site.pos) > size / 2 + 2.2 || !canReach(r, p, site))
        steer(r, p, site.pos);
      else {
        stand(r, p);
        applyCommand(r, p.id, { type: "work", target: site.id });
      }
      continue;
    }
    if (hall.hp < hall.maxHp * 0.8 && bank.wood >= 5) {
      p.ai.phase = "repair";
      if (distance(p.pos, hall.pos) > 5.5)
        steer(r, p, { ...hall.pos, z: hall.pos.z + 5 });
      else {
        stand(r, p);
        applyCommand(r, p.id, { type: "repair", target: hall.id });
      }
      continue;
    }
    if (farm && farm.amount > 0 && p.pack.food < 20) {
      p.ai.phase = "harvest";
      if (distance(p.pos, farm.pos) > 4) steer(r, p, farm.pos);
      else {
        stand(r, p);
        applyCommand(r, p.id, { type: "harvest", target: farm.id });
      }
      continue;
    }
    const needsSeed = !!farm && !farm.cropAt && !farm.amount;
    if (needsSeed && bank.food >= 3) {
      p.ai.phase = "plant";
      if (distance(p.pos, farm.pos) > 4.5) steer(r, p, farm.pos);
      else {
        stand(r, p);
        applyCommand(r, p.id, { type: "plant", target: farm.id });
      }
      continue;
    }
    const stationFor = (id: number) => {
      const station = s.entities[id];
      if (
        !canReach(r, p, station) ||
        distance(p.pos, station.pos) >
          BUILDINGS[station.type as Building].size / 2 + 2.3
      ) {
        steer(r, p, station.pos);
        return false;
      }
      stand(r, p);
      return true;
    };
    let recipe: string | undefined, station: Entity | undefined;
    if (!p.tools) {
      recipe = "tools";
      station = hall;
    } else if (armory && !p.weapons[0]) {
      recipe = "sword";
      station = armory;
    } else if (smithy && !p.armor) {
      recipe = "armor";
      station = smithy;
    } else if (armory && !p.weapons[1] && finished("tower")) {
      recipe = "bow";
      station = armory;
    } else if (
      armory &&
      p.weapons[1] &&
      s.config.difficulty === "hard" &&
      p.ammo.arrow < 10
    ) {
      recipe = "arrow";
      station = armory;
    }
    if (recipe && station) {
      const def = RECIPES[recipe],
        stored = def.weapon && station.equipment.includes(def.weapon),
        queued = station.queue.some(
          (q) => q.actor === p.id && q.recipe === recipe,
        );
      if (stored || queued || canPay(bank, def.cost)) {
        p.ai.phase = "craft";
        if (stationFor(station.id)) {
          if (stored)
            applyCommand(r, p.id, {
              type: "equip",
              target: station.id,
              weapon: def.weapon!,
              slot: recipe === "bow" ? 1 : 0,
            });
          else if (!queued)
            applyCommand(r, p.id, {
              type: "craft",
              target: station.id,
              recipe,
            });
        }
        continue;
      }
    }
    const next: Building | undefined = !armory
      ? "armory"
      : !farm
        ? "farm"
        : !finished("tower")
          ? "tower"
          : !smithy
            ? "smithy"
            : undefined;
    if (next && !needsSeed && canPay(bank, BUILDINGS[next].cost)) {
      p.ai.phase = "plan " + next;
      if (p.ai.build !== next || !p.ai.site) {
        p.ai.build = next;
        p.ai.site = buildSite(r, p, next);
      }
      const pos = p.ai.site;
      if (pos) {
        const dx = hall.pos.x - pos.x,
          dz = hall.pos.z - pos.z,
          len = Math.hypot(dx, dz),
          clear = BUILDINGS[next].size * 0.71 + 2,
          approach = {
            x: pos.x + (dx / len) * clear,
            y: 0,
            z: pos.z + (dz / len) * clear,
          };
        if (distance(p.pos, approach) > 1) steer(r, p, approach);
        else {
          stand(r, p);
          if (
            applyCommand(r, p.id, {
              type: "build",
              building: next,
              pos,
              yaw: 0,
            }).ok
          ) {
            p.ai.site = undefined;
            p.ai.build = undefined;
          } else {
            p.ai.site = undefined;
            p.ai.next = s.tick + 60;
          }
        }
        continue;
      }
    }
    if (p.weapons[0] && !next && !recipe && p.pack.food >= 10) {
      p.ai.raid = true;
      p.ai.phase = "raid";
      const target = enemies.sort(
          (a, b) => distance(p.pos, a.pos) - distance(p.pos, b.pos),
        )[0],
        enemyHall = Object.values(s.entities).find(
          (e) =>
            e.type === "townhall" &&
            e.faction !== p.faction &&
            s.factions[e.faction]?.alive &&
            visible(s, p.faction, e.pos, e.id),
        ),
        knownHall = Object.values(s.intel[p.faction]).find(
          (e) => e.type === "townhall" && s.factions[e.faction]?.alive,
        );
      if (target || enemyHall) {
        fight(r, p, target ?? enemyHall!);
        continue;
      }
      steer(
        r,
        p,
        knownHall?.pos ?? {
          x: s.size - hall.pos.x,
          y: 0,
          z: s.size - hall.pos.z,
        },
      );
      continue;
    }
    const needed: Partial<Stock> = needsSeed
      ? { food: 3 }
      : recipe
        ? RECIPES[recipe].cost
        : next
          ? BUILDINGS[next].cost
          : { food: 6 };
    const wanted: Resource =
      p.pack.food < 20
        ? "food"
        : ((["wood", "stone", "ore", "food"] as const).find(
            (k) => bank[k] < (needed[k] ?? 0),
          ) ?? "food");
    const total = Object.values(p.pack).reduce((a, b) => a + b, 0),
      bankable = { ...p.pack, food: Math.max(0, p.pack.food - 20) },
      hasCargo = Object.values(bankable).some((n) => n > 0),
      enough =
        hasCargo &&
        (total >= 75 ||
          bankable[wanted] + bank[wanted] >= (needed[wanted] ?? 0) + 1);
    if (enough) {
      p.ai.phase = "deposit";
      if (distance(p.pos, hall.pos) > 5.5)
        steer(r, p, { ...hall.pos, z: hall.pos.z + 5 });
      else {
        stand(r, p);
        applyCommand(r, p.id, {
          type: "deposit",
          target: hall.id,
          amounts: bankable,
        });
      }
      continue;
    }
    const known = Object.values(s.entities).filter((e) =>
        visible(s, p.faction, e.pos, e.id),
      ),
      memories = Object.values(s.intel[p.faction]).filter(
        (e) => !visible(s, p.faction, e.pos, e.id) && e.type !== "deer",
      );
    const target = [...known, ...memories]
      .filter(
        (e) =>
          resourceOf(e.type) === wanted &&
          e.amount > 0 &&
          distance(e.pos, hall.pos) < 38,
      )
      .sort((a, b) => distance(a.pos, p.pos) - distance(b.pos, p.pos))[0];
    p.ai.phase = "gather " + wanted;
    if (target) {
      if (distance(p.pos, target.pos) > 2.7 || !canReach(r, p, target))
        steer(r, p, target.pos);
      else {
        stand(r, p);
        applyCommand(r, p.id, { type: "interact", target: target.id });
      }
    } else
      steer(r, p, {
        x: hall.pos.x + (random(s) - 0.5) * 24,
        y: 0,
        z: hall.pos.z + (random(s) - 0.5) * 24,
      });
  }
}
