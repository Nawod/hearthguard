import type { GameRuntime } from "./types";
import { ground } from "./world";
import { footSpeed } from "./aim";
export function updateMovement(r: GameRuntime, dt: number): void {
  const s = r.state;
  for (let sub = 0; sub < 2; sub++) {
    for (const p of Object.values(s.players)) {
      if (p.dead || p.eliminated) continue;
      const i = p.input,
        owned = s.entities[p.vehicleId ?? -1],
        v = owned?.occupant === p.id ? owned : undefined;
      p.yaw = i.yaw;
      p.pitch = i.pitch;
      p.slot = i.weaponSlot;
      const magnitude = Math.min(1, Math.hypot(i.move.x, i.move.z)),
        angle = Math.atan2(i.move.x, -i.move.z) + i.yaw;
      let travelAngle = angle,
        speed =
          (v?.type === "horse" ? 8.5 : footSpeed(i)) *
          (s.tick < (p.trappedUntil ?? 0) ? 0.15 : 1);
      if (v?.type === "horse") {
        const turn = Math.atan2(
          Math.sin((magnitude > 0.05 ? angle : v.yaw) - v.yaw),
          Math.cos((magnitude > 0.05 ? angle : v.yaw) - v.yaw),
        );
        v.yaw += Math.max((-2.6 * dt) / 2, Math.min((2.6 * dt) / 2, turn));
        const target = 8.5 * magnitude,
          accel = target > (v.speed ?? 0) ? 4 : 8;
        v.speed =
          (v.speed ?? 0) +
          Math.max(
            (-accel * dt) / 2,
            Math.min((accel * dt) / 2, target - (v.speed ?? 0)),
          );
        travelAngle = v.yaw;
        speed = v.speed * (s.tick < (p.trappedUntil ?? 0) ? 0.15 : 1);
      }
      if (magnitude > 0.05 || i.attack) p.action = undefined;
      if (v?.type === "catapult") {
        const turn = Math.atan2(
          Math.sin(angle - v.yaw),
          Math.cos(angle - v.yaw),
        );
        if (magnitude > 0.05)
          v.yaw += Math.max((-1.2 * dt) / 2, Math.min((1.2 * dt) / 2, turn));
        v.speed = 1.4 * magnitude * (s.tick < (p.trappedUntil ?? 0) ? 0.15 : 1);
        const ignored = new Set([
          p.id,
          ...Object.values(s.entities)
            .filter(
              (e) =>
                e.type === "gate" && !e.gateLocked && e.faction === p.faction,
            )
            .map((e) => e.id),
        ]);
        const result = r.physics.moveCharacter(
          v.id,
          {
            x: (Math.sin(v.yaw) * v.speed * dt) / 2,
            y: (-9.81 * dt) / 2,
            z: (-Math.cos(v.yaw) * v.speed * dt) / 2,
          },
          ignored,
          0.6,
        );
        if (
          result.position.x >= 2 &&
          result.position.z >= 2 &&
          result.position.x <= s.size - 2 &&
          result.position.z <= s.size - 2
        )
          v.pos = result.position;
        else {
          r.physics.removeEntity(v.id);
          r.physics.addVehicle(v);
        }
        p.pos = {
          x: v.pos.x - Math.sin(v.yaw) * 1.6,
          y: ground(s, v.pos.x, v.pos.z),
          z: v.pos.z + Math.cos(v.yaw) * 1.6,
        };
        p.vel = {
          x: Math.sin(v.yaw) * v.speed,
          y: 0,
          z: -Math.cos(v.yaw) * v.speed,
        };
        r.physics.teleport(p.id, p.pos);
        continue;
      }
      p.vel.y -= (9.81 * dt) / 2;
      const groundY = ground(s, p.pos.x, p.pos.z);
      if (p.pos.y <= groundY + 0.08 && i.jump && sub === 0) p.vel.y = 5.2;
      const d = {
          x:
            (Math.sin(travelAngle) *
              speed *
              (v?.type === "horse" ? 1 : magnitude) *
              dt) /
            2,
          y: (p.vel.y * dt) / 2,
          z:
            (-Math.cos(travelAngle) *
              speed *
              (v?.type === "horse" ? 1 : magnitude) *
              dt) /
            2,
        },
        result = r.physics.moveCharacter(
          p.id,
          d,
          new Set(
            Object.values(s.entities)
              .filter(
                (e) =>
                  e.type === "gate" &&
                  !e.gateLocked &&
                  e.faction === p.faction &&
                  e.hp > 0,
              )
              .map((e) => e.id),
          ),
        );
      p.vel.x = (result.position.x - p.pos.x) / (dt / 2);
      p.vel.z = (result.position.z - p.pos.z) / (dt / 2);
      p.pos = result.position;
      if (result.grounded && p.vel.y < 0) p.vel.y = 0;
      if (
        p.pos.x < 1 ||
        p.pos.z < 1 ||
        p.pos.x > s.size - 1 ||
        p.pos.z > s.size - 1
      ) {
        p.pos.x = Math.max(1, Math.min(s.size - 1, p.pos.x));
        p.pos.z = Math.max(1, Math.min(s.size - 1, p.pos.z));
        r.physics.teleport(p.id, p.pos);
      }
      if (p.pos.y < groundY - 2) {
        p.pos.y = groundY;
        r.physics.teleport(p.id, p.pos);
        p.vel.y = 0;
      }
      if (v?.type === "horse") {
        v.pos = { ...p.pos };
      }
    }
    r.physics.step(dt / 2);
  }
}
