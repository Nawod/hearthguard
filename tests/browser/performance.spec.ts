import { writeFile, mkdir } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { createFixture } from "../helpers/fixture";
import { spawn, ground } from "../../src/game/world";
import { encodeSave } from "../../src/game/save";
import { savedFixture } from "./helpers";
test("eight travelers, vehicles and populated cities render within the declared proxy budget", async ({
  page,
}, info) => {
  const r = await createFixture({
    mode: "teams",
    participants: Array.from({ length: 8 }, (_, i) => ({
      name: "Traveler " + i,
      controller: "human",
      team: i < 4 ? 0 : 1,
    })),
  });
  for (const p of Object.values(r.state.players)) {
    p.pos = { x: 20 + p.id * 1.7, y: 0, z: 23 };
    p.pos.y = ground(r.state, p.pos.x, p.pos.z);
    r.physics.teleport(p.id, p.pos);
    const horse = spawn(r.state, "horse", p.faction, {
      ...p.pos,
      z: p.pos.z + 4,
    });
    horse.owner = p.id;
    p.vehicleId = horse.id;
    r.physics.addEntity(horse);
  }
  for (let i = 0; i < 48; i++) {
    const type = (
        [
          "tower",
          "armory",
          "smithy",
          "wall",
          "gate",
          "stable",
          "storage",
          "farm",
        ] as const
      )[i % 8],
      e = spawn(r.state, type, i % 2, {
        x: 5 + (i % 8) * 8,
        y: 0,
        z: 32 + Math.floor(i / 8) * 7,
      });
    r.physics.addEntity(e);
  }
  const save = encodeSave(r);
  r.physics.dispose();
  const cdp = await page.context().newCDPSession(page);
  if (info.project.name === "phone")
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await savedFixture(page, save);
  await page.waitForTimeout(8000);
  const report = await page.locator("canvas[data-engine]").evaluate((c) => {
    const canvas = c as HTMLCanvasElement,
      gl = canvas.getContext("webgl2")!,
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      fps: Number(canvas.dataset.fps),
      drawCalls: Number(canvas.dataset.drawCalls),
      triangles: Number(canvas.dataset.triangles),
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "Unavailable",
      viewport: [innerWidth, innerHeight],
      pixelRatio: devicePixelRatio,
    };
  });
  await mkdir("docs/evidence", { recursive: true });
  await writeFile(
    `docs/evidence/${info.project.name}-render-performance.json`,
    JSON.stringify(
      {
        ...report,
        cpuThrottle: info.project.name === "phone" ? 4 : 1,
        participants: 8,
        vehicles: 8,
        additionalBuildings: 48,
      },
      null,
      2,
    ),
  );
  await info.attach("render-performance.json", {
    body: JSON.stringify(
      {
        ...report,
        project: info.project.name,
        cpuThrottle: info.project.name === "phone" ? 4 : 1,
        participants: 8,
        vehicles: 8,
        additionalBuildings: 48,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(report.fps).toBeGreaterThan(info.project.name === "desktop" ? 55 : 30);
  await page.screenshot({
    path: `test-results/${info.project.name}-stress.png`,
  });
  await cdp.detach();
});
