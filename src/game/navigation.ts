import type { GameState, Vec3 } from "./types";
import { BUILDINGS } from "./balance";
export function findRoute(
  s: GameState,
  from: Vec3,
  to: Vec3,
  faction: number,
): Vec3[] {
  const n = s.size,
    grid = new Uint8Array(n * n);
  for (const e of Object.values(s.entities)) {
    if (
      e.hp <= 0 ||
      (e.type === "gate" && !e.gateLocked && e.faction === faction)
    )
      continue;
    const d = BUILDINGS[e.type as keyof typeof BUILDINGS],
      radius = d
        ? d.size / 2 + 0.55
        : e.type === "tree"
          ? 0.9
          : e.type === "stone" || e.type === "ore"
            ? 1.05
            : 0;
    if (!radius || (!d && e.amount <= 0)) continue;
    for (
      let z = Math.max(0, Math.floor(e.pos.z - radius));
      z < Math.min(n, e.pos.z + radius + 1);
      z++
    )
      for (
        let x = Math.max(0, Math.floor(e.pos.x - radius));
        x < Math.min(n, e.pos.x + radius + 1);
        x++
      )
        if (
          d
            ? Math.abs(x + 0.5 - e.pos.x) <= radius &&
              Math.abs(z + 0.5 - e.pos.z) <= radius
            : Math.hypot(x + 0.5 - e.pos.x, z + 0.5 - e.pos.z) < radius
        )
          grid[z * n + x] = 1;
  }
  const begin = Math.floor(from.z) * n + Math.floor(from.x);
  let gx = Math.floor(to.x),
    gz = Math.floor(to.z);
  if (grid[gz * n + gx]) {
    const choices: Vec3[] = [];
    for (let z = gz - 5; z <= gz + 5; z++)
      for (let x = gx - 5; x <= gx + 5; x++)
        if (x > 1 && z > 1 && x < n - 1 && z < n - 1 && !grid[z * n + x])
          choices.push({ x: x + 0.5, y: 0, z: z + 0.5 });
    choices.sort(
      (a, b) =>
        Math.hypot(a.x - to.x, a.z - to.z) +
        Math.hypot(a.x - from.x, a.z - from.z) * 0.1 -
        Math.hypot(b.x - to.x, b.z - to.z) -
        Math.hypot(b.x - from.x, b.z - from.z) * 0.1,
    );
    if (!choices.length) return [];
    gx = Math.floor(choices[0].x);
    gz = Math.floor(choices[0].z);
  }
  const end = gz * n + gx;
  if (begin === end) return [{ x: gx + 0.5, y: 0, z: gz + 0.5 }];
  const costs = new Float32Array(n * n).fill(Infinity),
    parent = new Int32Array(n * n).fill(-1),
    closed = new Uint8Array(n * n),
    heap: { id: number; score: number }[] = [];
  costs[begin] = 0;
  const push = (v: { id: number; score: number }) => {
    heap.push(v);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].score <= v.score) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = v;
  };
  const pop = () => {
    const out = heap[0],
      tail = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let c = i * 2 + 1;
        if (c + 1 < heap.length && heap[c + 1].score < heap[c].score) c++;
        if (heap[c].score >= tail.score) break;
        heap[i] = heap[c];
        i = c;
      }
      heap[i] = tail;
    }
    return out;
  };
  push({ id: begin, score: 0 });
  while (heap.length) {
    const { id } = pop();
    if (closed[id]) continue;
    closed[id] = 1;
    if (id === end) {
      const route: Vec3[] = [];
      for (let k = end; k !== begin && k >= 0; k = parent[k])
        route.push({ x: (k % n) + 0.5, y: 0, z: Math.floor(k / n) + 0.5 });
      return route.reverse();
    }
    const x = id % n,
      z = Math.floor(id / n);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        next = nz * n + nx;
      if (
        nx < 1 ||
        nz < 1 ||
        nx >= n - 1 ||
        nz >= n - 1 ||
        grid[next] ||
        closed[next] ||
        (dx && dz && (grid[z * n + nx] || grid[nz * n + x]))
      )
        continue;
      const cost = costs[id] + (dx && dz ? Math.SQRT2 : 1);
      if (cost >= costs[next]) continue;
      costs[next] = cost;
      parent[next] = id;
      push({ id: next, score: cost + Math.hypot(nx - gx, nz - gz) });
    }
  }
  return [];
}
