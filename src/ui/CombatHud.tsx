import type { Player, Entity } from "../game/types";
import { WEAPONS } from "../game/balance";
import type { CSSProperties } from "react";

export function CombatHud({
  player: p,
  tick,
  difficulty,
  vehicle,
}: {
  player: Player;
  tick: number;
  difficulty: string;
  vehicle?: Entity;
}) {
  const weapon = p.weapons[p.slot],
    ranged = weapon === "bow" || weapon === "crossbow",
    siege = vehicle?.type === "catapult" && vehicle.occupant === p.id,
    aiming = p.input.aim && (ranged || siege),
    blocking = p.input.aim && !p.input.attack && !ranged && !!weapon,
    focus = p.combat?.focus ?? 0,
    empty =
      difficulty === "hard" &&
      (siege
        ? p.ammo.catapult <= 0
        : ranged && p.ammo[WEAPONS[weapon].ammo!] <= 0),
    status = empty
      ? "Out of ammunition · craft more at your workshop"
      : p.cooldown > 0 && (ranged || siege)
        ? `${weapon === "bow" && !siege ? "Nocking arrow" : "Reloading"} · ${p.cooldown.toFixed(1)}s`
        : siege
          ? "Siege ready · attack to fire"
          : ranged
            ? aiming
              ? focus >= 0.95
                ? "Steady · attack to fire"
                : `Steadying · ${Math.round(focus * 100)}%`
              : "Hold aim to steady your shot"
            : blocking
              ? "Guarding your front"
              : "";
  return (
    <>
      <div
        data-testid="aim-reticle"
        className={`crosshair ${aiming ? "aiming" : ""} ${blocking ? "blocking" : ""}`}
        style={
          {
            "--reticle-size": `${12 + (1 - focus) * 20 + (Math.hypot(p.vel.x, p.vel.z) > 0.3 ? 8 : 0)}px`,
          } as CSSProperties
        }
      />
      {status && (
        <div className="combat-state" data-testid="combat-state">
          {status}
        </div>
      )}
      {tick - (p.combat?.lastHitTick ?? -100) < 9 && (
        <div className="hit-marker" aria-label="Hit confirmed" />
      )}
    </>
  );
}
