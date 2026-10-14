import type { PlayerView } from "../game/types";
export type ViewPacket = Omit<PlayerView, "heights" | "fog"> & {
  heights?: number[];
  fog?: number[];
  fogChanges?: number[];
};
/** Static terrain is sent once per connection; exploration is monotonic. */
export class ViewStream {
  private heights?: number[];
  private fog: number[] = [];
  private identity = "";
  private publishedFog?: number[];
  reset(): void {
    this.heights = undefined;
    this.fog = [];
    this.identity = "";
    this.publishedFog = undefined;
  }
  pack(view: PlayerView): ViewPacket {
    const key = `${view.config.seed}:${view.size}:${view.playerId}`;
    if (this.identity !== key) {
      this.identity = key;
      this.heights = view.heights;
      this.fog = [...view.fog];
      return view;
    }
    const { heights, fog, ...rest } = view,
      changes: number[] = [];
    for (let i = 0; i < fog.length; i++)
      if (fog[i] !== this.fog[i]) {
        changes.push(i);
        this.fog[i] = fog[i];
      }
    return { ...rest, fogChanges: changes };
  }
  unpack(packet: ViewPacket): PlayerView {
    if (packet.heights) this.heights = packet.heights;
    let changed = false;
    if (packet.fog) {
      this.fog = [...packet.fog];
      changed = true;
    }
    if (!this.heights || !this.fog.length)
      throw new Error(
        "The world update is incomplete. Reconnect to reload it.",
      );
    for (const index of packet.fogChanges ?? [])
      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < this.fog.length &&
        !this.fog[index]
      ) {
        this.fog[index] = 1;
        changed = true;
      }
    if (changed || !this.publishedFog) {
      this.publishedFog = [...this.fog];
      Object.freeze(this.publishedFog);
    }
    return { ...packet, heights: this.heights, fog: this.publishedFog };
  }
}
