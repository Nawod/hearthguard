import { createMatch } from "../../src/game/world";
import type { MatchConfig } from "../../src/game/types";
export const createFixture = (options: Partial<MatchConfig> = {}) =>
  createMatch({
    mode: "single",
    difficulty: "easy",
    seed: 42,
    participants: [
      { name: "You", controller: "human" },
      { name: "Rival", controller: "ai" },
    ],
    ...options,
  });
