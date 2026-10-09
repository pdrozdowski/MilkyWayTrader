---
date: 2026-10-09T16:27:18+02:00
researcher: Codex
git_commit: 07d9a3b4ddb87c870bf50a93dbd0a5d044cb686d
branch: main
repository: MilkyWayTrader
topic: "S-05 planet ship services: repairs and progression"
tags: [research, shipyard, upgrades, flight, weapons, landing]
status: complete
last_updated: 2026-10-09
last_updated_by: Codex
last_updated_note: "Recorded the 1,000-credit repair price alongside the approved Shipyard layout and interaction."
---

# Research: S-05 planet ship services

**Date**: 2026-10-09T16:27:18+02:00  
**Researcher**: Codex  
**Git Commit**: 07d9a3b4ddb87c870bf50a93dbd0a5d044cb686d  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

What existing contracts must S-05 preserve or extend to deliver landed repairs, the specified independent cargo/engine/weapon progressions, and the separate booster purchase?

## Summary

The existing `GameStateSnapshot` already persists current HP, cargo/engine/weapon levels, and booster ownership; `GameStateProvider.update` is the atomic reducer boundary for service purchases (`src/game/state/shipStatusState.ts:1-8`; `src/game/application/gameStateProvider.ts:24-29`). In the inspected worktree, the landing dialog provides hub, market, and facilities views, while its Shipyard control is disabled, so S-05 can add a presentation-local shipyard view without introducing a Phaser scene or changing the landed pause lifecycle (`src/ui/components/landingStatus.ts:63-72,165-185`; `src/game/mechanics/planet/landing.ts:7-35`).

The PRD specifies the target levels, prices, planet assignments, fixed booster basis, and parity-specific projectile angles (`context/foundation/prd.md:296-297,308-309,327-343`). The current cargo table supplies 20 units at level one, movement has a 240 normal-speed constant, and one cadence event creates one forward projectile; these are the implementation gaps S-05 must replace (`src/game/domain/runBalance.ts:1-6`; `src/game/definitions/gameplayTuning.ts:1-18`; `src/game/mechanics/gameSimulation.ts:96-111,128-134,178-190`).

## Detailed Findings

### Authoritative state and purchase seam

- The current snapshot holds `credits`, `cargo`, `ship`, and `shipStatus`; the latter has `currentHitPoints`, the three levels, and `boosterUnlocked` (`src/game/state/gameStateSnapshot.ts:15-37`; `src/game/state/shipStatusState.ts:1-8`). The initial state sets 100 HP, level one for each path, and a locked booster (`src/game/definitions/initialGameState.ts:64-70`).
- In this inspected reducer path, `GameStateProvider.update` validates the reducer output, replaces the aggregate, and notifies subscribers once (`src/game/application/gameStateProvider.ts:24-29,51-55`). Ship-service commands should use that boundary to deduct credits and alter HP, a level, or booster ownership together.
- The codec accepts positive cargo, engine, and weapon levels but does not bind them to the PRD maxima; it checks the exact `shipStatus` fields and rejects active boost while locked (`src/game/application/gameStateCodec.ts:229-235,420-425`). The planned level caps therefore need definition-backed validation and state/codec coverage. Per repository rules, that authoritative-state work requires `/utils-add-state` during implementation.
- `cargoCapacityByLevel` is currently `{ 1: 20 }`; landed trade, landed projections, run status, salvage transfer, and the scene pickup guard read it dynamically (`src/game/domain/runBalance.ts:1-6`; `src/game/application/serotonMarket.ts:53-59`; `src/game/application/runStatus.ts:36-43`; `src/game/mechanics/salvage/cargoDamage.ts:98`; `src/game/scenes/gameScene.ts:447`). `orbitalCargoCapacity` remains a separate 20-unit orbital-container constraint and is not the ship capacity named by BR-073 (`src/game/domain/runBalance.ts:3`; `src/game/application/gameStateCodec.ts:167-178`).
- Facility investment provides the closest command pattern: quote landed eligibility, known ID, next step, and affordability; then atomically deduct credits and change the landed record (`src/game/application/planetFacilities.ts:51-90`). Ship services can use an analogous quote/apply pair.

### Landed presentation and service locations

- The landing adapter derives eligibility from `landedPlanetId`, creates projections from the provider, and calls application reducers through typed commands (`src/ui/adapters/landingStatusAdapter.ts:68-88,136-143`). Its port currently declares trade, facility, and launch actions, without ship-service actions (`src/ui/contracts.ts:65-76`).
- The hub has a disabled Shipyard button, and the component's local view union is `hub | market | facilities` (`index.html:73-77`; `src/ui/components/landingStatus.ts:63-72,165-185`). The existing facilities implementation establishes the appropriate model: one typed snapshot, semantic commands, view-local navigation, and Back without a launch transition (`src/game/application/landedFacilities.ts:92-154`; `src/ui/components/landingStatus.ts:211-255`).
- S-04 recorded that the hub is a presentation seam and that Launch is the action ending landing (`context/archive/2026-09-26-s04-first-planetary-trade/research.md:65-72`). The historical decision remains supported by the current adapter, which emits `landing-modal-transition` solely after `launchFromPlanet` changes landed state (`src/ui/adapters/landingStatusAdapter.ts:144-150`).
- The PRD gives repair increments and the maximum/credit guard but leaves its configured price value outside the listed S-05 values (`context/foundation/prd.md:327-343`). The user set the repair-cost balance parameter to 1,000 credits per purchase; a purchase may provide less than 10 HP when it reaches the maximum.

### Approved Shipyard layout and repair interaction

- The supplied Shipyard wireframe makes Shipyard a local landing view: the upper portion is planet-themed artwork; the lower portion contains the planet title, repair card, three upgrade cards, and a booster row. On Seroton, Cargo Capacity is the actionable path while Engine System and Weapon System identify Lactozis-7C and Maslo-Prime as unavailable-service locations. This is a product decision supplied after the initial research, not behavior inferred from the existing component.
- Its top navigation must reuse the established Market/Facilities controls, layout, styling, and semantics: Back and paused clock at left, credits and cargo at right. The current Market and Facilities headers are structurally parallel but separately addressed in markup/component code (`index.html:79-99`; `src/ui/components/landingStatus.ts:35-48,123-130,179-189`). Planning should extract or share that header contract rather than create a third divergent copy.
- A repair purchase costs 1,000 credits, restores 10% of maximum HP, and caps restored HP at the maximum. With maximum HP 100, the supplied 75/100 example becomes 85/100 after one purchase (`src/game/domain/runBalance.ts:1-2`). The repair control is disabled when HP is full or its configured price exceeds credits; a successful atomic update must refresh the health projection and balance through existing provider subscriptions (`src/game/application/gameStateProvider.ts:24-29`; `src/game/application/runStatus.ts:36-43`).
- In the Shipyard view, balance, repair, upgrade, and booster prices must render without a currency-unit suffix. This formatting rule is local to Shipyard; `formatCredits` produces the grouped number while its callers supply surrounding labels (`src/ui/components/formatCredits.ts:1-5`; `src/ui/components/landingStatus.ts:129,151,186`).

### Engine progression and booster

- Normal maximum speed is the 240 tuning constant. The simulation uses that constant for ordinary movement and computes boost from it with multiplier 5 (`src/game/definitions/gameplayTuning.ts:1-10`; `src/game/mechanics/gameSimulation.ts:96-111`). With a 240 Lv1 base, the PRD's fixed boosted maximum is 1,200; upgraded normal speed must not become the multiplier's basis (`context/foundation/prd.md:296-297`).
- Boost requires manual target input, an unlocked booster, no landing, and no recovery lock; boosted state suppresses firing (`src/game/mechanics/gameSimulation.ts:92-130`). Existing impact recovery resets velocity using the same fixed 240 constant (`src/game/mechanics/gameSimulation.ts:251-264`). The requirements do not state whether recovery/impact velocity scales with engine level, so the plan must either retain the Lv1 constant or obtain a product decision.
- `setBoosterEnabled` currently changes `boosterUnlocked` directly from a scene helper (`src/game/scenes/gameScene.ts:229-236`). Implementation should preserve it as an explicitly bounded debug mechanism or replace its production use with the landed command.

### Weapon volley and combat seam

- A cadence beat is one firing event; the current reducer increments `projectileSequence` once and adds one forward trajectory after collision resolution (`src/game/mechanics/spaceship/fireCadence.ts:9-20`; `src/game/mechanics/gameSimulation.ts:128-134,178-190`). A level-dependent volley can retain cadence while producing the count implied by weapon level.
- `shotTrajectory` derives the forward vector from rotation, sets a 25-pixel nose offset, and applies the configured projectile speed (`src/game/mechanics/projectile/trajectory.ts:4-10`; `src/game/definitions/gameplayTuning.ts:13-19`). The specified angles can be represented as a pure degrees-to-radians rotation offset helper; counts one through ten require exact parity-pattern tests (`context/foundation/prd.md:308-309`).
- Projectile IDs are reconciliation keys for the ship weapon projection and are validated as unique by the codec (`src/game/objects/spaceship/shipWeapon.ts:18-34`; `src/game/application/gameStateCodec.ts:333-350`). S-05 must choose a deterministic per-projectile sequence convention for each volley; the frame does not decide whether a volley consumes one or N sequence values.
- Each projectile can independently damage an asteroid; a multi-projectile volley can therefore deliver several legitimate hits where paths converge (`src/game/mechanics/gameSimulation.ts:267-347`). S-08 and S-09 place collision, fragmentation, and salvage in mechanics, so S-05 should preserve that source of truth (`context/archive/2026-10-01-s08-asteroid-combat/plan.md:17-26,53-59`; `context/archive/2026-10-04-s09-asteroid-salvage/plan.md:19-20,89-107`).

## Architecture Insights

The architecture assigns JSON-safe authoritative values to `GameStateSnapshot`, pure reducers to mechanics/application, and DOM interactions to typed ports and adapters (`context/foundation/architecture.md:7-36`). S-05's seam is therefore: static service catalogues and balance definitions; existing persisted ship status with strengthened limits; pure quote/apply service operations; flight and volley mechanics; then a landed shipyard projection and local dialog view.

## Historical Context (from prior changes)

- Supported: S-04 established the landed dialog rather than a new Phaser view for services (`context/archive/2026-09-26-s04-first-planetary-trade/research.md:65-72`).
- Supported: S-16 uses landed-only application projections and semantic UI commands; it explicitly excluded repair and shipyard scope (`context/archive/2026-10-08-s16-planetary-facilities/plan.md:34`; `context/archive/2026-10-08-s16-planetary-facilities/research.md:120-131`).
- Supported: S-08/S-09 preserve authoritative projectile outcomes in mechanics, not Phaser objects (`context/archive/2026-10-01-s08-asteroid-combat/plan.md:53-59`; `context/archive/2026-10-04-s09-asteroid-salvage/plan.md:89-107`).

## Related Research

- `context/archive/2026-09-26-s04-first-planetary-trade/research.md`
- `context/archive/2026-10-08-s16-planetary-facilities/research.md`

## Open Questions

- Should collision/recovery escape velocity remain the 240 Lv1-base value or scale with engine level?
- Should one N-projectile volley consume N sequence values, or should IDs encode a per-volley projectile index?
- On planets without the relevant upgrade path, should the shipyard show an unavailable service or omit it? The PRD determines purchase locations but not that presentation detail (`context/foundation/prd.md:333-336`).
