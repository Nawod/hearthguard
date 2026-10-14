# Hearthguard — third-person city warfare

Date: 2026-10-14, Asia/Colombo.

Status: the user approved this written specification for implementation planning with "proceed", including local Wi-Fi multiplayer and unlimited Easy/Medium ammunition. No product implementation has started and no commits are authorized.

Project: `N:\Projects\GPT\hearthguard`, an independent application. Ironvale remains a separate project. Hearthguard may adapt its networking, persistence and testing patterns, but must not depend on Ironvale at runtime or modify its source to operate.

## 1. Intended experience

An original medieval third-person browser game combining personal action combat with strategic city construction and defense. Every participant controls one character. Players personally gather, hunt, cultivate, build, craft equipment, place traps, defend their settlement and attack opponents. There are no recruitable workers, soldiers or armies.

Start with an intact town hall, a character at its entrance, full health, empty equipment and zero stored/carried resources. Basic gathering must be possible without a purchased tool, so this start cannot deadlock progression. Better crafted tools speed gathering; nobody receives a hidden starting economy.

Deliver a polished original 3D landscape, readable character animation, believable physical interaction, positional sound and responsive desktop/touch controls. Use consistent stylized medieval art with detailed silhouettes and materials suitable for a close third-person camera; stunning presentation must not rely on claiming photorealism or universal hardware performance.

## 2. Match formats

### Player versus computer

Exactly one human character versus one AI character, with separate cities. Both obey the same resource, equipment, collision, crafting, building, combat and life rules. The AI must gather and construct its own economy before fielding better equipment; it cannot create workers, soldiers or additional heroes.

Easy, Medium and Hard set the life allowance for both participants. They may also adjust AI reaction intervals, aim error and planning quality, without hidden resources, extra lives or knowledge of concealed targets.

### Online multiplayer

- Free-for-all: 2–8 human players, one independent city/town hall per player.
- Team battles: two opposing teams, each containing 1–4 humans, 2–8 humans total. Uneven teams such as 3v4 are valid; neither team may be empty. Two total players form a 1v1 duel.
- Each team shares exactly one town hall, city ownership and resource bank. There is no private extra town hall for each member.
- All teammates can use shared barracks/armories, smithies, workshops, farms, storage and other city buildings. Building access cannot depend on which teammate placed it.
- Friendly fire is disabled for weapons, traps and defensive towers. No alliances exist between separate free-for-all cities or opposing teams.
- No victory timer or alternate army/city-occupation mechanic. Matches end through the elimination rules below.

### Lobby and joining

Support private room codes/invite links and public matchmaking. Use guest names rather than accounts. Private rooms accept the actual joined group up to eight, without asking the creator to preselect a required player count. Public queues match compatible mode, difficulty and requested total player count, then form a lobby.

Every room has a host. The host can choose map seed, match mode and difficulty before the round and assign/reassign team seats within the four-member limits. Public team lobbies initially distribute participants as evenly as possible, but permit valid uneven teams before start. Free-for-all seats remain independent cities.

Each participant must be connected and Ready. Only the host's explicit **Start round** action starts a match. Changing difficulty, seed, mode or team membership clears readiness. Validate all start conditions on the server, including at least two players and both nonempty teams when applicable. No new players join an active round.

If a host leaves a waiting lobby, transfer hosting to the earliest remaining participant. A disconnected active player has a 120-second reconnect window, using a private tab/session credential rather than a public invite token. Their avatar remains in the world and damageable; the match keeps running. After that window or an explicit departure, that seat forfeits. Online disconnects do not spawn replacement AI characters. Forfeiting the last surviving member eliminates its team.

### Local Wi-Fi / LAN multiplayer

Provide a clear **Play on local Wi-Fi** option alongside Internet multiplayer. One desktop/laptop runs the bundled Node server and hosts the shared match; other computers, tablets and phones on the same local network join through their browsers. After dependencies are installed and the local build is available, LAN gameplay needs no Internet connection or cloud service.

Use the same authoritative multiplayer rules, private rooms, ready states, manual host start, difficulty, free-for-all/team limits, shared cities and reconnect behavior. This is local network play, not split-screen. A phone or browser tab is a client; it does not silently become a Node server.

The LAN launcher listens on the local network and prints the host's usable IPv4 address and port, for example `http://192.168.1.20:5190`. Reserve port 5190 as Hearthguard's configurable default, separate from Ironvale's port. The host also opens that LAN address before creating a room so copied invitations use a reachable address rather than `localhost`. Friends open the address, enter/share a room code or invitation, press Ready, and wait for the host's Start round action.

Include in-game hosting/joining instructions and a server-address entry/link for local connection. Use manual address/invite joining; do not promise automatic Wi-Fi device discovery from the browser. Explain connection failures caused by guest-network/client isolation, separate subnets or a host firewall, with the chosen server address visible for correction. LAN setup must not require router port forwarding or public deployment. Physical Wi-Fi compatibility is verified only when tested with actual separate devices, not inferred from multiple local browser contexts.

## 3. Lives, death and victory

Life allowances include the initial life:

| Difficulty | Total lives per player | Maximum respawns |
|---|---:|---:|
| Easy | 3 | 2 |
| Medium | 2 | 1 |
| Hard | 1 | 0 |

On death, decrement remaining lives exactly once. Keep the player's two equipped weapon categories, their ammunition and crafted tool equipment. Drop carried resource stacks into a loot bag at the death location. Loot is recoverable by any living player; capacity limits still apply. Banked city resources are unaffected.

If lives remain and the city is still active, respawn after a five-second countdown at a clear location beside the town hall, with full health. Give three seconds of spawn protection that ends on offensive action, preventing immediate repeated spawn kills without permitting protected attacks. Check town-hall status again when the countdown completes; a hall destroyed during that interval cancels respawn.

The active horse or siege vehicle remains physically where it was left, with its existing health and ownership. Death does not duplicate it or generate a replacement. A destroyed vehicle frees the owner's active vehicle slot.

Zero remaining lives permanently eliminates that character from the round. In free-for-all or single-player, this eliminates its city/faction. In teams, living teammates may continue; the eliminated player receives results and may spectate a living teammate using that team’s permitted view, without revealing hidden opponents or traps, and cannot interact with the economy or combat. A team loses when all its members are permanently eliminated or forfeit.

**Destroying a town hall immediately eliminates its city/team**, even if its characters have lives left. Disable its characters, pending respawns, defensive attacks, production and interactions. The defeated settlement remains as inert ruins for visual continuity. Town halls cannot be rebuilt, relocated or replaced during a round.

The last surviving faction wins. Resolve damage and elimination for an entire simulation step before choosing a winner; simultaneous elimination of all remaining factions produces a draw. Display explicit victory/defeat/draw and the reason for elimination.

## 4. Economy, cultivation and construction

Use shared balance definitions for every harvest yield, capacity, recipe, duration, cost, defense statistic and unlock. Start with food, wood, stone and metal ore as the practical gathering resources. Metal ore supplies weapon/armor crafting; gold is not a mandatory extra economic layer in this release.

Trees, stone deposits, ore and wildlife are finite. Wildlife moves authoritatively and provides food through hunting. Gathering requires proximity and an appropriate timed interaction; gathering, looting, building and crafting cannot happen remotely through a menu. Basic wood/stone gathering works barehanded, while crafted axe/pick tools improve efficiency.

Characters have a bounded backpack measured by total resource/consumable capacity. Carry gathered resources back to a town hall or storehouse and deposit them in the faction bank. Teammates use this bank for city construction and shared crafting. Withdrawals, deposits and recipe reservations are atomic so two teammates cannot spend or duplicate the same resources. Single-player and free-for-all use the same bank rules for their one-member factions.

Provide buildable storehouses, farms, barracks/armories, smithies, crafting/siege workshops, stables, walls, gates and defensive towers. Barracks supply personal military equipment and never recruit autonomous troops. Functional upgrades unlock better recipes and defenses; cosmetic housing is not required to unlock population because there is no recruitable population.

Placement previews show valid/invalid footprints. The authority checks resources, terrain, clearance, map bounds, distance from the builder and collision with existing structures. Pay/reserve cost once when a site is accepted. The site begins incomplete and needs a living nearby player to work on it. Teammates can contribute to the same site; leaving pauses their contribution. Unfinished buildings can be attacked and have no completed-building abilities. Players can return to finish or repair accessible friendly sites.

Walls physically obstruct travel and projectiles. Gates admit teammates under faction control. Reject placements that trap characters inside a collider or block every safe town-hall spawn exit. Farming requires player planting and harvesting; crops grow over simulation time, consume seed/replant costs and do not harvest themselves. Recipes can turn harvested food into consumable meals.

The initial food action consumes 10 food to restore up to 25 health over two seconds, with an eight-second consumption cooldown. Damage interrupts the remaining healing. It cannot grant additional lives, exceed maximum health, or be consumed for free. The healing amount and consumption cooldown live in balance definitions.

## 5. Weapons, vehicles and defenses

Each player carries **two distinct equipped weapon categories** and owns at most **one active vehicle/mount**. Separate tool equipment supports gathering and construction; tools do not grant extra combat weapon slots. Changing loadouts requires an accessible friendly armory/storage interaction, with stored equipment retained there. Recipes cannot silently overwrite or delete an occupied slot.

Include swords, spears, bows and crossbows, with weapon/armor upgrades. Swords support close combat, spears provide reach and mounted counters, and bows/crossbows offer aimed ranged attacks. Use directional aim, range checks, cooldowns and obstacle-aware hit detection. Equipping a different weapon must not reset attack cooldown to permit rapid-fire exploits.

**Ammunition follows the match difficulty:** Easy and Medium have unlimited arrows, bolts and catapult ammunition. Firing in those modes never requires crafting ammunition, having an ammunition stack, consuming backpack capacity for ammunition, or paying a per-shot resource cost. Hard requires crafted, finite ammunition and rejects firing when none remains; valid shots consume ammunition exactly once. Unlimited ammunition does not remove aiming, weapon reload/attack cooldowns, projectile lifetimes or the cost of crafting the weapon/vehicle itself. The authority applies the same difficulty rule to humans and AI in single-player, Internet multiplayer and local Wi-Fi play. Show an infinity indicator on Easy/Medium and the actual ammunition count on Hard.

Provide horses and catapults as distinct vehicle choices. Horses are controlled mounts with speed, turn/acceleration limits, collision and health. Catapults are physical siege equipment that players position, operate and fire under the difficulty-based ammunition rule; they are not objects carried inside a backpack. The horse/catapult slot enforces one active choice per player, including when it is unoccupied. Stable/workshop production checks that slot atomically. No autonomous cavalry or siege crews exist.

Players can craft and place bear traps. Validate proximity, ground placement, collision and inventory cost. Enemy contact triggers damage and a short movement restraint; teammates do not trigger their faction's traps. Traps can be spotted/disarmed at close range and are consumed after triggering. Do not advertise hidden enemy trap coordinates through minimap or snapshot data.

Completed defensive towers automatically acquire visible enemies within range and line of sight, then shoot physical projectiles. Their damage, cooldown, health and construction costs come from shared definitions. Towers do not shoot through walls, attack teammates, or continue after faction elimination. Their fixed defenders are building behavior, not recruited soldiers.

## 6. Camera, physics and presentation

Use a genuine perspective third-person follow camera with yaw/pitch control, shoulder aiming and bounded zoom. Camera collision prevents viewing through buildings and terrain. Characters have grounded movement, gravity, jumps, slope limits, collision sliding and readable facing/attack animations. Physics determines projectile trajectories, impacts and vehicle/character obstruction; melee attacks use controlled hit volumes rather than sending arbitrary damage from the client.

Use TypeScript, Vite and React for menus/HUD, Three.js for rendering, and Rapier 3D for the physics world. Bundle all runtime/art/audio assets locally. Use original reusable medieval models, terrain and animation with close-camera detail. Apply lighting, shadows, terrain materials, atmospheric distance effects, team markings and readable silhouettes. Adapt graphics quality and pixel density to the device, with optional shadow/detail reductions rather than gameplay changes.

Generate seeded traversable land terrain with visual/physical elevation, comparable starting access to materials and reachable opponents. Scale the map for two to eight factions; team games scale around two settlements and the actual character count. Guarantee enough accessible starter wood/stone to begin the crafting/building loop without bonus inventories.

Collision shapes, geometry, materials, textures, audio nodes and physics worlds have explicit ownership and teardown. Avoid per-frame geometry creation. Bound scenery, projectile and loot counts; use terrain chunking, instancing and distance detail where appropriate.

## 7. Desktop and touch controls

Desktop: WASD movement, mouse camera/aim, primary attack, secondary aim/block as supported by the equipped weapon, jump, sprint, interact/gather/build, weapon switch, mount/operate vehicle and inventory/build menus. Show bindings in an accessible help panel. Pointer capture/lock is entered through a clear play interaction and released by Escape/menu; keyboard input never steals focus from lobby text fields.

Touch: left movement joystick; right-side drag area for camera/aim; distinct attack, aim/block, jump, interact and weapon-switch controls; contextual mount/vehicle and eat buttons. Prevent camera gestures from firing attacks or moving the joystick. Keep controls large, respect safe areas, support multi-touch and cancel held actions on blur/pointer cancellation. Construction previews and crafting use touch-friendly panels with explicit confirmation.

Recommend rotating phones to landscape using a dismissible portrait prompt. Portrait remains usable for menus/lobbies and basic play; do not hard-lock orientation or claim browser orientation APIs always work. Desktop, tablet and phone use the same game rules and compatible online rooms.

HUD shows health, remaining lives, two weapon slots, active vehicle, ammunition/food, backpack capacity, city stock, town-hall health and faction/teammate status. Use a compact minimap that only reveals permitted information, build/craft progress, attack warnings and elimination notifications. Include tutorial, settings, sound/music volume, pause/menu, restart/rematch and results.

## 8. Authority and module boundaries

Build a new shared simulation independent of React/DOM. Separate seeded world generation, physics adapter, character input/movement, economy/inventory, construction/crafting, combat/projectiles, mounts/siege, traps/towers, AI, visibility, life/faction lifecycle and persistence.

Offline play runs the same authority in a browser worker. Online matches run isolated authorities on the Node server, using WebSockets for lobby/input/snapshots. Online clients submit input intent and interaction commands, never trusted position, damage, life, resource or ownership values.

Use a fixed gameplay step with physics substeps. Plan for 30 gameplay steps/second, two 60 Hz physics substeps and approximately 15 snapshots/second, with rates configurable for measured performance rather than variable wall-clock gameplay. Keep browser render/camera/UI timing independent. Use local movement prediction with server reconciliation and remote interpolation to avoid third-person controls waiting on a network round trip; the authority remains final for collisions and interactions.

Define versioned, serializable match configuration, faction/player/entity state, input sequences, commands/results, public lobby views, player-visible snapshots, events and saves. Include stable IDs, seeded random state, cooldowns, production reservations, AI plans, input acknowledgement, respawn countdowns and equipment/vehicle ownership. Cap and validate input frequency and payload sizes. Shared-team commands must authorize the actor's current faction, not just possession of a building ID.

Visibility is based on authoritative faction knowledge and line of sight. Teammates share discovered map knowledge. Send visible opponents and permitted remembered static scenery; do not expose hidden live player positions, resources, inventory, inputs, plans or traps. Remove stale remembered moving wildlife when its old location is observably empty.

Physics initialization and snapshot restoration must work in both browser workers and Node workers. Test save continuity under the selected runtime; do not assume cross-platform bit-identical physics solely from seeded world generation. The online authority resolves disagreements.

## 9. Persistence and deployment boundary

Single-player manual saves and one rolling autosave use IndexedDB, retaining the complete simulation and reconstructible physics state. Loading resumes paused. Pause single-player when the tab is hidden; online matches continue while their clients are hidden or disconnected.

Server checkpoints retain online match/faction/player identity, shared economy, equipment, physics state and lifecycle, allowing recovery after a restart. Private reconnect credentials stay out of public room/invite data. Guest identities belong to the browser/session; accounts, cloud inventory and ranked progression are outside this version.

Deliver a locally runnable independent Node/browser project and a deployable production build, README, launcher, tests and verification evidence. Public hosting is a separate action. No commits, pushes, public deployment or changes to Ironvale are part of this authorization.

## 10. Acceptance criteria

1. Complete a playable human-versus-AI match from empty inventories: gather, deposit, plant/harvest, craft/equip, build/repair, heal, defend and defeat the opponent. The AI must perform its own economy and combat under the same rules.
2. Validate Easy/Medium/Hard death budgets, exactly-once death handling, retained weapons, recoverable dropped resources, safe respawns, cancelled respawns after hall destruction, individual team elimination, last-member loss and simultaneous-destruction draws.
3. Verify shared-team spending under concurrent actions, building access, construction contributions, recipe reservations, inventory/loadout limits, one-vehicle ownership, trap authorization, friendly-fire rules, towers and physical obstruction. Verify unlimited ammunition with empty inventories on Easy/Medium and exactly-once ammunition consumption, crafting and empty-ammunition rejection on Hard for bows, crossbows and catapults, including AI.
4. Exercise private and public lobbies, host-only manual start, readiness reset, all free-for-all counts 2–8, valid team counts including 3v4 and 4v4, invalid team overfill, reconnect, host migration before start, forfeiture and match recovery. Verify LAN-address invites, local-network server binding, address/connection guidance and shared Internet/LAN match rules; report actual separate-device Wi-Fi testing separately from local browser emulation.
5. Verify authority rejection of spoofed movement/damage/resources/ownership, duplicate or stale input sequences, distant interactions and concealed targets. Confirm player snapshots do not reveal hidden opponents or traps.
6. Verify collision/slopes/jumps, camera obstruction, melee/ranged hit detection, projectile trajectories, mounted travel, siege operation and the same movement/combat rules in browser and Node authority runtimes.
7. Verify desktop mouse/keyboard and emulated phone/tablet multi-touch, landscape controls, portrait prompts, placement, crafting, equipment, eating and menus. Label emulation accurately; physical-device verification requires actual devices.
8. Verify save/load continuity, random/AI/respawn/crafting/loot/vehicle restoration, hidden-tab behavior, unavailable storage and incompatible saves with clear messages.
9. Pass type checking, simulation/physics/server tests, browser integration tests and production build. Run seeded headless complete matches, including all lobby formats and an eight-player stress case.
10. Measure desktop/mobile-class rendering and server step timing on reported hardware. Target 60 FPS desktop and 30 FPS mobile-class rendering at the supported quality preset with eight active players, their cities, vehicles, traps, projectiles and towers. Report visible scene counts, graphics settings, CPU/GPU and limitations; do not label desktop-emulated mobile results physical-phone performance.

## 11. Delivery sequence for the subsequent plan

First establish the shared physics/character controller, third-person camera and desktop/touch controls. Then implement the empty-start gathering/building/crafting loop; personal combat/food/vehicles/traps/towers; life/faction lifecycle and the single AI opponent; online lobbies/teams/authority/prediction/recovery; finally presentation, persistence, performance and complete-match verification. These are implementation milestones, not permission to omit online mode or stop after a movement demo.

This document is ready for user review. The detailed implementation plan is the next artifact after written-spec approval.

Reference APIs: [Rapier JavaScript setup](https://rapier.rs/docs/user_guides/javascript/getting_started_js/), [Rapier character controller](https://rapier.rs/docs/user_guides/javascript/character_controller/), [Three.js documentation](https://threejs.org/docs/).
