import { it, expect, vi, afterEach } from "vitest";
import { OnlineSession } from "../src/session/online";
import { Soundscape } from "../src/platform/audio";
import { createFixture } from "./helpers/fixture";
import { makeView, updateVisibility } from "../src/game/visibility";
import { ViewStream } from "../src/session/stream";
import { cameraSubject } from "../src/render/camera";
import { deliverView } from "../server/transport";
afterEach(() => vi.unstubAllGlobals());
it("blocked session storage does not interrupt join identity, start, leave or rejected recovery", () => {
  const callbacks: string[] = [];
  let socket: any;
  class Socket {
    static OPEN = 1;
    readyState = 1;
    onopen?: () => void;
    onmessage?: (e: any) => void;
    onclose?: (e: any) => void;
    constructor() {
      socket = this;
    }
    send() {}
    close() {}
  }
  vi.stubGlobal("WebSocket", Socket);
  vi.stubGlobal("location", {
    href: "http://localhost:5190",
    protocol: "http:",
  });
  vi.stubGlobal("sessionStorage", {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
    removeItem() {
      throw Error("blocked");
    },
  });
  const session = new OnlineSession();
  session.onIdentity = () => callbacks.push("identity");
  session.onRoom = (room) => callbacks.push(room ? "room" : "left");
  session.onStart = () => callbacks.push("start");
  session.onResult = (text) => callbacks.push(text);
  session.send({ type: "leave" });
  socket.onmessage({
    data: JSON.stringify({
      type: "joined",
      clientId: "seat",
      token: "secret",
      room: { code: "ROOM", phase: "playing" },
    }),
  });
  expect(callbacks).toContain("identity");
  expect(callbacks).toContain("start");
  expect(callbacks.some((s) => s.includes("incompatible"))).toBe(false);
  expect(() => session.leave()).not.toThrow();
  expect(callbacks).toContain("left");
  socket.onmessage({
    data: JSON.stringify({
      type: "error",
      resumeRejected: true,
      message: "expired",
    }),
  });
  expect(callbacks).toContain("expired");
  expect(() => socket.onclose({ code: 4001 })).not.toThrow();
  session.dispose();
});
it("spectating uses the living teammate location rather than a dead local prediction", async () => {
  const r = await createFixture({
    mode: "teams",
    participants: [
      { name: "A", controller: "human", team: 0 },
      { name: "B", controller: "human", team: 0 },
      { name: "C", controller: "human", team: 1 },
    ],
  });
  try {
    r.state.players[1].eliminated = true;
    r.state.players[1].dead = true;
    r.state.players[2].pos = { x: 55, y: 0, z: 55 };
    updateVisibility(r);
    const subject = cameraSubject(makeView(r.state, 1), { x: 14, y: 0, z: 21 });
    expect(subject.id).toBe(2);
    expect(subject.pos.x).toBe(55);
  } finally {
    r.physics.dispose();
  }
});
it("actual transport backpressure never loses an explored fog cell", async () => {
  const r = await createFixture();
  try {
    updateVisibility(r);
    const view = makeView(r.state, 1),
      sender = new ViewStream(),
      receiver = new ViewStream(),
      packets: any[] = [];
    const socket = {
      readyState: 1,
      bufferedAmount: 0,
      send(data: string) {
        packets.push(JSON.parse(data));
      },
    };
    view.fog[0] = 0;
    deliverView(socket, sender, view);
    receiver.unpack(packets.pop().view);
    view.fog[0] = 1;
    socket.bufferedAmount = 3e6;
    expect(deliverView(socket, sender, view)).toBe(false);
    socket.bufferedAmount = 0;
    deliverView(socket, sender, view);
    expect(receiver.unpack(packets.pop().view).fog[0]).toBe(1);
  } finally {
    r.physics.dispose();
  }
});
it("world sound has left-right positioning and distance attenuation while UI stays centered", async () => {
  const gains: number[] = [],
    pans: number[] = [],
    links: any[] = [];
  let destination: any;
  class Context {
    state = "running";
    currentTime = 0;
    destination = { kind: "speaker" };
    constructor() {
      destination = this.destination;
    }
    resume() {}
    close() {}
    createOscillator() {
      return {
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
        disconnect() {},
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime(v: number) {
            gains.push(v);
          },
          exponentialRampToValueAtTime() {},
        },
        connect(target: any) {
          links.push(target);
        },
        disconnect() {},
      };
    }
    createStereoPanner() {
      const node = {
        pan: {
          setValueAtTime(v: number) {
            pans.push(v);
          },
        },
        connect() {},
        disconnect() {},
      };
      return node;
    }
  }
  vi.stubGlobal("AudioContext", Context);
  const sound = new Soundscape();
  await sound.unlock();
  try {
    const e: any = {
      id: 1,
      kind: "attack",
      text: "hit",
      pos: { x: -10, y: 0, z: 0 },
    };
    sound.play(e, { x: 0, y: 0, z: 0 }, 0);
    e.pos.x = 10;
    sound.play(e, { x: 0, y: 0, z: 0 }, 0);
    e.pos.x = 100;
    sound.play(e, { x: 0, y: 0, z: 0 }, 0);
    expect(pans[0]).toBeLessThan(0);
    expect(pans[1]).toBeGreaterThan(0);
    expect(gains[2]).toBeLessThan(gains[1]);
    sound.click();
    expect(links.at(-1)).toBe(destination);
  } finally {
    sound.dispose();
  }
});
