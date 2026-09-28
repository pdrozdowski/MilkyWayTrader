# Guided Orbit and Landing Implementation Plan

## Overview

Deliver the S-03 navigation loop: permanent static orbital paths for moving planets, automatic orbit capture that preserves manual steering, automatic centre-entry landing, and an explicit launch back into flight.

## Current State Analysis

The simulation already advances direct flight and deterministic planet positions from the shared active clock. Planet proximity currently renders only a `LAND ON` presentation cue; the snapshot, codec, simulation input, and DOM UI contain no orbit or landed lifecycle.

## Desired End State

For each configured planet, a player can see its permanent dashed orbital path, enter its capture zone, retain direct flight while following the planet's displacement, manually land from orbit, and explicitly launch. Landing pauses the shared clock and disables boost/fire; launch resumes the clock and requires leaving the physical planet radius before another landing can occur.

### Key Discoveries:

- `advanceGameSimulation` is the authoritative seam for active-time movement and currently returns without movement while paused (`src/game/mechanics/gameSimulation.ts:65`).
- `planetLandingRadius` supplies an existing tested proximity threshold suitable for capture (`src/game/mechanics/planet/proximity.ts:4`).
- The three configured planet orbits are fixed circles around the Moolaris origin, so their paths can be drawn once without snapshot or per-frame calculation (`src/game/definitions/planetDefinitions.ts:16`, `src/game/mechanics/planet/orbit.ts:5`).
- Existing UI pause tests and historical S-02 review require clearing held flight intent when modal state changes (`tests/ui/applicationUiTest.ts:129`, `context/archive/2026-09-23-s02-direct-moving-system-flight/reviews/impl-review-phase-5.md:34`).

## What We're NOT Doing

- No markets, prices, cargo transactions, repairs, upgrades, or usable shipyard actions.
- No destination selection, waypoint navigation, autopilot, gravity, or scripted orbit path.
- No snapshot migration for older schemas, persistent storage, or save integration.
- No planet collision damage or unrelated hazards/combat changes.

## Implementation Approach

Keep lifecycle values in the JSON-safe snapshot and transition them through pure mechanics. The scene owns the static orbital-path projection, gathers direct input, emits landing/launch intent, clears transient held intent across the modal boundary, and reconciles moving projections. Presentation never writes gameplay state.

## Critical Implementation Details

The simulation must update planet positions before deriving capture displacement, then apply that displacement to a captured ship without altering its player-controlled velocity, heading, or target. On the landing transition, the clock pause reason and modal state must commit in the same provider update; launch must remove only `landed`, preserving any independent pause reason. Static orbital paths must be created once and never rebuilt from the scene update loop.

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

**Contract**: Enter capture automatically inside `planetLandingRadius`; while captured, add the planet's tick displacement to the ship but preserve direct velocity/heading/target. Detach after leaving that zone. Land automatically for the captured planet at centre distance ≤35 px. Landing adds `landed`; launch removes it, clears transient flight intent through the adapter, disables the relevant landing state, and blocks relanding until ship-centre distance exceeds the configured planet definition radius. While landed, boost/fire intents cannot affect simulation.

#### 3. Scene, planet projection, and landed status modal

**Files**: `src/game/scenes/gameScene.ts`, `src/game/objects/planet/planet.ts`, `src/ui/`

**Intent**: Let the player see capture/start states and perform the lifecycle without hiding control state or introducing future trading UI.

**Contract**: Wire automatic centre-entry landing at 35 px and an explicit semantic `LAUNCH` modal action. The modal names the planet, confirms paused time, and labels market/shipyard access as deferred. Mark interactive UI with `data-game-input="ignore"`; on modal transitions clear held gameplay input. Update planet-local rings/labels to distinguish available orbit, landed, and relaunch-lock states. The modal is not dismissible by backdrop or an ambiguous close control.

### Success Criteria:

#### Automated Verification:

- Mechanics/state tests cover capture at the boundary, manual detach, inherited displacement, automatic landing at 35 px, blocked landing outside capture, launched relanding lock, boost/fire suppression while landed, pause composition, immutability, JSON round-trip, and v4 codec rejection cases.
- Architecture tests, `npm.cmd run typecheck`, and `npm.cmd run build-nolog` pass after the new state/UI contracts are added.

#### Manual Verification:

- In the browser, fly into a planet's capture zone and confirm steering remains manual while the ship follows that planet's movement.
- Fly to the centre, confirm automatic landing pauses the clock and the explicit `LAUNCH` action resumes it; then leave the planet radius and confirm landing becomes available again.

**Implementation Note**: After automated verification passes, pause for the human to confirm the manual lifecycle checks before Phase 2.

## Phase 2: Permanent Static Orbital Paths

### Overview

Render permanent visual orbital paths without adding steering, target selection, route calculations, or persistent presentation state.

### Changes Required:

#### 1. Product contract update

**Files**: `context/foundation/prd.md`

**Intent**: Align the product contract with the simplified permanent orbital-path navigation aid.

**Contract**: Replace US-02's proximity-only route guidance and BR-021 through BR-029 with a capability to see all configured planetary orbital paths as permanent, dashed visual references. Remove direction, ETA, route-selection, guidance-band, proximity-visibility, and capture-visibility requirements. Preserve the direct-control guardrail and the distinct moving-planet, capture, landing, and launch rules. Validate the PRD with `10x-prd-en-capability` before Phase 2 implementation proceeds.

#### 2. Static orbit-path geometry

**Files**: `src/game/visual/` or `src/game/effects/`, `src/game/definitions/`

**Intent**: Define reusable, presentation-only geometry for the three configured circular orbit paths without deriving runtime route information.

**Contract**: Produce complete circular dash segments centered on Moolaris for each configured orbit radius, with 50 px visible arc length followed by a 10 px gap; the final segment may be shorter to close the circumference. The geometry consumes definitions only, accepts no game state, and creates no Phaser objects.

#### 3. World orbital-path projection

**Files**: `src/game/scenes/gameScene.ts`, `src/game/effects/` or `src/game/visual/`

**Intent**: Make each planet's orbital path continuously visible as a quiet world reference while leaving gameplay and planet-local lifecycle presentation untouched.

**Contract**: Create one scene-owned world `Graphics` projection during scene creation, render all configured dash segments once at a depth below planets and above the asteroid belt, and never clear or redraw it from `update`. Keep it visible during direct flight, capture, landing, launch, paused time, and overlapping paths. Destroy it on scene shutdown. Do not add labels, ETA/CW/CCW text, input handling, or state writes.

### Success Criteria:

#### Automated Verification:

- The PRD capability validator passes after the orbital-path contract changes. Unit tests cover the fixed Moolaris centre, each configured radius, complete circumference coverage, and the 50 px visible / 10 px gap dash pattern within floating-point tolerance.
- Browser tests cover all three paths immediately after boot and through capture, landing, and launch; they assert no ETA, CW/CCW, route emphasis, or proximity visibility behavior. `npm.cmd run test:project`, `npm.cmd run typecheck`, and `npm.cmd run build-nolog` pass.

#### Manual Verification:

- In the browser, confirm all three paths are visible from boot and retain the 50 px visible / 10 px gap pattern while the camera moves; profile normal flight and confirm the one-time Graphics command buffer causes no visible frame-time regression.
- Capture, land on, and launch from a planet; confirm the paths remain visible and never move the ship, change its heading, or change boost/fire behavior.

**Implementation Note**: After automated verification passes, pause for the human to confirm manual permanent-path behavior.

## Testing Strategy

### Unit Tests:

- Test all transition thresholds and invalid lifecycle combinations in pure mechanics, state, and codec tests.
- Compare uninterrupted and restored orbit/planet simulation while excluding transient held input and presentation effects.
- Test static orbit-path dash geometry for all configured radii, including circumference closure and fractional final dashes.

### Integration Tests:

- Use Playwright to validate a real booted run, modal pause/resume, semantic `LAUNCH` control, and permanent orbital-path rendering.

### Manual Testing Steps:

1. Fly manually through capture, landing, launch, physical-radius exit, and a second landing for each planet.
2. Test keyboard/mouse and touch-sized browser input around the modal; held flight input must not leak through `LAUNCH`.
3. Inspect all three paths during normal flight and lifecycle transitions; confirm no route text or automatic movement appears.

## Performance Considerations

The three configured orbit paths are generated once into one scene-owned Graphics command buffer and are never rebuilt per frame. If profiling finds a regression, evaluate a baked-texture fallback after checking supported-device texture-size limits; do not pre-emptively add that fallback.

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

- [x] 1.1 Lifecycle mechanics boundary and transition verification
- [x] 1.2 Snapshot, codec, architecture, typecheck, and build verification

#### Manual

- [x] 1.3 Manual capture and direct-steering verification
- [x] 1.4 Manual landing, launch, pause, and relanding verification

### Phase 2: Permanent Static Orbital Paths

#### Automated

- [x] 2.1 PRD capability and static orbit-path geometry verification
- [x] 2.2 UI/browser permanent-path, project-test, typecheck, and build verification

#### Manual

- [x] 2.3 Manual permanent-path visibility and performance verification
- [x] 2.4 Manual no-autopilot behavior verification
