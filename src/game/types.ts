import type { PhysicsPort } from "./physics";
export type Vec3 = { x: number; y: number; z: number };
export type Difficulty = "easy" | "medium" | "hard";
export type MatchMode = "single" | "ffa" | "teams";
export type Resource = "food" | "wood" | "stone" | "ore";
export type Stock = Record<Resource, number>;
export type Weapon = "sword" | "spear" | "bow" | "crossbow";
export type Ammo = "arrow" | "bolt" | "catapult";
export type Building =
  | "townhall"
  | "storage"
  | "farm"
  | "armory"
  | "smithy"
  | "workshop"
  | "stable"
  | "wall"
  | "gate"
  | "tower";
export type EntityType =
  | Building
  | "tree"
  | "stone"
  | "ore"
  | "deer"
  | "bag"
  | "horse"
  | "catapult"
  | "trap";
export interface MatchConfig {
  mode: MatchMode;
  difficulty: Difficulty;
  seed: number;
  participants: { name: string; controller: "human" | "ai"; team?: 0 | 1 }[];
}
export interface InputFrame {
  seq: number;
  move: { x: number; z: number };
  yaw: number;
  pitch: number;
  jump: boolean;
  sprint: boolean;
  attack: boolean;
  aim: boolean;
  interact: boolean;
  weaponSlot: 0 | 1;
  /** Camera sight origin; the authority validates distance and projectile obstruction. */
  aimOrigin?: Vec3;
}
export const emptyInput = (): InputFrame => ({
  seq: 0,
  move: { x: 0, z: 0 },
  yaw: 0,
  pitch: 0,
  jump: false,
  sprint: false,
  attack: false,
  aim: false,
  interact: false,
  weaponSlot: 0,
});
export const emptyStock = (): Stock => ({ food: 0, wood: 0, stone: 0, ore: 0 });
export interface Player {
  id: number;
  name: string;
  controller: "human" | "ai";
  faction: number;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  pitch: number;
  hp: number;
  lives: number;
  dead: boolean;
  eliminated: boolean;
  respawnAt: number;
  protectionUntil: number;
  pack: Stock;
  weapons: [Weapon | null, Weapon | null];
  slot: 0 | 1;
  ammo: Record<Ammo, number>;
  tools: number;
  armor: number;
  cooldown: number;
  heal: number;
  healUntil: number;
  eatReady: number;
  input: InputFrame;
  lastSeq: number;
  action?: { kind: "gather" | "work" | "repair" | "disarm"; target: number };
  vehicleId?: number;
  ai: {
    next: number;
    goal?: number;
    phase: string;
    raid: boolean;
    waypoint?: Vec3;
    route?: Vec3[];
    goalPoint?: Vec3;
    nextPath?: number;
    site?: Vec3;
    build?: Building;
  };
  deathTick: number;
  trappedUntil?: number;
  combat?: {
    weapon: Weapon | null;
    focus: number;
    triggerHeld: boolean;
    lastHitTick: number;
  };
}
export interface CraftJob {
  recipe: string;
  actor: number;
  remaining: number;
  cost: Partial<Stock>;
}
export interface Entity {
  id: number;
  type: EntityType;
  faction: number;
  pos: Vec3;
  yaw: number;
  hp: number;
  maxHp: number;
  progress: number;
  amount: number;
  cropAt: number;
  queue: CraftJob[];
  stock: Stock;
  equipment: Weapon[];
  owner?: number;
  occupant?: number;
  cooldown: number;
  home?: Vec3;
  goal?: Vec3;
  nextMove?: number;
  triggered?: boolean;
  ghost?: boolean;
  gateLocked?: boolean;
  speed?: number;
}
export interface Faction {
  id: number;
  name: string;
  color: string;
  alive: boolean;
  townhall: number;
  stock: Stock;
  members: number[];
  explored: number[];
  lastAttackTick?: number;
}
export interface Projectile {
  id: number;
  owner: number;
  faction: number;
  pos: Vec3;
  vel: Vec3;
  damage: number;
  life: number;
  kind: "arrow" | "bolt" | "catapult" | "tower";
}
export interface GameEvent {
  id: number;
  tick: number;
  kind: "info" | "attack" | "death" | "complete" | "error";
  actor?: number;
  faction?: number;
  text: string;
  pos?: Vec3;
}
export interface GameState {
  version: 1;
  config: MatchConfig;
  tick: number;
  rng: number;
  nextId: number;
  nextEvent: number;
  size: number;
  heights: number[];
  players: Record<number, Player>;
  factions: Record<number, Faction>;
  entities: Record<number, Entity>;
  projectiles: Projectile[];
  events: GameEvent[];
  paused: boolean;
  result: { winnerFactionId: number | null; draw: boolean } | null;
  intel: Record<number, Record<number, Entity>>;
  visibleIds: Record<number, number[]>;
  damage: {
    target: number;
    amount: number;
    source: number;
    origin?: Vec3;
    blockable?: boolean;
  }[];
}
export interface GameRuntime {
  state: GameState;
  physics: PhysicsPort;
}
export interface PlayerView {
  version: 1;
  tick: number;
  playerId: number;
  size: number;
  heights: number[];
  config: MatchConfig;
  players: Player[];
  entities: Entity[];
  factions: Faction[];
  projectiles: Projectile[];
  events: GameEvent[];
  paused: boolean;
  result: GameState["result"];
  ack: number;
  fog: number[];
}
export type Command =
  | { type: "gate"; target: number; open: boolean }
  | { type: "deposit" | "withdraw"; target: number; amounts?: Partial<Stock> }
  | {
      type:
        | "interact"
        | "work"
        | "repair"
        | "loot"
        | "mount"
        | "operate"
        | "disarm";
      target: number;
    }
  | { type: "build"; building: Building; pos: Vec3; yaw: number }
  | { type: "craft"; target: number; recipe: string }
  | { type: "equip"; target: number; weapon: Weapon; slot: 0 | 1 }
  | { type: "plant" | "harvest"; target: number }
  | { type: "trap"; pos: Vec3 }
  | { type: "eat" | "dismount" | "stop" };
export type CommandResult =
  { ok: true } | { ok: false; code: string; message: string };
export interface SaveEnvelope {
  version: 1;
  balance: 1;
  state: GameState;
  physics: number[];
  handles: { bodies: [number, number][]; colliders: [number, number][] };
}
