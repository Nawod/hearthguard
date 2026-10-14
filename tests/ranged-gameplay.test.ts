import { describe, it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { fire, updateCombat, queueDamage } from "../src/game/combat";
import { resolveLifecycle } from "../src/game/lifecycle";
import { applyInput, applyCommand, stepGame } from "../src/game/engine";
import { updateMovement } from "../src/game/movement";
import { spawn, ground } from "../src/game/world";
import { encodeSave, restoreSave } from "../src/game/save";
import { updateVisibility } from "../src/game/visibility";
import { emptyInput } from "../src/game/types";
import { updateAI } from "../src/game/ai";
import { validateMessage } from "../server/validation";
import { FollowCamera } from "../src/render/camera";

async function arena() {
  const r = await createFixture({ difficulty: "hard" });
  for (const e of Object.values(r.state.entities))
    if (e.faction < 0) {
      r.physics.removeEntity(e.id);
      delete r.state.entities[e.id];
    }
  const p = r.state.players[1],
    enemy = r.state.players[2];
  p.pos = { x: 45, y: ground(r.state, 45, 45), z: 45 };
  enemy.pos = { x: 45, y: ground(r.state, 45, 30), z: 30 };
  p.yaw = 0;
  p.pitch = 0;
  p.input = emptyInput();
  enemy.controller = "human";
  r.physics.teleport(1, p.pos);
  r.physics.teleport(2, enemy.pos);
  r.physics.step(1 / 60);
  p.weapons = ["bow", "crossbow"];
  p.ammo = { arrow: 10, bolt: 10, catapult: 0 };
  return r;
}
describe("deliberate ranged combat and defense", () => {
  it("fires one crossbow bolt per press, even across a completed reload", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1];
      p.slot = 1;
      p.input.attack = true;
      for (let i = 0; i < 120; i++) {
        r.state.tick++;
        updateCombat(r, 1 / 30);
      }
      expect(p.ammo.bolt).toBe(9);
      p.input.attack = false;
      updateCombat(r, 1 / 30);
      p.input.attack = true;
      updateCombat(r, 1 / 30);
      expect(p.ammo.bolt).toBe(8);
    } finally {
      r.physics.dispose();
    }
  });
  it("steady bow aim increases launch power without spending ammunition while aiming", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1];
      fire(r, 1);
      const quick = r.state.projectiles[0];
      p.cooldown = 0;
      r.state.projectiles = [];
      p.input.aim = true;
      for (let i = 0; i < 45; i++) {
        r.state.tick++;
        updateCombat(r, 1 / 30);
      }
      expect(p.ammo.arrow).toBe(9);
      fire(r, 1);
      const aimed = r.state.projectiles[0];
      expect(aimed.damage).toBeGreaterThan(quick.damage);
      expect(Math.hypot(aimed.vel.x, aimed.vel.y, aimed.vel.z)).toBeGreaterThan(
        Math.hypot(quick.vel.x, quick.vel.y, quick.vel.z),
      );
    } finally {
      r.physics.dispose();
    }
  });
  it("rejects remote and non-finite camera origins instead of accepting a forged sight ray", async () => {
    const r = await arena();
    try {
      expect(
        applyInput(r, 1, {
          ...emptyInput(),
          seq: 1,
          aim: true,
          aimOrigin: { x: 1e6, y: 0, z: 0 },
        } as any).ok,
      ).toBe(false);
      expect(
        applyInput(r, 1, {
          ...emptyInput(),
          seq: 2,
          aim: true,
          aimOrigin: { x: NaN, y: 0, z: 0 },
        } as any).ok,
      ).toBe(false);
      expect(
        applyInput(r, 1, {
          ...emptyInput(),
          seq: 3,
          aim: true,
          aimOrigin: { x: 45.65, y: 1.7, z: 48 },
        } as any).ok,
      ).toBe(true);
    } finally {
      r.physics.dispose();
    }
  });
  it("holding aim suppresses sprinting and steadies movement", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1];
      p.input = {
        ...emptyInput(),
        aim: true,
        sprint: true,
        move: { x: 1, z: 0 },
      };
      const x = p.pos.x;
      updateMovement(r, 1 / 30);
      expect(p.pos.x - x).toBeLessThan(3 / 30);
    } finally {
      r.physics.dispose();
    }
  });
  it("melee guard covers the front, but not the back or bear traps", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1],
        e = r.state.players[2];
      p.weapons = ["sword", null];
      p.input.aim = true;
      e.pos = { ...p.pos, z: p.pos.z - 2 };
      queueDamage(r, 1, 20, 2);
      resolveLifecycle(r, 0);
      expect(p.hp).toBe(91);
      e.pos = { ...p.pos, z: p.pos.z + 2 };
      queueDamage(r, 1, 20, 2);
      resolveLifecycle(r, 0);
      expect(p.hp).toBe(71);
      const trap = spawn(r.state, "trap", 1, { ...p.pos, z: p.pos.z - 1 });
      queueDamage(r, 1, 20, trap.id);
      resolveLifecycle(r, 0);
      expect(p.hp).toBe(51);
    } finally {
      r.physics.dispose();
    }
  });
  it("aiming camera looks along the actual shooting direction at every pitch", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1];
      p.input.aim = true;
      const view = {
        size: r.state.size,
        heights: r.state.heights,
        entities: [],
      } as any;
      for (const pitch of [-0.6, 0, 0.6]) {
        const cam = new FollowCamera();
        cam.update(p, view, 0, pitch, 1 / 60);
        const point = {
          x: cam.camera.position.x,
          y: cam.camera.position.y - Math.sin(pitch) * 30,
          z: cam.camera.position.z - Math.cos(pitch) * 30,
        };
        const projected = cam.project(point);
        expect(Math.abs(projected.x)).toBeLessThan(0.001);
        expect(Math.abs(projected.y)).toBeLessThan(0.001);
      }
    } finally {
      r.physics.dispose();
    }
  });
  it("records damage confirmation only for actual enemy damage", async () => {
    const r = await arena();
    try {
      queueDamage(r, 2, 12, 1);
      resolveLifecycle(r, 0);
      expect((r.state.players[1] as any).combat?.lastHitTick).toBe(
        r.state.tick,
      );
    } finally {
      r.physics.dispose();
    }
  });
  it("restores focus and trigger state, while accepting older saves without the new fields", async () => {
    const r = await arena();
    let restored;
    try {
      const p = r.state.players[1];
      p.input.aim = true;
      for (let i = 0; i < 20; i++) {
        r.state.tick++;
        updateCombat(r, 1 / 30);
      }
      expect((p as any).combat?.focus).toBeGreaterThan(0);
      const save = encodeSave(r);
      restored = await restoreSave(save);
      expect((restored.state.players[1] as any).combat).toEqual(
        (p as any).combat,
      );
      restored.physics.dispose();
      restored = undefined;
      delete (save.state.players[1] as any).combat;
      restored = await restoreSave(save);
      updateCombat(restored, 1 / 30);
      expect((restored.state.players[1] as any).combat?.focus).toBeGreaterThan(
        0,
      );
    } finally {
      r.physics.dispose();
      restored?.physics.dispose();
    }
  });
  it("converges a shoulder camera ray onto a nearby enemy while the muzzle still obeys cover", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1],
        enemy = r.state.players[2];
      p.input.aim = true;
      (p as any).combat = {
        weapon: "bow",
        focus: 1,
        triggerHeld: false,
        lastHitTick: -100,
      };
      (p.input as any).aimOrigin = { x: 45.65, y: p.pos.y + 1.3, z: 48 };
      const dx = enemy.pos.x - (p.input as any).aimOrigin.x,
        dz = enemy.pos.z - (p.input as any).aimOrigin.z;
      p.yaw = Math.atan2(dx, -dz);
      p.pitch = Math.atan2(
        (p.input as any).aimOrigin.y - (enemy.pos.y + 1),
        Math.hypot(dx, dz),
      );
      fire(r, 1);
      for (let i = 0; i < 25; i++) {
        r.state.tick++;
        updateCombat(r, 1 / 30);
        resolveLifecycle(r, 1 / 30);
      }
      expect(enemy.hp).toBeLessThan(100);
      p.cooldown = 0;
      r.state.projectiles = [];
      enemy.hp = 100;
      const wall = spawn(r.state, "wall", 1, { x: 45, y: 0, z: 42.5 });
      r.physics.addEntity(wall);
      r.physics.step(1 / 60);
      (p as any).combat.focus = 1;
      fire(r, 1);
      for (let i = 0; i < 25; i++) {
        r.state.tick++;
        updateCombat(r, 1 / 30);
        resolveLifecycle(r, 1 / 30);
      }
      expect(enemy.hp).toBe(100);
      expect(wall.hp).toBeLessThan(wall.maxHp);
    } finally {
      r.physics.dispose();
    }
  });
  it("guard uses the incoming projectile direction instead of the shooter's current position", async () => {
    const r = await arena();
    try {
      const p = r.state.players[1],
        enemy = r.state.players[2];
      p.weapons = ["sword", null];
      p.input.aim = true;
      enemy.pos = { ...p.pos, z: p.pos.z + 10 };
      queueDamage(r, 1, 20, enemy.id, {
        origin: { ...p.pos, z: p.pos.z - 1 },
        blockable: true,
      });
      resolveLifecycle(r, 0);
      expect(p.hp).toBe(91);
      queueDamage(r, 1, 20, enemy.id, {
        origin: { ...p.pos, z: p.pos.z - 1 },
        blockable: false,
      });
      resolveLifecycle(r, 0);
      expect(p.hp).toBe(71);
    } finally {
      r.physics.dispose();
    }
  });
  it("rejects starting repairs without deposited wood instead of starting an endless task", async () => {
    const r = await createFixture();
    try {
      const p = r.state.players[1],
        hall = r.state.entities[r.state.factions[0].townhall];
      hall.hp -= 30;
      expect(applyCommand(r, 1, { type: "repair", target: hall.id }).ok).toBe(
        false,
      );
      expect(p.action).toBeUndefined();
      r.state.factions[0].stock.wood = 1;
      expect(applyCommand(r, 1, { type: "repair", target: hall.id }).ok).toBe(
        true,
      );
    } finally {
      r.physics.dispose();
    }
  });

  it("AI readies, fires and releases its bow trigger repeatedly under the same player rules", async () => {
    const r = await arena();
    try {
      const bot = r.state.players[2],
        human = r.state.players[1];
      bot.controller = "ai";
      bot.weapons = ["sword", "bow"];
      bot.ammo.arrow = 10;
      bot.pos = { ...human.pos, z: human.pos.z + 10 };
      r.physics.teleport(bot.id, bot.pos);
      r.physics.step(1 / 60);
      updateVisibility(r);
      for (let i = 0; i < 240 && !r.state.result; i++) stepGame(r);
      expect(bot.ammo.arrow).toBeLessThanOrEqual(8);
      expect(human.hp < 100 || human.dead).toBe(true);
    } finally {
      r.physics.dispose();
    }
  });
  it("online message validation carries a legal camera origin and rejects malformed vectors", () => {
    const input = {
      ...emptyInput(),
      seq: 1,
      aim: true,
      aimOrigin: { x: 45.6, y: 1.5, z: 48 },
    };
    expect(validateMessage({ type: "input", input })).toEqual({
      type: "input",
      input,
    });
    expect(() =>
      validateMessage({
        type: "input",
        input: { ...input, aimOrigin: { x: NaN, y: 0, z: 0 } },
      }),
    ).toThrow();
    expect(() =>
      validateMessage({
        type: "input",
        input: { ...input, aimOrigin: { ...input.aimOrigin, extra: 1 } },
      }),
    ).toThrow();
  });

  it("AI drops its aiming stance when returning to economy tasks", async () => {
    const r = await createFixture();
    try {
      const bot = r.state.players[2];
      bot.weapons = ["sword", "bow"];
      bot.input.aim = true;
      bot.ai.phase = "defend";
      updateVisibility(r);
      updateAI(r, 1 / 30);
      expect(bot.ai.phase).not.toBe("defend");
      expect(bot.input.aim).toBe(false);
    } finally {
      r.physics.dispose();
    }
  });
});
