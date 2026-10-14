import { Castle } from "lucide-react";
import { BUILDINGS } from "../game/balance";
import type { Building } from "../game/types";
import { cost } from "./format";
export function BuildPanel({
  onSelect,
  onTrap,
}: {
  onSelect: (type: Building) => void;
  onTrap: () => void;
}) {
  return (
    <>
      <span className="eyebrow">Shape your settlement</span>
      <h2>Build your city.</h2>
      <p>
        Materials come from the city bank. Place a site on clear land, then work
        beside it to finish.
      </p>
      <div className="build-grid">
        {Object.entries(BUILDINGS)
          .filter(([t]) => t !== "townhall")
          .map(([t, d]) => (
            <button
              key={t}
              aria-label={"Build " + d.name}
              onClick={() => {
                onSelect(t as Building);
              }}
            >
              <Castle size={24} />
              <b>{d.name}</b>
              <small>{cost(d.cost)}</small>
              <span>{d.seconds}s construction</span>
            </button>
          ))}
      </div>
      <button className="secondary" onClick={onTrap}>
        Set bear trap · carry 5 wood + 5 ore
      </button>
    </>
  );
}
