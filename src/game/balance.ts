import type { Building, Stock, Weapon, Difficulty, EntityType } from "./types";
export const LIVES: Record<Difficulty, number> = {
  easy: 3,
  medium: 2,
  hard: 1,
};
export const COLORS = [
  "#74b6c9",
  "#d47757",
  "#bdaa69",
  "#aa88c7",
  "#7bb48a",
  "#d792bb",
  "#e0d6b4",
  "#7492d3",
];
export const PACK_CAPACITY = 90;
export const DT = 1 / 30;
export const COMBAT = {
  aimMoveSpeed: 2.3,
  maxCameraDistance: 8,
  focusSeconds: { bow: 1.1, crossbow: 0.45 },
  hipSpread: 0.055,
  aimedSpread: 0.001,
  movingSpread: 0.018,
  guardHalfAngle: 1.15,
  guardedDamage: 0.45,
} as const;
export interface BuildingDef {
  name: string;
  cost: Partial<Stock>;
  size: number;
  hp: number;
  seconds: number;
  requires?: Building[];
  height: number;
}
export const BUILDINGS: Record<Building, BuildingDef> = {
  townhall: {
    name: "Town hall",
    cost: {},
    size: 6,
    hp: 1800,
    seconds: 0,
    height: 5,
  },
  storage: {
    name: "Storehouse",
    cost: { wood: 25 },
    size: 3,
    hp: 500,
    seconds: 8,
    height: 2.6,
  },
  farm: {
    name: "Cultivation plot",
    cost: { wood: 18, food: 3 },
    size: 4,
    hp: 250,
    seconds: 6,
    height: 0.2,
  },
  armory: {
    name: "Barracks & armory",
    cost: { wood: 45, stone: 15 },
    size: 4,
    hp: 700,
    seconds: 12,
    height: 3,
  },
  smithy: {
    name: "Smithy",
    cost: { wood: 45, stone: 25 },
    size: 4,
    hp: 700,
    seconds: 12,
    height: 3,
  },
  workshop: {
    name: "Siege workshop",
    cost: { wood: 65, stone: 35, ore: 15 },
    size: 5,
    hp: 850,
    seconds: 15,
    requires: ["smithy"],
    height: 3.5,
  },
  stable: {
    name: "Stable",
    cost: { wood: 50, food: 20 },
    size: 5,
    hp: 650,
    seconds: 12,
    height: 2.8,
  },
  wall: {
    name: "Stone wall",
    cost: { stone: 12 },
    size: 2,
    hp: 650,
    seconds: 5,
    height: 2.6,
  },
  gate: {
    name: "City gate",
    cost: { stone: 20, wood: 15 },
    size: 4,
    hp: 650,
    seconds: 8,
    height: 3,
  },
  tower: {
    name: "Watchtower",
    cost: { stone: 55, wood: 35, ore: 5 },
    size: 3,
    hp: 900,
    seconds: 15,
    requires: ["armory"],
    height: 6,
  },
};
export const WEAPONS: Record<
  Weapon,
  {
    name: string;
    damage: number;
    range: number;
    cooldown: number;
    ammo?: "arrow" | "bolt";
  }
> = {
  sword: { name: "Sword", damage: 25, range: 2.5, cooldown: 0.7 },
  spear: { name: "Spear", damage: 22, range: 3.5, cooldown: 0.9 },
  bow: { name: "Longbow", damage: 21, range: 45, cooldown: 1, ammo: "arrow" },
  crossbow: {
    name: "Crossbow",
    damage: 35,
    range: 50,
    cooldown: 1.8,
    ammo: "bolt",
  },
};
export interface Recipe {
  name: string;
  station: Building;
  cost: Partial<Stock>;
  seconds: number;
  weapon?: Weapon;
  ammo?: "arrow" | "bolt" | "catapult";
  quantity?: number;
  vehicle?: "horse" | "catapult";
  upgrade?: "tools" | "armor";
}
export const RECIPES: Record<string, Recipe> = {
  tools: {
    name: "Gathering tools",
    station: "townhall",
    cost: { wood: 8, stone: 5 },
    seconds: 3,
    upgrade: "tools",
  },
  sword: {
    name: "Forge sword",
    station: "armory",
    cost: { wood: 8, ore: 12 },
    seconds: 6,
    weapon: "sword",
  },
  spear: {
    name: "Forge spear",
    station: "armory",
    cost: { wood: 12, ore: 8 },
    seconds: 5,
    weapon: "spear",
  },
  bow: {
    name: "Craft longbow",
    station: "armory",
    cost: { wood: 20 },
    seconds: 6,
    weapon: "bow",
  },
  crossbow: {
    name: "Craft crossbow",
    station: "smithy",
    cost: { wood: 22, ore: 18 },
    seconds: 9,
    weapon: "crossbow",
  },
  armor: {
    name: "Forge armor",
    station: "smithy",
    cost: { ore: 20, wood: 5 },
    seconds: 8,
    upgrade: "armor",
  },
  arrow: {
    name: "20 arrows",
    station: "armory",
    cost: { wood: 6, ore: 2 },
    seconds: 3,
    ammo: "arrow",
    quantity: 20,
  },
  bolt: {
    name: "15 bolts",
    station: "smithy",
    cost: { wood: 5, ore: 4 },
    seconds: 3,
    ammo: "bolt",
    quantity: 15,
  },
  catapultAmmo: {
    name: "8 siege stones",
    station: "workshop",
    cost: { stone: 12 },
    seconds: 4,
    ammo: "catapult",
    quantity: 8,
  },
  horse: {
    name: "Saddle horse",
    station: "stable",
    cost: { food: 30, wood: 15 },
    seconds: 10,
    vehicle: "horse",
  },
  catapult: {
    name: "Build catapult",
    station: "workshop",
    cost: { wood: 70, ore: 20, stone: 15 },
    seconds: 15,
    vehicle: "catapult",
  },
};
export const resourceOf = (type: EntityType) =>
  type === "tree"
    ? "wood"
    : type === "deer"
      ? "food"
      : type === "stone"
        ? "stone"
        : type === "ore"
          ? "ore"
          : undefined;
