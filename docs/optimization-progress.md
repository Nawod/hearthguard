# Hearthguard gameplay, physics, animation and performance polish

User request: optimize the game and improve all game logic, physics and animations. This is a bounded pass on existing systems. Preserve approved match modes, lives, ammo rules, shared cities, authoritative simulation, local saves and controls. No commits, no public deployment, no Ironvale edits.

Implemented and reproduced with failing regressions before fixes:

- Melee selects the nearest reachable enemy in the attack cone and reaches the actual rotated building surface. Terrain blocks melee. Spear cavalry bonuses require an occupied horse; projectiles collide with owned parked vehicles.
- Wildlife uses correct facing, stays within map bounds, stops at solid obstacles and does not roam when dead. Non-solid wildlife sensors no longer block gathering/work/deposits; walls and terrain still do. A seeded Easy AI stall exposed this interaction edge case and was corrected.
- Repairs charge only for health actually restored, stop when complete and report completion. Destroyed or eliminated farms cannot produce new harvests.
- Character and animal positions/yaw interpolate disclosed snapshots, including early packet arrivals. Teleports, respawns and world changes snap/reset; absent actors are removed immediately; no unseen movement is extrapolated. Mouse-facing on foot remains immediate; online movement prediction remains authoritative-reconciled.
- Attack/consume/hit clips are one-shots driven by state changes. Hit reactions complete during work and riding. Faded mixer actions stop. Backward gait reverses, strafing steers legs with a counter-rotated torso, and riders stay aligned with horse heading while looking with the mouse. Hidden rig caches have age/count bounds and do not advance hidden mixers.
- Static instance buffers upload only when their float32 transforms change. Snapshot entities/colors are indexed once, diagnostic attributes update at 4 Hz, and immutable fog masks are reused until exploration changes. Minimap terrain tiles are memoized. Nearby camera obstacle checks avoid scanning distant geometry; world changes reset the camera and labels behind it are discarded.
- Online start clears setup preview HUD values and waits for a real snapshot. Asynchronous asset loading uses actual match snapshots and session ownership rather than replaying a preview. Menus render at 20 FPS to reduce idle GPU use.

One independent read-only review found one Important interrupted-hit reaction issue and no Critical issue. The finding was reproduced and fixed. Final verification: 129 unit tests in 34 files pass, production type checking/build pass, three online browser cases pass, and 16 desktop/phone/tablet controls/rendering/loading cases pass with two intentional skips. Measured approximately 60/39/60 FPS desktop/throttled-phone/tablet. Full evidence, simulation timing variation and physical-device boundaries are recorded in docs/verification.md.

Earlier automatic approval review stopped one command because of an account usage limit, before executing it. On the user's explicit continuation, the saved code was inspected and missing edits completed; no safety rejection was bypassed.
