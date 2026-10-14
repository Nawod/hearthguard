import type { PlayerView } from "../src/game/types";
import type { ViewStream } from "../src/session/stream";
export function deliverView(
  socket: {
    readyState: number;
    bufferedAmount: number;
    send(data: string): void;
  },
  stream: ViewStream,
  view: PlayerView,
): boolean {
  if (socket.readyState !== 1 || socket.bufferedAmount >= 2e6) {
    stream.reset();
    return false;
  }
  try {
    socket.send(JSON.stringify({ type: "snapshot", view: stream.pack(view) }));
    return true;
  } catch {
    stream.reset();
    return false;
  }
}
