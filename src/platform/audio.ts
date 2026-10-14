import type { GameEvent, Vec3 } from "../game/types";
export class Soundscape {
  private ctx?: AudioContext;
  music = 0.2;
  effects = 0.65;
  private musicTimer?: ReturnType<typeof setInterval>;
  async unlock(): Promise<void> {
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.musicTimer)
      this.musicTimer = setInterval(
        () => this.tone(110, 0.45, this.music * 0.05, "sine"),
        1800,
      );
  }
  private tone(
    freq: number,
    length: number,
    volume: number,
    type: OscillatorType,
    pan?: number,
  ): void {
    const c = this.ctx;
    if (!c || c.state !== "running" || volume <= 0) return;
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.7,
      c.currentTime + length,
    );
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + length);
    o.connect(g);
    const spatial = pan === undefined ? undefined : c.createStereoPanner();
    if (spatial) {
      spatial.pan.setValueAtTime(pan!, c.currentTime);
      g.connect(spatial);
      spatial.connect(c.destination);
    } else g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + length);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      spatial?.disconnect();
    };
  }
  play(event: GameEvent, listener?: Vec3, yaw = 0): void {
    const dx = event.pos && listener ? event.pos.x - listener.x : 0,
      dz = event.pos && listener ? event.pos.z - listener.z : 0,
      distance = Math.hypot(dx, dz);
    const pan =
      event.pos && listener
        ? Math.max(
            -1,
            Math.min(
              1,
              (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / Math.max(1, distance),
            ),
          )
        : undefined;
    this.tone(
      event.kind === "attack"
        ? 85
        : event.kind === "death"
          ? 65
          : event.kind === "complete"
            ? 440
            : 240,
      0.15,
      (this.effects * 0.08) / (1 + distance * 0.07),
      event.kind === "attack" ? "sawtooth" : "triangle",
      pan,
    );
  }
  click(): void {
    this.tone(330, 0.08, this.effects * 0.05, "sine");
  }
  test(): void {
    void this.unlock().then(() =>
      this.tone(440, 0.35, this.effects * 0.1, "triangle"),
    );
  }
  setVolumes(music: number, effects: number): void {
    this.music = music;
    this.effects = effects;
  }
  dispose(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    void this.ctx?.close();
  }
}
