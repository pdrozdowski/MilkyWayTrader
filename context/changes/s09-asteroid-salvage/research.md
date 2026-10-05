---
date: 2026-10-04T19:57:01+02:00
researcher: Codex
git_commit: 177bba7
branch: main
repository: MilkyWayTrader
topic: "Authoritative asteroid salvage replacement"
tags: [research, asteroid-salvage, cargo, game-state, economy]
status: complete
last_updated: 2026-10-04
last_updated_by: Codex
last_updated_note: "Recorded final tuning, interaction, sound, and placeholder-icon decisions."
---

# Research: Authoritative asteroid salvage replacement

**Date**: 2026-10-04T19:57:01+02:00  
**Researcher**: Codex  
**Git Commit**: 177bba7  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

What existing contracts and code paths must an implementation plan account for
when S09 replaces live/frozen salvage crates with persistent orbital cargo and
zero-cost loose commodity pickups, while retaining correct ship-cargo average
cost after ship-to-cargo transfers and market trades?

## Summary

The authoritative integration point is the terminal projectile hit on a small
asteroid in `gameSimulation.ts`; the Phaser scene must project its committed
result, not create drops. The snapshot/provider/codec already support immutable,
JSON-safe world collections and deterministic random state, but the present
ship cargo representation is one average-price stack per commodity and cannot
preserve the acquisition price of a unit stored in orbital cargo.

The plan must replace the PRD's old crate lifecycle, introduce state-backed
cargo containers and loose items, and make market transactions normalize the
cost basis of the carried units of the traded commodity. Existing production
code has snapshot codec support, not durable save/load integration; S09 can
make the future save payload complete without claiming that durable saves are
already implemented.

The owner has now fixed the interaction contract: opening cargo pauses active
time; cargo takes projectile damage only; the modal closes by an explicit
button; a full-cargo pickup attempt shows a two-second warning; and S09 models
state without implementing durable persistence (`change.md:14-20`). Existing
32px cargo icons can serve as the requested placeholder flip frames
(`change.md:19-20`).

The remaining spatial and sound decisions are also fixed: cargo uses the
planet-style star-centered orbit calculation, its visible activation zone is
20px, cargo and loose-item collision radii are 15px, and loose items use the
existing ship-impact fragmentation direction (`change.md:22-26`). S09 has
three new generated commodity placeholder icons in the workspace
(`change.md:27-29`).

## Detailed Findings

### Product contract and historical scope

- The frame records that S09 replaces the older crate design and prioritizes
  asteroid-to-loot gameplay; orbital storage is allowed but secondary
  (`context/changes/s09-asteroid-salvage/frame.md:22-27`).
- The current PRD instead describes a crate that is live for 60 seconds of
  active time, then frozen, with separate projectile outcomes
  (`context/foundation/prd.md:294-314`). Those rules must be revised rather
  than retained as a second salvage lifecycle.
- S08 explicitly excluded salvage and assigned it to S09
  (`context/archive/2026-10-01-s08-asteroid-combat/frame.md:38-56`). The
  roadmap also names S09 as the slice after S04 and S08
  (`context/foundation/roadmap.md:51-54,173-182`).

### Authoritative state and cost basis

- `GameStateSnapshot` contains the run clock, `randomState`, ship cargo,
  projectiles, and asteroids (`src/game/state/gameStateSnapshot.ts:13-31`).
  `GameStateProvider` validates each construction, update, and restore through
  the codec and publishes detached snapshots (`src/game/application/gameStateProvider.ts:13-55`).
- Current `CargoState` is exactly one `{ commodityId, quantity,
  averageBuyPrice }` stack shape (`src/game/state/cargoState.ts:1-6`). The
  codec validates unique commodity IDs and those three exact keys
  (`src/game/application/gameStateCodec.ts:111-125`). This shape cannot retain
  a separate purchase cost while a unit is outside ship cargo.
- On a valid market purchase, `applySerotonTrade` computes a weighted average;
  on a sale, it retains the existing stack average while units remain
  (`src/game/application/serotonMarket.ts:53-77`). The owner-selected rule is
  compatible with that sale average, but requires every remaining carried unit
  of the traded commodity to be rewritten to that average after each valid
  market trade (`frame.md:22-27`).
- Landing-market and run-status projections consume aggregate cargo quantity
  and average price (`src/game/application/landedMarket.ts:73-115`,
  `src/game/application/runStatus.ts:26-36`). They should continue to receive
  aggregate view models even if authoritative cargo gains unit-price detail.
- The project lesson prohibits snapshot migrations before the application is
  mature (`context/foundation/lessons.md:12-17`); the current codec rejects
  retired schema versions (`src/game/application/gameStateCodec.ts:98-106`).
  A schema change in S09 should therefore reject obsolete snapshots unless a
  separately approved migration policy changes that rule.

### Deterministic loot lifecycle

- The simulation advances active time, world motion, asteroid impacts, and
  persisted random state before it returns a new snapshot
  (`src/game/mechanics/gameSimulation.ts:76-221`). If a pause prevents active
  time from advancing, this inspected path returns before world simulation
  (`src/game/mechanics/gameSimulation.ts:78-80`).
- Projectile targets are resolved against asteroid motions in the impact
  resolver; a terminal projectile hit removes an asteroid at final HP
  (`src/game/mechanics/gameSimulation.ts:240-318`). This is the authoritative
  seam for the two independent 10-percent rolls specified in the frame, and
  ship/planet/Moolaris asteroid branches must not create loot there.
- Asteroid motion demonstrates star-centered orbit and linear velocity
  integration using active time (`src/game/mechanics/asteroid/asteroidSimulation.ts:35-65`).
  Cargo and loose-item motion require their own state and reducer rules rather
  than reusing asteroid culling assumptions.
- The owner selected the same star-centered orbit calculation used for planets
  for cargo, a visible 20px activation zone, 15px collision radii for cargo
  and loose items, and no world-boundary cull (`change.md:22-25`). The loose
  item's initial vector uses the deterministic ship-impact fragmentation
  direction (`change.md:25-26`).
- `randomState` is a codec-validated uint32 (`src/game/application/gameStateCodec.ts:98-109`),
  and the simulation already advances it for ordered damage resolution
  (`src/game/mechanics/gameSimulation.ts:191-210`). Loot rolls, commodity
  choice, quantity, and release vectors need a stated draw order from this
  stream so restored and uninterrupted runs agree.
- The present projectile target collection does not include loose commodities
  (`src/game/mechanics/gameSimulation.ts:240-318`). Keeping loose items outside
  that collection gives the requested projectile immunity without Phaser
  physics becoming authoritative.

### UI, projections, audio, and assets

- The landed dialog is a static semantic DOM dialog and `data-game-input="ignore"`
  control surface (`index.html:64-82`). Its component subscribes to a typed
  port, controls visibility and focus, and releases listeners on teardown
  (`src/ui/components/landingStatus.ts:14-18,56-59,136-179`). A cargo transfer
  modal can use the same port/component boundary while its selected cargo and
  transfer quantity remain transient UI state.
- Landing is the current source of the `landed` clock pause
  (`src/game/mechanics/planet/landing.ts:15`). Opening a cargo modal has no
  existing pause contract. The old PRD says crate opening/transfer does not
  pause active time (`context/foundation/prd.md:301-306`), but the replacement
  decision now explicitly pauses active time (`change.md:14-15`). The cargo-modal pause must be a
  distinct authoritative pause reason so the active clock and its world
  simulation remain frozen while the modal is open.
- `AsteroidProjection` reconciles snapshot objects by stable ID and draws a
  health bar only below full durability (`src/game/objects/asteroid/asteroidProjection.ts:22-116`).
  This is a direct presentation pattern for two-HP cargo with a visible 50%
  bar at one HP; cargo durability itself belongs in state/tuning.
- Object assets are auto-discovered from object definitions and loaded by the
  preloader (`src/game/objects/_shared/registry.ts:4-29`,
  `src/game/scenes/preloaderScene.ts:37-54`). Audio definitions are also
  auto-discovered (`src/game/audio/registry.ts:5-13`). No inspected pickup
  sound or transient warning-banner component establishes a reuse contract.
- The existing icon directory contains `cargo_32x32.png` and `cargo2_32x32.png`
  (`public/assets/icons/`, `change.md:19-20`). They can be used as placeholder cargo animation
  frames for 0.2 seconds and 1 second respectively;
  this research does not generate replacement bitmaps.
- The owner selected the existing sun-ingestion and asteroid-crash recordings
  for loose-item consumption and cargo destruction (`change.md:26-28`). Three
  generated 32px placeholder commodity icons are stored at
  `public/assets/icons/commodity-supplies-placeholder_32x32.png`,
  `public/assets/icons/commodity-alloys-placeholder_32x32.png`, and
  `public/assets/icons/commodity-medicines-placeholder_32x32.png`
  (`change.md:28-29`).

### Verification seams

- State/codec tests already cover frozen snapshots, malformed cargo, atomic
  restore, serialization continuity, and strict asteroid validation
  (`tests/domain/gameState.test.mjs:14-108,173-193,403-423`).
- Mechanics tests cover paused asteroid motion, swept targeting, deterministic
  restore equivalence, projectile damage, and terminal fragmentation
  (`tests/game-mechanics.test.mjs:592-723`). They are the appropriate place
  for drop probability boundaries, no-loot branches, cargo destruction, loose
  pickup/full-capacity behavior, sun ingestion, and restore determinism.
- Existing market tests cover weighted purchase basis and sale retention
  (`tests/domain/serotonMarket.test.mjs:33-64`). Extend them for zero-cost
  loot and post-trade normalization; Playwright is not required for these
  state/economy rules under `context/foundation/testing.md`.

## Architecture Insights

State is JSON-safe and behavior-free; transitions belong in pure reducers and
Phaser objects are projections (`src/game/state/AGENTS.md:1-8`). The root
architecture similarly assigns save-surviving spatial state to the snapshot and
keeps collision geometry/derived values outside it (`context/foundation/architecture.md:20-34`).

This means S09 requires the `utils-add-state` workflow during implementation.
The request does not explicitly ask for architecture artifacts, so this research
does not request a code graph or data diagram refresh.

## Historical Context

- **Supported**: S04 deliberately added a weighted average cost basis per
  aggregate cargo stack (`context/changes/s04-first-planetary-trade/plan.md:160-188`).
  That remains correct for market presentation but is insufficient for external
  storage provenance.
- **Superseded for S09**: the original salvage contract in the PRD and roadmap
  names live/frozen crates (`context/foundation/prd.md:294-314`,
  `context/foundation/roadmap.md:173-182`). The current owner decision replaces
  it (`context/changes/s09-asteroid-salvage/frame.md:22-27`).

## Related Research

No earlier S09 research artifact exists. The accepted S08 frame is relevant:
`context/archive/2026-10-01-s08-asteroid-combat/frame.md`.

## Resolved Product Decisions

- The cargo modal pauses active game time (`change.md:14-15`).
- A loose item combines two vectors over 10 active seconds: its initial linear
  vector transitions linearly from 100% to 0%, while the vector toward the sun
  center transitions from 0% to 100% (`change.md:14-16`).
- Cargo can take damage from projectiles, not ship or asteroid contact (`change.md:16-17`).
- The modal has a Close button. A pickup attempt with no ship capacity shows
  `WARNING - CARGO IS FULL` for 2 seconds. Cargo-to-ship transfer controls are
  disabled when the ship is already full (`change.md:17-18`).
- S09 establishes complete snapshot/codec state modelling; durable save/load is
  deferred to S11 (`change.md:18-19`).
- Placeholder cargo animation uses the existing 32px icons:
  `cargo_32x32.png` for 0.2 seconds and `cargo2_32x32.png` for 1 second
  (`change.md:19-20`).
- Cargo uses the planet-style star-centered orbit calculation. Its activation
  zone is 20px and shown like a planet orbit (`change.md:22-24`).
- Cargo and loose items use 15px collision radii and no world-boundary cull
  (`change.md:24-25`).
- Loose-item initial vectors use the ship-impact asteroid-fragmentation
  direction (`change.md:25-26`).
- Sun consumption uses `sun_asteroid_low_slurp_loud_no_noise.wav`; cargo
  destruction uses `asteroid_crash_metal_clean.wav` (`change.md:26-28`).
- Generated 32px placeholder commodity icons are recorded in `change.md:28-29`.

## Open Questions

No product decisions remain that block implementation planning. Manual review
may replace the placeholder commodity icons before release.
