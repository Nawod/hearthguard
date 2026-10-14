import { it, expect } from "vitest";
import { SnapshotMotion } from "../src/render/snapshot-motion";
import { ViewStream } from "../src/session/stream";
import type { PlayerView } from "../src/game/types";
it("renders intermediate poses and turns across the short angle instead of jumping between snapshots", () => {
  const m = new SnapshotMotion();
  m.push([{ id: 1, pos: { x: 1, y: 0, z: 1 }, yaw: Math.PI * 0.99 }], 0, 0.1);
  m.push(
    [{ id: 1, pos: { x: 2, y: 0, z: 1 }, yaw: -Math.PI * 0.99 }],
    100,
    0.1,
  );
  const p = m.sample(1, 150)!;
  expect(p.pos.x).toBeCloseTo(1.5);
  expect(Math.abs(p.yaw)).toBeCloseTo(Math.PI);
  expect(m.sample(1, 500)!.pos.x).toBe(2);
});
it("snaps teleports and removes undisclosed actors immediately", () => {
  const m = new SnapshotMotion();
  m.push([{ id: 1, pos: { x: 1, y: 0, z: 1 }, yaw: 0 }], 0, 0.1);
  m.push([{ id: 1, pos: { x: 25, y: 0, z: 1 }, yaw: 0 }], 100, 0.1);
  expect(m.sample(1, 101)!.pos.x).toBe(25);
  m.push([], 200, 0.1);
  expect(m.sample(1, 201)).toBeUndefined();
});
it("paused poses and a cleared world do not retain the old interpolation", () => {
  const m = new SnapshotMotion();
  m.push([{ id: 1, pos: { x: 1, y: 0, z: 1 }, yaw: 0 }], 0, 0.1);
  m.push([{ id: 1, pos: { x: 2, y: 0, z: 1 }, yaw: 0 }], 100, 0);
  expect(m.sample(1, 100)!.pos.x).toBe(2);
  m.clear();
  expect(m.sample(1, 200)).toBeUndefined();
});
it("unchanged fog reuses an immutable mask and changes preserve old snapshots", () => {
  const stream = new ViewStream();
  const view = { heights: [0], fog: [0, 1], tick: 0 } as unknown as PlayerView;
  const first = stream.unpack(view),
    second = stream.unpack({ tick: 1, fogChanges: [] } as any);
  expect(second.fog).toBe(first.fog);
  expect(Object.isFrozen(second.fog)).toBe(true);
  const third = stream.unpack({ tick: 2, fogChanges: [0] } as any);
  expect(first.fog).toEqual([0, 1]);
  expect(third.fog).toEqual([1, 1]);
  expect(third.fog).not.toBe(second.fog);
});

it("early snapshots continue from the visible pose rather than jumping forward", () => {
  const m = new SnapshotMotion();
  m.push([{ id: 1, pos: { x: 1, y: 0, z: 1 }, yaw: 0 }], 0, 0.1);
  m.push([{ id: 1, pos: { x: 2, y: 0, z: 1 }, yaw: 0 }], 100, 0.1);
  expect(m.sample(1, 150)!.pos.x).toBeCloseTo(1.5);
  m.push([{ id: 1, pos: { x: 3, y: 0, z: 1 }, yaw: 0 }], 150, 0.1);
  expect(m.sample(1, 150)!.pos.x).toBeCloseTo(1.5);
});
