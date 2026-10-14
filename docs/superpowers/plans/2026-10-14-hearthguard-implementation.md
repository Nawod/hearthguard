# Hearthguard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native implementation, or superpowers:subagent-driven-development if the user selects that method. Execute task-by-task; checkbox steps track progress. The user must review this plan and select an execution method before implementation. Do not commit.

**Goal:** Deliver an independent third-person medieval browser game with complete human-versus-AI, Internet and local-Wi-Fi matches, personal crafting/city warfare, and desktop/touch controls.

**Architecture:** One shared authoritative TypeScript simulation owns character physics, resources, combat and faction lifecycle. Browser workers host offline matches; isolated Node workers host online/LAN matches. React manages interfaces; Three.js renders and interpolates views; Rapier handles collisions and movement. Multiplayer prediction is presentation support, never gameplay authority.

**Tech Stack:** Node 24, TypeScript, React, Vite, Three.js, `@dimforge/rapier3d-compat`, `ws`, Vitest, IndexedDB, Playwright. Verify compatible package versions when installing and pin the resulting lockfile.

**Spec:** `docs/superpowers/specs/2026-10-14-hearthguard-design.md`, approved for planning by the user's “proceed,” including LAN and unlimited Easy/Medium ammunition amendments.

## Global constraints

- Work only inside `N:\Projects\GPT\hearthguard`; no runtime dependency on or source changes to Ironvale. No commits, pushes or public deployment.
- Single-player: one human versus one AI character. No recruitable workers, armies, extra heroes or replacement AI in multiplayer.
- Start with one character per participant and exactly one intact town hall per faction, full health, empty equipment and zero resources.
- Free-for-all: 2–8 humans. Teams: two nonempty sides, 1–4 humans each; 3v4 is valid. Each team shares its city, town hall and bank.
- Easy: 3 lives / 2 respawns. Medium: 2 / 1. Hard: 1 / 0. Destroyed town hall eliminates its faction immediately; all members exhausting lives also eliminates it.
- Respawn countdown 5 seconds; spawn protection 3 seconds, ending on offensive action. Keep weapons, ammunition and tools; drop carried resources. Death never duplicates the existing vehicle.
- Easy/Medium arrows, bolts and catapult ammunition are unlimited, require no stack/crafting/carrying capacity and incur no shot cost. Hard uses crafted finite ammunition. Aim/reload cooldowns still apply.
- Maximum two distinct equipped combat weapon categories and one active horse/catapult per player. Tools are separate equipment; barracks craft personal equipment, never troops.
- Friendly fire disabled. Teammates may use all shared city buildings; concealed enemy positions, plans, inventory and traps stay private.
- Host-only manual Start round after readiness; settings/team changes clear Ready. Guest reconnect grace 120 seconds, then forfeiture. Hidden tabs pause offline play only.
- LAN uses one computer-hosted Node server, browser clients and reachable LAN invitations. Default port 5190; no Internet/cloud requirement for installed/built LAN play.
- Bundle assets locally. Support desktop/tablet/phone, landscape recommendation with usable portrait menus/play. Report emulation separately from physical-device verification.
- Save/version/config/protocol types and shared balance tables are authoritative contracts; UI/server may not duplicate costs or life/ammunition rules.

## Review focus

1. A character dies while its hall is destroyed during the same step or respawn countdown: no duplicate loot, life deductions or resurrected defeated factions. Owned by Task 9.
2. Teammates submit simultaneous bank/crafting/vehicle commands: spend once, never overdraw or duplicate equipment/vehicles. Owned by Tasks 4 and 7.
3. Touch cancellation, menu opening and browser blur occur while moving/attacking: all held controls release, without stray attacks or camera/joystick cross-talk. Owned by Task 3.
4. Reordered input, replaced tabs and malicious payloads request movement/damage or hidden collision state: authority rejects spoofing and snapshots/prediction payloads preserve privacy. Owned by Tasks 10 and 12.
5. Browser storage/WASM/network setup fails or host has multiple network adapters: show usable errors/addresses, free partially initialized resources, and avoid false LAN/physics support claims. Owned by Tasks 1, 11 and 13.

## File and interface map

All paths below are relative to Hearthguard. Keep modules focused and put tests beside their owning feature under `tests/`.

- `src/game/types.ts`: `Vec3`, `Difficulty`, `MatchConfig`, `InputFrame`, `Command`, `CommandResult`, `GameState`, `GameRuntime`, `PlayerView`, `GameEvent`, `SaveEnvelope`.
- `src/game/balance.ts`: costs, recipes, movement, carrying capacity, damage, cooldowns, lives, food, farming and vehicle/tower/trap values.
- `src/game/world.ts`: seeded terrain/entities/factions/characters; stable IDs and RNG.
- `src/game/physics.ts`: Rapier initialization, collision/controller/body ownership and physics restoration.
- `src/game/engine.ts`: fixed-step orchestration and shared command boundary.
- `src/game/movement.ts`, `economy.ts`, `construction.ts`, `crafting.ts`, `combat.ts`, `vehicles.ts`, `defenses.ts`, `lifecycle.ts`, `visibility.ts`, `ai.ts`: the named gameplay responsibilities.
- `src/game/save.ts`, `src/platform/storage.ts`: versioned complete saves and IndexedDB slots/errors.
- `src/session/protocol.ts`, `local.ts`, `online.ts`, `prediction.ts`, `src/worker/game.worker.ts`: browser session boundaries, acknowledgements, worker execution and reconciliation.
- `src/render/scene.ts`, `camera.ts`, `models.ts`, `terrain.ts`, `animation.ts`, `effects.ts`: original 3D presentation only.
- `src/input/desktop.ts`, `touch.ts`, `controller.ts`: normalized input intent, bindings and lifecycle.
- `src/ui/App.tsx`, `Setup.tsx`, `Lobby.tsx`, `Hud.tsx`, `CraftingPanel.tsx`, `BuildPanel.tsx`, `TouchControls.tsx`, `Results.tsx`, `Tutorial.tsx`, `Settings.tsx`, `styles.css`: user-facing controls/menus.
- `server/index.ts`, `rooms.ts`, `validation.ts`, `match.ts`, `match.worker.ts`, `checkpoints.ts`, `lan.ts`: HTTP/WebSocket lifecycle, lobby rules, validated actor binding, isolated matches, saves and LAN addresses.
- `scripts/build-server.mjs`, `simulate.ts`, `benchmark.ts`, `test-server.mjs`, LAN/local launcher files and README: build, diagnostics and local delivery.

### Core contracts established in Task 1

- `Difficulty = 'easy' | 'medium' | 'hard'`; `MatchMode = 'single' | 'ffa' | 'teams'`; `Resource = 'food' | 'wood' | 'stone' | 'ore'`.
- `MatchConfig = {mode:MatchMode; difficulty:Difficulty; seed:number; participants:{name:string; controller:'human'|'ai'; team?:0|1}[]}`. Only single-player permits AI participants.
- `Vec3 = {x:number;y:number;z:number}`. World coordinates are meters; terrain supplies physical ground height.
- `InputFrame = {seq:number; move:{x:number;z:number}; yaw:number; pitch:number; jump:boolean; sprint:boolean; attack:boolean; aim:boolean; interact:boolean; weaponSlot:0|1}`. No accepted client position/damage fields.
- `Command` is a discriminated union for deposit/withdraw/loot/build/repair/craft/equip/mount/operate/disarm/eat actions. Commands refer to stable entity/recipe IDs and quantities, not caller-supplied costs or faction ownership.
- `CommandResult = {ok:true} | {ok:false;code:string;message:string}`; actor ID always comes from the trusted session.
- `GameRuntime = {state:GameState; physics:PhysicsPort}`; `PhysicsPort` is defined by Task 1. React/DOM/WebSocket objects never enter `GameState`.
- `createMatch(config:MatchConfig):Promise<GameRuntime>`; `stepGame(runtime:GameRuntime,ticks?:number):void`; `applyInput(runtime,actorId:number,input:InputFrame):CommandResult`; `applyCommand(runtime,actorId:number,command:Command):CommandResult`.
- `createFixture(options?:Partial<MatchConfig>):Promise<GameRuntime>` in `tests/helpers/fixture.ts` supplies a fixed seeded two-participant match; helpers explicitly adjust state for feature tests, never add production cheats.
- Gameplay step is 1/30 second with two 1/60-second physics substeps. Snapshot cadence is 15 Hz. Rendering remains independent.

Tasks extend these contracts explicitly. Keep a ledger at `docs/implementation-progress.md`, recording task outcomes, actual commands/results and design rulings. Every task ends by updating this ledger and leaving changes uncommitted.

## Milestone A — grounded, playable third-person character

### Task 1: Shared world and physics foundation

**Create:** project package/lock/config files, `index.html`, `src/main.tsx`, `src/game/types.ts`, `balance.ts`, `world.ts`, `physics.ts`, `engine.ts`, `tests/helpers/fixture.ts`, `tests/world-physics.test.ts`, `scripts/build-server.mjs`.

**Interfaces:** Produce the core contracts above and `PhysicsPort.step(dt:number):void`, `addCharacter(id:number,position:Vec3):void`, `removeEntity(id:number):void`, `moveCharacter(id:number,desired:Vec3):{position:Vec3;grounded:boolean}`, `raycast(origin:Vec3,direction:Vec3,maxDistance:number):{entityId?:number;point:Vec3}|null`, `serialize():Uint8Array`, `dispose():void`.

- [x] Bootstrap build/test/type-check commands and compatible dependencies, then write `seeded_empty_start_and_physics_collision`: assert empty equipment/banks, one hall/faction, one character/participant, valid FFA 2–8 and teams 3v4, rejected fifth teammate, traversable/comparable resource starts and a character blocked by a wall collider.
- [x] Run `npx vitest run tests/world-physics.test.ts`; observe failing missing/incorrect production behavior.
- [x] Implement deterministic RNG/IDs/config validation and seeded height terrain, safe hall starts, resources/wildlife and a minimal playable ground scene. Async Rapier setup must work in browser and Node workers, and free partial initialization on failure.
- [x] Run the same tests plus `npm run check` and `npm run build`; require zero failures. Test mocked WASM initialization rejection reports an actionable error and leaves no live world/loop.

### Task 2: Character movement, camera and original models

**Create:** `src/game/movement.ts`, `src/render/{scene,camera,models,terrain,animation}.ts`, `tests/movement-camera.test.ts`, `tests/browser/movement.spec.ts`.

**Interfaces:** Consume `GameRuntime`/`PhysicsPort`; produce `updateMovement(runtime:GameRuntime,dt:number):void`, `GameScene.mount(host:HTMLElement):Promise<void>`, `GameScene.update(view:PlayerView):void`, `GameScene.dispose():void`, `FollowCamera.update(target:Vec3,yaw:number,pitch:number,dt:number):void`.

- [x] Write tests `grounded_walk_slide_jump_and_camera_obstruction`: walls block movement; slopes respect limits; jump requires ground; gravity returns the character to ground; normalized diagonal input cannot move faster; camera stays outside buildings.
- [x] Run `npx vitest run tests/movement-camera.test.ts`; require an observed failure before movement implementation.
- [x] Implement controlled capsules, ground/vertical velocity, two physics substeps, perspective follow/shoulder aim and camera shape/ray collision. Add locally generated terrain, character/tools/building silhouettes, rigged pose animation and renderer cleanup. Keep input yaw independent of camera obstruction.
- [x] Pass the unit tests and `npx playwright test tests/browser/movement.spec.ts --project=desktop`; verify actual movement/jump/collision, camera aiming and mount/unmount cleanup, not only a static canvas.

### Task 3: Desktop and multi-touch controls

**Create:** `src/input/{controller,desktop,touch}.ts`, `src/ui/TouchControls.tsx`, `tests/input.test.ts`, `tests/browser/touch-controls.spec.ts`.

**Interfaces:** Produce `InputController.sample():InputFrame`, `releaseAll():void`, `dispose():void`, `TouchController.pointerDown/Move/Up/Cancel(event:PointerEvent):void`; bind controls to input intent and later commands through callbacks.

- [x] Write `held_controls_release_on_blur_cancel_and_menu`: joystick release becomes zero movement; attack does not stick after cancellation; camera finger never becomes attack/joystick; lobby inputs ignore gameplay keys; a dismissible portrait prompt does not block menus.
- [x] Run `npx vitest run tests/input.test.ts`; observe failures before implementation.
- [x] Implement WASD/mouse, play-triggered pointer lock with Escape release, jump/sprint/interact, weapon selection and touch movement/look/action overlays with safe-area spacing. React menus call `releaseAll()` when opening. Preserve touch pointer ownership until cancellation/release.
- [x] Pass input tests and `npx playwright test tests/browser/touch-controls.spec.ts`; use desktop, phone portrait/landscape and tablet emulation, verify multi-finger movement plus aiming/attack and no accidental commands.

## Milestone B — empty-start economy and personal warfare

### Task 4: Gathering, backpack and shared city bank

**Create:** `src/game/economy.ts`, `tests/economy.test.ts`.

**Interfaces:** Produce `updateEconomy(runtime:GameRuntime,dt:number):void`, `transferResources(runtime,actorId:number,storeId:number,direction:'deposit'|'withdraw',amounts:Partial<Record<Resource,number>>):CommandResult`, `loot(runtime,actorId:number,bagId:number):CommandResult`.

- [x] Write `barehanded_start_bank_conservation_and_team_access`: zero-resource player gathers starter wood/stone without a tool; finite nodes deplete without negative amounts; backpack cap stops harvesting; deposit/withdraw conserve totals; teammates share access; enemies/distant actors are rejected; concurrent withdrawals cannot overdraw.
- [x] Observe failures with `npx vitest run tests/economy.test.ts`.
- [x] Implement proximity/timed harvest actions, improved axe/pick efficiency, deterministic roaming/huntable wildlife and bounded loot/backpack transfers. Reserve bank changes synchronously at the authority command boundary.
- [x] Pass economy tests, including wildlife save-independent RNG repeatability and hunters collecting moving targets without ghost/resource duplication.

### Task 5: Construction, repair, farms and functional city progression

**Create:** `src/game/construction.ts`, `src/ui/{BuildPanel,Hud}.tsx`, `tests/construction-farming.test.ts`, `tests/browser/city.spec.ts`.

**Interfaces:** Produce `placeBuilding(runtime,actorId:number,type:string,position:Vec3,yaw:number):CommandResult`, `updateConstruction(runtime,dt:number):void`; extend `Command` with validated build/work/repair/plant/harvest actions.

- [x] Write `paid_sites_shared_work_and_safe_spawns`: one-time payment, near-builder valid footprints, rejected overlaps/distant placement, multiplayer construction contributions, incomplete towers inactive, repair costs, no blocked final hall spawn exit, farm growth/harvest/replant costs and no automatic harvest.
- [x] Observe failure with `npx vitest run tests/construction-farming.test.ts`.
- [x] Implement storehouse/farm/armory/smithy/workshop/stable/wall/gate/tower definitions and physical colliders, progression recipe prerequisites, construction/repair interactions and agriculture. Reject duplicate town halls and character-trapping placements; own-team gate admission is authoritative.
- [x] Pass unit tests and `npx playwright test tests/browser/city.spec.ts`; personally gather/deposit, place/work on a site, leave/return to finish, plant/harvest and use building previews on desktop/touch.

### Task 6: Crafting, two-category loadouts and difficulty ammunition

**Create:** `src/game/crafting.ts`, `src/ui/CraftingPanel.tsx`, `tests/crafting-ammunition.test.ts`.

**Interfaces:** Produce `reserveRecipe(runtime,actorId:number,stationId:number,recipeId:string):CommandResult`, `updateCrafting(runtime,dt:number):void`, `equipWeapon(runtime,actorId:number,stationId:number,itemId:number,slot:0|1):CommandResult`, `consumeAmmo(runtime,actorId:number,kind:'arrow'|'bolt'|'catapult'):CommandResult`.

- [x] Write tests: `two_distinct_weapon_categories_and_shared_station`; `concurrent_recipe_reservations_spend_once`; `easy_medium_empty_inventory_shots_are_unlimited`; `hard_shot_consumes_once_and_empty_rejects`. Assert craft/equip prerequisites, nearby teammate station use, no silently deleted loadouts and infinity HUD values on Easy/Medium.
- [x] Observe failures with `npx vitest run tests/crafting-ammunition.test.ts`.
- [x] Implement weapons/tools/armor recipes, timed production, shared stored equipment, atomic costs and two-category slot enforcement. On Easy/Medium, ammo bypasses crafting/stack/capacity/shot cost; Hard requires finite crafted ammo. All modes retain cooldowns and weapon/vehicle costs.
- [x] Pass crafting/ammunition tests; serialize reservations/equipment as ordinary state and verify weapon switching cannot reset an existing cooldown.

### Task 7: Horses and operated catapults

**Create:** `src/game/vehicles.ts`, `tests/vehicles.test.ts`, vehicle models/controllers in `src/render/models.ts` and `src/ui/Hud.tsx`.

**Interfaces:** Produce `createVehicle(runtime,actorId:number,stationId:number,kind:'horse'|'catapult'):CommandResult`, `enterVehicle(runtime,actorId:number,vehicleId:number):CommandResult`, `leaveVehicle(runtime,actorId:number):CommandResult`, `updateVehicles(runtime,dt:number):void`.

- [x] Write `one_vehicle_slot_shared_workshops_and_physical_operation`: concurrent requests produce one active vehicle; enemy/distant entry rejected; occupied-seat conflicts rejected; horse movement collides and respects turn/speed limits; catapult remains a world object; destruction frees the slot; dismount requires clear ground.
- [x] Observe failures with `npx vitest run tests/vehicles.test.ts`.
- [x] Implement owned vehicle creation, mount/operator bindings, controlled horse acceleration/slope movement, catapult placement/operation, colliders and slot accounting. Feed catapult shots through Task 6's ammunition contract, never a separate ammo rule.
- [x] Pass vehicle tests including Easy/Medium zero-ammo siege fire versus Hard rejection, and two teammate station requests that cannot duplicate a personal active slot.

### Task 8: Combat, healing, traps and automatic towers

**Create:** `src/game/{combat,defenses}.ts`, `src/render/effects.ts`, `tests/combat-defenses.test.ts`.

**Interfaces:** Produce `updateCombat(runtime,dt:number):void`, `updateDefenses(runtime,dt:number):void`, `queueDamage(runtime,targetId:number,amount:number,sourceId:number):void`, `eat(runtime,actorId:number):CommandResult`; damage is an authority-produced event queue resolved by Task 9.

- [x] Write `melee_projectiles_and_friendly_fire`, `tower_line_of_sight_and_trap_trigger`, `food_cost_healing_interrupt`: enemies take hits only in legal ranges; walls block arrows/bolts/siege and tower sight; friendlies take no damage; placed traps affect enemies once and can be disarmed nearby; 10 food grants up to 25 HP over 2 seconds with 8-second cooldown; damage cancels remaining healing.
- [x] Observe failures with `npx vitest run tests/combat-defenses.test.ts`.
- [x] Implement aimed attacks/hit volumes, fixed-step physical projectiles, weapon counters/cooldowns, siege building damage, single-use bear traps, completed-tower acquisition/projectiles and food. Reuse ammo, faction ownership and physical queries; cap projectile lifetimes/counts without deleting valid damage silently.
- [x] Pass tests including melee/ranged AI same-rule fixtures, full-health food rejection and eliminated/unfinished towers not firing. Show actionable feedback for out-of-range, empty Hard ammo and invalid targets.

### Task 9: Lives, dropped resources, faction elimination and results

**Create:** `src/game/lifecycle.ts`, `src/ui/Results.tsx`, `tests/lifecycle.test.ts`.

**Interfaces:** Produce `resolveLifecycle(runtime:GameRuntime,dt:number):void`, `forfeitPlayer(runtime,playerId:number):void`; extend state with remaining lives, death nonce, respawn/protection deadlines, eliminated faction state and `result:{winnerFactionId:number|null;draw:boolean}|null`.

- [x] Write `difficulty_lives_exactly_once_death_and_hall_loss`: assert lives 3/2/1, at most 2/1/0 respawns, one deduction/loot bag per death, retained weapons/ammo/tools, resource-only drops, full-health safe spawn after 5 seconds, 3-second offensive-cancelled protection, no duplicated vehicle and no respawn after hall loss.
- [x] Add `same_step_double_hall_destruction_is_draw` and `eliminated_teammate_spectates_only_permitted_team_view`: living teammates continue; last-member exhaustion/forfeit eliminates the faction; hall loss disables production/towers/characters in the same step.
- [x] Observe failures with `npx vitest run tests/lifecycle.test.ts`.
- [x] Resolve accumulated damage for the entire step before choosing winners. Implement death/loot/counters, respawn checks, permanent elimination, inert city ruins and explicit results; restrict spectator interactions and information.
- [x] Pass all lifecycle tests, including hall destruction halfway through a respawn countdown and duplicate damage/input events against an already dead actor.

### Task 10: Visibility and a complete single AI opponent

**Create:** `src/game/{visibility,ai}.ts`, `scripts/simulate.ts`, `tests/visibility-ai.test.ts`.

**Interfaces:** Produce `makeView(state:GameState,viewerId:number):PlayerView`, `updateVisibility(runtime):void`, `updateAI(runtime,dt:number):void`. `PlayerView` carries permitted transforms/events, shared faction stock and the viewer's inventory/input ack; no full private state. AI submits the same input/command contracts as a human.

- [x] Write `shared_team_vision_no_hidden_inventory_or_traps`, `old_visible_deer_location_forgets_ghost`, `ai_completes_empty_start_economy_and_attacks_without_cheats`. Assert enemy inventory/plans/reservations and hidden live collision positions stay excluded; spectators receive only team knowledge.
- [x] Observe failures with `npx vitest run tests/visibility-ai.test.ts`.
- [x] Implement line-of-sight/faction exploration, remembered static entities and visible-empty wildlife correction. Implement one AI character's gathering/deposit/build/craft/eat/defend/attack plans with difficulty reaction/aim quality and recorded RNG/plan state. Never move two characters or spawn helpers for its faction.
- [x] Pass tests and `npm run simulate -- --seed 42 --difficulty easy`; report a completed rules-valid match. Repeat Medium/Hard seeds and assert the bot progresses, defends and can win/lose under the same life/ammo rules.

## Milestone C — complete Internet and local-network multiplayer

### Task 11: Worker sessions and complete persistence

**Create:** `src/worker/game.worker.ts`, `src/session/{protocol,local}.ts`, `src/game/save.ts`, `src/platform/storage.ts`, `tests/save-session.test.ts`.

**Interfaces:** Produce `encodeSave(runtime:GameRuntime):SaveEnvelope`, `restoreSave(save:SaveEnvelope):Promise<GameRuntime>`, `writeSave(slot:'manual'|'auto',save:SaveEnvelope):Promise<void>`, `readSave(slot):Promise<SaveEnvelope|null>`, `GameSession.submitInput(input):void`, `sendCommand(command):void`, `onView(view):void`, `dispose():void`.

- [x] Write `complete_state_restore_and_storage_failures`: retain physics bodies/handles, characters, RNG/AI, ammunition, life/respawn/protection deadlines, crops/sites, reservations, loot, vehicles, traps/towers and explored knowledge; malformed/incompatible saves reject clearly; loading pauses and unavailable storage reports an error without crashing.
- [x] Observe failures with `npx vitest run tests/save-session.test.ts`.
- [x] Implement version-1 envelopes with balance/schema compatibility marker, typed state validation, reconstructible Rapier snapshots/controllers and IndexedDB manual/rolling 60-simulation-second autosave. Offline worker controls start/pause/load/save and fixed-step views. Release held input on pause/hide and resume only deliberately.
- [x] Pass tests with uninterrupted versus saved/restored runs in the same runtime, plus browser worker save/load tests; async failure frees the old/new physics worlds and renderer/session resources.

### Task 12: Server rooms, authoritative matches and client prediction

**Create:** `server/{index,rooms,validation,match,match.worker,checkpoints}.ts`, `src/session/{online,prediction}.ts`, `src/ui/Lobby.tsx`, `tests/{rooms,server,prediction}.test.ts`, `tests/browser/multiplayer.spec.ts`, `scripts/test-server.mjs`.

**Interfaces:** Produce `startServer(options:{port?:number;host?:string;dataDir?:string|false}):Promise<{close():Promise<void>}>`, `RoomManager.handle(clientId:string,message:ClientMessage):void`, `validateMessage(value:unknown):ClientMessage`, `Prediction.accept(view:PlayerView):void`, `Prediction.record(input:InputFrame):void`. Protocol version 1 includes lobby settings, team seats/readiness, start/resume, inputs/commands/acks and player views; server binds actor/faction from the credential.

- [x] Write `host_manual_start_counts_team_caps_and_readiness_reset`, `reconnect_replaced_tab_forfeit_and_checkpoint_recovery`, `malicious_input_and_concurrent_team_spend`, `prediction_replays_unacknowledged_inputs_without_double_actions`: all FFA 2–8, 3v4/4v4 and 1v1 valid; fifth teammate/empty side/unready/nonhost starts fail; guest credential stays out of public room data.
- [x] Observe failures with `npx vitest run tests/rooms.test.ts tests/server.test.ts tests/prediction.test.ts`.
- [x] Implement private/public-compatible matchmaking-to-lobbies, host migration before start, isolated match workers, 15 Hz viewer snapshots, bounded inputs/messages and actor-bound commands. Reject duplicate/stale sequences and caller position/damage/faction fields. Predict local movement against permitted scenery, reconcile acknowledged inputs, interpolate remote players; replay must never spend resources, consume ammunition or trigger damage twice.
- [x] Implement 120-second reconnect/forfeit and atomic server checkpoints every 60 simulation seconds plus graceful shutdown; restored active rooms accept their credentials and retain lifecycle/physics state. Hidden-tab online play keeps running.
- [x] Pass server/prediction tests and `npx playwright test tests/browser/multiplayer.spec.ts`; two browser seats gather/build/fight in a shared team, opposing teams damage each other, eight contexts share a round, reconnect and difficulty changes work. Simulate input delay/jitter without changing authoritative movement speeds.

### Task 13: Local Wi-Fi mode, launchers and hosting instructions

**Create:** `server/lan.ts`, LAN panel in `src/ui/Setup.tsx`, `Play Hearthguard.cmd`, `Host Hearthguard LAN.cmd`, `.env.example`, `README.md`, `tests/lan.test.ts`, `tests/browser/lan.spec.ts`.

**Interfaces:** Produce `getLanAddresses(port:number):string[]`, `inviteURL(serverBase:string,roomCode:string):string`; LAN configuration uses default `HOST=0.0.0.0`, `PORT=5190` and the same server/room authority. Browser address joining is explicit navigation to a validated HTTP(S) server base.

- [x] Write `lan_invites_use_reachable_host_and_multiple_adapter_guidance`: invitations preserve the chosen LAN origin, reject unsupported URL schemes, exclude invite credentials, list usable non-loopback IPv4 addresses and label loopback-only/multiple-adapter cases clearly.
- [x] Observe failures with `npx vitest run tests/lan.test.ts`.
- [x] Implement **Play on local Wi-Fi**, computer-host versus browser-client guidance, address input, LAN server launch/display and room invite links. No cloud/CDN fetches, port forwarding or browser-only Node hosting; explain guest-network isolation/firewall failure with a visible corrective address. Preserve manual host start and lobby difficulty settings.
- [x] Pass LAN tests and `npx playwright test tests/browser/lan.spec.ts`; launch a network-bound server and join actual independent browser contexts through its LAN address when environment access permits. Record physical Wi-Fi testing only if separate devices are available; otherwise explicitly leave it unverified rather than blocking local-source delivery.

## Milestone D — presentation, complete rounds and delivery

### Task 14: Finished interface, animation, feedback and audio

**Create/complete:** `src/ui/{App,Setup,Hud,Tutorial,Settings,Results}.tsx`, `src/ui/styles.css`, `src/platform/audio.ts`, `src/render/{models,terrain,animation,effects}.ts`, `tests/browser/full-round.spec.ts`.

**Interfaces:** App owns `GameSession`, `InputController` and `GameScene` lifecycle; UI calls their established contracts. Produce `Soundscape.unlock():Promise<void>`, `play(event:GameEvent):void`, `setVolumes(music:number,effects:number):void`, `dispose():void`; no game rule decisions in UI/audio/render modules.

- [x] Write browser checks `empty_start_tutorial_craft_two_weapons_eat_and_win`, `infinity_ammo_lives_hall_health_and_results`, `touch_city_and_vehicle_controls`, `first_interaction_audio_signal`. Test real commands/resources, not an attractive menu with simulated backend behavior.
- [x] Observe the unimplemented flows failing with `npx playwright test tests/browser/full-round.spec.ts` before completing their UI wiring.
- [x] Finish original close-camera medieval art/rigging/materials, movement/harvest/build/attack/death/projectile animations, damaged sites/ruins, readable team colors and attack/production alerts. Build recipe/inventory/city/vehicle HUD, minimap privacy, tutorial, pause/settings and guest round/rematch flows. Unlock locally synthesized/bundled sound on first interaction and provide volume/test sound.
- [x] Pass the browser checks on desktop/phone/tablet; inspect screenshots and animated combat sequences for clipping, unreadable controls, menu overlap and dropped visual feedback. Use audio analyser evidence and distinguish it from physical speaker audition.

### Task 15: Performance, authority stress and verification evidence

**Create:** `scripts/benchmark.ts`, `tests/stress.test.ts`, `tests/browser/performance.spec.ts`, `docs/verification.md`; optimize focused render/physics/network modules only where profiles justify it.

**Interfaces:** Benchmarks consume the same `GameRuntime`/`GameSession`/`GameScene`; controlled fixtures provide eight characters, eight active vehicles, populated cities, towers, traps and projectiles. Record world and visible counts, graphics preset and snapshot/physics rates.

- [x] Write assertions for bounded world/projectile/loot memory, no duplicate damage/resource transactions under simultaneous clients, and renderer/session disposal after repeated match changes. Set declared FPS thresholds at >55 desktop / >30 CPU-throttled phone emulation, treating these as proxies for the 60/30 targets.
- [x] Run `npx vitest run tests/stress.test.ts` and `npx playwright test tests/browser/performance.spec.ts`; profile failures before changing quality or timing. Report authority mean/p95/max step time against its 33.33 ms gameplay budget.
- [x] Optimize measured bottlenecks through shared materials/instancing, cached static transforms, terrain/scenery culling, bounded shadows and quality presets. Gameplay rules, eight-player counts, input speeds and physical obstruction cannot be reduced to make tests pass.
- [x] Run all declared commands: `npm run check`, `npm test`, `npm run test:browser`, `npm run build`, seeded single-player/FFA/team diagnostics. Require passing checks and retain measured JSON/screenshots/logs. Record exact hardware, emulation, browsers, LAN-access and physical-device limits.

### Task 16: Final review and independent local delivery

**Complete:** `README.md`, `docs/verification.md`, `docs/implementation-progress.md`, launcher/build output and this checklist.

- [x] Request a fresh read-only whole-project review under Superpowers requesting-code-review; keep it separate from implementation and give spec/plan/test evidence. Fix concrete Critical/Important findings with regression tests and rerun affected checks; record minor limitations.
- [x] On final production assets, complete an actual human-versus-AI match and private multiplayer round; exercise FFA, 3v4 teams, each difficulty/life/ammo rule, local-address invitations, food, traps, tower defense, horse/catapult and town-hall/last-life losses. Label exploratory automation accurately rather than calling it physical-device play.
- [x] Provide runnable source, deployable browser/server builds, compatible dependency lock, Windows local/LAN launchers, default URL/port and complete run/hosting instructions. Start a local server only for final verification/preview; state its running status and how to stop it. Public Internet hosting remains a separate action.
- [x] Verify no commits/pushes were made, no files in Ironvale changed, no runtime imports point outside Hearthguard, and the spec's acceptance list is met or any environment-dependent physical verification is explicitly reported. Update every completed checkbox and give a concise outcome/validation/limitations report.

## Execution decision

Recommended method: **Native / inline execution**, followed by one fresh whole-project review. These tasks share tightly coupled physics/state/session contracts; keeping one implementation context reduces repeated reading and interface drift. The user may instead choose task-by-task subagents with independent review gates. Neither method changes scope or authorizes commits.

Plan self-review checklist: all eleven spec sections and LAN/ammunition amendments map to tasks; core signatures are consistent; the five Review Focus cases have owning tests; every task has an observed-failure and passing-verification step; no product code or dependencies were created during planning. Implementation waits for plan review and the selected execution method.

## Delivery record — 2026-10-14

Implementation delivered in the independent Hearthguard directory, without commits or changes to Ironvale. Test names and file splits were consolidated into the actual suites listed in `docs/verification.md`; the organizational filename ruling is in the progress ledger. Completed checks cover the same shared gameplay/physics and worker/server contracts. The final fresh review's Important findings received one regression-tested fix pass. No further reviewers were dispatched.

Verification is browser automation and Chromium device emulation. The unmodified Hard human-versus-AI browser round ends in defeat; controlled saves separately exercise winning combat, personal farming/crafting and resumed online team collaboration. Eight real browser seats finish a host-started round through explicit forfeits. Seeded FFA/team diagnostics are labeled as input/forfeit diagnostics. These checks do not claim manual human play, a full unmodified human-victory journey, physical phones/Safari, speaker audition, separate-device Wi-Fi or Internet deployment. Review minors and these verification limits are retained in the delivery evidence rather than hidden by the completed implementation checklist.
