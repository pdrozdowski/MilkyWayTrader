# Anonymous Run Status Implementation Plan

## Overview

Deliver roadmap slice S-01: an anonymous player can explicitly start a new run and read its clock, credits, cargo, hit points, and ship-system status. The status is a semantic DOM panel backed by the authoritative, versioned game-state aggregate.

## Current State Analysis

The main menu already enters the `Game` scene, and the singleton `GameStateProvider` already owns an immutable, codec-validated snapshot. The current schema contains the clock, ship motion, planets, weapon cadence, and projectiles, while the Phaser HUD displays only the clock. Credits, cargo, HP, system levels, and booster availability are absent. Scene creation currently resets the provider, and simulation accepts boost even though the PRD requires a new run to start with the booster locked.

## Desired End State

Selecting `Start New Game` creates a schema-v3 run showing `30:00 · RUNNING`, `100,000 cr`, `Cargo 0 / 20`, and `HP 100 / 100`. An initially collapsed details section exposes empty cargo, level-one Cargo/Engine/Weapon systems as available, and the Booster as locked. Shift cannot activate boost until authoritative state unlocks it. The panel is shown only while `Game` is active, and historical v1/v2 snapshots migrate safely to v3.

### Key Discoveries

- `GameStateProvider` is the sole authoritative state owner and publishes detached readonly snapshots (`src/game/application/gameStateProvider.ts`).
- The codec validates exact root and nested keys, so the aggregate change requires a schema bump and explicit migration (`src/game/application/gameStateCodec.ts`).
- UI components may depend only on UI contracts/components, while Phaser integration belongs in adapters (`tests/architecture.test.mjs`).
- Provider subscriptions are not eager and scene updates publish at frame rate, so the adapter must seed from `getSnapshot()` and deduplicate projected values.

## What We're NOT Doing

- Trading, repairs, upgrade purchases, or unlocking the booster.
- Damage mechanics, terminal run outcomes, or a complete persisted lifecycle model.
- Authentication, backend persistence, or resume.
- Orbit and landing mechanics from S-03.
- Economy balancing beyond configurable S-01 defaults.

## Implementation Approach

Extend the authoritative snapshot with primary run values, derive capacities and display values through pure projection, and migrate historical snapshots forward. Move destructive reset semantics to the explicit new-game action. Feed a semantic DOM component through a typed adapter/port, keeping Phaser and game implementation imports outside the component. Verify each boundary with domain, mechanics, component, and real-application tests, then refresh both architecture graphs.

## Critical Implementation Details

`GameStateProvider.subscribe()` does not emit the current value, while normal simulation publishes around 60 times per second. The run-status adapter must therefore project `getSnapshot()` before subscribing and suppress notifications when the exposed view model is unchanged. Moving reset out of `GameScene.create()` is required before any future resume path can safely enter that scene.

## Phase 1: Authoritative Run State and Rules

### Overview

Introduce the schema-v3 run contract, migrate older snapshots, make new-game reset explicit, and enforce the initial booster lock.

### Changes Required

#### 1. State declarations and balance definitions

**Files**: `src/game/state/`, `src/game/definitions/initialGameState.ts`, new balance definition module

**Intent**: Persist only primary run values while keeping maximum HP, cargo capacity, and other tuning outside the snapshot.

**Contract**: `GameStateSnapshot.schemaVersion` becomes `3` and gains `credits`, `cargo`, and `shipStatus`. `CargoState` contains unique `{ commodityId, quantity }` stacks. `ShipStatusState` contains `currentHitPoints`, `cargoLevel`, `engineLevel`, `weaponLevel`, and `boosterUnlocked`. Defaults are 100000 credits, empty cargo, 100 HP, level-one systems, locked booster, and level-one cargo capacity 20.

#### 2. Codec and provider continuity

**Files**: `src/game/application/gameStateCodec.ts`, `src/game/application/gameStateProvider.ts`

**Intent**: Preserve strict validation, atomic replacement, immutability, and serialization continuity after extending the aggregate.

**Contract**: Decode v3 with exact keys; chain v1→v2→v3; inject S-01 defaults for v2 and force both `boosterUnlocked=false` and `ship.boosting=false`. Credits and quantities are safe non-negative integers, cargo IDs are non-empty and unique, levels are positive integers, and HP is within the configured maximum.

#### 3. New-run ownership and boost rule

**Files**: `src/game/scenes/mainMenuScene.ts`, `src/game/scenes/gameScene.ts`, `src/game/mechanics/gameSimulation.ts`

**Intent**: Ensure only an explicit new-game action destroys current state and align boost behavior with the visible locked status.

**Contract**: `Start New Game` resets the provider before entering `Game`; `GameScene.create()` no longer resets it. Simulation activates boost only when input requests it and `shipStatus.boosterUnlocked` is true. Help text must not advertise an available 5× boost while locked.

### Success Criteria

#### Automated Verification

- Domain state tests cover schema v3, v1/v2 migration, round-trip serialization, invalid values, atomic restore, and immutability: `npm.cmd run test:domain`.
- Mechanics tests prove boost remains inactive while locked and works after unlock: `npm.cmd run test:mechanics`.
- Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual Verification

- Repeated `Start New Game` actions reset the full run, ordinary entry to `Game` does not hide an implicit reset, and Shift does not boost a new run.

**Implementation Note**: After automated checks pass, pause for human confirmation of the manual verification before treating this phase as fully complete.

---

## Phase 2: Semantic DOM Run Status

### Overview

Project authoritative state into a deduplicated UI port and replace the canvas clock with an accessible, responsive, full-width DOM status toolbar.

### Changes Required

#### 1. Pure run-status projection

**Files**: new application selector/view-model module, `src/ui/contracts.ts`

**Intent**: Give presentation code one coherent, read-only status contract without duplicating derived values in persisted state.

**Contract**: `RunStatusSnapshot` exposes visibility, remaining seconds, `RUNNING|PAUSED`, credits, cargo stacks/used/capacity, current/maximum HP, three system levels/availability, and booster availability. Remaining seconds use ceiling and clamp at zero; maximum HP and capacity come from definitions.

#### 2. Phaser adapter and UI composition

**Files**: new run-status adapter, `src/ui/setupUi.ts`

**Intent**: Bridge provider and scene lifecycle events into the UI layer while avoiding frame-rate DOM churn.

**Contract**: `RunStatusPort` provides `getSnapshot()`, `subscribe(listener)`, and `destroy()`. The adapter seeds from `getSnapshot()`, observes provider and scene activity, shows status only for active `Game`, and emits only when projected values change. `setupApplicationUi` mounts and destroys the new component with existing controls.

#### 3. Status component and layout

**Files**: new run-status component, `public/style.css`, `src/game/scenes/gameScene.ts`

**Intent**: Keep critical values continuously readable while allowing secondary detail to remain compact and accessible.

**Layout clarification (supersedes the following single-details-control description)**: The English status UI is a full-width toolbar anchored at the top of the screen. The clock/state is at its far left. The center holds credits, cargo used/capacity, and an HP bar with a text label. A Ship info button on the left and a Cargo button on the right independently control their own initially collapsed detail regions; both use `aria-expanded`. Ship info contains Cargo/Engine/Weapon system levels and availability plus booster availability. Cargo contains cargo contents. Only these two buttons accept pointer input; the toolbar itself remains non-blocking.

**Contract**: The English panel always displays clock/state, credits, cargo used/capacity, and HP. An initially collapsed button with `aria-expanded` reveals `Cargo contents: Empty`, Cargo/Engine/Weapon `Level 1 · Available`, and `Booster: Locked`. Expansion is presentation-only. The countdown is not `aria-live`; only the details button accepts pointer input. Remove the duplicate Phaser clock and avoid collisions with fullscreen, audio, exit, and landing controls in desktop and touch layouts.

### Success Criteria

#### Automated Verification

- Projection tests cover 30:00, millisecond boundaries, zero clamp, multiple pause reasons, credit formatting inputs, capacity, and empty cargo.
- Component tests cover independently collapsed/expanded Ship info and Cargo controls, toolbar rendering, HP-bar updates, visibility, cleanup, and listener stability.
- Real-application tests pass in desktop and touch projects: `npm.cmd run test:ui`.
- Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual Verification

- The full-width toolbar remains readable without blocking flight controls in desktop and touch layouts; Ship info and Cargo controls expand independently; blur shows `PAUSED` with stable time and focus resumes `RUNNING` countdown.

**Implementation Note**: After automated checks pass, pause for human confirmation of the manual verification before treating this phase as fully complete.

---

## Phase 3: End-to-End Validation and Architecture Artifacts

### Overview

Complete real-user acceptance coverage, regenerate architecture artifacts, and run the repository-wide gates.

### Changes Required

#### 1. Application acceptance coverage

**Files**: `tests/ui/applicationUiTest.ts`, UI harness/component tests as required

**Intent**: Verify player-visible S-01 behavior through stable semantic selectors while preserving the existing input and error smoke coverage.

**Contract**: Tests start a new game, assert every initial primary value, expand and assert details, exercise blur/focus pause behavior, verify the status is absent outside `Game`, and retain page-error and flight-input checks in desktop and touch projects.

#### 2. Generated architecture contracts

**Files**: `context/foundation/code-graph.json`, `context/foundation/data-logical-diagram.md`

**Intent**: Keep the recorded dependency and persisted-data contracts synchronized with the new state and UI boundaries.

**Contract**: Regenerate both artifacts with project scripts, validate the logical diagram with `--check`, and leave no `REFACTOR_REQUIRED` finding.

### Success Criteria

#### Automated Verification

- Code graph and logical data diagram regenerate and validate without `REFACTOR_REQUIRED`.
- Full unit, architecture, and Playwright suite passes: `npm.cmd run test:project`.
- Production build and both TypeScript projects pass: `npm.cmd run build-nolog` and `npm.cmd run typecheck`.

#### Manual Verification

- Menu → New Game → status → expand → pause/resume works without regressions to flight controls, audio, or fullscreen.

## Testing Strategy

### Unit Tests

- Validate schema-v3 boundaries, migrations, restore atomicity, immutability, and serialization round trips.
- Exercise boost gating for locked and unlocked state.
- Exercise pure status projection and component subscription/render lifecycle.

### Integration Tests

- Use Playwright role and visible-text selectors for the run-status toolbar, separate Ship info and Cargo controls, and HP bar.
- Verify desktop and touch projects, pause/resume behavior, scene visibility, and absence of browser errors.

### Manual Testing Steps

1. Start from the menu and verify the exact initial critical values.
2. Independently expand Ship info and Cargo; verify level-one systems and locked booster in Ship info, then empty cargo in Cargo.
3. Hold Shift during flight and confirm no boost effect.
4. Blur and refocus the page; confirm time pauses and resumes.
5. Check desktop and touch layouts alongside audio/fullscreen controls.

## Performance Considerations

Provider updates may occur every frame, but the DOM port must publish only when an exposed value changes. The seconds display should therefore update at most once per displayed second except for immediate state/visibility changes.

## Migration Notes

Schema v1 first follows the existing spatial-state migration to v2, then v2 receives the S-01 defaults and becomes v3. Historical boosting is cleared because migrated runs must obey the same locked-booster contract as new runs. Invalid input must leave the provider's current snapshot unchanged.

## References

- Product contract: `context/foundation/prd.md`
- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- Architecture: `context/foundation/architecture.md`
- Testing policy: `context/foundation/testing.md`
- State boundary: `src/game/state/AGENTS.md`
- Existing codec/provider: `src/game/application/gameStateCodec.ts`, `src/game/application/gameStateProvider.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Authoritative Run State and Rules

#### Automated

- [x] 1.1 Domain state tests cover schema v3, v1/v2 migration, round-trip serialization, invalid values, atomic restore, and immutability — 0355cc0
- [x] 1.2 Mechanics tests prove boost remains inactive while locked and works after unlock — 0355cc0
- [x] 1.3 Production and test TypeScript projects compile — 0355cc0

#### Manual

- [x] 1.4 Repeated New Game resets the run, ordinary Game entry does not reset implicitly, and Shift does not boost a new run — 0355cc0

### Phase 2: Semantic DOM Run Status

#### Automated

- [x] 2.1 Projection tests cover clock boundaries, pause reasons, credits, capacity, and empty cargo
- [x] 2.2 Component tests cover collapsed and expanded rendering, updates, visibility, cleanup, and listener stability
- [x] 2.3 Real-application tests pass in desktop and touch projects
- [x] 2.4 Production and test TypeScript projects compile

#### Manual

- [x] 2.5 The panel is readable and non-blocking in both layouts, and blur/focus pauses and resumes the visible clock

### Phase 3: End-to-End Validation and Architecture Artifacts

#### Automated

- [ ] 3.1 Code graph and logical data diagram regenerate and validate without REFACTOR_REQUIRED
- [ ] 3.2 Full unit, architecture, and Playwright suite passes
- [ ] 3.3 Production build and both TypeScript projects pass

#### Manual

- [ ] 3.4 Complete menu-to-status interaction works without regressions to flight, audio, or fullscreen
