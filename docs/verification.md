# Hearthguard verification

Verification date: 2026-10-14. This is a locally built Node/browser game, not a publicly deployed service. No commits or pushes were made. All implementation is confined to Hearthguard.

## Tested environment

- Windows, Node 24.16.0; Intel Core i5-12450H, 12 logical cores, 16 GB RAM.
- Chromium through Playwright; ANGLE Intel UHD Graphics, Direct3D11.
- Desktop 1440×900; iPhone 13 and iPad Mini emulation. Phone rendering also measured at four-times CPU throttling. Device emulation shares the desktop GPU and is not physical-phone performance.
- Local-network joins use independent browser contexts over the host's actual non-loopback IPv4 origin. No separate physical Wi-Fi clients were available.

## Evidence collected

The complete simulation/server/storage suite passes **67 tests in 22 files**. Type checking and production browser/server builds pass; the dependency audit reports **zero vulnerabilities**. The complete browser baseline passed **34 tests with five intentional skips** (7.4 minutes). After the final camera-pointer and siege HUD adjustments, the focused desktop/phone/tablet control and vehicle suite passed **11 tests with one intentional skip**. These are distinct runs, not an added total of unique tests.

Tests exercise empty starts, deterministic world generation, real Rapier obstruction, normalized walking/jumping, gates, line of sight, private snapshots, resource conservation, manual gathering and farms, atomic shared crafting, weapon exchange, ammunition by difficulty, mounted acceleration, operated catapults, food/healing interruption, towers/traps, exactly-once deaths, hall loss during respawn, ownership, draw results, save continuity/errors, lobby admission and host rules, eight-seat recovery and movement prediction.

Browser journeys use real UI commands. Controlled saved fixtures shorten specific construction/crafting/combat cases while retaining the production simulation and renderer. A separate **unmodified empty-start PvC** round uses browser movement/combat input automation and completes with a real result; read-only manual saves provide route observations. This is exploratory browser automation, not manual human play. The inspected Hard round ended in human defeat. Seeded Easy, Medium and Hard diagnostics separately verify the AI gathers, builds farms/armories/towers/smithies, equips weapons/tools/armor and wins against an idle human diagnostic seat without gifted resources.

An additional actual online authority integration resumes a controlled three-human checkpoint: two independent teammate browsers harvest a finite 30-wood node, share deposits, finish one farm and damage an enemy while the ally stays at full health. The fixture includes a previously started farm and one sword; it is not an unmodified online start. Its focused run passes.

Eight independent desktop browser seats join one host-started 4v4 Medium round, receive their two-life settings, and receive the host's team victory after the other seats explicitly forfeit. Two-seat room/start/reconnect journeys run in all three emulations. Public matchmaking has a separate passing browser journey on desktop, phone and tablet: two queued strangers enter a lobby, readiness is required, and only its host manually starts the Hard round. Three cases pass. Room tests cover every FFA count 2–8, uneven 3v4, team caps, readiness resets and host migration. Server tests cover spoof rejection, replaced tabs, private credential recovery and graceful checkpoints.

Phone/tablet journeys cover touch movement, cancellation, build/work, crafting/equipment, eating, attack, menus and saves. Phone landscape controls are checked by viewport rotation. A Web Audio analyser confirms a running context and nonzero generated signal after a user gesture; physical speaker audition is not claimed.

## Performance

Authority scenario: eight characters, four mounted horses, four operated catapults, eight traps, 498 total entities, 80 initial projectiles and populated cities. Gameplay is 30 Hz, physics 60 Hz and snapshots 15 Hz. Initial implementation capture: mean step **7.16 ms**, p95 **16.54 ms**, maximum **32.80 ms**, against a 33.33 ms gameplay budget. This capture stayed within the budget; earlier captures included maximum spikes above it, so it is not a worst-case guarantee. A steady permitted snapshot was approximately 26.9 KB after one-time map transmission and exploration deltas.

Render scenario after the detailed rigged-model upgrade: eight travelers, eight vehicles and 48 additional buildings. The earlier model-upgrade automatic-quality capture measured **57.14 FPS desktop**, **34.66 FPS with four-times CPU-throttled phone emulation**, and **59.95 FPS tablet emulation**. These superseded the original block-model measurements; the newer polish capture is recorded below. The desktop threshold is >55 FPS, with 60 FPS as the target; touch emulation uses >30 FPS. Automatic touch detail disables shadows at render scale 1. Integrated Intel automatic detail disables shadows and uses desktop render scale 0.85; detailed mode is manually selectable. Device emulation shares the Intel UHD GPU. These captures establish a local proxy result, not physical-device frame rates or worst-case guarantees. Initial texture/shader loading is excluded by an eight-second warm-up. Earlier captures failed performance thresholds; rock simplification, shared skeleton palettes, camera culling, static transforms and local map-delta transport corrected the measured bottlenecks.

Machine-readable reports are under [evidence](evidence/), including authority timing, device render measurements, LAN origins, seeded matches and the unmodified PvC round. Browser screenshots and traces are produced under `test-results`; that folder is replaced by subsequent Playwright runs.

## Delivery and boundaries

- Browser build: `dist`; combined HTTP/WebSocket service and isolated match worker: `dist-server`.
- Local and Wi-Fi Windows launchers plus full instructions: [README](../README.md).
- Offline manual and 60-simulation-second rolling autosave; online server checkpoints and 120-second reconnect grace.
- Local assets and synthesized sound require no CDN/cloud after installation/build.
- Public matchmaking and private rooms run on the installed server. Public Internet hosting, DNS and TLS have not been deployed.
- Physical phones, separate-device Wi-Fi, Safari/iOS browser execution, physical speaker audition and real Internet latency/load remain unverified. Chromium phone/tablet emulation is clearly distinguished from these.
- The build tool reports large Three.js/Rapier chunks; these are locally bundled engine/WASM payloads. Rapier emits its internal deprecated-initialization warning, although initialization and save continuity pass in both supported runtimes.

One fresh read-only whole-project review found no Critical issues. Seven Important findings and touch pointer ownership (regraded Important) were corrected in one regression-tested pass. The changes cover ownership versus occupancy, physical siege transport/save continuity, safe respawn searches, spectator cameras, blocked session storage, dropped fog deltas and positional sound. A phone-only siege HUD overlap found by the added vehicle journey was reproduced and corrected; desktop/phone/tablet Medium and Hard movement, firing and dismount now pass.

Deferred minor findings: generic elimination reason text; some balance literals remain outside the central definitions; placement preview does not mirror every authority clearance rule. The later polish pass fixed defeated-farm maturation. The full review and rulings are recorded in the progress ledger.

Seeded online diagnostics exercise two/eight-seat FFA and uneven 3v4 teams, normalized/reordered human inputs and explicit forfeits. They are headless rule/transport diagnostics, not natural PvP combat matches. Full unmodified human-victory play and physical-device/user experience evaluation are not claimed; controlled-save victories and the unmodified Hard defeat are separately documented.

## Current local preview

The final build is running at [localhost:5190](http://localhost:5190), also reachable on this host's Wi-Fi address [192.168.0.205:5190](http://192.168.0.205:5190). The release health check reports protocol 1 and no active rooms. This is a local preview, not Internet hosting. Ask the assistant to stop the Codex preview; when using either Windows launcher, press Ctrl+C in its window to checkpoint and stop gracefully. IP addresses/process state can change after this delivery.


## Detailed model upgrade verification

Fresh final run: `npm run test` passes **89 tests in 28 files**. Production type checking and the browser/server build pass through the Playwright production-server startup. `npx playwright test tests/browser/model-loading-error.spec.ts tests/browser/model-showcase.spec.ts tests/browser/detailed-rigs.spec.ts tests/browser/performance.spec.ts` passes **10 tests with two intentional skips** (missing-asset behavior runs once on desktop). Other scoped post-upgrade runs verify desktop/touch menus, control cancellation, audio signal, Medium/Hard siege vehicles and save restoration. An earlier upgrade run also passed host-started eight-seat rooms, team joining and reconnect behavior; those are separate runs, not a combined unique-test total.

Screenshots under `docs/evidence` were visually inspected: the original block avatars are replaced by textured humanoid meshes, heads/hair are attached, equipment is visible, horses are grounded, village structures have textured roofs/walls, and tree atlas UVs select needle sprigs. The front-character screenshots use a controlled team save with foreground resources cleared for inspection. The phone front-character screenshot uses landscape viewport rotation. This art is detailed game-ready medieval artwork rather than a photoreal/cinematic claim. Asset credits/licenses and the packaging pipeline are recorded in [THIRD_PARTY_ASSETS](../THIRD_PARTY_ASSETS.md). Packaged model and texture payload is approximately 61 MB and needs an initial local/server download.

One independent read-only rendering review found one Important cached-animal species issue; a failing regression test reproduced it, and the fix now passes. Replacing worlds resets rigs and reused animal IDs validate species. Additional regressions cover mouse-aligned model yaw, actual local rendered heading, unavailable tools, parked versus occupied vehicles, death/respawn, local-worker view deltas/generations and movement-driven wildlife clips without private AI goals. Asset-load errors remain visible and disable local match starts. Async startup preserves received online/saved snapshots.

The local server remains on port 5190 and serves the refreshed production assets. No Git commits, pushes or public deployment were performed; Ironvale was not edited. Physical phones, Safari, separate-device Wi-Fi and physical speaker audition remain unverified.

## Gameplay, physics, animation and performance polish

Fresh final verification on 2026-10-14:

- `npm test`: **129 tests in 34 files pass**, including seeded Easy/Medium/Hard AI development and conquest, actual Rapier collision, combat, saves, server rules and animation regressions.
- Production type checking and browser/server build pass through both final Playwright server startups.
- Desktop online suite: **three tests pass** (eight real browser seats in host-started 4v4 Medium, two-seat join/reconnect, and deliberately delayed snapshots during online start).
- Final desktop/phone/tablet rendering, controls/audio and save-loading suite: **16 tests pass, two intentional skips**. Missing-model failure is checked once on desktop. These two final suites cover 19 distinct passing cases; earlier scoped runs are separate evidence.

The first combined unit run during eight simultaneous browser contexts timed out on the 30-second Easy AI diagnostic (128 passed, one timeout). A fresh complete run after those contexts closed passed all 129 without changing its assertions or timeout. The eight-context loading check now permits 20 seconds for the initial authoritative snapshot on a shared GPU, retaining its actual Medium two-life assertion. A separate delayed-snapshot regression first reproduced stale setup HUD values, then verified loading hides those values until the real match snapshot arrives.

Implemented changes include interpolated character/animal/vehicle poses with teleport and fog resets, immediate mouse heading, backward and strafe gait, horse-aligned riders, one-shot attack/eat/hit reactions, bounded hidden rig caches, fewer unchanged instance-buffer uploads, reused immutable fog, memoized minimap tiles and camera obstacle filtering. Menus and loading screens render at 20 FPS; gameplay rendering stays uncapped. Gameplay regressions verify nearest reachable melee targets, rotated building surfaces, terrain occlusion, occupied-horse bonuses, parked-vehicle projectile hits, wildlife facing/obstacles, transparent wildlife interaction sensors, exact repair costs/completion and destroyed-farm behavior. Shared city, life, ammo, save and multiplayer rules remain intact.

Latest eight-player authority stress capture: mean **5.92 ms**, p95 **14.63 ms**, maximum **27.61 ms**; approximately **27.2 KB** steady snapshot. The scenario still includes 498 entities, four mounted horses, four operated catapults, eight traps and 80 initial projectiles. Before-polish evidence is preserved in `evidence/pre-polish-authority-performance.json` (mean 6.85 ms, p95 17.76 ms, max 43.78 ms). An earlier post-polish capture measured mean 8.69 ms, p95 19.72 ms, max 36.04 ms. Wildlife clearance adds real physics queries; capture variation prevents claiming a uniform simulation speedup or a worst-case budget guarantee.

Latest rendered stress capture on the documented Intel UHD computer:

| Browser scenario | FPS | Draw calls | Triangles |
|---|---:|---:|---:|
| Desktop 1440 x 900 | 59.99 | 203 | 665797 |
| Phone 390 x 664, 4x CPU throttle | 38.78 | 135 | 419393 |
| Tablet 768 x 1024 | 60.01 | 144 | 475923 |

Eight travelers, eight vehicles and 48 additional buildings are rendered after eight seconds of warm-up. Automatic quality disables shadows here; desktop uses render scale 0.85 and touch uses 1. These are local Chromium captures sharing a desktop GPU, not physical phone/tablet measurements. Fresh front-character and phone landscape screenshots were inspected: characters, equipment, horses and scenery remain present and grounded. Physical devices, Safari, remote Internet latency and physical speaker audition remain unverified.

One independent read-only review found no Critical issues and one Important interrupted hit-reaction issue. Failing work/riding regression cases reproduced it; both now pass with the full nine-case animation polish suite. The implementation ledger is [optimization-progress](optimization-progress.md). The refreshed production files are served by the existing local preview on port 5190; its final health check reports protocol 1 and zero rooms. No commits, pushes, public deployment or Ironvale edits were made.

## Held aiming and gameplay extension verification

Fresh final runs on 2026-10-14:

- `npm test`: **143 tests in 35 files pass**, including 14 new ranged/guard/repair/AI/save/input cases. The first full run exposed an outdated hand-made touch event fixture lacking `preventDefault`; updating it to represent the real event and assert cancellation yielded the complete passing run.
- Aim/shoot/cancel/repair, held-controls/audio, asynchronous save loading and touch pointer ownership: **11 browser cases pass, one intentional desktop skip**.
- Actual two-client online crossbow damage, detailed rig loading/facing, render stress and Medium/Hard catapult controls: **13 browser cases pass, two intentional touch skips** (the online authority fixture runs once on desktop). Combined final runs cover 24 distinct passing cases, with three intentional skips.
- Both final browser suites compile/type-check and build production browser/server files before running.

The online firing case restores a controlled two-human Hard checkpoint with an equipped crossbow and three bolts. A real held-right/left-click input travels through the browser WebSocket, server message validator and isolated match worker; exactly one bolt is spent and the rival takes damage. It is an integration fixture, not a full empty-start match. Desktop uses independent mouse-button input; touch uses native Chromium CDP fingers to hold Aim, tap Attack, cancel, look and repair. Save assets are deliberately delayed while checking equipment synchronization. Existing city-development/conquest and save/server regressions pass with the complete unit suite.

One independent review identified the omitted online `aimOrigin` allowlist and AI retaining aim during economy travel, plus a native-touch compatibility concern. Failing regressions and a browser reproduction preceded their fixes. Corrected mouse handling also addresses the browser pointer-event rule that only the first pressed mouse button generates pointerdown: held right plus left now works. Touch scene pointerdown suppresses compatibility mouse events, keeping look taps from requesting mouse lock or shooting.

Research sources, chosen original rules and controls are recorded in [gameplay-improvements](gameplay-improvements.md). Ready times, movement accuracy tradeoffs, deliberate shots, directional defense, hit confirmation and repair/stop feedback extend existing systems. Optional sight/combat fields keep old compatible saves loading; no life, team or unlimited-ammo rules changed. The stronger damage context keeps the original target/amount/count regression assertions while carrying incoming direction.

Latest authority stress: mean **5.81 ms**, p95 **11.81 ms**, max **26.74 ms**; steady snapshot approximately **27.3 KB**. Same eight-character/eight-vehicle/498-entity scenario as earlier captures. Latest render proxy results: **60.03 FPS desktop**, **42.03 FPS phone emulation with 4x CPU throttle**, **59.99 FPS tablet emulation**. Hardware, warm-up and auto-quality settings remain as documented above. These captures do not establish physical phone performance or worst-case frame budgets.

Desktop/phone steady-aim and online-hit screenshots were inspected: shoulder camera, reticle, readiness/reload, ammo and damage marker are present, and characters/scenery remain visible. Ranged hand poses remain procedural on the imported generic humanoid rig; this pass does not introduce a dedicated archery animation pack. Physical devices, Safari, separate Wi-Fi clients, Internet latency and physical speaker audition remain unverified.

The prior preview process was verified to be the idle Hearthguard server with zero rooms before restarting it, so new network validation loads immediately. Refreshed browser/server files are served at localhost:5190, with Wi-Fi address 192.168.0.205:5190 on the current host. No Git commits/pushes, public hosting or Ironvale edits were made.

## GitHub delivery preparation

After the local gameplay delivery, the user explicitly authorized stopping the running servers and committing/pushing Hearthguard to https://github.com/Nawod/hearthguard. Earlier no-commit statements describe the preceding local-only deliveries. Fresh pre-commit verification passes all 143 tests in 35 files and the production type-check/build. The first publication includes source, packaged local assets, credits and verification evidence; downloaded art archives, browser/server saves, dependencies and generated builds are excluded. Game servers were stopped before publication. GitHub publication does not deploy the game to a public game server.
