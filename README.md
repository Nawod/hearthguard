# Hearthguard

An independent third-person medieval browser game. You personally gather, build, farm, craft and fight. There are no hired workers or armies. Graphics and synthesized sounds are bundled locally. Detailed medieval characters use skinned humanoid rigs with blended animation; buildings, animals and scenery use textured game-ready meshes. Imported CC0 art and source credits are listed in [THIRD_PARTY_ASSETS](THIRD_PARTY_ASSETS.md).

Movement uses interpolated match snapshots, with immediate mouse turning and backward/strafe/riding animation. Melee respects terrain and building surfaces; wildlife avoids solid obstacles, and repairs charge for the health actually restored. See the [polish verification](docs/verification.md#gameplay-physics-animation-and-performance-polish) for measured performance and testing limits.

## Play on this computer

Install Node.js 24 or newer, then double-click **Play Hearthguard.cmd**. It installs dependencies and builds on first use, opens `http://localhost:5190`, and runs the local server. Leave its window open; press **Ctrl+C** to save active online rounds and stop it. Later installed/built sessions work without Internet access.

From a terminal in this folder:

```powershell
npm ci
npm run build
npm start
```

Choose **Play against the computer** for one human against one computer character, or **Play with friends** for private rooms and public matchmaking. Private rooms do not require a capacity choice. Invite friends, choose the round settings, mark everyone Ready, and let the host press **Start round**. The actual joined count may be 2–8.

## Local Wi-Fi

1. One computer runs **Host Hearthguard LAN.cmd**. The server listens on all network adapters, port **5190**.
2. On that computer and the other devices, open one of the printed **Local Wi-Fi** addresses. Choose the adapter connected to your friends' network. `localhost` only points to the device currently using it.
3. Create a private room, share its code or invitation, and start when everyone is ready. The browser's **Local Wi-Fi** panel also accepts a host address and lists this host's adapter URLs.
4. If joining fails, check that Node.js is allowed on the host's **private** network and that the router is not isolating guest devices. No port forwarding or cloud service is required.

A phone's browser joins the computer's server; it does not run a Node host. The first dependency installation needs Internet, but built LAN sessions have no CDN, account or external asset requirement. Multiple network adapters are listed because the game cannot know which network your friends use.

## Match rules

| Setting | Lives | Respawns | Ammunition |
|---|---:|---:|---|
| Easy | 3 | 2 | Unlimited |
| Medium | 2 | 1 | Unlimited |
| Hard | 1 | 0 | Finite, crafted |

Free-for-all supports 2–8 humans. Team battles use two nonempty sides with at most four members each; 3v4 is supported. A team shares one town hall, city bank and all workshops. Friendly fire is disabled.

Start empty-handed with full health and a town hall. Gather food, wood, stone and ore yourself, then deposit them at your town hall or storehouse. Backpacks hold 90 resources. Building sites need your work; teammates can help finish them. Farms need planting and manual harvesting. A barracks & armory produces equipment rather than soldiers. Smithies craft armor and crossbows; stables produce horses; siege workshops produce operated catapults. Completed watchtowers shoot enemies automatically.

Equip two distinct weapon categories and own one active horse or catapult. Parked vehicles stay parked until you mount or operate them. A horse accelerates and turns; an operated catapult moves slowly with the usual movement controls and fires siege projectiles. Tools are separate. On Easy and Medium there is no ammunition crafting, inventory or per-shot cost; cooldowns still apply. Hard requires arrows, bolts and siege stones. Food costs 10 carried food and restores up to 25 health over two seconds, with an eight-second cooldown; damage interrupts eating. Bear traps cost five carried wood and five ore and trigger once against enemies.

Death drops carried resources into a recoverable bag and keeps your weapons, tools and ammunition. Your existing vehicle stays in the world. With lives remaining, respawn after five seconds with three seconds of protection, ending on an offensive action. Losing the town hall eliminates the whole faction immediately. Exhausted teammates may watch surviving members. The last surviving faction wins; simultaneous mutual destruction draws.

## Controls

Desktop: **WASD** movement, mouse look after clicking the scene, **left-click** attack, **hold right-click** to aim a bow/crossbow or guard the front with a sword/spear, **Space** jump, **Shift** sprint, **E** use/gather/work, **B** build, **C** craft, **F** eat, **G** mount/dismount, **1/2** weapon slots, **Escape** menu. Buildings have a placement preview; green indicates known available space and materials, red indicates a problem. The simulation rechecks every placement.

Touch: left joystick moves, drag the scene to look, and use the right-side action buttons. Hold **Aim** and tap **Attack** to shoot; release and tap again for the next shot. Landscape is recommended; portrait remains usable. Opening a menu, losing focus or cancelling a touch releases held controls. Automatic visual detail disables shadows on touch devices and integrated Intel graphics, with a reduced 0.85 desktop render scale on the lighter setting; Settings offers manual choices, sound volumes and a test sound.

Ranged combat: hold aim to narrow the camera view and steady the reticle. Bows steady over 1.1 seconds; quick shots have less power and accuracy. Crossbows steady faster (0.45 seconds), fire one bolt per press and show their 1.8-second reload. Moving adds spread. The server traces the camera sight line, then launches from the character with gravity and collision checks; cover still stops shots. A gold hit marker confirms actual damage. Easy/Medium ammunition remains unlimited; Hard still requires crafting.

Approach a damaged friendly building and choose **Repair**. Repairs use deposited city wood, restore 18 health per second and cost one wood per 36 health restored. The game explains when wood is missing; **Stop** cancels gathering, construction or repairs.

## Saves and reconnecting

Offline matches have a manual save and one rolling autosave every 60 **simulation** seconds in IndexedDB. They belong to this browser/device/origin. Loading pauses the game. Hidden tabs pause offline play; online rounds keep running.

Online guests retain a private reconnect credential in session storage. If the browser blocks this storage, the current tab still joins and reconnects using its in-memory credential; a visible message explains that closing/reloading it loses recovery. A disconnected character parks and remains damageable for **120 seconds**, then forfeits. An explicit leave forfeits immediately. Opening the same seat in another tab replaces the previous connection. Do not share reconnect credentials or the `server-data` directory.

The server saves complete active rounds every 60 simulation seconds and on graceful shutdown. Restarting from the same folder restores active rooms and credentials; clients have a new reconnect grace period. Keep the dependency lock and compatible build with these saves. Version/balance mismatches and damaged saves reject clearly. Finished unattended rooms are eventually removed to free capacity.

## Development and verification

```powershell
npm run dev          # Browser development server; multiplayer also needs npm start
npm run check
npm test
npm run test:browser
npm run benchmark
npm run simulate -- --seed 42 --difficulty easy
npm run build
```

Playwright uses installed Chromium; run `npx playwright install chromium` if it is missing. The test server uses port 5198 and server integration tests use 5199. Run browser suites sequentially. Controlled saves in browser tests exercise real game commands; they are test fixtures, not production cheats.

The production browser build is in `dist`; the Node server and match worker are in `dist-server`. Retain both folders, `package.json`, the lockfile and production dependencies. Launch from this project folder. `HOST` and `PORT` are process environment variables; `.env.example` documents them but is not automatically loaded.

For Internet play, host this Node service on a reachable server and proxy HTTP plus `/ws` WebSockets through HTTPS. Public deployment, DNS, TLS certificates and hosting are separate steps and have not been performed. Serving `dist` alone supports local single-player, but multiplayer requires the Node service. The authoritative simulation is shared by browser and server workers; clients predict movement only, never resource spending or damage.

See [approved design](docs/superpowers/specs/2026-10-14-hearthguard-design.md), [implementation plan](docs/superpowers/plans/2026-10-14-hearthguard-implementation.md), [progress ledger](docs/implementation-progress.md) and [verification evidence](docs/verification.md). Hearthguard has no runtime dependency on Ironvale and no automatic commits or pushes.
