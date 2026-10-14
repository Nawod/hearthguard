import { deliverView } from "./transport";
import { Checkpoints } from "./checkpoints";
import { ViewStream } from "../src/session/stream";
import type { PlayerView } from "../src/game/types";
import { createServer } from "node:http";
import { readFile, mkdir, readdir, writeFile, rename } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { randomBytes } from "node:crypto";
import { Worker } from "node:worker_threads";
import { WebSocketServer, WebSocket } from "ws";
import { RoomManager } from "./rooms";
import { validateMessage } from "./validation";
import { getLanAddresses } from "./lan";
import type { SaveEnvelope } from "../src/game/types";
import type { Room } from "../src/session/protocol";
interface Client {
  id: string;
  socket: WebSocket;
  room?: string;
  seat?: string;
  count: number;
  since: number;
  stream: ViewStream;
}
interface Match {
  worker: Worker;
  tokens: Map<string, string>;
  sockets: Map<string, Client>;
  deadlines: Map<string, number>;
  sequences: Map<string, number>;
  save?: SaveEnvelope;
  latestViews?: PlayerView[];
  checkpointPending?: () => void;
  finishedAt?: number;
}
export async function startServer(
  options: {
    port?: number;
    host?: string;
    dataDir?: string | false;
    reconnectMs?: number;
  } = {},
): Promise<{ close(): Promise<void> }> {
  const manager = new RoomManager(),
    clients = new Map<string, Client>(),
    matches = new Map<string, Match>(),
    queues = new Map<
      string,
      {
        client: Client;
        name: string;
        mode: "ffa" | "teams";
        difficulty: any;
        count: number;
      }[]
    >(),
    root = resolve("dist"),
    data =
      options.dataDir === false
        ? undefined
        : resolve(options.dataDir ?? "server-data"),
    port = options.port ?? Number(process.env.PORT ?? 5190),
    host = options.host ?? process.env.HOST ?? "0.0.0.0";
  const saves = data ? new Checkpoints(data) : undefined;
  let shutting = false;
  const http = createServer(async (req, res) => {
      try {
        const url = new URL(
          req.url ?? "/",
          `http://${req.headers.host ?? "localhost"}`,
        );
        if (url.pathname === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              protocol: 1,
              rooms: manager.rooms.size,
            }),
          );
          return;
        }
        if (url.pathname === "/lan") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ addresses: getLanAddresses(port) }));
          return;
        }
        const path = resolve(
          root,
          "." +
            decodeURIComponent(
              url.pathname === "/" ? "/index.html" : url.pathname,
            ),
        );
        if (path !== root && !path.startsWith(root + sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
        const bytes = await readFile(path);
        res.writeHead(200, {
          "Content-Type":
            (
              {
                ".html": "text/html",
                ".js": "text/javascript",
                ".css": "text/css",
                ".wasm": "application/wasm",
                ".png": "image/png",
                ".svg": "image/svg+xml",
                ".json": "application/json",
              } as any
            )[extname(path)] ?? "application/octet-stream",
          "Cache-Control":
            extname(path) === ".html" ? "no-store" : "public,max-age=3600",
        });
        res.end(bytes);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    }),
    ws = new WebSocketServer({ noServer: true, maxPayload: 16384 });
  const send = (c: Client, m: unknown) => {
    if (c.socket.readyState === WebSocket.OPEN && c.socket.bufferedAmount < 2e6)
      c.socket.send(JSON.stringify(m));
  };
  const broadcast = (r: Room) => {
    for (const c of clients.values())
      if (c.room === r.code) send(c, { type: "room", room: r });
  };
  const checkpoint = async (code: string, m: Match) => {
    if (!saves || !m.save) return;
    await saves.write(code, {
      room: manager.rooms.get(code),
      tokens: [...m.tokens],
      sequences: [...m.sequences],
      save: m.save,
    });
  };
  function attachWorker(
    r: Room,
    save?: SaveEnvelope,
    tokens = new Map<string, string>(),
    sequences = new Map<string, number>(),
  ): Match {
    const worker = new Worker(
        new URL(
          import.meta.url.endsWith(".ts")
            ? "../dist-server/match.worker.mjs"
            : "./match.worker.mjs",
          import.meta.url,
        ),
      ),
      m: Match = {
        worker,
        tokens,
        sequences,
        sockets: new Map(),
        deadlines: new Map(),
        save,
      };
    matches.set(r.code, m);
    worker.on("message", (packet) => {
      if (packet.type === "views") {
        m.latestViews = packet.views;
        if (packet.views[0]?.result) {
          r.phase = "finished";
          m.finishedAt ??= Date.now();
        }
        for (const [seat, c] of m.sockets) {
          const p = r.seats.find((s) => s.id === seat);
          if (p) {
            const view = packet.views.find(
              (v: any) => v.playerId === p.playerId,
            );
            if (view) deliverView(c.socket, c.stream, view);
          }
        }
      }
      if (packet.type === "result") {
        const seat = r.seats.find((s) => s.playerId === packet.actor),
          c = seat && m.sockets.get(seat.id);
        if (c && !packet.result.ok)
          send(c, { type: "error", message: packet.result.message });
      }
      if (packet.type === "checkpoint") {
        m.save = packet.save;
        m.checkpointPending?.();
        m.checkpointPending = undefined;
        void checkpoint(r.code, m).catch((e) =>
          console.error("Checkpoint failed:", e.message),
        );
      }
      if (packet.type === "error")
        for (const c of m.sockets.values())
          send(c, { type: "error", message: packet.message });
    });
    worker.on("error", (e) => {
      for (const c of m.sockets.values())
        send(c, {
          type: "error",
          message:
            "Match simulation stopped. Reconnect after the server recovers.",
        });
    });
    worker.postMessage({
      type: "start",
      config: save?.state.config ?? {
        mode: r.mode,
        difficulty: r.difficulty,
        seed: r.seed,
        participants: r.seats.map((s) => ({
          name: s.name,
          controller: "human",
          team: s.team,
        })),
      },
      save,
    });
    return m;
  }
  function joined(c: Client, r: Room, seat: string): void {
    c.room = r.code;
    c.seat = seat;
    let m = matches.get(r.code);
    if (!m) {
      m = {
        worker: undefined as any,
        tokens: new Map(),
        sockets: new Map(),
        deadlines: new Map(),
        sequences: new Map(),
      };
      matches.set(r.code, m);
    }
    if (!m.tokens.has(seat))
      m.tokens.set(seat, randomBytes(32).toString("hex"));
    m.sockets.set(seat, c);
    c.stream.reset();
    send(c, {
      type: "joined",
      room: r,
      token: m.tokens.get(seat),
      clientId: seat,
      seq: m.sequences.get(seat) ?? 0,
    });
    const player = r.seats.find((s) => s.id === seat);
    const cached = m.latestViews?.find((v) => v.playerId === player?.playerId);
    if (cached) deliverView(c.socket, c.stream, cached);
    broadcast(r);
  }
  function leave(c: Client, explicit: boolean): void {
    for (const q of queues.values()) {
      const i = q.findIndex((v) => v.client === c);
      if (i >= 0) q.splice(i, 1);
    }
    if (!c.room || !c.seat) return;
    const r = manager.rooms.get(c.room),
      m = matches.get(c.room),
      seat = r?.seats.find((s) => s.id === c.seat);
    if (r?.phase === "lobby") {
      manager.leave(c.seat, c.room);
      m?.sockets.delete(c.seat);
      m?.tokens.delete(c.seat);
      if (manager.rooms.has(c.room)) broadcast(r);
      else matches.delete(c.room);
    } else if (r && m && seat) {
      seat.connected = false;
      seat.ready = false;
      m.worker.postMessage({ type: "release", actor: seat.playerId });
      m.sockets.delete(c.seat);
      if (explicit) {
        m.worker.postMessage({ type: "forfeit", actor: seat.playerId });
        m.tokens.delete(c.seat);
      } else
        m.deadlines.set(c.seat, Date.now() + (options.reconnectMs ?? 120000));
      broadcast(r);
    }
    c.room = undefined;
    c.seat = undefined;
  }
  http.on("upgrade", (req, socket, head) => {
    let allowed = true;
    try {
      if (req.headers.origin)
        allowed = new URL(req.headers.origin).host === req.headers.host;
    } catch {
      allowed = false;
    }
    if (shutting || req.url !== "/ws" || !allowed || clients.size >= 128) {
      socket.destroy();
      return;
    }
    ws.handleUpgrade(req, socket, head, (s) => ws.emit("connection", s, req));
  });
  ws.on("connection", (socket) => {
    const c: Client = {
      id: randomBytes(8).toString("hex"),
      socket,
      count: 0,
      since: Date.now(),
      stream: new ViewStream(),
    };
    clients.set(c.id, c);
    send(c, { type: "welcome", id: c.id, protocol: 1 });
    socket.on("message", (bytes) => {
      try {
        if (Date.now() - c.since > 1000) {
          c.since = Date.now();
          c.count = 0;
        }
        if (++c.count > 100) throw new Error("Too many requests.");
        if (shutting)
          throw new Error(
            "The server is saving and shutting down. Reconnect after it restarts.",
          );
        const message = validateMessage(JSON.parse(bytes.toString()));
        if (message.type === "create") {
          leave(c, true);
          const r = manager.create(
            c.id,
            message.name,
            message.mode,
            message.difficulty,
            message.seed,
          );
          joined(c, r, c.id);
        } else if (message.type === "join") {
          leave(c, true);
          const r = manager.join(c.id, message.name, message.code);
          joined(c, r, c.id);
        } else if (message.type === "queue") {
          leave(c, true);
          const key = [message.mode, message.difficulty, message.count].join(
              ":",
            ),
            q = queues.get(key) ?? [];
          q.push({ client: c, ...message });
          queues.set(key, q);
          for (const v of q)
            send(v.client, {
              type: "queued",
              waiting: q.length,
              count: message.count,
            });
          if (q.length >= message.count) {
            const group = q.splice(0, message.count),
              r = manager.create(
                group[0].client.id,
                group[0].name,
                message.mode,
                message.difficulty,
                randomBytes(4).readUInt32LE(),
              );
            joined(group[0].client, r, group[0].client.id);
            for (const v of group.slice(1)) {
              manager.join(v.client.id, v.name, r.code);
              joined(v.client, r, v.client.id);
            }
            broadcast(r);
          }
        } else if (message.type === "resume") {
          leave(c, false);
          const r = manager.rooms.get(message.code),
            m = matches.get(message.code),
            seat = r?.seats.find((s) => m?.tokens.get(s.id) === message.token);
          if (
            !r ||
            !m ||
            !seat ||
            (m.deadlines.has(seat.id) &&
              m.deadlines.get(seat.id)! <= Date.now())
          )
            throw new Error("This reconnect seat is no longer available.");
          const old = m.sockets.get(seat.id);
          if (old && old !== c) {
            old.room = undefined;
            old.seat = undefined;
            old.socket.close(4001, "Seat replaced");
          }
          seat.connected = true;
          m.deadlines.delete(seat.id);
          joined(c, r, seat.id);
        } else if (message.type === "leave" || message.type === "cancel") {
          leave(c, true);
          send(c, { type: "left" });
        } else {
          if (!c.room || !c.seat) throw new Error("Join a room first.");
          const r = manager.rooms.get(c.room)!;
          if (message.type === "ready")
            manager.ready(c.seat, c.room, message.ready);
          if (message.type === "settings")
            manager.settings(c.seat, c.room, message);
          if (message.type === "team")
            manager.team(c.seat, c.room, message.id, message.team);
          if (message.type === "start") {
            const result = manager.start(c.seat, c.room);
            if (!result.ok) throw new Error(result.message);
            const lobby = matches.get(r.code)!,
              m = attachWorker(r, undefined, lobby.tokens, lobby.sequences);
            m.sockets = lobby.sockets;
            for (const client of m.sockets.values())
              send(client, { type: "started" });
          }
          if (message.type === "input" || message.type === "command") {
            if (r.phase !== "playing")
              throw new Error("The round is not active.");
            const m = matches.get(r.code)!,
              seat = r.seats.find((s) => s.id === c.seat)!;
            if (message.type === "input")
              m.worker.postMessage({
                type: "input",
                actor: seat.playerId,
                input: message.input,
              });
            else {
              if (message.seq <= (m.sequences.get(c.seat) ?? 0))
                throw new Error("Stale command.");
              m.sequences.set(c.seat, message.seq);
              m.worker.postMessage({
                type: "command",
                actor: seat.playerId,
                seq: message.seq,
                command: message.command,
              });
            }
          }
          if (message.type !== "input" && message.type !== "command")
            broadcast(r);
        }
      } catch (e) {
        send(c, {
          type: "error",
          message: (e as Error).message,
          resumeRejected: bytes.toString().includes("resume"),
        });
      }
    });
    socket.on("close", () => {
      leave(c, false);
      clients.delete(c.id);
    });
  });
  if (data) {
    await mkdir(data, { recursive: true });
    for (const file of await readdir(data)) {
      if (!/^[A-F0-9]{6}\.json$/.test(file)) continue;
      try {
        const stored = JSON.parse(await readFile(resolve(data, file), "utf8"));
        const r: Room = stored.room;
        if (!r || !stored.save || r.phase === "lobby") continue;
        r.seats.forEach((s) => (s.connected = false));
        manager.rooms.set(r.code, r);
        const m = attachWorker(
          r,
          stored.save,
          new Map(stored.tokens),
          new Map(stored.sequences),
        );
        r.seats.forEach((s) => m.deadlines.set(s.id, Date.now() + 120000));
      } catch {}
    }
  }
  const timer = setInterval(() => {
    for (const [code, m] of matches) {
      const r = manager.rooms.get(code);
      if (!r || !m.worker) continue;
      if (
        m.finishedAt &&
        (Date.now() - m.finishedAt > 900000 ||
          (m.sockets.size === 0 && m.deadlines.size === 0))
      ) {
        void m.worker.terminate();
        manager.rooms.delete(code);
        matches.delete(code);
        if (saves) void saves.remove(code).catch(() => {});
        continue;
      }
      for (const [seat, deadline] of m.deadlines)
        if (Date.now() >= deadline) {
          const p = r.seats.find((s) => s.id === seat);
          if (p) m.worker.postMessage({ type: "forfeit", actor: p.playerId });
          m.deadlines.delete(seat);
          m.tokens.delete(seat);
        }
    }
  }, 1000);
  await new Promise<void>((resolve) => http.listen(port, host, resolve));
  return {
    close: async () => {
      shutting = true;
      clearInterval(timer);
      await Promise.all(
        [...matches.values()]
          .filter((m) => m.worker)
          .map(
            (m) =>
              new Promise<void>((resolve) => {
                const timeout = setTimeout(resolve, 5000);
                m.checkpointPending = () => {
                  clearTimeout(timeout);
                  resolve();
                };
                m.worker.postMessage({ type: "stop" });
              }),
          ),
      );
      await saves?.flush();
      for (const [code, m] of matches) {
        if (m.worker) {
          await checkpoint(code, m).catch(() => {});
          await m.worker.terminate();
        }
      }
      for (const c of clients.values()) c.socket.close();
      await new Promise<void>((resolve) =>
        ws.close(() => http.close(() => resolve())),
      );
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))
) {
  const server = await startServer();
  console.log(
    "Hearthguard is running at http://localhost:" + (process.env.PORT ?? 5190),
  );
  for (const address of getLanAddresses(Number(process.env.PORT ?? 5190)))
    console.log("Local Wi-Fi: " + address);
  for (const sig of ["SIGINT", "SIGTERM"] as const)
    process.once(sig, () => {
      void server.close().then(() => process.exit(0));
    });
}
