import type {
  MatchConfig,
  InputFrame,
  Command,
  PlayerView,
  Difficulty,
  MatchMode,
} from "../game/types";
export interface Seat {
  id: string;
  name: string;
  team: 0 | 1;
  ready: boolean;
  connected: boolean;
  playerId: number;
}
export interface Room {
  code: string;
  host: string;
  phase: "lobby" | "playing" | "finished";
  mode: "ffa" | "teams";
  difficulty: Difficulty;
  seed: number;
  seats: Seat[];
}
export type ClientMessage =
  | {
      type: "create";
      name: string;
      mode: "ffa" | "teams";
      difficulty: Difficulty;
      seed: number;
    }
  | { type: "join"; name: string; code: string }
  | {
      type: "queue";
      name: string;
      mode: "ffa" | "teams";
      difficulty: Difficulty;
      count: number;
    }
  | {
      type: "settings";
      mode: "ffa" | "teams";
      difficulty: Difficulty;
      seed: number;
    }
  | { type: "team"; id: string; team: 0 | 1 }
  | { type: "ready"; ready: boolean }
  | { type: "start" | "leave" | "cancel" }
  | { type: "resume"; code: string; token: string }
  | { type: "input"; input: InputFrame }
  | { type: "command"; seq: number; command: Command };
export interface GameSession {
  onView?: (view: PlayerView) => void;
  onResult?: (message: string) => void;
  submitInput(input: InputFrame): void;
  sendCommand(command: Command): void;
  dispose(): void;
}
