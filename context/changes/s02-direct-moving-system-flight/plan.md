# S-02 Direct Moving-System Flight Implementation Plan

## Overview

Deliver direct flight through a readable, deterministic moving solar system. Planets move from the shared active-time clock, MOO-2187 “Moolaris” safely repels the ship, the world works on desktop and touch screens, and temporary pauses are explicit, composable game state.

## Current State Analysis

The v3 snapshot already owns JSON-safe planet positions and the active clock, while `advanceGameSimulation` advances only the clock, ship, and projectiles. `Game` currently uses one Phaser collider for Moolaris and all planets, fixed-coordinate HUD text, pointer-to-target touch flight, and no reusable pause menu or orientation pause. The display adapter refreshes Phaser scale but does not affect authoritative pause reasons.

## Desired End State

Players can identify Moolaris and three named planets, fly through their active-time circular motion, and safely recover from Moolaris contact without losing control permanently. Desktop and mobile players can pause, use fullscreen, and resume with no active-time advancement during menu, portrait, or background pauses.

### Key Discoveries:

- `advanceGameSimulation` derives `activeDeltaMs` from the authoritative clock and returns immediately while paused (`src/game/mechanics/gameSimulation.ts:61`).
- Planet presentation already synchronizes snapshot positions to Phaser objects (`src/game/objects/planet/planet.ts:51`), while the scene currently couples planet instances by array index (`src/game/scenes/gameScene.ts:58`).
- The existing broad collider includes Moolaris and every planet (`src/game/scenes/gameScene.ts:63`), which conflicts with the requested planet pass-through behavior.
- DOM display controls already refresh scale on viewport/fullscreen changes (`src/ui/adapters/displayAdapter.ts:8`), and UI tests already provide desktop and touch browser projects (`playwrightConfig.ts:21`).

## What We're NOT Doing

- Guidance, orbit capture, landing, launch, or automated travel from S-03.
- Moolaris damage, HP loss, terminal outcomes, asteroid combat, spawning, salvage, or asteroid collisions from S-07 through S-09.
- Snapshot migration or a schema-version increment: this change reuses the existing planet-position shape.
- A destination-selection flow, analog thrust magnitude, or fullscreen-triggered pause.

## Implementation Approach

Keep simulation rules pure and driven solely by `activeElapsedMs`; Phaser and DOM layers reconcile that state and hold only transient input or presentation values. Static definitions supply orbital and visual tuning. The state codec changes only for the two new pause-reason values, while all new pause contributors update the single `GameStateProvider` boundary.

## Critical Implementation Details

Planet motion and all belt animation must derive from active time, not Phaser wall-clock time, so background, portrait, and menu pauses freeze the complete visible system. The Moolaris control lock is geometric rather than timed: it ends only after the ship crosses the configured clearance boundary.

## Phase 1: Deterministic Moving Solar System

### Overview

Introduce stable planet identity and circular orbital projection from active time without changing snapshot schema shape.

### Changes Required:

#### 1. Orbit definitions and pure mechanics

**Files**: `src/game/definitions/`, `src/game/mechanics/planet/`, `src/game/mechanics/gameSimulation.ts`

**Intent**: Define Seroton, Lactozis-7C, and Maslo-Prime as canonical identities with initial phase, orbital radius, and CCW periods of 180, 240, and 300 seconds. Keep every circular orbit as close as possible to Moolaris and its adjacent orbit while maintaining a 50px minimum surface-to-surface radial gap: Seroton clears Moolaris, each following planet clears its predecessor, and no orbital bands overlap. Project their positions exclusively from active elapsed time so an uninterrupted and restored run agree exactly.

**Contract**: A pure planet-position projection accepts the canonical planet identity and active elapsed milliseconds, returns a finite `Vector2State`, and replaces only existing planet `position` values during an active simulation step. Static definitions contain the concrete radii and initial phases; tests enforce the 50px radial surface gap against Moolaris and adjacent planets. No orbit parameters enter `GameStateSnapshot`.

#### 2. State integration and identity-safe scene composition

**Files**: `src/game/definitions/initialGameState.ts`, `src/game/scenes/gameObjects.ts`, `src/game/scenes/gameScene.ts`, `src/game/application/gameStateCodec.ts`

**Intent**: Make the initial state and scene instances consume the canonical planet definitions by stable ID rather than relying on unrelated array ordering.

**Contract**: Schema remains v3 and the codec continues to validate unique IDs and finite positions. Scene reconciliation matches identities deterministically and fails fast on a missing or duplicate configured planet rather than silently pairing the wrong visual with state.

### Success Criteria:

#### Automated Verification:

- Mechanics tests prove each configured period, phase, radius, direction, exact active-time projection, and the 50px non-overlap gap between Moolaris and adjacent orbital bands.
- State tests prove paused and restored runs retain the same projected planet positions and schema-v3 codec round trips remain valid.

#### Manual Verification:

- The three planets move smoothly in distinct counter-clockwise circles and freeze immediately whenever active time is paused.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Moolaris Flight Safety

### Overview

Replace presentation-physics collision behavior with deterministic Moolaris-only safety while allowing flight and projectiles to pass through planets.

### Changes Required:

#### 1. Pure Moolaris contact resolver

**Files**: `src/game/definitions/`, `src/game/mechanics/`, `src/game/mechanics/gameSimulation.ts`

**Intent**: Ensure contact with MOO-2187 “Moolaris” overrides player control and applies full outward ship velocity until the ship passes the configured collision radius plus ship radius plus 50px clearance.

**Contract**: The resolver uses the authoritative ship snapshot and static Moolaris geometry, never Phaser body state. While distance is less than or equal to the clearance boundary it ignores steering/boost/fire intent, points velocity away from Moolaris at configured full speed, and emits a readonly simulation result suitable for loss-of-control presentation. If the radial vector is zero, it uses a fixed positive-X fallback direction so its output is always finite; control returns only at a strictly greater distance.

#### 2. Scene collision and projectile policy

**Files**: `src/game/scenes/gameScene.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/objects/`

**Intent**: Remove the broad Arcade collider so planet contact never changes ship state, preserve Moolaris as the only projectile obstacle, and display a clear temporary loss-of-control indicator.

**Contract**: The scene owns no authoritative collision correction. Projectile obstacle input contains Moolaris only; planets and the future decorative belt are pass-through.

### Success Criteria:

#### Automated Verification:

- Mechanics tests prove Moolaris contact forces an outward full-speed vector, suppresses player controls, uses the finite positive-X fallback at zero radial distance, and restores control only outside the configured clearance.
- Mechanics tests prove ship and projectile paths pass through planets while a Moolaris-crossing projectile is removed.

#### Manual Verification:

- Flying into Moolaris visibly shows temporary loss of control and reliably pushes the ship clear without trapping it.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: World Presentation

### Overview

Make celestial identities legible and add a non-gameplay asteroid belt that reinforces the scale of the system.

### Changes Required:

#### 1. Celestial labels and orbit rendering

**Files**: `src/game/objects/planet/planet.ts`, `src/game/objects/sun/sun.ts`, `src/game/effects/starfield.ts`, `src/game/scenes/gameScene.ts`, `src/game/visual/`

**Intent**: Replace debug coordinates with centered planet names and label Moolaris along the radial direction facing the ship, outside its unreadable center.

**Contract**: Labels derive from stable IDs/names and current presentation coordinates. No coordinate diagnostics, gameplay statistics, or new UI state are exposed.

**Active-time contract**: `Game` passes authoritative `activeElapsedMs` to the Sun, starfield, planets, and belt projections. No visible world animation derives from Phaser wall-clock time, so background, menu, and orientation pauses freeze all motion and active-time resumption continues it without a jump.

#### 2. Decorative outer asteroid belt

**Files**: `src/game/effects/` or `src/game/visual/`, `src/game/definitions/`

**Intent**: Render a deterministic seeded belt beyond Maslo-Prime that rotates from active time, starts after a 50px surface-to-surface gap from Maslo-Prime, and uses individual asteroid radii equal to half the smallest planet radius.

**Contract**: The belt is a scene/effect-owned visual projection with no snapshot records, physics bodies, colliders, projectile targets, damage, loot, or replenishment behavior. Its innermost asteroid extent remains at least 50px beyond Maslo-Prime's outer orbital band.

### Success Criteria:

#### Automated Verification:

- Unit tests prove deterministic belt layout, active-time rotation, the 50px clearance beyond Maslo-Prime, and paused/resumed active-time projections for the Sun and starfield without adding the belt to authoritative state.
- Architecture tests continue to pass with mechanics, world, and presentation dependency boundaries intact.

#### Manual Verification:

- Planet and Moolaris labels remain readable during flight, and the belt is visible, smooth, and completely non-interactive.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Responsive Direct Controls

### Overview

Make the fixed-design Phaser view resize-safe and provide complete transient touch flight controls.

### Changes Required:

#### 1. Resize-safe Phaser HUD and input layout

**Files**: `src/game/scenes/gameScene.ts`, `src/game/main.ts`, `public/style.css`

**Intent**: Re-anchor fixed-coordinate Phaser HUD, landing prompt, pause control, and touch controls whenever the viewport/scale changes, while retaining current DOM safe-area layout and display-adapter scale refresh.

**Contract**: Scene-owned resize listeners are removed idempotently on shutdown. World objects remain world-space; only HUD and controls use screen-space anchoring.

#### 2. Touch joystick and action buttons

**Files**: `src/game/scenes/gameScene.ts`, `src/game/objects/` or `src/game/visual/`

**Intent**: Add a left-side relative joystick with a dead zone and constant full thrust, plus right-side fire and boost controls, without regressing keyboard or desktop pointer flight.

**Contract**: Joystick and button ownership, pointer release, pointer-up-outside, and touch-cancel cleanup are transient scene input. DOM interactive elements retain `data-game-input="ignore"`; touch controls never enter snapshots.

### Success Criteria:

#### Automated Verification:

- Application UI tests cover viewport resize/re-anchoring and retain desktop pointer, keyboard, boost, and fire behavior.
- Touch UI tests cover joystick ownership, dead-zone/full-thrust behavior, fire/boost actions, release, and cancellation cleanup.

#### Manual Verification:

- HUD and controls remain reachable and unobstructed in desktop and touch-sized landscape viewports during resize and fullscreen changes.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Pause Menu, Orientation, and Acceptance

### Overview

Finish resilient pause behavior and an accessible menu lifecycle without coupling fullscreen to gameplay state.

### Changes Required:

#### 1. Authoritative pause reasons and orientation bridge

**Files**: `src/game/state/gameClockState.ts`, `src/game/application/gameStateCodec.ts`, `src/ui/contracts.ts`, `src/ui/adapters/gameControlsAdapter.ts`, `src/ui/adapters/displayAdapter.ts`, `src/ui/setupUi.ts`, `src/game/scenes/gameScene.ts`, `tests/ui/fixtures/uiHarness.ts`, `tests/ui/fixtures/uiHarness.html`

**Intent**: Add `orientation` and `menu` to the composable pause-reason set so portrait and modal states halt the same active clock as background pauses.

**Contract**: The codec rejects unknown/duplicate reasons and supports the two new valid values. A typed `GameControlsPort`, implemented only by `gameControlsAdapter`, is the DOM-to-game bridge: it owns menu actions and provider updates, while `displayAdapter` owns only display observations. `setupUi` composes both ports. Each owner adds/removes only its own reason; `Game` observes entry into menu/orientation pause and clears held flight input, and no owner resumes the clock while another reason remains. The UI harness implements the same port contract for component tests.

#### 2. Accessible pause modal and relocated audio controls

**Files**: `src/ui/components/`, `src/ui/contracts.ts`, `src/ui/adapters/gameControlsAdapter.ts`, `src/ui/setupUi.ts`, `src/game/scenes/gameScene.ts`, `tests/ui/fixtures/uiHarness.ts`, `tests/ui/fixtures/uiHarness.html`, `index.html`, `public/style.css`

**Intent**: Open a DOM modal through Escape or a visible pause control; provide Resume and Exit to Main Menu, and move audio controls from the always-visible game UI into this modal.

**Contract**: `GameControlsPort` exposes menu state/actions and returns an idempotent handle. The adapter is the only DOM layer allowed to update the provider or request the `MainMenu` transition; `Game` remains the owner of transient flight-input cleanup. The modal traps/isolate gameplay pointer and keyboard input, restores focus on close, marks controls with `data-game-input="ignore"`, and Exit returns to `MainMenu` without creating a terminal outcome.

#### 3. Portrait overlay and fullscreen behavior

**Files**: `src/ui/components/displayControls.ts`, `src/ui/adapters/displayAdapter.ts`, `tests/ui/`

**Intent**: Replace the current portrait notice with a blocking rotate-to-landscape overlay that pauses gameplay and blocks input; retain fullscreen as a HUD control that refreshes layout without pausing.

**Contract**: Portrait overlay visibility maps to the `orientation` reason and removes only that reason on landscape restoration. Fullscreen success/failure remains covered through the fake display port because headless fullscreen is unreliable.

### Success Criteria:

#### Automated Verification:

- State and UI tests cover overlapping background, menu, and orientation pauses, invalid pause-reason codec input, the game-controls adapter/fixture contract, modal focus/actions/cleanup, and audio controls inside the modal.
- Playwright covers portrait pause/resume, menu open/resume/exit, fullscreen wiring, no page errors, and no clock advancement for every pause state.

#### Manual Verification:

- Escape and the pause button reliably open a usable modal; portrait blocks flight until landscape returns; fullscreen does not interrupt active flight.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before treating the change as complete.

---

## Testing Strategy

### Unit Tests:

- Test exact orbital positions, CCW direction, periods, paused time, restore continuity, Moolaris clearance, and pass-through rules in mechanics/state suites.
- Test deterministic belt data without Phaser and codec validation for each pause reason.

### Integration Tests:

- Use Playwright desktop and touch projects for resize, joystick, actions, portrait, modal lifecycle, audio relocation, fullscreen port wiring, and pause-clock behavior.

### Manual Testing Steps:

1. Start a run, observe named moving planets and Moolaris, then background/refocus and confirm all active-time motion freezes/resumes.
2. Enter Moolaris, confirm visible forced outward movement and recovery only after the 50px clearance boundary.
3. Exercise desktop and touch controls, resize/fullscreen, portrait rotation, pause/resume, audio settings, and exit to the main menu.

## Performance Considerations

Use precomputed deterministic belt layout and lightweight position/graphics updates. Do not allocate authoritative objects or physics bodies for decorative asteroids each frame.

## Migration Notes

No persisted-shape migration is required. Planet positions retain their existing `Vector2State` shape and schema version stays v3; only the valid pause-reason enum expands.

## References

- `context/foundation/prd.md` — FR-010, FR-012, FR-014 and active-time rules.
- `context/foundation/architecture.md` — snapshot ownership, pause semantics, and transient presentation/input boundaries.
- `src/game/mechanics/gameSimulation.ts:61`
- `src/game/scenes/gameScene.ts:63`
- `src/ui/adapters/displayAdapter.ts:8`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` â€” <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deterministic Moving Solar System

#### Automated

- [x] 1.1 Mechanics tests prove each configured period, phase, radius, direction, and exact active-time projection.
- [x] 1.2 State tests prove paused and restored runs retain the same projected planet positions and schema-v3 codec round trips remain valid.

#### Manual

- [x] 1.3 The three planets move smoothly in distinct counter-clockwise circles and freeze immediately whenever active time is paused.

### Phase 2: Moolaris Flight Safety

#### Automated

- [x] 2.1 Mechanics tests prove Moolaris contact forces an outward full-speed vector, suppresses player controls, and restores control only outside the configured clearance. — c2284e4
- [x] 2.2 Mechanics tests prove ship and projectile paths pass through planets while a Moolaris-crossing projectile is removed. — c2284e4

#### Manual

- [x] 2.3 Flying into Moolaris visibly shows temporary loss of control and reliably pushes the ship clear without trapping it. — c2284e4

### Phase 3: World Presentation

#### Automated

- [x] 3.1 Unit tests prove deterministic belt layout and active-time rotation without adding it to authoritative state. — e431b3d
- [x] 3.2 Architecture tests continue to pass with mechanics, world, and presentation dependency boundaries intact. — e431b3d

#### Manual

- [x] 3.3 Planet and Moolaris labels remain readable during flight, and the belt is visible, smooth, and completely non-interactive. — e431b3d

### Phase 4: Responsive Direct Controls

#### Automated

- [x] 4.1 Application UI tests cover viewport resize/re-anchoring and retain desktop pointer, keyboard, boost, and fire behavior.
- [x] 4.2 Touch UI tests cover joystick ownership, dead-zone/full-thrust behavior, fire/boost actions, release, and cancellation cleanup.

#### Manual

- [x] 4.3 HUD and controls remain reachable and unobstructed in desktop and touch-sized landscape viewports during resize and fullscreen changes.

### Phase 5: Pause Menu, Orientation, and Acceptance

#### Automated

- [ ] 5.1 State and UI tests cover overlapping background, menu, and orientation pauses, invalid pause-reason codec input, modal focus/actions/cleanup, and audio controls inside the modal.
- [ ] 5.2 Playwright covers portrait pause/resume, menu open/resume/exit, fullscreen wiring, no page errors, and no clock advancement for every pause state.

#### Manual

- [ ] 5.3 Escape and the pause button reliably open a usable modal; portrait blocks flight until landscape returns; fullscreen does not interrupt active flight.
