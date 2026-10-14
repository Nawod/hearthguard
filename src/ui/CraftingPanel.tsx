import { Hammer, Swords } from "lucide-react";
import { BUILDINGS, RECIPES, WEAPONS } from "../game/balance";
import type {
  Entity,
  Command,
  Building,
  Resource,
  Difficulty,
} from "../game/types";
import { cost } from "./format";
export function CraftingPanel({
  building,
  difficulty,
  issue,
}: {
  building?: Entity;
  difficulty: Difficulty;
  issue: (command: Command) => void;
}) {
  return (
    <>
      <span className="eyebrow">Made by your own hands</span>
      <h2>
        {building
          ? (BUILDINGS[building.type as Building]?.name ?? building.type)
          : "Find a workshop."}
      </h2>
      <p>
        {building
          ? "Stay close to use this shared city building. Crafted weapons go into its shared equipment store."
          : "Approach a town hall, armory, smithy, stable or siege workshop, then press E / Use."}
      </p>
      {building && (
        <>
          <div className="recipe-grid">
            {Object.entries(RECIPES)
              .filter(
                ([, d]) =>
                  d.station === building.type &&
                  (!d.ammo || difficulty === "hard"),
              )
              .map(([key, d]) => (
                <button
                  key={key}
                  aria-label={d.name}
                  onClick={() =>
                    issue({
                      type: "craft",
                      target: building.id,
                      recipe: key,
                    })
                  }
                >
                  <Hammer size={19} />
                  <span>
                    <b>{d.name}</b>
                    <small>
                      {cost(d.cost)} · {d.seconds}s
                    </small>
                  </span>
                </button>
              ))}
          </div>
          {building.queue.map((q, i) => (
            <p className="production" key={i}>
              Crafting {RECIPES[q.recipe].name} · {Math.ceil(q.remaining)}s
            </p>
          ))}
          {building.equipment.map((weapon, i) => (
            <div className="equipment-row" key={i}>
              <Swords size={18} />
              {WEAPONS[weapon].name}
              <button
                onClick={() =>
                  issue({
                    type: "equip",
                    target: building.id,
                    weapon,
                    slot: 0,
                  })
                }
              >
                Equip 1
              </button>
              <button
                onClick={() =>
                  issue({
                    type: "equip",
                    target: building.id,
                    weapon,
                    slot: 1,
                  })
                }
              >
                Equip 2
              </button>
            </div>
          ))}
          {["townhall", "storage"].includes(building.type) && (
            <div className="bank-actions">
              <button
                onClick={() => issue({ type: "deposit", target: building.id })}
              >
                Deposit backpack
              </button>
              {(["food", "wood", "stone", "ore"] as Resource[]).map((k) => (
                <button
                  key={k}
                  onClick={() =>
                    issue({
                      type: "withdraw",
                      target: building.id,
                      amounts: { [k]: 10 },
                    })
                  }
                >
                  Take 10 {k}
                </button>
              ))}
            </div>
          )}
          <button
            className="quiet"
            onClick={() => issue({ type: "repair", target: building.id })}
          >
            Repair this building
          </button>
        </>
      )}
    </>
  );
}
