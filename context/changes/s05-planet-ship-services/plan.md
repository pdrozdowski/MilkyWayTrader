# S-05 Planet Ship Services Implementation Plan

## Overview

Deliver landed Shipyard services for repair and independent Cargo Capacity, Engine System, and Weaponary System progression. The work completes S-05 with exact prices, levels, planet assignments, fixed-speed booster behavior, and deterministic multi-projectile firing.

## Current State Analysis

`ShipStatusState` already persists hit points, the three levels, and booster ownership, while `GameStateProvider.update` is the atomic state-replacement boundary. The landing dialog currently has hub, market, and facilities views; its Shipyard control is disabled. Flight uses one fixed maximum speed and each cadence beat creates one projectile.

## Desired End State

A landed player can open Shipyard on every planet, repair damage, and buy the next eligible service only on its assigned planet. Cargo upgrades raise usable cargo capacity; engine upgrades raise only player-directed normal-flight speed; weapon upgrades create the specified volley. Purchases update state and the visible Shipyard immediately.

### Key Discoveries:

- `GameStateProvider.update` validates and publishes one authoritative snapshot per reducer (`src/game/application/gameStateProvider.ts:24-29`).
- Existing facility quote/apply operations establish the landed-purchase pattern (`src/game/application/planetFacilities.ts:50-99`).
- The landing component already owns local modal navigation and focus handling (`src/ui/components/landingStatus.ts:63-80,266-323`).
- Projectile IDs must be unique and the current `projectileSequence` is a persisted integer (`src/game/mechanics/gameSimulation.ts:128-134,178-190`; `src/game/application/gameStateCodec.ts:333-350`).

## What We're NOT Doing

- Facility investment, changes to asteroid combat or salvage outcomes, booster fuel, snapshot migrations, and Playwright coverage.
- Engine-level changes to collision recovery, asteroid impact pushback, Moolaris forced movement, or the fixed 1,200 booster speed.

## Implementation Approach

Put service balance and planet availability in definition-backed catalogues, expose pure quote/apply operations through the existing state provider, then project them into a local Shipyard dialog view. Keep flight and volley calculations pure mechanics so Phaser continues to reconcile only authoritative projectile state.

## Phase 1: Ship-service catalogue and landed operations

### Overview

Establish the balance definition, bounded authoritative state, and atomic landed commands before rendering or mechanics consume them.

### Changes Required:

#### 1. Ship-service definitions and state validation

**Files**: `src/game/domain/runBalance.ts`, `src/game/state/shipStatusState.ts`, `src/game/application/gameStateCodec.ts`

**Intent**: Define the Cargo, Engine, Weaponary, repair, and booster progression once so every consumer shares prices, caps, service planets, and resulting capabilities.

**Contract**: Cargo is sold on Seroton; engine and the independent booster on Lactozis-7C; weaponary on Maslo-Prime. Cargo levels map 1–5 to 40/50/65/85/110, engine levels map 1–5 to 100/110/120/135/150% of normal speed, and weapon levels map 1–10 to projectile count. The codec accepts only catalogue-supported levels while retaining the current `ShipStatusState` field shape.

#### 2. Landed shipyard application service

**Files**: `src/game/application/planetShipServices.ts`, `src/game/application/gameStateProvider.ts`

**Intent**: Make each repair or purchase an authoritative all-or-nothing state transition, following the existing landed-facility quote/apply pattern.

**Contract**: Export typed quote and apply operations for repair, each upgrade path, and booster purchase. Reject not-landed, wrong-planet, insufficient-credit, full-health, maximum-level, and already-owned requests without changing state. Repair costs 1,000 and restores 10% of max HP capped at maximum; each path permits only its next level.

### Success Criteria:

#### Automated Verification:

- Domain/application tests cover every catalogue level, price, planet assignment, next-level rule, repair cap, affordability, and rejection path.
- Codec tests reject out-of-range service levels and preserve valid existing snapshots.

#### Manual Verification:

- Inspect service definitions to confirm the three upgrade paths are each assigned to exactly one planet.

---

## Phase 2: Engine and weapon mechanics

### Overview

Apply the catalogue to player-directed flight and produce deterministic weapon volleys without changing the existing cadence model.

### Changes Required:

#### 1. Normal-flight engine scaling

**Files**: `src/game/mechanics/gameSimulation.ts`, `src/game/definitions/gameplayTuning.ts`

**Intent**: Make engine upgrades increase ordinary controlled-flight speed and acceleration while preserving the deliberately fixed non-player-directed movement rules.

**Contract**: Calculate normal max speed and its acceleration basis from `shipStatus.engineLevel`. Collision recovery, impact pushback, Moolaris forced movement, and their deceleration behavior retain Lv1 speed. Boost remains an unlocked, manual-only fixed 5× Lv1 speed (1,200), independent of engine level.

#### 2. Level-based projectile volleys

**Files**: `src/game/mechanics/gameSimulation.ts`, `src/game/mechanics/projectile/trajectory.ts`, `src/game/state/weaponState.ts`

**Intent**: Emit the player-visible number and geometry of shots for the purchased weapon level while maintaining stable state reconciliation.

**Contract**: A firing cadence beat increments `projectileSequence` once as the volley number and emits `weaponLevel` projectiles with IDs `projectile-<volley>-<projectile>`. Offset order is deterministic: ascending angle from left to right. Odd volleys use a forward shot then mirrored ±2.5°, ±7.5°, ±12.5° pairs; even volleys use mirrored ±5°, ±10°, ±15° pairs. Every trajectory retains the existing muzzle offset and projectile speed.

### Success Criteria:

#### Automated Verification:

- Mechanics tests verify each engine level's normal speed and verify Lv1 speed remains in recovery, impact, Moolaris, and boost paths.
- Mechanics tests verify levels 1–10 for projectile count, exact degree offsets, unique IDs, and consecutive-volley ID progression.

#### Manual Verification:

- In a running scene, confirm an upgraded engine feels faster under direct input while boost remains capped at its documented fixed speed.
- Confirm visually that representative even and odd weapon levels fire symmetric spreads without suppressing the normal cadence.

---

## Phase 3: Shipyard projection and landed UI

### Overview

Expose Shipyard state and commands through the existing landing adapter, then add a fourth local dialog view that shares landing behavior and shows unavailable services clearly.

### Changes Required:

#### 1. Shipyard projection and UI port

**Files**: `src/game/application/landedShipyard.ts`, `src/ui/contracts.ts`, `src/ui/adapters/landingStatusAdapter.ts`

**Intent**: Give DOM UI a read-only, typed view of landed ship services and semantic commands for atomic provider updates.

**Contract**: Add `LandedShipyardSnapshot` with landed visibility, planet identity, paused clock, credits, cargo usage/capacity, repair status, each service row, service planet, price, level, and action availability. Extend `LandingStatusPort` with Shipyard snapshot subscription and typed repair/purchase commands; adapter refreshes it with the existing landing projections.

#### 2. Shipyard local dialog view

**Files**: `index.html`, `src/ui/components/landingStatus.ts`, `src/ui/components/displayLabels.ts`, `public/style.css`

**Intent**: Provide the approved landed service experience without creating a Phaser scene or changing launch/landing lifecycle.

**Contract**: Enable Shipyard from every landed hub and add `shipyard` to the component's local view union. Reuse the market/facilities header contract: Back to Planet, paused clock, credits, and cargo. Render repair, three service cards, and booster row; show inactive cards as `Not available` with their assigned planet. Only local services may dispatch commands. Disable repair at full HP or insufficient credits, upgrades at maximum or insufficient credits, and booster after purchase or without credits. Shipyard balances and prices use grouped numerals with no currency-unit suffix; Back returns to the hub without launch.

### Success Criteria:

#### Automated Verification:

- Application/adapter tests prove snapshot refresh after every successful command and correct local service eligibility on all planets.
- DOM tests cover opening and leaving Shipyard, focus behavior, repair/purchase dispatch, disabled states, immediate rendered updates, and unavailable-service messages.
- Type checking passes: `npm.cmd run typecheck`.

#### Manual Verification:

- Land on each planet, open Shipyard, and verify repair is usable while exactly the assigned upgrade path is actionable.
- Confirm a purchase updates credits, HP or level, and the visible control without leaving the landed view.

---

## Phase 4: Focused regression verification

### Overview

Run the narrow automated suites that cover authoritative services, mechanics, UI contracts, and TypeScript integration; then perform one player-facing acceptance pass.

### Changes Required:

#### 1. Focused test coverage and acceptance pass

**Files**: `tests/domain/gameState.test.mjs`, `tests/landing-status.test.mjs`, relevant mechanics test files

**Intent**: Lock down the service, flight, and UI contracts at the lowest effective test level.

**Contract**: Cover state transitions and DOM component behavior with Node tests. Do not add a Playwright test because neither authoritative state transitions nor local fake-port component rendering requires browser-only behavior.

### Success Criteria:

#### Automated Verification:

- The focused domain, mechanics, and UI test groups for modified risks pass.
- `npm.cmd run typecheck` passes after all S-05 changes.

#### Manual Verification:

- Complete a representative repair, one local upgrade on each service planet, and one booster purchase in a browser session.

## Testing Strategy

### Unit and application tests:

- Catalogue limits, prices, planet assignment, repair cap, atomic affordability, and snapshot validation.
- Engine normal-flight multipliers, fixed non-directed speeds, fixed boost speed, volley geometry, and projectile identity.
- Landed projection freshness and UI command routing.

### DOM component tests:

- Shipyard local navigation, focus, action enablement, unavailable service labels, and immediate state rendering.

### Manual testing steps:

1. Open Shipyard on every landed planet and verify repair is available on all of them.
2. Verify Cargo only on Seroton, Engine and booster only on Lactozis-7C, and Weaponary only on Maslo-Prime.
3. Buy representative upgrades and validate the resulting cargo, movement, and projectile behavior in flight.

## Migration Notes

No snapshot migration is introduced. Existing level-one ship status receives the new level-one 40-unit cargo capacity from the balance definition.

## References

- Frame: `context/changes/s05-planet-ship-services/frame.md`
- Research: `context/changes/s05-planet-ship-services/research.md`
- State boundary: `src/game/application/gameStateProvider.ts:24-29`
- Facility purchase pattern: `src/game/application/planetFacilities.ts:50-99`
- Landing UI pattern: `src/ui/components/landingStatus.ts:63-80,266-323`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Ship-service catalogue and landed operations

#### Automated

- [x] 1.1 Catalogue, landed-operation, and rejection-path tests pass — 21cf580
- [x] 1.2 Codec level-bound tests pass — 21cf580

#### Manual

- [ ] 1.3 Service planet assignments are inspected

### Phase 2: Engine and weapon mechanics

#### Automated

- [x] 2.1 Engine normal-flight and fixed non-directed-speed tests pass
- [x] 2.2 Volley count, angle, and ID tests pass

#### Manual

- [ ] 2.3 Upgraded controlled flight and fixed boost speed are verified
- [ ] 2.4 Representative odd and even volleys are visually verified

### Phase 3: Shipyard projection and landed UI

#### Automated

- [ ] 3.1 Shipyard projection and adapter refresh tests pass
- [ ] 3.2 Shipyard DOM interaction and unavailable-service tests pass
- [ ] 3.3 Type checking passes: `npm.cmd run typecheck`

#### Manual

- [ ] 3.4 Shipyard availability and planet-specific actions are verified
- [ ] 3.5 Purchases visibly refresh Shipyard state without launch

### Phase 4: Focused regression verification

#### Automated

- [ ] 4.1 Focused domain, mechanics, and UI suites pass
- [ ] 4.2 Type checking passes after the complete change: `npm.cmd run typecheck`

#### Manual

- [ ] 4.3 Representative repair, all three local upgrades, and booster purchase are completed
