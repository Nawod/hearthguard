import type { PlayerView } from "../game/types";
import { BUILDINGS } from "../game/balance";
import type { FollowCamera } from "./camera";
export class WorldLabels {
  readonly canvas = document.createElement("canvas");
  private ctx = this.canvas.getContext("2d")!;
  constructor(host: HTMLElement) {
    this.canvas.className = "world-labels";
    this.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(this.canvas);
  }
  draw(
    view: PlayerView,
    camera: FollowCamera,
    width: number,
    height: number,
  ): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const c = this.ctx;
    c.clearRect(0, 0, width, height);
    c.font = "11px Segoe UI, sans-serif";
    c.textAlign = "center";
    const label = (
      pos: { x: number; y: number; z: number },
      text: string,
      value: number,
      color: string,
    ) => {
      const projected = camera.project(pos);
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1 ||
        projected.x > 1 ||
        projected.y < -1 ||
        projected.y > 1
      )
        return;
      const x = ((projected.x + 1) * width) / 2,
        y = ((1 - projected.y) * height) / 2;
      c.fillStyle = "#14281fbb";
      c.fillRect(x - 27, y + 4, 54, 5);
      c.fillStyle = color;
      c.fillRect(x - 26, y + 5, Math.max(0, Math.min(1, value)) * 52, 3);
      c.lineWidth = 3;
      c.strokeStyle = "#192d25";
      c.strokeText(text, x, y);
      c.fillStyle = "#f4e6c6";
      c.fillText(text, x, y);
    };
    for (const p of view.players)
      if (p.id !== view.playerId && !p.dead && !p.eliminated)
        label(
          { ...p.pos, y: p.pos.y + 2.1 },
          p.name.slice(0, 16),
          p.hp / 100,
          view.factions.find((f) => f.id === p.faction)?.color ?? "#d47757",
        );
    for (const e of view.entities) {
      const d = BUILDINGS[e.type as keyof typeof BUILDINGS];
      if (
        !d ||
        e.ghost ||
        e.hp <= 0 ||
        (e.progress === 1 && e.hp >= e.maxHp * 0.85)
      )
        continue;
      label(
        { ...e.pos, y: e.pos.y + d.height * Math.max(0.2, e.progress) + 0.6 },
        e.progress < 1
          ? `${d.name} · ${Math.round(e.progress * 100)}%`
          : d.name,
        e.progress < 1 ? e.progress : e.hp / e.maxHp,
        "#c9ba83",
      );
    }
  }
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  dispose(): void {
    this.canvas.remove();
  }
}
