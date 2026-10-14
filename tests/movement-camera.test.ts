import { it, expect } from "vitest";
import { createFixture } from "./helpers/fixture";
import { applyInput, stepGame } from "../src/game/engine";
import { emptyInput } from "../src/game/types";
import { FollowCamera } from "../src/render/camera";
import { makeView, updateVisibility } from "../src/game/visibility";
import { spawn } from "../src/game/world";
it('jumping requires ground and gravity brings the character back down',async()=>{const r=await createFixture();try{r.state.players[2].controller='human';const p=r.state.players[1];applyInput(r,1,{...emptyInput(),seq:1,jump:true});stepGame(r,6);expect(p.pos.y).toBeGreaterThan(.5);const airborneVelocity=p.vel.y;applyInput(r,1,{...emptyInput(),seq:2,jump:true});stepGame(r,1);expect(p.vel.y).toBeLessThan(airborneVelocity);applyInput(r,1,{...emptyInput(),seq:3,jump:false});stepGame(r,60);expect(p.pos.y).toBeCloseTo(0,1);expect(p.vel.y).toBe(0);}finally{r.physics.dispose();}});
it("camera stays clear of foreground trees and infantry diagonal movement is normalized", async () => {
  const a = await createFixture(),
    b = await createFixture();
  try {
    for (const r of [a, b]) r.state.players[2].controller = "human";
    const p = a.state.players[1];
    p.pos = { x: 16, y: 0, z: 21 };
    a.physics.teleport(1, p.pos);
    const tree = spawn(a.state, "tree", -1, { x: 16, y: 0, z: 25 });
    a.physics.addEntity(tree);
    updateVisibility(a);
    const camera = new FollowCamera();
    camera.update(p, makeView(a.state, 1), 0, 0, 1 / 60);
    expect(camera.camera.position.z).toBeLessThan(24);
    for (const r of [a, b]) {
      for (const e of Object.values(r.state.entities)) {
        r.physics.removeEntity(e.id);
        delete r.state.entities[e.id];
      }
      const player = r.state.players[1];
      player.pos = { x: 15, y: 0, z: 15 };
      r.physics.teleport(1, player.pos);
    }
    applyInput(a, 1, { ...emptyInput(), seq: 1, move: { x: 1, z: 0 } });
    applyInput(b, 1, { ...emptyInput(), seq: 1, move: { x: 1, z: 1 } });
    stepGame(a, 20);
    stepGame(b, 20);
    const distance = (r: typeof a) =>
      Math.hypot(r.state.players[1].pos.x - 15, r.state.players[1].pos.z - 15);
    expect(distance(a)).toBeCloseTo(distance(b), 3);
  } finally {
    a.physics.dispose();
    b.physics.dispose();
  }
});
it("normalized movement collides, is grounded and rejects stale input", async () => {
  const r = await createFixture();
  try {
    r.state.players[2].controller = "human";
    const p = r.state.players[1];
    expect(
      applyInput(r, 1, {
        ...emptyInput(),
        seq: 1,
        move: { x: 0, z: -1 },
        yaw: 0,
      }).ok,
    ).toBe(true);
    stepGame(r, 100);
    expect(p.pos.z).toBeGreaterThan(19);
    expect(p.pos.y).toBeCloseTo(0, 1);
    expect(applyInput(r, 1, { ...emptyInput(), seq: 1 }).ok).toBe(false);
  } finally {
    r.physics.dispose();
  }
});
