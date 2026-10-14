import { it, expect } from "vitest";
import { RoomManager } from "../server/rooms";
it.each([2, 3, 4, 5, 6, 7, 8])(
  "FFA lobby starts exactly %i joined guests without an initial capacity choice",
  (count) => {
    const m = new RoomManager(),
      r = m.create("0", "Host", "ffa", "hard", 42);
    for (let i = 1; i < count; i++) m.join(String(i), "Guest " + i, r.code);
    for (const s of r.seats) m.ready(s.id, r.code, true);
    expect(m.start("0", r.code).config?.participants).toHaveLength(count);
  },
);
it("three versus four is valid and the host migrates when its creator leaves", () => {
  const m = new RoomManager(),
    r = m.create("0", "Host", "teams", "easy", 42);
  for (let i = 1; i < 8; i++) m.join(String(i), "Guest " + i, r.code);
  m.leave("0", r.code);
  expect(r.host).toBe("1");
  expect(r.seats.filter((s) => s.team === 0)).toHaveLength(3);
  expect(r.seats.filter((s) => s.team === 1)).toHaveLength(4);
  for (const s of r.seats) m.ready(s.id, r.code, true);
  expect(m.start("1", r.code).ok).toBe(true);
});
it("host manually starts actual joined count and enforces team caps", () => {
  const room = new RoomManager();
  const r = room.create("a", "Alice", "teams", "medium", 42);
  room.join("b", "Bob", r.code);
  expect(room.start("b", r.code)).toMatchObject({ ok: false });
  room.ready("a", r.code, true);
  room.ready("b", r.code, true);
  const started = room.start("a", r.code);
  expect(started.ok).toBe(true);
  expect(started.config?.participants).toHaveLength(2);
  expect(started.config?.difficulty).toBe("medium");
});
it("settings clear readiness and invalid starts reject", () => {
  const m = new RoomManager(),
    r = m.create("a", "A", "ffa", "easy", 1);
  m.join("b", "B", r.code);
  m.ready("a", r.code, true);
  m.ready("b", r.code, true);
  m.settings("a", r.code, { mode: "teams", difficulty: "hard", seed: 2 });
  expect(r.seats.every((s) => !s.ready)).toBe(true);
  expect(m.start("a", r.code).ok).toBe(false);
});
