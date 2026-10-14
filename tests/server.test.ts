import { it, expect } from "vitest";
import { WebSocket } from "ws";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server/index";
class Seat {
  socket: WebSocket;
  messages: any[] = [];
  constructor(port: number) {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.socket.on("message", (m) =>
      this.messages.push(JSON.parse(m.toString())),
    );
  }
  async get(
    type: string,
    predicate: (m: any) => boolean = () => true,
  ): Promise<any> {
    const end = Date.now() + 8000;
    while (Date.now() < end) {
      const i = this.messages.findIndex((m) => m.type === type && predicate(m));
      if (i >= 0) return this.messages.splice(i, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("Missing server message: " + type);
  }
  send(m: unknown): void {
    this.socket.send(JSON.stringify(m));
  }
  close(): void {
    this.socket.close();
  }
}
it("eight seats, actor binding, replaced tab and graceful checkpoint recovery", async () => {
  const data = await mkdtemp(join(tmpdir(), "hearthguard-test-"));
  let server = await startServer({
    port: 5199,
    host: "127.0.0.1",
    dataDir: data,
  });
  const seats: Seat[] = [];
  try {
    for (let i = 0; i < 8; i++) {
      const seat = new Seat(5199);
      seats.push(seat);
      await seat.get("welcome");
    }
    seats[0].send({
      type: "create",
      name: "Host",
      mode: "teams",
      difficulty: "medium",
      seed: 42,
    });
    const created = await seats[0].get("joined"),
      code = created.room.code;
    for (let i = 1; i < 8; i++) {
      seats[i].send({ type: "join", name: "Friend " + i, code });
      await seats[i].get("joined");
    }
    seats[1].send({ type: "start" });
    expect((await seats[1].get("error")).message).toMatch(/host/i);
    for (const seat of seats) seat.send({ type: "ready", ready: true });
    await seats[0].get(
      "room",
      (m) =>
        m.room.seats.length === 8 && m.room.seats.every((s: any) => s.ready),
    );
    seats[0].send({ type: "start" });
    for (const seat of seats) {
      const snapshot = await seat.get("snapshot");
      expect(snapshot.view.players).toHaveLength(4);
      expect(snapshot.view.config.participants).toHaveLength(8);
      expect(snapshot.view.config.difficulty).toBe("medium");
    }
    seats[1].send({
      type: "command",
      seq: 1,
      actor: 1,
      command: { type: "eat" },
    });
    expect((await seats[1].get("error")).message).toMatch(/invalid/i);
    const replacement = new Seat(5199);
    seats.push(replacement);
    await replacement.get("welcome");
    replacement.send({ type: "resume", code, token: created.token });
    await replacement.get("joined");
    const resumed = await replacement.get("snapshot");
    expect(resumed.view.playerId).toBe(1);
    await server.close();
    expect((await readdir(data)).filter((p) => p.endsWith(".json"))).toEqual([
      code + ".json",
    ]);
    server = await startServer({
      port: 5199,
      host: "127.0.0.1",
      dataDir: data,
    });
    const recovered = new Seat(5199);
    seats.push(recovered);
    await recovered.get("welcome");
    recovered.send({ type: "resume", code, token: created.token });
    await recovered.get("joined");
    const after = await recovered.get("snapshot");
    expect(after.view.tick).toBeGreaterThanOrEqual(resumed.view.tick);
    expect(after.view.playerId).toBe(1);
  } finally {
    for (const seat of seats) seat.close();
    await server.close();
    await rm(data, { recursive: true, force: true });
  }
}, 30000);
