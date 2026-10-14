import { randomBytes } from "node:crypto";
import type { Room, Seat } from "../src/session/protocol";
import type { Difficulty, MatchConfig } from "../src/game/types";
export class RoomManager {
  rooms = new Map<string, Room>();
  create(
    id: string,
    name: string,
    mode: "ffa" | "teams",
    difficulty: Difficulty,
    seed: number,
  ): Room {
    if (this.rooms.size >= 32) throw new Error("This server is full.");
    let code = "";
    do {
      code = randomBytes(3).toString("hex").toUpperCase();
    } while (this.rooms.has(code));
    const r: Room = {
      code,
      host: id,
      phase: "lobby",
      mode,
      difficulty,
      seed,
      seats: [
        { id, name, team: 0, ready: false, connected: true, playerId: 1 },
      ],
    };
    this.rooms.set(code, r);
    return r;
  }
  join(id: string, name: string, code: string): Room {
    const r = this.rooms.get(code.toUpperCase());
    if (!r || r.phase !== "lobby") throw new Error("That room is unavailable.");
    if (r.seats.length >= 8) throw new Error("This room has eight players.");
    if (r.seats.some((s) => s.id === id)) return r;
    const a = r.seats.filter((s) => s.team === 0).length,
      b = r.seats.length - a;
    r.seats.push({
      id,
      name,
      team: a <= b ? 0 : 1,
      ready: false,
      connected: true,
      playerId: r.seats.length + 1,
    });
    r.seats.forEach((s) => (s.ready = false));
    return r;
  }
  ready(id: string, code: string, ready: boolean): void {
    const r = this.require(code);
    if (r.phase !== "lobby") throw new Error("This round has already started.");
    const seat = r.seats.find((s) => s.id === id);
    if (!seat) throw new Error("Join the room first.");
    seat.ready = ready;
  }
  settings(
    id: string,
    code: string,
    value: { mode: "ffa" | "teams"; difficulty: Difficulty; seed: number },
  ): void {
    const r = this.require(code);
    if (r.host !== id || r.phase !== "lobby")
      throw new Error("Only the lobby host can change settings.");
    Object.assign(r, value);
    r.seats.forEach((s) => (s.ready = false));
  }
  team(id: string, code: string, target: string, team: 0 | 1): void {
    const r = this.require(code);
    if (
      r.phase !== "lobby" ||
      r.mode !== "teams" ||
      (id !== r.host && id !== target)
    )
      throw new Error("Only your seat or the host can change teams.");
    const seat = r.seats.find((s) => s.id === target);
    if (!seat) throw new Error("Unknown seat.");
    if (r.seats.filter((s) => s.team === team && s !== seat).length >= 4)
      throw new Error("Each team can have at most four members.");
    seat.team = team;
    r.seats.forEach((s) => (s.ready = false));
  }
  start(
    id: string,
    code: string,
  ): { ok: boolean; config?: MatchConfig; message?: string } {
    const r = this.require(code);
    if (r.host !== id || r.phase !== "lobby")
      return { ok: false, message: "Only the host can start this lobby." };
    if (r.seats.length < 2 || r.seats.some((s) => !s.connected || !s.ready))
      return {
        ok: false,
        message: "At least two connected players must be ready.",
      };
    if (
      r.mode === "teams" &&
      [0, 1].some((t) => {
        const n = r.seats.filter((s) => s.team === t).length;
        return n < 1 || n > 4;
      })
    )
      return {
        ok: false,
        message: "Two nonempty teams of up to four players are required.",
      };
    r.phase = "playing";
    r.seats.forEach((s, i) => (s.playerId = i + 1));
    return {
      ok: true,
      config: {
        mode: r.mode,
        difficulty: r.difficulty,
        seed: r.seed,
        participants: r.seats.map((s) => ({
          name: s.name,
          controller: "human",
          team: s.team,
        })),
      },
    };
  }
  leave(id: string, code: string): void {
    const r = this.rooms.get(code);
    if (!r) return;
    if (r.phase === "lobby") {
      r.seats = r.seats.filter((s) => s.id !== id);
      if (!r.seats.length) {
        this.rooms.delete(code);
        return;
      }
      if (r.host === id) r.host = r.seats[0].id;
      r.seats.forEach((s) => (s.ready = false));
    } else {
      const seat = r.seats.find((s) => s.id === id);
      if (seat) seat.connected = false;
    }
  }
  private require(code: string): Room {
    const r = this.rooms.get(code);
    if (!r) throw new Error("This room is unavailable.");
    return r;
  }
}
