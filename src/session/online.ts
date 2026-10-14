import { ViewStream } from "./stream";
import { Prediction } from "./prediction";
import type { GameSession, Room, ClientMessage } from "./protocol";
import type { InputFrame, Command, PlayerView } from "../game/types";
export class OnlineSession implements GameSession {
  readonly prediction = new Prediction();
  private stream = new ViewStream();
  onView?: GameSession["onView"];
  onResult?: GameSession["onResult"];
  onRoom?: (room: Room | undefined) => void;
  onStatus?: (status: string) => void;
  onStart?: () => void;
  onIdentity?: (id: string) => void;
  private socket?: WebSocket;
  private outbox: ClientMessage[] = [];
  private ended = false;
  private retry?: ReturnType<typeof setTimeout>;
  private credential?: { code: string; token: string };
  private seq = 0;
  private persistSeat(): void {
    try {
      if (this.credential)
        sessionStorage.setItem(
          "hearthguard-seat",
          JSON.stringify(this.credential),
        );
      else sessionStorage.removeItem("hearthguard-seat");
    } catch {
      if (this.credential)
        this.onResult?.(
          "Reconnect storage is unavailable. This tab can reconnect, but keep it open to retain your character.",
        );
    }
  }
  constructor() {
    try {
      const s = sessionStorage.getItem("hearthguard-seat");
      if (s) {
        this.credential = JSON.parse(s);
        this.connect();
      }
    } catch {}
  }
  private connect(): void {
    if (this.ended || (this.socket && this.socket.readyState < 2)) return;
    this.onStatus?.("Connecting");
    const url = new URL("/ws", location.href);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.stream.reset();
    this.prediction.reset();
    const ws = (this.socket = new WebSocket(url));
    ws.onopen = () => {
      this.onStatus?.("Connected");
      if (this.credential)
        ws.send(JSON.stringify({ type: "resume", ...this.credential }));
      for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === "welcome") this.onIdentity?.(m.id);
        if (m.type === "joined") {
          this.credential = { code: m.room.code, token: m.token };
          this.persistSeat();
          this.seq = m.seq ?? 0;
          if (m.clientId) this.onIdentity?.(m.clientId);
          this.stream.reset();
          this.prediction.reset();
          this.onRoom?.(m.room);
          if (m.room.phase !== "lobby") this.onStart?.();
        }
        if (m.type === "room") this.onRoom?.(m.room);
        if (m.type === "started") this.onStart?.();
        if (m.type === "snapshot") {
          const view = this.stream.unpack(m.view);
          this.prediction.accept(view);
          this.onView?.(view);
        }
        if (m.type === "error") {
          if (m.resumeRejected) {
            this.credential = undefined;
            this.persistSeat();
            this.onRoom?.(undefined);
          }
          this.onResult?.(m.message);
        }
        if (m.type === "queued")
          this.onStatus?.(`Waiting for players · ${m.waiting}/${m.count}`);
        if (m.type === "left") {
          this.credential = undefined;
          this.persistSeat();
          this.onRoom?.(undefined);
        }
      } catch {
        this.onResult?.("The server sent an incompatible update.");
      }
    };
    ws.onerror = () =>
      this.onResult?.(
        "Cannot reach the server. For Wi-Fi play, check the host address and firewall.",
      );
    ws.onclose = (event) => {
      if (this.ended) return;
      if (event.code === 4001) {
        this.credential = undefined;
        this.persistSeat();
        this.onResult?.("Your character is connected in another tab.");
        this.onStatus?.("Disconnected");
        return;
      }
      this.socket = undefined;
      if (this.credential) {
        this.onStatus?.("Reconnecting");
        this.retry = setTimeout(() => this.connect(), 1000);
      } else this.onStatus?.("Disconnected");
    };
  }
  send(m: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(m));
    else {
      this.outbox.push(m);
      this.connect();
    }
  }
  submitInput(input: InputFrame): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.prediction.record(input);
      this.socket.send(JSON.stringify({ type: "input", input }));
    }
  }
  sendCommand(command: Command): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.onResult?.("Wait for the connection before interacting.");
      return;
    }
    this.send({ type: "command", seq: ++this.seq, command });
  }
  leave(): void {
    this.send({ type: "leave" });
    this.credential = undefined;
    this.persistSeat();
    this.onRoom?.(undefined);
  }
  dispose(): void {
    this.ended = true;
    if (this.retry) clearTimeout(this.retry);
    this.socket?.close();
  }
}
