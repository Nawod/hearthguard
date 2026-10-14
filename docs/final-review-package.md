# Hearthguard final review package

Review the whole independent project at `N:\Projects\GPT\hearthguard`. It has no Git repository/base commit; no commits or Ironvale mutations are authorized. Review the working source, not a fictitious diff. Do not mutate files or run browser suites concurrently with the implementer.

Authority: `docs/superpowers/specs/2026-10-14-hearthguard-design.md` and `docs/superpowers/plans/2026-10-14-hearthguard-implementation.md`. Rulings and test history are in `docs/implementation-progress.md`. Run/hosting instructions are in README; measurements and boundaries are in `docs/verification.md` and `docs/evidence`.

Implemented: independent React/Three.js/Rapier third-person RTS, empty-start one human/one AI; FFA2–8 and two teams≤4 each; gathering/banking/build/work/repair/crops; tools/armor/two weapons/one horse or operated catapult; difficulty lives/ammo; physics combat/food/traps/towers/gates; fog/private views; complete saves; isolated authoritative server workers; host-started private/public lobbies, seat reconnect, recovery; local Wi-Fi launchers; desktop/touch/portrait/landscape; original locally defined art/sound and measured rendering.

Evidence at package preparation: 54 complete unit/server tests passed before additional jump/session regressions (those also pass). Easy/Medium/Hard seeded AI rounds complete. Desktop/phone/tablet complete controlled gathering/crafting/healing/win journeys pass. A real unmodified Hard PvC round completes via browser input automation (human defeat). Eight independent desktop browser seats reached 4v4 victory; full-suite load exceeded the initial test timeout, so the test has a180-second budget and smaller peer viewports to avoid pretending eight physical GPUs exist. The same eight players/game rules remain. Physics/render performance is separately measured with eight travelers/vehicles and populated cities. Full final check results are being consolidated.

Important regressions already addressed: terminal snapshot on odd-tick win; parked vehicle/one loot bag on hall loss; per-character gate ownership and owner locks; strict network spoof fields; malformed save validation; LOS interactions; movement-only prediction; map/fog deltas; serialized atomic checkpoints and shutdown acknowledgement; old session generation filtering and disabled Resume during async restore; no post-result input spam; AI navigation uses only discovered scenery.

Review focus (verbatim from plan):

1. A character dies while its hall is destroyed during the same step or respawn countdown: no duplicate loot, life deductions or resurrected defeated factions. Owned by Task 9.
2. Teammates submit simultaneous bank/crafting/vehicle commands: spend once, never overdraw or duplicate equipment/vehicles. Owned by Tasks 4 and 7.
3. Touch cancellation, menu opening and browser blur occur while moving/attacking: all held controls release, without stray attacks or camera/joystick cross-talk. Owned by Task 3.
4. Reordered input, replaced tabs and malicious payloads request movement/damage or hidden collision state: authority rejects spoofing and snapshots/prediction payloads preserve privacy. Owned by Tasks 10 and 12.
5. Browser storage/WASM/network setup fails or host has multiple network adapters: show usable errors/addresses, free partially initialized resources, and avoid false LAN/physics support claims. Owned by Tasks 1, 11 and 13.

Read-only whole-project review only, no further subagents. Check concrete behavior and omissions, not merely checklist wording. Grade actual impact. Give file/line evidence, reproduction reasoning and suggested fix for Critical/Important findings; list Minor findings separately. Explicitly list anything declined as outside scope with rationale. Do not claim tests you did not run. Physical phones, separate-device Wi-Fi, speaker audition, Safari/iOS and public Internet deployment are explicitly unverified boundaries, not implemented substitutes.
