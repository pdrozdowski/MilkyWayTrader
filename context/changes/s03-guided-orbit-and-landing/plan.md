# Guided Orbit and Landing Implementation Plan

## Overview

Deliver the S-03 navigation loop: advisory route guidance near moving planets, automatic orbit capture that preserves manual steering, manual centre-entry landing, and an explicit launch back into flight.

## Current State Analysis

The simulation already advances direct flight and deterministic planet positions from the shared active clock. Planet proximity currently renders only a `LAND ON` presentation cue; the snapshot, codec, simulation input, and DOM UI contain no orbit or landed lifecycle.

## Desired End State

For each configured planet, a player can see nearby navigation information, enter its capture zone, retain direct flight while following the planet's displacement, manually land from orbit, and explicitly launch. Landing pauses the shared clock and disables boost/fire; launch resumes the clock and requires leaving the physical planet radius before another landing can occur.

### Key Discoveries:

- `advanceGameSimulation` is the authoritative seam for active-time movement and currently returns without movement while paused (`src/game/mechanics/gameSimulation.ts:65`).
- `planetLandingRadius` supplies an existing tested proximity threshold suitable for capture (`src/game/mechanics/planet/proximity.ts:4`).
- `GameStateProvider` and the strict codec own atomic authoritative-state replacement (`src/game/application/gameStateProvider.ts:19`, `src/game/application/gameStateCodec.ts:84`).
- Existing UI pause tests and historical S-02 review require clearing held flight intent when modal state changes (`tests/ui/applicationUiTest.ts:129`, `context/archive/2026-09-23-s02-direct-moving-system-flight/reviews/impl-review-phase-5.md:34`).

## What We're NOT Doing

- No markets, prices, cargo transactions, repairs, upgrades, or usable shipyard actions.
- No destination selection, waypoint navigation, autopilot, gravity, or scripted orbit path.
- No snapshot migration for older schemas, persistent storage, or save integration.
- No planet collision damage or unrelated hazards/combat changes.

## Implementation Approach

Keep lifecycle values in the JSON-safe snapshot and transition them through pure mechanics. Treat routes and visible labels as derived data. The scene stays an adapter: it gathers direct input, emits landing/launch intent, clears transient held intent across the modal boundary, and reconciles projections. Presentation never writes gameplay state.

## Critical Implementation Details

The simulation must update planet positions before deriving capture displacement, then apply that displacement to a captured ship without altering its player-controlled velocity, heading, or target. On the landing transition, the clock pause reason and modal state must commit in the same provider update; launch must remove only `landed`, preserving any independent pause reason.

## Phase 1: Orbit, Landing, and Launch Lifecycle

### Overview

Add the authoritative lifecycle and the complete manual landing/start interaction, preserving direct flight and the shared active-time contract.

### Changes Required:

#### 1. Snapshot schema, initial state, and codec

**Files**: `src/game/state/`, `src/game/definitions/initialGameState.ts`, `src/game/application/gameStateCodec.ts`

**Intent**: Represent captured orbit, landed planet, and post-launch relanding lock as persistable state so restore and simulation have a single source of truth.

**Contract**: Advance the schema to v4; add JSON-safe planet identity/lifecycle fields with mutually consistent invariants; update initial state and exact codec validation. Reject legacy v3 shapes without migration.

#### 2. Pure orbit and landing mechanics

**Files**: `src/game/mechanics/planet/`, `src/game/mechanics/gameSimulation.ts`, `src/game/mechanics/clock/`

**Intent**: Make capture, detach, landing, and launch deterministic active-time transitions rather than Phaser behavior.

**Contract**: Enter capture automatically inside `planetLandingRadius`; while captured, add the planet's tick displacement to the ship but preserve direct velocity/heading/target. Detach after leaving that zone. Permit landing only for the captured planet at centre distance ≤50 px. Landing adds `landed`; launch removes it, clears transient flight intent through the adapter, disables the relevant landing state, and blocks relanding until ship-centre distance exceeds the configured planet definition radius. While landed, boost/fire intents cannot affect simulation.

#### 3. Scene, planet projection, and landed status modal

**Files**: `src/game/scenes/gameScene.ts`, `src/game/objects/planet/planet.ts`, `src/ui/`

**Intent**: Let the player see capture/start states and perform the lifecycle without hiding control state or introducing future trading UI.

**Contract**: Wire a manual centre-entry landing intent and an explicit semantic `LAUNCH` modal action. The modal names the planet, confirms paused time, and labels market/shipyard access as deferred. Mark interactive UI with `data-game-input="ignore"`; on modal transitions clear held gameplay input. Update planet-local rings/labels to distinguish available orbit, landed, and relaunch-lock states. The modal is not dismissible by backdrop or an ambiguous close control.

### Success Criteria:

#### Automated Verification:

- Mechanics/state tests cover capture at the boundary, manual detach, inherited displacement, landing at 50 px, blocked landing outside capture, launched relanding lock, boost/fire suppression while landed, pause composition, immutability, JSON round-trip, and v4 codec rejection cases.
- Architecture tests, `npm.cmd run typecheck`, and `npm.cmd run build-nolog` pass after the new state/UI contracts are added.

#### Manual Verification:

- In the browser, fly into a planet's capture zone and confirm steering remains manual while the ship follows that planet's movement.
- Manually fly to the centre, confirm the modal pauses the clock and the explicit `LAUNCH` action resumes it; then leave the planet radius and confirm landing becomes available again.

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual lifecycle checks before Phase 2.

## Phase 2: Advisory Route Guidance

### Overview

Render useful route guidance in the world without adding steering, target selection, or persistent presentation state.

### Changes Required:

#### 1. Derived route-geometry mechanics

**Files**: `src/game/mechanics/planet/`, `src/game/definitions/`

**Intent**: Calculate the information the player needs to choose an interception direction from present authoritative positions and configured normal ship speed.

**Contract**: Define a 100 px radial guidance band and 200 km-per-world-pixel display scale. For the closest eligible planet, project the ship onto that planet's orbit and derive CW and CCW route distances accounting for current planet motion at normal unboosted speed. Provide equality tolerance so neither route is preferred when effectively equal. These functions return derived values and do not mutate state.

#### 2. World guidance projection

**Files**: `src/game/scenes/gameScene.ts`, `src/game/effects/` or `src/game/visual/`, `src/game/objects/planet/planet.ts`

**Intent**: Make the advisory route visible without cluttering remote flight or conflicting with captured/landed states.

**Contract**: Render the complete selected orbit as a subtle dashed line with the planet name while inside its 100 px band. Show both CW and CCW distances in km near the guide, emphasize the shorter value, and omit emphasis on equality. Hide the guide after capture or on leaving the band; when bands overlap, show the closest eligible planet. Reuse display-label constants for visible text.

### Success Criteria:

#### Automated Verification:

- Mechanics tests cover guidance-band boundaries, closest-planet selection, both directional distances, 200 km conversion, equal-route presentation state, planet-motion prediction, paused-time stability, and input/state immutability.
- UI/browser tests cover guide visibility at the band boundary, distance labels, shorter-route emphasis, hide-on-capture behavior, and unchanged direct-flight input; `npm.cmd run test:project`, `npm.cmd run typecheck`, and `npm.cmd run build-nolog` pass.

#### Manual Verification:

- In the browser, approach each orbital path and confirm a subtle dashed guide, readable CW/CCW km values, and only the shorter route emphasis; leave or capture the orbit and confirm the guide disappears.
- Confirm the guide never moves the ship, changes its heading, or changes boost/fire behavior during direct flight.

**Implementation Note**: After automated verification passes, pause for the human to confirm manual guidance behavior.

## Testing Strategy

### Unit Tests:

- Test all transition thresholds and invalid lifecycle combinations in pure mechanics, state, and codec tests.
- Compare uninterrupted and restored orbit/planet simulation while excluding transient held input and presentation effects.
- Test route derivation with normal speed, moving planets, overlap selection, equality, and kilometre conversion.

### Integration Tests:

- Use Playwright to validate a real booted run, modal pause/resume, semantic `LAUNCH` control, and route-label rendering.

### Manual Testing Steps:

1. Fly manually through capture, landing, launch, physical-radius exit, and a second landing for each planet.
2. Test keyboard/mouse and touch-sized browser input around the modal; held flight input must not leak through `LAUNCH`.
3. Approach overlapping orbits and inspect that one closest guide is shown without automatic movement.

## Performance Considerations

Route geometry is derived only for the closest eligible planet and is not stored in snapshots. Reuse cached Phaser graphics where possible; do not create a new graphics object each frame.

## Migration Notes

The snapshot advances from schema v3 to v4. No migration is added because persistent saves are out of scope and the project lesson prohibits premature snapshot migrations; the codec rejects old persisted shapes.

## References

- Research: `context/changes/s03-guided-orbit-and-landing/research.md`
- Product contract: `context/foundation/prd.md:251`
- State architecture: `context/foundation/architecture.md:24`
- Existing simulation: `src/game/mechanics/gameSimulation.ts:58`
- Existing proximity seam: `src/game/mechanics/planet/proximity.ts:4`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Orbit, Landing, and Launch Lifecycle

#### Automated

- [ ] 1.1 Lifecycle mechanics boundary and transition verification
- [ ] 1.2 Snapshot, codec, architecture, typecheck, and build verification

#### Manual

- [ ] 1.3 Manual capture and direct-steering verification
- [ ] 1.4 Manual landing, launch, pause, and relanding verification

### Phase 2: Advisory Route Guidance

#### Automated

- [ ] 2.1 Route-geometry boundary and derived-distance verification
- [ ] 2.2 UI/browser, project-test, typecheck, and build verification

#### Manual

- [ ] 2.3 Manual route visibility and route-emphasis verification
- [ ] 2.4 Manual no-autopilot behavior verification
