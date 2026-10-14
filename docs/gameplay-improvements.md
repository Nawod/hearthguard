# Hearthguard aiming and gameplay improvements

Request: inspect comparable games, improve gameplay, add held right-click aiming for ranged weaponry and useful additional interactions. Bounded extension of the existing combat, input, camera, task and HUD flows. Preserve all match/team/life/ammo rules, detailed assets and local saves. No commits, public deployment or Ironvale edits.

## Research and adaptation

Primary sources inspected:

- [Mount & Blade developer notes on ranged readiness](https://www.taleworlds.com/en/News/422): different readying times and contracting accuracy indicators for ranged weapons.
- [Mount & Blade developer notes on movement and accuracy](https://www.taleworlds.com/en/News/383): moving and instant-release accuracy tradeoffs.
- [Enshrouded developer combat update](https://enshrouded.com/en-US/news/enshrouded-thralls-of-twilight-update): responsive aim/charge input, avoiding accidental repeated ranged shots and clearer feedback.
- [Enshrouded developer blocking update](https://enshrouded.com/en-US/news/enshrouded-back-to-the-shroud-update): reliable defensive transitions and directional handling.

These inform original Hearthguard rules; no assets, source code or exact balance are copied. Hold aim to steady, then click/tap to shoot. Weapon-specific readiness, deliberate firing, movement tradeoffs and directional defense fit the existing personal gathering/building/combat loop. This pass adds no stamina or dodge system.

## Implemented behavior

- Right mouse hold enters shoulder aiming and narrows FOV; lower aiming sensitivity and walking speed apply. Camera view and shot yaw/pitch agree. Independent mouse-button events support right + left simultaneously; ordinary pointerdown alone omits the second button of that chord.
- A legal nearby camera origin travels through both local and online input validation. The authority traces its sight line and converges a ballistic shot from the actual character muzzle. Terrain, structures, parked vehicles and friendly bodies still obstruct projectiles. Invalid/non-finite/remote origins reject; no client-authoritative damage or spending.
- Longbow focus takes 1.1 seconds; quick fire has 65% launch speed/power, reaching ordinary full values at steady aim. Crossbow focus takes 0.45 seconds. Moving adds spread. Seeded randomness determines spread and restores through saves.
- Bow/crossbow fire once per press; held attack cannot fire again after cooldown without release. Reload/nocking, focus, ammo shortages and actual damage confirmations are shown. Siege firing cadence remains unchanged. Unlimited ammunition on Easy/Medium and crafted ammo on Hard remain intact.
- Touch Aim + Attack supports simultaneous fingers. Canvas look taps suppress compatibility mouse attacks/PointerLock. Cancellation, menus and focus loss release controls; short attack taps are sampled once.
- Sword/spear guard reduces incoming damage from the front while guarding, using projectile arrival direction rather than the shooter's later position. Rear hits, traps and siege explosions bypass weapon guard. Armor remains unchanged.
- Damaged friendly buildings expose Repair; active gathering/work/repair exposes Stop. Repairs spend shared deposited wood only for health restored. Missing/depleted wood reports clearly and ends the task rather than leaving an endless animation.
- AI readies, fires and releases bow input under the same rules, and clears its aim stance when returning to economic tasks. Save loading retains pending orientation/weapon synchronization until controls exist.
- Optional combat/input fields validate in saves. Existing v1/balance-1 saves without those fields continue to load; no schema replacement or account/networking changes.

## Review and verification

Failing regressions were run before fixes for ranged repeat fire, focus/power, invalid camera origins, sprint suppression, rear/trap guard, pitch alignment, damage confirmation, save state, missing repair resources, AI bow cadence, AI leaving aim stance and online packet acceptance. Actual browser failures exposed mouse-button chord handling and native-touch compatibility events. Existing exact damage-array assertions now allow the added incoming-direction context while retaining target, amount and array-length checks.

One independent read-only review found two important issues (online input allowlist and retained AI aim) and a touch-compatibility concern. Each was reproduced and fixed. The full unit suite passes 143 tests in 35 files. Desktop/phone/tablet aim/shoot/cancel/repair, controls/audio, save loading and pointer ownership pass 11 cases with one intentional desktop skip. The additional final online shooting, detailed-model, performance and vehicle suite passes 13 cases with two intentional touch skips. Combined final browser runs cover 24 distinct passing cases and three skips. Production type checking/build pass. The idle local server was restarted on port 5190 to load the new online validator; no active rooms were stopped. Final results are recorded in verification.md.

Physical touch devices, Safari, real Internet latency and physical audio audition remain unverified; browser device tests are Chromium emulation. Research informs the rules, not a claim that Hearthguard reproduces another game's full combat system.
