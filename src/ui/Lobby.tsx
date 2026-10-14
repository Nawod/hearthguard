import { Users, ArrowRight } from "lucide-react";
import type { Room } from "../session/protocol";
import type { Difficulty } from "../game/types";
interface Props {
  room?: Room;
  clientId: string;
  connection: string;
  name: string;
  setName: (v: string) => void;
  onlineMode: "ffa" | "teams";
  setOnlineMode: (v: "ffa" | "teams") => void;
  difficulty: Difficulty;
  setDifficulty: (v: Difficulty) => void;
  seedValue: number;
  send: (m: any) => void;
  joinCode: string;
  setJoinCode: (v: string) => void;
  count: number;
  setCount: (v: number) => void;
  notify: (v: string) => void;
  onLeave: () => void;
}
export function Lobby({
  room,
  clientId,
  connection,
  name,
  setName,
  onlineMode,
  setOnlineMode,
  difficulty,
  setDifficulty,
  seedValue,
  send,
  joinCode,
  setJoinCode,
  count,
  setCount,
  notify,
  onLeave,
}: Props) {
  return (
    <>
      <Users size={28} />
      <h2>{room ? "Your company awaits." : "Share the realm."}</h2>
      <p>
        {connection ||
          "Create a private room, join a friend, or find an open company."}
      </p>
      {!room ? (
        <>
          <label>
            Your name
            <input
              aria-label="Online name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
            />
          </label>
          <div className="field-pair">
            <label>
              Match mode
              <select
                aria-label="Online match mode"
                value={onlineMode}
                onChange={(e) => setOnlineMode(e.target.value as any)}
              >
                <option value="ffa">Free-for-all</option>
                <option value="teams">Two shared cities</option>
              </select>
            </label>
            <label>
              Difficulty
              <select
                aria-label="Online difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <button
            className="primary"
            aria-label="Create room"
            onClick={() =>
              send({
                type: "create",
                name,
                mode: onlineMode,
                difficulty,
                seed: seedValue,
              })
            }
          >
            Create private room
            <ArrowRight size={17} />
          </button>
          <div className="join-row">
            <input
              aria-label="Room code"
              placeholder="Friend’s room code"
              id="room-code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button
              className="secondary"
              onClick={() =>
                send({
                  type: "join",
                  name,
                  code: joinCode.toUpperCase(),
                })
              }
            >
              Join room
            </button>
          </div>
          <div className="join-row">
            <select
              aria-label="Matchmaking player count"
              value={count}
              onChange={(e) => setCount(+e.target.value)}
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={() =>
                send({
                  type: "queue",
                  name,
                  mode: onlineMode,
                  difficulty,
                  count,
                })
              }
            >
              Find a match
            </button>
            <button className="quiet" onClick={() => send({ type: "cancel" })}>
              Cancel search
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="room-code">
            <span>Room code</span>
            <strong>{room.code}</strong>
            <button
              onClick={() => {
                if (!navigator.clipboard) {
                  notify("Share the room code: " + room.code);
                  return;
                }
                void navigator.clipboard
                  ?.writeText(new URL("?room=" + room.code, location.href).href)
                  .then(() => notify("Invitation copied."))
                  .catch(() => notify("Share the room code: " + room.code));
              }}
            >
              Copy invite
            </button>
          </div>
          <div className="seats">
            {room.seats.map((s) => (
              <div key={s.id}>
                <span className={"seat-color team-" + s.team} />
                <b>{s.name}</b>
                <small>
                  {s.connected
                    ? s.ready
                      ? "Ready"
                      : "Preparing"
                    : "Disconnected"}
                </small>
                {room.mode === "teams" && (
                  <select
                    aria-label={"Team for " + s.name}
                    disabled={room.host !== clientId && s.id !== clientId}
                    value={s.team}
                    onChange={(e) =>
                      send({
                        type: "team",
                        id: s.id,
                        team: +e.target.value,
                      })
                    }
                  >
                    <option value="0">Azure</option>
                    <option value="1">Ember</option>
                  </select>
                )}
              </div>
            ))}
          </div>
          <div className="field-pair">
            <label>
              Lobby difficulty
              <select
                aria-label="Lobby difficulty"
                disabled={room.host !== clientId}
                value={room.difficulty}
                onChange={(e) =>
                  send({
                    type: "settings",
                    mode: room.mode,
                    difficulty: e.target.value,
                    seed: room.seed,
                  })
                }
              >
                <option value="easy">Easy · 3 lives · ∞ ammo</option>
                <option value="medium">Medium · 2 lives · ∞ ammo</option>
                <option value="hard">Hard · 1 life · crafted ammo</option>
              </select>
            </label>
            <label>
              Lobby mode
              <select
                aria-label="Lobby mode"
                disabled={room.host !== clientId}
                value={room.mode}
                onChange={(e) =>
                  send({
                    type: "settings",
                    mode: e.target.value,
                    difficulty: room.difficulty,
                    seed: room.seed,
                  })
                }
              >
                <option value="ffa">Free-for-all</option>
                <option value="teams">Two teams</option>
              </select>
            </label>
          </div>
          <div className="join-row">
            <button
              className="secondary"
              onClick={() =>
                send({
                  type: "ready",
                  ready: !room.seats.find((s) => s.id === clientId)?.ready,
                })
              }
            >
              {room.seats.find((s) => s.id === clientId)?.ready
                ? "Not ready"
                : "Ready"}
            </button>
            {room.host === clientId && (
              <button
                className="primary"
                aria-label="Start round"
                disabled={
                  room.seats.length < 2 ||
                  room.seats.some((s) => !s.connected || !s.ready)
                }
                onClick={() => send({ type: "start" })}
              >
                Start round
                <ArrowRight size={17} />
              </button>
            )}
          </div>
          <button className="quiet" onClick={() => onLeave()}>
            Leave room
          </button>
        </>
      )}
    </>
  );
}
