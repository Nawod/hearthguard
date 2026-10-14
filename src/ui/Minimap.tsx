import { memo, useMemo } from "react";
import type { PlayerView } from "../game/types";
export const Minimap = memo(function Minimap({ view }: { view: PlayerView }) {
  const p = view.players.find((p) => p.id === view.playerId);

  const n = view.size,
    step = 8;
  const tiles = useMemo(() => {
    const tiles = [];
    for (let z = 0; z < n; z += step)
      for (let x = 0; x < n; x += step) {
        let explored = false;
        for (let zz = z; zz < Math.min(n, z + step) && !explored; zz++)
          for (let xx = x; xx < Math.min(n, x + step); xx++)
            if (view.fog[zz * n + xx]) {
              explored = true;
              break;
            }
        if (explored)
          tiles.push(
            <rect
              key={`${x}:${z}`}
              x={x}
              y={z}
              width={step}
              height={step}
              fill="#657c55"
            />,
          );
      }
    return tiles;
  }, [view.fog, n]);
  if (!p) return null;
  return (
    <aside className="minimap" aria-label="Explored realm map">
      <svg
        viewBox={`0 0 ${n} ${n}`}
        role="img"
        aria-label="Your city and visible travelers"
      >
        <rect width={n} height={n} fill="#17271f" />
        {tiles}
        {view.entities
          .filter((e) => e.type === "townhall" || e.type === "tower")
          .map((e) => (
            <rect
              key={e.id}
              x={e.pos.x - 2}
              y={e.pos.z - 2}
              width="4"
              height="4"
              opacity={e.ghost ? 0.45 : 1}
              fill={
                view.factions.find((f) => f.id === e.faction)?.color ?? "#ccc"
              }
            />
          ))}
        {view.players
          .filter((v) => !v.dead && !v.eliminated)
          .map((v) => (
            <circle
              key={v.id}
              cx={v.pos.x}
              cy={v.pos.z}
              r={v.id === p.id ? 2 : 1.5}
              fill={
                v.id === p.id
                  ? "#fff4ce"
                  : view.factions.find((f) => f.id === v.faction)?.color
              }
            />
          ))}
        <path
          d="M 0 -5 L -3 3 L 0 1 L 3 3 Z"
          fill="#fff4ce"
          transform={`translate(${p.pos.x} ${p.pos.z}) rotate(${(p.yaw * 180) / Math.PI})`}
        />
      </svg>
      <span>
        Explored realm <small>N ↑</small>
      </span>
    </aside>
  );
});
