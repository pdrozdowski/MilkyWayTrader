# Smooth Salvage Motion, Deterministic Cargo Drops, and Debug Spawn Implementation Plan

## Overview

Make salvage movement visually smooth without moving gameplay truth into Phaser,
guarantee one cargo drop in every seeded five-kill small-asteroid cycle, expose
debug cargo, and evolve orbital cargo into a capacity-limited multi-commodity
container with usable transfer controls and distinct spilled items.

## Current State Analysis

- Loose commodity projection calls `SceneObject.setPosition()` for every
  snapshot update; that also synchronizes its dynamic Arcade body. Asteroids
  are rendered without an Arcade body and do not have the same conflict.
- `spawnAsteroidLoot()` currently owns one random 10% cargo / 10% loose / 80%
  empty outcome. The snapshot has no cargo guarantee schedule.
- `GameStateSnapshot` and its strict codec own all deterministic run truth;
  initial state is seeded through `randomState`.
- The DOM debug menu sends events to `Game`, which commits state through its
  provider and then reconciles presentation objects.

## Desired End State

Loose items render smoothly from authoritative positions and begin at 126
units/second. The first eligible kill of each five-kill cycle creates a seeded
five-entry zero table and places one `1` at a seeded index: that `1` guarantees orbital cargo and every `0`
still has its existing 10% loose-commodity chance. The debug menu can create a
normal zero-cost cargo container 100px in front of the ship for manual tests.

### Key Discoveries

- `src/game/objects/_shared/sceneObject.ts` re-synchronizes a dynamic Arcade
  body whenever a projection calls `setPosition()`.
- `src/game/mechanics/salvage/asteroidLoot.ts` is the deterministic terminal
  small-asteroid loot boundary.
- `src/ui/setupUi.ts` and `src/game/scenes/gameScene.ts` establish the debug
  action-to-state-update convention.

## What We're NOT Doing

- Adding Phaser-owned physics, collision truth, or interpolation state to
  loose commodities.
- Migrating old snapshots; the new schema rejects them.
- Changing cargo quantity range, commodity odds, cargo durability, or loose
  chance on a non-cargo schedule slot.
- Adding Playwright coverage or exposing the debug action outside the existing
  debug menu.

## Implementation Approach

First revise the S09 capability contract and add schema-validated, seeded loot
schedule state at the same boundary that resolves terminal asteroid hits. Then
make loose commodity rendering presentation-only and connect a debug-menu
intent that creates standard cargo through state. Finish with focused state,
mechanics, object, and DOM-controller verification.

## Critical Implementation Details

The schedule advances only on a final small-asteroid projectile destruction;
all other asteroid removals leave it intact. On the first eligible kill of a cycle, create a fresh
five-entry zero table, choose one marker index from the persisted RNG, and store the resulting RNG state with
the snapshot. The debug spawn must likewise consume persisted RNG for its
commodity and 1–20 quantity so restored and uninterrupted runs agree.

## Phase 1: Deterministic Cargo Schedule and Salvage Contract

### Overview

Replace unbounded cargo chance with state-backed five-kill scheduling while
preserving the existing loose-item probability on non-cargo slots.

### Changes Required

#### 1. Product and snapshot contract

**Files**: `context/foundation/prd.md`, `src/game/state/gameStateSnapshot.ts`,
`src/game/definitions/initialGameState.ts`, `src/game/application/gameStateCodec.ts`.

**Intent**: Update the salvage capability to describe the guaranteed cargo
cycle, then make its remaining sequence explicit JSON-safe run state.

**Contract**: Bump the schema; `GameStateSnapshot` contains the unconsumed
binary cargo schedule. Initial state starts with no allocated cycle; the first eligible kill produces one seeded cycle from `randomState`. Codec validation accepts exactly
the expected binary shape and rejects prior schemas; do not add migration.

#### 2. Loot transition and focused coverage

**Files**: `src/game/mechanics/salvage/asteroidLoot.ts`,
`src/game/mechanics/gameSimulation.ts`, `tests/domain/gameState.test.mjs`,
`tests/game-mechanics.test.mjs`.

**Intent**: Consume schedule entries only at the eligible loot boundary and
preserve seeded replay behavior.

**Contract**: A `1` produces cargo, then normal RNG selects its commodity and
quantity. A `0` runs the current 10% loose-item decision without allowing
cargo. After the fifth eligible kill, a newly seeded shuffled cycle is stored
before the next eligible decision. Non-projectile and non-small-asteroid
removals never consume an entry.

### Success Criteria

#### Automated Verification

- State tests round-trip the schedule, reject old schemas and prove initial
  cycles contain exactly one cargo marker.
- Seeded mechanics tests prove exactly one cargo in every five eligible kills,
  preserve 10% loose chance in zero slots, and leave the schedule unchanged for
  ineligible removals.
- PRD capability validation has no deterministic or semantic findings.

#### Manual Verification

- Replaying the same seed reproduces schedule order, cargo contents and loose
  outcomes across cycle boundaries.

## Phase 2: Smooth Projection, Tuned Ejection, and Debug Cargo Intent

### Overview

Remove the projection-level source of visual hitching and expose a normal,
state-backed cargo container for manual validation.

### Changes Required

#### 1. Loose commodity rendering and tuning

**Files**: `src/game/objects/commodity/`, `src/game/definitions/gameplayTuning.ts`,
`tests/object-scaffold.test.mjs`, `tests/game-mechanics.test.mjs`.

**Intent**: Let authoritative simulation remain the sole owner of loose-item
coordinates while Phaser only displays them without dynamic-body correction.

**Contract**: Preserve a 20px gameplay interaction radius in mechanics, but
do not attach or update a dynamic Arcade body for the commodity projection.
Set `looseItemEjectionSpeed` to `126`; preserve sun-vector blending and active
time semantics.

#### 2. Debug-menu cargo spawn

**Files**: `index.html`, `src/ui/components/displayLabels.ts`,
`src/ui/setupUi.ts`, `src/game/scenes/gameScene.ts`, and a pure debug/salvage
state helper with focused tests.

**Intent**: Allow manual salvage testing without waiting for combat loot.

**Contract**: The existing debug menu emits a dedicated scene event. The scene
commits a state transition that creates cargo at `ship.position + heading *
100`, derives valid orbital fields from that position, assigns zero cost and
standard HP, and uses the persisted RNG for a uniformly chosen commodity plus
quantity 1–20. The button text is defined in shared display labels.

### Success Criteria

#### Automated Verification

- Object tests prove commodity synchronization does not create or update an
  Arcade body and retains projection cleanup.
- Mechanics tests prove the 126 initial velocity and unchanged active-time
  blend behavior.
- DOM/scene tests prove the debug action creates one valid state-backed cargo
  exactly 100px forward, with deterministic random contents and no Phaser-only
  mutation.
- `npm.cmd run test:objects`, `npm.cmd run test:mechanics`, and
  `npm.cmd run typecheck` pass.

#### Manual Verification

- Loose items move smoothly while the ship camera tracks them.
- The debug button creates nearby cargo that opens through the normal transfer
  flow, can be damaged, and spills normally.

## Phase 3: Integrated Validation

### Overview

Verify the changed salvage contract across state, mechanics, rendering, and
debug controls without expanding to browser E2E.

### Changes Required

#### 1. Focused regression validation

**Files**: affected Node test suites only.

**Intent**: Prove that deterministic schedule state, presentation ownership,
and debug behavior work together under the project’s fast validation boundary.

**Contract**: Retain focused lower-level coverage; do not add Playwright tests.

### Success Criteria

#### Automated Verification

- `npm.cmd run test:domain`, `npm.cmd run test:mechanics`, and
  `npm.cmd run test:objects` pass.
- `npm.cmd run typecheck` and `npm.cmd run test:fast` pass.

#### Manual Verification

- Over ten small-asteroid projectile kills, cargo appears exactly twice—once
  in each five-kill cycle—while zero slots can still yield loose commodities.
- Cargo spawned from Debug is visible 100px ahead of the ship and loose-item
  motion is smooth during normal camera movement.

## Phase 4: Multi-Commodity Cargo, Transfer Controls, and Distinct Spills

### Overview

Replace the single-stack orbital-cargo contract with a persisted 20-unit
multi-commodity manifest, make its transfer modal useful for every relevant
commodity, and remove presentation behavior that makes cargo and its spills
appear incorrect.

### Changes Required

#### 1. Product contract and authoritative cargo manifest

**Files**: `context/foundation/prd.md`, `src/game/state/orbitalCargoState.ts`,
`src/game/application/gameStateCodec.ts`, `src/game/definitions/gameplayTuning.ts`,
`src/game/mechanics/salvage/asteroidLoot.ts`,
`src/game/mechanics/debug/spawnDebugCargo.ts`.

**Intent**: Let every orbital container own multiple independent commodity
stacks while enforcing a visible, fixed capacity of 20 units.

**Contract**: Replace the singular orbital `container` with a JSON-safe,
non-empty manifest of unique positive-quantity commodity stacks whose total
quantity is at most 20. Bump the snapshot schema and reject v14 snapshots; do
not migrate them. Cargo and debug generation create valid manifests. Update the
salvage capability and business rules without leaking UI implementation details,
then pass the PRD English-capability gate.

#### 2. Exact transfer and deterministic spill reducers

**Files**: `src/game/application/salvageInteractions.ts`,
`src/game/mechanics/salvage/cargoDamage.ts`,
`src/game/mechanics/gameSimulation.ts`, focused domain/mechanics tests.

**Intent**: Transfer a chosen commodity and amount atomically in either
direction, then produce independently collectible loose items when cargo is
destroyed.

**Contract**: Transfers accept `cargoId`, `commodityId`, exact quantity, and
direction. One-unit actions move one; max actions move the largest legal amount
bounded by source quantity and receiving capacity. Remove orbital cargo only
when its manifest is empty. Centralize destruction/spill generation so every
manifest unit becomes a unique loose item with deterministic distinct
authoritative position and velocity; preserve per-stack proportional cost and
set spill speed to 126. Non-projectile cargo damage and normal pickup rules
remain unchanged.

#### 3. Cargo projection and transfer modal

**Files**: `src/game/objects/cargo/`, `src/ui/contracts.ts`,
`src/ui/adapters/cargoTransferAdapter.ts`, `src/ui/components/cargoTransfer.ts`,
`public/style.css`, focused object/UI tests.

**Intent**: Present cargo as a smooth visual projection and give the player a
clear, compact inventory-to-inventory transfer view.

**Contract**: Cargo projection has no dynamic Arcade body or decorative orbit
ring; projectile collision remains an authoritative mechanic. The modal renders
the union of cargo and ship commodity IDs as rows, showing each commodity's
cargo and ship quantity plus cargo usage as `used / 20`. Each row has
cargo-to-ship max/one and ship-to-cargo one/max controls. Do not show average
price. Reuse shared display-label constants for all new visible text and keep
cleanup idempotent.

### Success Criteria

#### Automated Verification

- Codec and state tests round-trip valid manifests; reject old schemas,
  duplicate/unknown IDs, zero stacks, over-capacity cargo, and malformed
  manifests.
- Domain and mechanics tests prove exact one/max transfers, capacity boundaries,
  atomic failures, empty-manifest removal, cost preservation, deterministic
  distinct spills, and 126 spill speed.
- Object and UI-component tests prove cargo has no projection physics/ring and
  the modal renders commodity rows, `used / 20`, and correct directional
  commands without average-price text.
- PRD capability validation, `npm.cmd run test:domain`, `npm.cmd run
  test:mechanics`, `npm.cmd run test:objects`, `npm.cmd run typecheck`, and
  `npm.cmd run test:fast` pass.

#### Manual Verification

- A mixed cargo container shows each commodity and its cargo/ship counts;
  one/max controls obey both ship and 20-unit orbital limits.
- Cargo has no ring and remains visually smooth while tracked by the camera.
- Destroying mixed cargo releases one spatially separated collectible icon per
  unit at the slower spill speed.

## Phase 5: Asteroid Cargo Spawn Position Regression

### Overview

Keep orbital cargo at the destroyed small asteroid's world position when it is
first inserted into the active-time orbital simulation.

### Changes Required

#### 1. Phase-normalized asteroid cargo initialization

**Files**: `src/game/mechanics/salvage/asteroidLoot.ts`,
`tests/game-mechanics.test.mjs`.

**Intent**: Initialize asteroid-loot cargo with an orbit phase that accounts
for the current active elapsed time, matching the established debug-cargo
convention.

**Contract**: The cargo retains the destroyed asteroid position through its
first call to `advanceOrbitalCargo()`. This changes no snapshot shape, schema,
loot schedule, cargo contents, or later orbit behavior.

### Success Criteria

#### Automated Verification

- A mechanics regression test creates guaranteed cargo at a non-zero active
  time and proves its first orbital update retains the asteroid kill position.
- `npm.cmd run test:mechanics` and `npm.cmd run typecheck` pass.

## Phase 6: Variable Multi-Commodity Cargo Generation

### Overview

Generate compact, deterministic manifests for asteroid and debug cargo.

### Changes Required

#### 1. Shared seeded manifest generator

**Files**: `src/game/mechanics/salvage/cargoManifest.ts`,
`src/game/mechanics/salvage/asteroidLoot.ts`,
`src/game/mechanics/debug/spawnDebugCargo.ts`,
`src/game/definitions/gameplayTuning.ts`, `tests/game-mechanics.test.mjs`.

**Intent**: Give cargo one distinct commodity half the time, two a quarter of
the time, and three a quarter of the time; independently choose one through
five units for each selected commodity.

**Contract**: Both asteroid and debug cargo use persisted run randomness, have
unique zero-cost stacks, and remain within the existing twenty-unit capacity.
No snapshot schema changes are required.

### Success Criteria

#### Automated Verification

- Mechanics tests prove each possible manifest size, unique commodity IDs,
  one-through-five quantities, and deterministic replay.
- `npm.cmd run test:mechanics`, `npm.cmd run typecheck`, and the PRD
  capability validation pass.

## Testing Strategy

Use Node state/codec tests for schema and schedule persistence, mechanics tests
for seeded outcomes and velocity, object tests for projection ownership, and
existing DOM-controller tests for the debug control. These cover the risk more
directly than a browser journey.

## Migration Notes

The new persisted schedule changes the snapshot shape. Bump the schema and
reject earlier versions; no snapshot migration is added before application
maturity.

## References

- Frame brief: `context/changes/salvage-motion-loot-debug/frame.md`
- Existing salvage plan: `context/changes/s09-asteroid-salvage/plan.md`
- State boundary: `src/game/state/gameStateSnapshot.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deterministic Cargo Schedule and Salvage Contract

#### Automated

- [x] 1.1 State tests round-trip the schedule, reject old schemas and prove initial cycles contain exactly one cargo marker.
- [x] 1.2 Seeded mechanics tests prove one cargo per five eligible kills, 10% loose chance in zero slots, and no ineligible consumption.
- [x] 1.3 PRD capability validation has no deterministic or semantic findings.

#### Manual

- [x] 1.4 Fixed-seed replay reproduces schedule, cargo contents and loose outcomes across cycle boundaries.

### Phase 2: Smooth Projection, Tuned Ejection, and Debug Cargo Intent

#### Automated

- [x] 2.1 Object and mechanics tests prove projection ownership, 126 ejection velocity, and active-time blending.
- [x] 2.2 DOM and scene tests prove debug cargo spawns 100px forward with valid deterministic contents.
- [x] 2.3 `npm.cmd run test:objects`, `npm.cmd run test:mechanics`, and `npm.cmd run typecheck` pass.

#### Manual

- [x] 2.4 Loose items move smoothly and debug cargo follows the normal transfer, damage, and spill flows.

### Phase 3: Integrated Validation

#### Automated

- [x] 3.1 `npm.cmd run test:domain`, `npm.cmd run test:mechanics`, and `npm.cmd run test:objects` pass.
- [x] 3.2 `npm.cmd run typecheck` and `npm.cmd run test:fast` pass.

#### Manual

- [x] 3.3 Ten eligible kills produce cargo exactly twice and debug cargo appears 100px ahead during normal camera movement.

### Phase 4: Multi-Commodity Cargo, Transfer Controls, and Distinct Spills

#### Automated

- [x] 4.1 Codec/state and PRD validation prove the v15, capacity-20 manifest contract and old-schema rejection.
- [x] 4.2 Domain/mechanics tests prove commodity-specific one/max transfer, exact capacity boundaries, manifest depletion, and deterministic distinct 126-speed spills.
- [x] 4.3 Object and UI-component tests prove physics/ring removal and row-level transfer controls with no average-price display.
- [x] 4.4 `npm.cmd run test:domain`, `npm.cmd run test:mechanics`, `npm.cmd run test:objects`, `npm.cmd run typecheck`, and `npm.cmd run test:fast` pass.

#### Manual

- [x] 4.5 Mixed cargo transfers, smooth/ring-free cargo projection, and distinct slow spill icons behave as specified.

### Phase 5: Asteroid Cargo Spawn Position Regression

#### Automated

- [x] 5.1 Normalize asteroid-cargo orbit phase at its kill position and prove its first orbital advance preserves that position.

### Phase 6: Variable Multi-Commodity Cargo Generation

#### Automated

- [x] 6.1 Generate deterministic one-, two-, or three-commodity cargo manifests with one-through-five quantities.
