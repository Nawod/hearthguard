import { Company } from "./Company";
import { CombatHud } from "./CombatHud";
import { BuildPanel } from "./BuildPanel";
import { CraftingPanel } from "./CraftingPanel";
import { Lobby } from "./Lobby";
import { Minimap } from "./Minimap";
import { useEffect, useRef, useState } from "react";
import {
  Castle,
  Flame,
  Users,
  Wifi,
  Globe,
  ArrowRight,
  X,
  TreePine,
  Mountain,
  Wheat,
  Pickaxe,
  Heart,
  Shield,
  Swords,
  Settings,
  Save,
  Pause,
  Package,
  Hammer,
  Volume2,
} from "lucide-react";
import type {
  PlayerView,
  Difficulty,
  Building,
  Command,
  Entity,
  MatchConfig,
  Stock,
  Resource,
} from "../game/types";
import {
  BUILDINGS,
  RECIPES,
  WEAPONS,
  LIVES,
  PACK_CAPACITY,
} from "../game/balance";
import { createMatch } from "../game/world";
import { makeView, updateVisibility } from "../game/visibility";
import { GameScene } from "../render/scene";
import { InputController } from "../input/controller";
import { LocalSession } from "../session/local";
import { OnlineSession } from "../session/online";
import type { Room, GameSession } from "../session/protocol";
import { readSave, writeSave } from "../platform/storage";
import { Soundscape } from "../platform/audio";
import { TouchControls } from "./TouchControls";
const icons = { food: Wheat, wood: TreePine, stone: Mountain, ore: Pickaxe };
const cost = (stock: Partial<Stock>) =>
  Object.entries(stock)
    .map(([k, v]) => `${v} ${k}`)
    .join(" · ");
type Panel =
  "none" | "build" | "craft" | "menu" | "help" | "settings" | "online" | "lan";
export function App() {
  const pendingOrientation = useRef(false),
    [quality, setQuality] = useState<"auto" | "light" | "detailed">("auto");
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<GameScene | undefined>(undefined),
    input = useRef<InputController | undefined>(undefined),
    local = useRef<LocalSession | undefined>(undefined),
    network = useRef<OnlineSession | undefined>(undefined),
    session = useRef<GameSession | undefined>(undefined),
    sound = useRef<Soundscape | undefined>(undefined),
    latest = useRef<any>({}),
    [view, setView] = useState<PlayerView>(),
    [screen, setScreen] = useState<"setup" | "game">("setup"),
    [loading, setLoading] = useState(false),
    [assetsReady, setAssetsReady] = useState(false),
    [assetError, setAssetError] = useState(""),
    [panel, setPanel] = useState<Panel>("none"),
    [difficulty, setDifficulty] = useState<Difficulty>("easy"),
    [seed, setSeed] = useState("Hearthguard"),
    [name, setName] = useState("Traveler"),
    [onlineMode, setOnlineMode] = useState<"ffa" | "teams">("ffa"),
    [count, setCount] = useState(2),
    [room, setRoom] = useState<Room>(),
    [connection, setConnection] = useState(""),
    [toast, setToast] = useState(""),
    [station, setStation] = useState<number>(),
    [placement, setPlacement] = useState<Building>(),
    [online, setOnline] = useState(false),
    [saved, setSaved] = useState(false),
    [autoSaved, setAutoSaved] = useState(false),
    [lanUrls, setLanUrls] = useState<string[]>([]),
    [spectating, setSpectating] = useState(false),
    [joinCode, setJoinCode] = useState(
      new URLSearchParams(location.search).get("room") ?? "",
    ),
    [near, setNear] = useState<Entity>(),
    [landscape, setLandscape] = useState(false),
    [tutorial, setTutorial] = useState(true),
    [music, setMusic] = useState(0.2),
    [effects, setEffects] = useState(0.65),
    [lanAddress, setLanAddress] = useState(""),
    [clientId, setClientId] = useState("");
  latest.current = {
    view,
    screen,
    panel,
    placement,
    online,
    loading,
    assetsReady,
    spectating,
  };
  const notify = (text: string) => {
    setToast(text);
  };
  const issue = (c: Command) => {
    session.current?.sendCommand(c);
    sound.current?.click();
  };
  const toggle = (p: Panel) => {
    const current = latest.current;
    input.current?.releaseAll();
    if (input.current && current.screen === "game")
      session.current?.submitInput(input.current.sample());
    if (document.pointerLockElement) void document.exitPointerLock();
    setPanel(p);
    if (p === "lan")
      fetch("/lan")
        .then((r) => r.json())
        .then((data) => setLanUrls(data.addresses ?? []))
        .catch(() => {});
    if (current.screen === "game" && !current.online)
      local.current?.pause(p === "menu" || p === "settings" || p === "help");
  };
  const action = (name: string): boolean => {
    const state = latest.current;
    if (state.screen !== "game") return false;
    if (name === "primary") {
      if (state.placement) {
        const pos = scene.current?.placementPosition();
        if (pos)
          issue({
            type: "build",
            building: state.placement,
            pos,
            yaw: input.current?.frame.yaw ?? 0,
          });
        return true;
      }
      return false;
    }
    if (name === "menu") {
      toggle(state.panel === "menu" ? "none" : "menu");
      return true;
    }
    if (name === "build" || name === "craft") {
      const n = scene.current?.nearest();
      if (name === "craft") setStation(n?.id);
      toggle(name);
      return true;
    }
    if (name === "eat") {
      issue({ type: "eat" });
      return true;
    }
    if (name === "mount") {
      const p = state.view?.players.find(
          (p: any) => p.id === state.view.playerId,
        ),
        v = state.view?.entities.find((e: any) => e.id === p?.vehicleId);
      if (v?.occupant === p?.id) issue({ type: "dismount" });
      else {
        const n = scene.current?.nearest();
        if (n) issue({ type: "mount", target: n.id });
      }
      return true;
    }
    if (name === "interact") {
      if (state.placement) return action("primary");
      const n = scene.current?.nearest();
      if (!n) {
        notify("Approach a resource, workshop or city building.");
        return true;
      }
      if (n.progress < 1 || ["tree", "stone", "ore", "deer"].includes(n.type))
        issue({ type: "interact", target: n.id });
      else if (n.type === "gate")
        issue({ type: "gate", target: n.id, open: !!n.gateLocked });
      else if (n.type === "bag") issue({ type: "loot", target: n.id });
      else if (n.type === "farm")
        issue({ type: n.amount > 0 ? "harvest" : "plant", target: n.id });
      else if (n.type === "trap") issue({ type: "disarm", target: n.id });
      else if (["horse", "catapult"].includes(n.type))
        issue({ type: "mount", target: n.id });
      else {
        if (["townhall", "storage"].includes(n.type))
          issue({ type: "deposit", target: n.id });
        setStation(n.id);
        toggle("craft");
      }
      return true;
    }
    if (name === "repair") {
      const n = scene.current?.nearest();
      if (n) issue({ type: "repair", target: n.id });
      return true;
    }
    if (name === "stop") {
      issue({ type: "stop" });
      return true;
    }
    return false;
  };
  useEffect(() => {
    let cancelled = false;
    const audio = (sound.current = new Soundscape()),
      field = (scene.current = new GameScene(
        host.current!,
        () =>
          input.current?.peek() ??
          latest.current.view?.players.find(
            (p: any) => p.id === latest.current.view.playerId,
          )?.input,
        () =>
          latest.current.online
            ? network.current?.prediction.position
            : undefined,
      ));
    const w = (local.current = new LocalSession()),
      net = (network.current = new OnlineSession());
    session.current = w;
    let lastEvent = 0;
    let matchView: PlayerView | undefined;
    const receive = (v: PlayerView) => {
      if (cancelled) return;
      matchView = v;
      setLoading(false);
      if (v.result || v.players.find((p) => p.id === v.playerId)?.dead)
        input.current?.releaseAll();
      if (pendingOrientation.current) {
        const self = v.players.find((p) => p.id === v.playerId);
        if (self && input.current) {
          input.current.synchronize(v.ack, self.yaw);
          input.current.frame.weaponSlot = self.slot;
          pendingOrientation.current = false;
        }
        lastEvent = Math.max(0, ...v.events.map((e) => e.id));
      }
      for (const event of v.events)
        if (event.id > lastEvent) {
          const self = v.players.find((p) => p.id === v.playerId),
            listener = self?.eliminated
              ? (v.players.find(
                  (p) => p.faction === self.faction && !p.dead && !p.eliminated,
                ) ?? self)
              : self;
          audio.play(
            event,
            listener?.pos,
            input.current?.frame.yaw ?? listener?.yaw ?? 0,
          );
          if (
            ["complete", "error", "death", "info"].includes(event.kind) ||
            (event.kind === "attack" && event.text.includes("under attack"))
          )
            notify(event.text);
        }
      lastEvent = Math.max(lastEvent, ...v.events.map((e) => e.id));
      setView(v);
      field.update(v);
      input.current?.synchronize(v.ack);
      if (v.tick === 0)
        input.current?.synchronize(
          v.ack,
          v.players.find((p) => p.id === v.playerId)?.yaw ?? 0,
        );
    };
    w.onView = (v) => {
      if (session.current === w) receive(v);
    };
    w.onResult = (message) => {
      notify(message);
      if (latest.current.loading) {
        setLoading(false);
        setScreen("setup");
        setPanel("none");
      }
    };
    w.onSave = (slot, save) => {
      void writeSave(slot, save)
        .then(() => {
          if (slot === "manual") setSaved(true);
          else setAutoSaved(true);
          if (slot === "manual") notify("Match saved in this browser.");
        })
        .catch((e) => notify(e.message));
    };
    net.onView = (v) => {
      if (session.current === net) receive(v);
    };
    net.onResult = notify;
    net.onRoom = (r) => {
      setRoom(r);
      if (r?.phase === "lobby") setPanel("online");
    };
    net.onStatus = setConnection;
    net.onIdentity = setClientId;
    net.onStart = () => {
      matchView = undefined;
      setView(undefined);
      setLoading(true);
      pendingOrientation.current = true;
      w.pause(true);
      session.current = net;
      setOnline(true);
      setSpectating(false);
      input.current?.synchronize(0, Math.PI);
      setScreen("game");
      setPanel("none");
    };
    void field
      .mount()
      .then(async () => {
        if (cancelled) return;
        const control = (input.current = new InputController(
          field.canvas,
          (key) => action(key),
          () => field.aimOrigin(),
        ));
        if (session.current === net || latest.current.screen === "game") {
          setAssetsReady(true);
          if (matchView) receive(matchView);
          return;
        }
        const r = await createMatch({
          mode: "single",
          difficulty: "easy",
          seed: 42,
          participants: [
            { name: "Traveler", controller: "human" },
            { name: "Ember stranger", controller: "ai" },
          ],
        });
        updateVisibility(r);
        const preview = makeView(r.state, 1);
        r.physics.dispose();
        if (!cancelled) {
          if (session.current === w && latest.current.screen === "setup") {
            field.update(preview);
            setView(preview);
          }
          setAssetsReady(true);
        }
      })
      .catch((error) => {
        field.dispose();
        setAssetError(
          error.message ||
            "Unable to initialize 3D graphics. Enable hardware acceleration and reload.",
        );
        notify(
          error.message ||
            "Unable to initialize 3D graphics. Enable hardware acceleration and reload.",
        );
      });
    void readSave("manual")
      .then((s) => setSaved(!!s))
      .catch(() => {});
    void readSave("auto")
      .then((s) => setAutoSaved(!!s))
      .catch(() => {});
    if (new URLSearchParams(location.search).has("room")) setPanel("online");
    const unlock = () => {
      void audio.unlock();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const visibility = () => {
      if (document.hidden) {
        input.current?.releaseAll();
        if (input.current) session.current?.submitInput(input.current.sample());
        if (!latest.current.online && latest.current.screen === "game") {
          w.pause(true);
          setPanel("menu");
        }
      }
    };
    document.addEventListener("visibilitychange", visibility);
    const interval = setInterval(() => {
      const state = latest.current;
      if (input.current) {
        input.current.active =
          state.assetsReady &&
          state.screen === "game" &&
          state.panel === "none" &&
          !state.loading &&
          !state.view?.result;
        const own = state.view?.players.find(
          (p: any) => p.id === state.view.playerId,
        );
        if (input.current.active && !own?.dead && !own?.eliminated)
          session.current?.submitInput(input.current.sample());
      }
      setNear(field.nearest());
    }, 1000 / 30);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      input.current?.dispose();
      field.dispose();
      w.dispose();
      net.dispose();
      audio.dispose();
    };
  }, []);
  useEffect(() => {
    scene.current?.setPlacement(placement);
  }, [placement]);
  useEffect(() => {
    if (scene.current)
      scene.current.menu = screen === "setup" || loading || !assetsReady;
  }, [screen, loading, assetsReady]);
  useEffect(() => {
    sound.current?.setVolumes(music, effects);
  }, [music, effects]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => scene.current?.setQuality(quality), [quality]);
  const hash = () => {
    let n = 2166136261;
    for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  };
  const start = () => {
    if (!assetsReady) {
      notify("Loading detailed 3D models. Please wait.");
      return;
    }
    setLoading(true);
    pendingOrientation.current = true;
    session.current = local.current;
    setOnline(false);
    setPlacement(undefined);
    setSpectating(false);
    setStation(undefined);
    setScreen("game");
    setPanel("none");
    input.current?.releaseAll();
    input.current?.synchronize(0, Math.PI);
    local.current?.start({
      mode: "single",
      difficulty,
      seed: hash(),
      participants: [
        { name, controller: "human" },
        { name: "Ember stranger", controller: "ai" },
      ],
    });
  };
  const load = async (slot: "manual" | "auto") => {
    try {
      const s = await readSave(slot);
      if (!s) return notify("No match is saved in that slot.");
      session.current = local.current;
      setOnline(false);
      setScreen("game");
      setPanel("menu");
      pendingOrientation.current = true;
      setLoading(true);
      local.current?.load(s);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const p = view?.players.find((p) => p.id === view.playerId),
    f = view?.factions.find((f) => f.id === p?.faction),
    hall = view?.entities.find((e) => e.id === f?.townhall),
    building = view?.entities.find((e) => e.id === station);
  const alive = view && !p?.eliminated && view.result === null;
  const friends = () => {
    setPanel("online");
    fetch("/health")
      .then((r) => r.json())
      .then(() => {})
      .catch(() =>
        notify("Start the Hearthguard server for online or local Wi-Fi play."),
      );
  };
  const send = (m: any) => network.current?.send(m);
  const exit = () => {
    if (online) network.current?.leave();
    else local.current?.pause(true);
    setOnline(false);
    session.current = local.current;
    setScreen("setup");
    setPanel("none");
    setPlacement(undefined);
  };
  return (
    <main className="app">
      <div ref={host} className="battlefield" data-testid="battlefield" />
      {screen === "setup" ? (
        <>
          <div className="setup-shade" />
          <section className="setup">
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
              <span className="brand-mark">
                <Flame size={29} />
              </span>
              Hearthguard
            </a>
            <div className="setup-story">
              <p className="edition">A realm worth defending</p>
              <h1>
                Your hands.
                <br />
                Your hearth.
                <br />
                Your kingdom.
              </h1>
              <p>
                Raise a city from the wilderness. Forge your weapons.
                <br className="wide" /> Defend the place you call home.
              </p>
            </div>
            <div className="setup-fields">
              <label>
                Your name
                <input
                  maxLength={32}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Your name"
                />
              </label>
              <div className="field-pair">
                <label>
                  Challenge
                  <select
                    aria-label="Difficulty"
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as Difficulty)
                    }
                  >
                    <option value="easy">Easy · 3 lives</option>
                    <option value="medium">Medium · 2 lives</option>
                    <option value="hard">Hard · 1 life</option>
                  </select>
                </label>
                <label>
                  World seed
                  <input
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    aria-label="World seed"
                  />
                </label>
              </div>
              <p className="difficulty-note">
                {difficulty === "hard"
                  ? "Craft every arrow. Make your one life count."
                  : "Unlimited ammunition. Build, explore, and learn."}
              </p>
              <button
                className="primary"
                disabled={!assetsReady}
                onClick={start}
              >
                <Swords size={19} />
                Play against the computer
                <ArrowRight size={18} />
              </button>
              <div className="play-options">
                <button onClick={friends}>
                  <Globe size={17} />
                  Play with friends
                </button>
                <button onClick={() => toggle("lan")}>
                  <Wifi size={17} />
                  Local Wi-Fi
                </button>
              </div>
              {saved && (
                <button
                  className="quiet saved"
                  disabled={!assetsReady}
                  onClick={() => void load("manual")}
                >
                  <Save size={15} />
                  Continue saved journey
                </button>
              )}
              {autoSaved && (
                <button
                  className="quiet saved"
                  disabled={!assetsReady}
                  onClick={() => void load("auto")}
                >
                  <Save size={15} />
                  Continue latest autosave
                </button>
              )}
              <div className="setup-footer">
                <button onClick={() => toggle("help")}>How to play</button>
                <span>2–8 players · Shared cities · No armies</span>
              </div>
            </div>
          </section>
          <div className="scene-caption">
            <span>One traveler. An entire realm.</span>
            <p>
              Everything you build
              <br />
              is worth fighting for.
            </p>
          </div>
        </>
      ) : view && p && f ? (
        <>
          <header className="hud">
            <div className="small-brand">
              <Flame size={24} />
              Hearthguard
            </div>
            <div className="bank" aria-label="City resources">
              {Object.entries(f.stock).map(([k, v]) => {
                const Icon = icons[k as Resource];
                return (
                  <span key={k}>
                    <Icon size={17} />
                    <b>{Math.floor(v + 1e-6)}</b>
                    <small>{k}</small>
                  </span>
                );
              })}
            </div>
            <div className="hud-buttons">
              <button
                aria-label="Save match"
                disabled={online}
                onClick={() => local.current?.save()}
              >
                <Save size={18} />
              </button>
              <button aria-label="Settings" onClick={() => toggle("settings")}>
                <Settings size={18} />
              </button>
              <button aria-label="Pause match" onClick={() => toggle("menu")}>
                <Pause size={18} />
              </button>
            </div>
          </header>
          <div className="realm">
            <span>
              <Castle size={16} />
              {f.name}
            </span>
            <span>
              {view.config.difficulty} ·{" "}
              {online ? "Shared realm" : "Against the computer"} ·{" "}
              {Math.floor(view.tick / 1800)}:
              {String(Math.floor(view.tick / 30) % 60).padStart(2, "0")}{" "}
              {p.vehicleId &&
                view.entities.find((e) => e.id === p.vehicleId) && (
                  <em className="vehicle-status">
                    {" "}
                    · {
                      view.entities.find((e) => e.id === p.vehicleId)!.type
                    } ·{" "}
                    {Math.ceil(
                      view.entities.find((e) => e.id === p.vehicleId)!.hp,
                    )}{" "}
                    health ·{" "}
                    {view.entities.find((e) => e.id === p.vehicleId)!
                      .occupant === p.id
                      ? "Mounted"
                      : "Ready"}
                  </em>
                )}
            </span>
          </div>
          <Minimap view={view} />
          <Company view={view} />
          <div className="hall-health">
            <Castle size={18} />
            <div>
              <span>Town hall</span>
              <progress
                max={hall?.maxHp ?? 1800}
                value={Math.max(0, hall?.hp ?? 0)}
              />
            </div>
            <b>{Math.ceil(hall?.hp ?? 0)}</b>
          </div>
          {panel === "none" && alive && !p.dead && (
            <>
              <CombatHud
                player={p}
                tick={view.tick}
                difficulty={view.config.difficulty}
                vehicle={view.entities.find((e) => e.id === p.vehicleId)}
              />
              <div className="interact-hint">
                {placement ? (
                  <>
                    <Hammer size={16} />
                    <span>Place {BUILDINGS[placement].name}</span>
                    <button onClick={() => action("primary")}>Place</button>
                    <button onClick={() => setPlacement(undefined)}>
                      Cancel
                    </button>
                  </>
                ) : p.action ? (
                  <>
                    <Hammer size={16} />
                    <span>
                      {p.action.kind === "gather"
                        ? "Gathering resources"
                        : p.action.kind === "repair"
                          ? "Repairing building"
                          : "Working on building"}
                    </span>
                    <button
                      aria-label="Stop current task"
                      onClick={() => action("stop")}
                    >
                      Stop
                    </button>
                  </>
                ) : near ? (
                  <>
                    <span className="key">E</span>
                    <span>
                      {near.progress < 1
                        ? "Finish building"
                        : near.type === "tree"
                          ? "Gather timber"
                          : near.type === "stone"
                            ? "Gather stone"
                            : near.type === "ore"
                              ? "Gather ore"
                              : near.type === "deer"
                                ? "Hunt deer"
                                : near.type === "farm"
                                  ? near.amount
                                    ? "Harvest crops"
                                    : "Plant crops"
                                  : near.type === "gate"
                                    ? near.gateLocked
                                      ? "Open your gate"
                                      : "Lock your gate"
                                    : near.type === "bag"
                                      ? "Recover resources"
                                      : near.type === "trap"
                                        ? "Disarm trap"
                                        : near.type === "horse"
                                          ? "Mount horse"
                                          : near.type === "catapult"
                                            ? "Operate catapult"
                                            : "Use " +
                                              (BUILDINGS[near.type as Building]
                                                ?.name ?? near.type)}
                    </span>
                    <button onClick={() => action("interact")}>Use</button>
                    {near.faction === p.faction &&
                      near.progress === 1 &&
                      near.hp < near.maxHp &&
                      BUILDINGS[near.type as Building] && (
                        <button
                          aria-label="Repair building"
                          onClick={() => action("repair")}
                        >
                          Repair · wood
                        </button>
                      )}
                  </>
                ) : (
                  <span>Explore the wilderness · Gather · Build · Defend</span>
                )}
              </div>
              <div className="quick-actions">
                <button aria-label="Build menu" onClick={() => toggle("build")}>
                  <Hammer size={20} />
                  <span>Build</span>
                </button>
                <button
                  aria-label="Craft menu"
                  onClick={() => {
                    setStation(near?.id);
                    toggle("craft");
                  }}
                >
                  <Package size={20} />
                  <span>Craft</span>
                </button>
                <button
                  aria-label="Mount or dismount"
                  onClick={() => action("mount")}
                >
                  <Users size={20} />
                  <span>Mount</span>
                </button>
              </div>
              <TouchControls controller={input.current} action={action} />
            </>
          )}
          <footer className="player-deck">
            <div className="vitals">
              <div className="vitals-title">
                <Heart size={17} />
                <span>{p.name}</span>
                <b>{Math.ceil(p.hp - 1e-6)} / 100</b>
              </div>
              <progress max={100} value={Math.max(0, p.hp)} />
              <div className="lives" data-testid="lives">
                {Array.from(
                  { length: LIVES[view.config.difficulty] },
                  (_, i) => (
                    <Heart
                      key={i}
                      size={14}
                      className={i < p.lives ? "remaining" : "lost"}
                    />
                  ),
                )}
                <span>{p.lives} lives remaining</span>
              </div>
            </div>
            <div className="loadout">
              {p.weapons.map((w, i) => (
                <button
                  key={i}
                  className={p.slot === i ? "equipped" : ""}
                  aria-label={"Weapon slot " + (i + 1)}
                  onClick={() => {
                    if (input.current)
                      input.current.frame.weaponSlot = i as 0 | 1;
                  }}
                >
                  <span>{i + 1}</span>
                  <Swords size={23} />
                  <b>{w ? WEAPONS[w].name : "Empty hand"}</b>
                  {i === 0 &&
                    view.entities.some(
                      (e) =>
                        e.id === p.vehicleId &&
                        e.type === "catapult" &&
                        e.occupant === p.id,
                    ) && (
                      <small className="siege-ammo">
                        Siege ·{" "}
                        {view.config.difficulty === "hard"
                          ? p.ammo.catapult
                          : "∞"}{" "}
                        ammunition
                      </small>
                    )}
                  {w && WEAPONS[w].ammo && (
                    <small>
                      {view.config.difficulty === "hard"
                        ? p.ammo[WEAPONS[w].ammo!]
                        : "∞"}{" "}
                      ammunition
                    </small>
                  )}
                </button>
              ))}
            </div>
            <div className="backpack">
              <span>
                <Package size={15} />
                Backpack ·{" "}
                {Math.floor(
                  Object.values(p.pack).reduce((a, b) => a + b, 0) + 1e-6,
                )}
                /{PACK_CAPACITY}
              </span>
              <div>
                {Object.entries(p.pack).map(([k, v]) => {
                  const Icon = icons[k as Resource];
                  return (
                    <span key={k}>
                      <Icon size={14} />
                      {Math.floor(v + 1e-6)}
                    </span>
                  );
                })}
              </div>
              <button onClick={() => issue({ type: "eat" })}>
                Eat food · F
              </button>
            </div>
          </footer>
          {tutorial && panel === "none" && alive && (
            <aside className="tutorial">
              <button
                aria-label="Dismiss tutorial"
                onClick={() => setTutorial(false)}
              >
                <X size={13} />
              </button>
              <span>Your first hearth</span>
              <p>
                {!Object.values(f.stock).some((n) => n > 0)
                  ? "Walk to a tree or deposit. Press E / Use to gather, then bring materials to your town hall."
                  : !view.entities.some(
                        (e) => e.faction === f.id && e.type === "armory",
                      )
                    ? "Build a barracks & armory. Personally finish its construction, then craft your first weapon."
                    : !p.weapons.some(Boolean)
                      ? "Use your armory to craft and equip a weapon. Two weapon categories and one vehicle are yours to carry."
                      : "Defend your town hall. Destroy the rival hearth or exhaust their lives to claim the realm."}
              </p>
              <small>WASD move · Mouse look · E use · B build</small>
            </aside>
          )}
          {p.dead && !p.eliminated && (
            <div className="death-card">
              <Flame size={28} />
              <h2>A spark remains.</h2>
              <p>
                Returning to your town hall in{" "}
                {Math.max(0, Math.ceil((p.respawnAt - view.tick) / 30))}{" "}
                seconds.
              </p>
              <small>
                Your weapons remain. Recover your dropped resources.
              </small>
            </div>
          )}
          {(!alive || p.eliminated) && !spectating && (
            <div className="modal-shade">
              <section className="modal results">
                <Flame size={35} />
                <h2>
                  {view.result?.draw
                    ? "The realm falls silent."
                    : view.result?.winnerFactionId === p.faction
                      ? "Your hearth endures."
                      : "Your hearth has fallen."}
                </h2>
                <p>
                  {p.eliminated && !view.result
                    ? "Your journey ends. Your surviving teammates can continue."
                    : view.result?.winnerFactionId === p.faction
                      ? "The realm belongs to your city."
                      : "A destroyed town hall or exhausted lives ends the journey."}
                </p>
                {p.eliminated && !view.result && (
                  <button
                    className="secondary"
                    onClick={() => setSpectating(true)}
                  >
                    Watch your teammates
                  </button>
                )}
                <button className="primary" onClick={exit}>
                  Return to the fireside
                  <ArrowRight size={17} />
                </button>
              </section>
            </div>
          )}
        </>
      ) : null}
      {panel !== "none" && (
        <div className="modal-shade">
          <section
            className={
              "modal " +
              (["build", "craft", "online"].includes(panel) ? "wide-modal" : "")
            }
          >
            <button
              className="close"
              aria-label="Close panel"
              onClick={() => toggle("none")}
            >
              <X size={20} />
            </button>
            {panel === "build" && (
              <BuildPanel
                onSelect={(type) => {
                  setPlacement(type);
                  toggle("none");
                }}
                onTrap={() => {
                  const player = latest.current.view?.players.find(
                      (v: any) => v.id === latest.current.view.playerId,
                    ),
                    pos = player && {
                      x:
                        player.pos.x +
                        Math.sin(input.current?.frame.yaw ?? 0) * 2,
                      y: player.pos.y,
                      z:
                        player.pos.z -
                        Math.cos(input.current?.frame.yaw ?? 0) * 2,
                    };
                  if (pos) issue({ type: "trap", pos });
                  toggle("none");
                }}
              />
            )}
            {panel === "craft" && (
              <CraftingPanel
                building={building}
                difficulty={view?.config.difficulty ?? difficulty}
                issue={issue}
              />
            )}
            {panel === "menu" && (
              <>
                <Flame size={30} />
                <h2>The hearth can wait.</h2>
                <p>
                  {online
                    ? "Your shared round keeps running while this menu is open."
                    : "Your single-player journey is paused."}
                </p>
                <button
                  className="primary"
                  disabled={loading}
                  onClick={() => toggle("none")}
                >
                  Resume journey
                  <ArrowRight size={16} />
                </button>
                {!online && (
                  <button
                    className="secondary"
                    onClick={() => local.current?.save()}
                  >
                    Save match
                  </button>
                )}
                <button className="quiet" onClick={exit}>
                  Return to main menu
                </button>
              </>
            )}
            {panel === "settings" && (
              <>
                <h2>Make yourself at home.</h2>
                <label>
                  Visual detail
                  <select
                    aria-label="Visual detail"
                    value={quality}
                    onChange={(e) =>
                      setQuality(e.target.value as typeof quality)
                    }
                  >
                    <option value="auto">Automatic for this device</option>
                    <option value="light">Lightweight</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </label>
                <label className="slider">
                  Music
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={music}
                    onChange={(e) => setMusic(+e.target.value)}
                  />
                </label>
                <label className="slider">
                  Effects
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={effects}
                    onChange={(e) => setEffects(+e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  onClick={() => sound.current?.test()}
                >
                  <Volume2 size={18} />
                  Test sound
                </button>
              </>
            )}
            {panel === "help" && (
              <>
                <h2>A hearth of your own.</h2>
                <p>
                  You start empty-handed. Gather timber, stone, ore and food
                  yourself. Deposit supplies at your town hall to build shared
                  workshops and defenses. Personally work beside sites to
                  complete them.
                </p>
                <p>
                  Craft and equip two distinct weapon categories. Own one horse
                  or catapult. Towers defend automatically; bear traps catch
                  enemies. Carry 10 food to restore health.
                </p>
                <p>
                  Easy gives 3 lives; Medium 2; Hard 1. Easy and Medium have
                  unlimited ammunition. Destroying the town hall ends the
                  faction, regardless of remaining lives.
                </p>
                <p>
                  Desktop: WASD move, mouse look, left-click attack. Hold the
                  right button to aim a bow/crossbow, then left-click to fire.
                  Click again after reloading. With a sword or spear, hold
                  right-click to guard your front. Space jump, Shift sprint, E
                  use, B build, C craft, F eat, G mount, 1/2 switch weapon,
                  Escape menu.
                </p>
                <p>
                  Touch: left joystick moves, drag the scene to look, right
                  buttons attack/aim/jump/use. Hold Aim and tap Attack to shoot.
                  Nearby damaged buildings offer Repair; deposit wood first.
                  Landscape gives you more room.
                </p>
              </>
            )}
            {panel === "lan" && (
              <>
                <Wifi size={30} />
                <h2>Gather around one hearth.</h2>
                <p>
                  One computer runs <b>Host Hearthguard LAN.cmd</b>. Everyone on
                  the same Wi-Fi opens its printed address, such as
                  http://192.168.1.20:5190.
                </p>
                <p>
                  The host opens that LAN address too, creates a room, shares
                  its code, and starts when friends are ready. Installed LAN
                  play needs no Internet.
                </p>
                {lanUrls.length > 0 && (
                  <div className="lan-addresses">
                    <p>
                      Addresses on this host — choose the adapter connected to
                      your friends’ Wi-Fi:
                    </p>
                    {lanUrls.map((url) => (
                      <a key={url} href={url}>
                        {url}
                      </a>
                    ))}
                  </div>
                )}
                <label>
                  Host server address
                  <input
                    aria-label="Host server address"
                    placeholder="http://192.168.1.20:5190"
                    value={lanAddress}
                    onChange={(e) => setLanAddress(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  onClick={() => {
                    try {
                      const url = new URL(lanAddress);
                      if (
                        !["http:", "https:"].includes(url.protocol) ||
                        url.username ||
                        url.password
                      )
                        throw new Error();
                      location.href = url.origin;
                    } catch {
                      notify("Enter a valid http:// or https:// host address.");
                    }
                  }}
                >
                  Connect to local server
                  <ArrowRight size={17} />
                </button>
                <small>
                  Guest Wi-Fi isolation or host firewalls can block connections.
                  Use the host’s reachable local address, not localhost.
                </small>
              </>
            )}
            {panel === "online" && (
              <Lobby
                room={room}
                clientId={clientId}
                connection={connection}
                name={name}
                setName={setName}
                onlineMode={onlineMode}
                setOnlineMode={setOnlineMode}
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                seedValue={hash()}
                send={send}
                joinCode={joinCode}
                setJoinCode={setJoinCode}
                count={count}
                setCount={setCount}
                notify={notify}
                onLeave={() => network.current?.leave()}
              />
            )}
          </section>
        </div>
      )}
      {spectating && view?.result && (
        <div className="death-card">
          <h2>
            {view.result.winnerFactionId === p?.faction
              ? "Your team endures."
              : "The round has ended."}
          </h2>
          <button className="primary" onClick={exit}>
            Return to main menu
          </button>
        </div>
      )}
      {spectating && !view?.result && (
        <div className="spectator">
          Watching your surviving teammates{" "}
          <button onClick={exit}>Leave round</button>
        </div>
      )}
      {screen === "game" && !landscape && (
        <div className="portrait-prompt">
          <button
            aria-label="Dismiss landscape suggestion"
            onClick={() => setLandscape(true)}
          >
            ×
          </button>
          Turn your phone sideways for room to move and aim.
        </div>
      )}
      {(loading || !assetsReady) && (
        <div className="loading-realm" role="status">
          {assetError ||
            (assetsReady
              ? "Preparing your realm…"
              : "Loading medieval characters and scenery…")}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
