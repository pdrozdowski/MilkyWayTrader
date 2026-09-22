# Direct Moving System Flight Implementation Plan

## Overview

Deliver S-02: readable direct flight through a moving solar system. Moolaris remains fixed at the origin; three planets and a visual-only asteroid band follow distinct counter-clockwise orbital bands. The slice also delivers viewport, touch-control, orientation, and menu improvements, with each dependency placed in its owning phase.

## Current State Analysis

The game currently has three static planets, a static sun, and an Arcade collider whose response is overwritten by authoritative scene synchronization. The simulation owns active time, ship state, and projectiles. Orientation and menu UI producers do not exist yet, so Phase 1 cannot safely own their pause lifecycle.

## Desired End State

Seroton, Lactozis-7C, Maslo-Prime, and the outer asteroid band visibly occupy separate CCW orbits. Smaller Moolaris has a readable ship-facing label and deterministically pushes a contacting ship to a visible clearance, then stops it without damage. Touch, orientation, and menu pauses are implemented together with their UI producers.

### Key Discoveries

- Phaser collision cannot be authoritative because `GameScene` replaces it with the next simulation snapshot.
- Current Moolaris geometry is hard-coded at 1650 world units; accepted geometry is 70%, or 1155.
- Phase 2 first introduces the orientation notice, joystick, UI contracts, and menu, so it must also own their pause-state wiring.

## What We're NOT Doing

- Asteroid colliders, damage, projectile interception, harvesting, or any other S-07 hazard behavior.
- Orbit capture, landing, market access, or launch behavior from S-03.
- Snapshot migration or a schema-version change.
- Analog speed controls, touch firing, or input preferences.

## Implementation Approach

Celestial tuning, orbit projection, and Moolaris contact stay pure. The simulation commits planet positions from active elapsed time and resolves contact before Phaser synchronization. Phaser presentation samples the same pure orbital projection at consecutive 100 ms active-time boundaries and linearly interpolates with `activeElapsedMs % 100 / 100`; no raw Phaser delta participates, so paused active time freezes every celestial visual and resuming starts from the matching segment without a jump. The asteroid band is deterministic scene presentation only, so it is neither persisted nor an obstacle. Phase 2 owns the UI ports and pause reasons that its controls produce.

## Critical Implementation Details

Remove the ship Arcade collider completely. Resolve Moolaris contact after ship motion: place the ship beyond configured visible clearance and zero its velocity. `GameScene` owns the `orientation` reason and input clearing only; the modal-menu adapter owns `menu` pause/resume only.

## Phase 1: Deterministic Solar System and Direct Flight

### Overview

Create the self-contained moving-system simulation and presentation without depending on Phase 2 UI components.

### Changes Required

#### 1. Solar-system tuning and authoritative orbit projection

**Files**: new `src/game/definitions/solarSystemTuning.ts`, new `src/game/mechanics/planet/orbits.ts`, `src/game/definitions/initialGameState.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/application/gameStateCodec.ts`, `src/game/application/gameStateProvider.ts`, `src/game/scenes/gameObjects.ts`, `src/game/scenes/gameScene.ts`, `tests/game-mechanics.test.mjs`, `tests/domain/gameState.test.mjs`

**Intent**: Make celestial geometry configurable and derive persisted planet positions deterministically from active time.

**Contract**: Define Moolaris at `(0, 0)` with radius `1155`; planet radii `96`, `144`, `192`; orbital radii `2000`, `3000`, `4000`; and CCW periods `180`, `240`, `300` seconds. Define explicit initial phases, and derive `initialGameState.planets` from the resulting zero-active-time projection. Define a deterministic visual asteroid annulus from `4650` to `5050` plus a navigation margin. Tuning order and each planet's static ID/name/radius fields are canonical. The codec validates that contract during restore and rejects a reordered or substituted v3 list atomically with a descriptive invariant error. Projection reproduces the new initial snapshot at zero time and leaves paused planet positions unchanged. Derive bounds from the asteroid outer radius and margin.

#### 2. Moolaris contact and pass-through boundaries

**Files**: `src/game/mechanics/gameSimulation.ts`, `src/game/scenes/gameScene.ts`, `src/game/scenes/gameObjects.ts`, `src/game/objects/sun/definition.ts`

**Intent**: Make Moolaris contact authoritative and obvious, while planets and asteroids stay non-interactive.

**Contract**: After flight movement, a pure resolver moves an overlapping ship to `sun radius + ship radius + configured visible clearance`, sets velocity to zero, and preserves rotation, HP, lifecycle, clock, and weapon state. A zero-length contact vector uses opposite previous velocity, then positive X. Remove the Arcade collider. Projectile obstacles contain Moolaris only; ships and shots pass through planets and the asteroid band.

#### 3. Celestial labels and visual asteroid band

**Files**: `src/game/objects/planet/planet.ts`, `src/game/objects/sun/sun.ts`, new scene-owned asteroid-band module as needed, `src/game/scenes/gameScene.ts`

**Intent**: Make bodies identifiable, establish a decorative fourth orbital band, and present authoritative orbital updates without choppy visual jumps.

**Contract**: Planet labels are names only. `Planet.synchronizeAuthoritative(state)` accepts the exact snapshot slice for identity/radius and non-visual gameplay calculations; `Planet.renderOrbit(activeElapsedMs)` owns all transient display coordinates. `Sun.synchronizeLabel(shipPosition, cameraMidpoint)` receives transient Phaser vectors from `GameScene` after ship synchronization and renders exactly `MOO-2187 “Moolaris”` inside its visible surface on the edge facing the ship; it uses the camera midpoint only when ship and sun share a position. Each moving planet and asteroid visual derives its display position from pure projections at the enclosing 100 ms active-time boundaries and linearly interpolates with `activeElapsedMs % 100 / 100`; it snaps only at scene creation, restore, or invalid targets. Raw Phaser delta must not advance this presentation. Exact authoritative positions still drive all non-visual logic. The planet sprite, atmosphere, name label, landing ring, landing zone, and prompt geometry share that interpolated display position. The asteroid band has a fixed deterministic seed/count and projects its angle from the same active elapsed-time basis and CCW orbital convention as the planets; `GameScene` synchronizes it from `state.clock.activeElapsedMs` after each provider update. It has no label, body, obstacle, collider, damage, or persisted state. Existing landing rings and prompt remain visible but inert for S-03, and their radius-derived geometry tests update to the tuned planet sizes. Synchronize planets before dependent indicators and visuals.

### Success Criteria

#### Automated Verification

- Pure mechanics tests prove zero-time compatibility, canonical order, CCW direction, distinct radii/periods, full-period return, pause/restore/chunk equivalence, tuned geometry, and immutable input.
- Contact tests prove configured visible clearance, zero post-contact velocity, unchanged non-flight state, and both zero-vector fallbacks.
- Direct-flight/projectile tests prove planets and asteroids pass through while Moolaris is the sole obstacle: `npm.cmd run test:mechanics`.
- State continuity tests pass: `npm.cmd run test:domain`.
- TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual Verification

- Observe four distinct CCW orbital bands; focus loss freezes active-clock motion.
- Confirm readable labels, intended smaller star scale, and name-only planet labels.
- Confirm planet/asteroid pass-through and visible, non-damaging Moolaris push-out that stops the ship.

**Implementation Note**: After automated checks pass, pause for human confirmation before considering the phase complete.

---

## Phase 2: Full-Viewport Touch Controls, Orientation, and Toolbar Menu

### Overview

Make the canvas responsive, introduce touch steering, and implement UI-owned orientation and menu pause lifecycles.

### Changes Required

#### 1. Responsive Phaser layout and touch-flight joystick

**Files**: `src/game/main.ts`, `public/style.css`, `src/game/scenes/gameScene.ts`, `src/game/scenes/mainMenuScene.ts`, `src/game/scenes/gameOverScene.ts`, `src/game/scenes/preloaderScene.ts`, `src/game/effects/starfield.ts`, new `src/game/scenes/touchFlightJoystick.ts`, `tests/ui/applicationUiTest.ts`

**Intent**: Fill the viewport without stretching world geometry, with exclusive touch steering.

**Contract**: Replace `Scale.FIT` with `Scale.RESIZE`, retain normal game-camera zoom one, and reflow fixed scene/HUD positions on resize with cleanup. On coarse-pointer devices a UI-camera joystick at left-centre uses a 120 px base and 44 px knob, maps clamped direction to existing steering, and prevents outside touches from steering.

#### 2. Orientation pause contract and toolbar

**Files**: `src/game/state/gameClockState.ts`, `src/game/application/gameStateCodec.ts`, `src/game/scenes/gameScene.ts`, `index.html`, `src/ui/components/displayControls.ts`, `src/ui/components/runStatus.ts`, `src/ui/contracts.ts`, `src/ui/setupUi.ts`, `src/ui/adapters/displayAdapter.ts`, `public/style.css`, UI harness and tests

**Intent**: Revise the existing portrait presentation stack so it stays aligned with the authoritative clock and the readable toolbar.

**Contract**: Add unique serializable `orientation` and `menu` reasons. Reuse the existing `DisplayPort`, display adapter, notice markup, UI harness, and component tests strictly for orientation presentation; do not add a parallel observer or notice element. `GameScene` is the sole media-query owner: it applies/removes `orientation`, clears pointer/joystick/boost/fire intent, reconciles after restore, and removes its listener on shutdown. Update the existing DOM blocker to render exactly `Rotate your device to landscape to play.` above every control through its revised CSS layer. Keep the established three-zone toolbar and compact-width behavior.

#### 3. Modal menu and control lifecycle

**Files**: `index.html`, new `src/ui/adapters/gameControlAdapter.ts`, `src/ui/components/gameMenu.ts`, `src/ui/contracts.ts`, `src/ui/setupUi.ts`, `src/game/scenes/gameScene.ts`, `src/ui/components/audioControls.ts`, UI harness and tests

**Intent**: Provide a safe paused menu without a scene-to-DOM dependency.

**Contract**: `GameControlPort` has idempotent `pause(reason)`, `resume(reason)`, and `endGame()`. The menu adapter alone applies/removes `menu`; GameScene only handles the payload-free end-game event. Remove the persistent normal-game audio host and its unconditional mount. The accessible modal is the sole audio-control host; it mounts audio controls once for its own lifecycle, mirrors that composition in the UI harness, and proves teardown/re-entry cannot duplicate subscriptions. The modal owns/restores focus, sits below the orientation blocker, contains touch-only fullscreen exit and End game, and tears down only its own reason/listeners.

### Success Criteria

#### Automated Verification

- UI component tests cover orientation text/layering, toolbar layout, dialog focus lifecycle, menu-owned audio, and control-port actions.
- Application tests cover desktop pointer flight, joystick interaction/resizing, orientation pause/restoration, menu pause/resume/teardown, and mobile fullscreen exit.
- Resize tests cover canvas/HUD/scene reflow and unscaled world geometry: `npm.cmd run test:ui`.
- TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual Verification

- On touch, confirm joystick placement and non-overlap with Cargo/Ship details.
- Confirm resize, fullscreen, portrait blocking, toolbar readability, and menu pause behavior.

**Implementation Note**: After automated checks pass, pause for human confirmation before considering the phase complete.

---

## Phase 3: Acceptance Coverage and Architecture Artifacts

### Overview

Complete end-to-end acceptance coverage and refresh required architecture artifacts.

### Changes Required

#### 1. End-to-end user acceptance

**Files**: `tests/game-mechanics.test.mjs`, `tests/domain/gameState.test.mjs`, `tests/ui/applicationUiTest.ts`, UI component/harness tests as required

**Intent**: Protect the moving-system, controls, and paused-UI player contract across layers.

**Contract**: Keep orbital behavior in pure mechanics tests and use semantic Playwright selectors for UI behavior. Retain desktop/touch no-page-error, focus pause/resume, portrait blocking, and scene-transition coverage.

#### 2. Generated architecture contracts

**Files**: `context/foundation/code-graph.json`, `context/foundation/data-logical-diagram.md`

**Intent**: Keep dependency and persistable-state documentation accurate after authoritative planet projections and UI-control additions.

**Contract**: Regenerate and validate both artifacts with their project skills, resolving every `REFACTOR_REQUIRED` finding.

### Success Criteria

#### Automated Verification

- Full unit, architecture, and desktop/touch Playwright suite passes: `npm.cmd run test:project`.
- Code graph and logical data diagram regenerate and validate with no `REFACTOR_REQUIRED` finding.
- Production build and TypeScript projects pass: `npm.cmd run build-nolog` and `npm.cmd run typecheck`.

#### Manual Verification

- Complete desktop and touch menu-to-flight journey is readable and responsive; Moolaris contact is understandable; no stretching or input regression is visible.

## Testing Strategy

### Unit Tests

- Test phase/period boundaries, pause/restore continuity, canonical ordering, contact fallbacks, and input immutability.
- Test 100 ms active-time interpolation separately from orbital mechanics, including creation/restore snaps, paused visual stability, resume continuity, and exact-state non-visual logic.
- Test asteroid-band determinism, shared active-time orbital basis, and paused stability without adding it to authoritative state.

### Integration Tests

- Use desktop and touch Playwright projects for pointer/joystick behavior, portrait/menu pauses, resize/fullscreen behavior, and browser-error smoke coverage.

### Manual Testing Steps

1. Verify planets and asteroid band occupy visibly separated CCW orbital bands.
2. Verify Moolaris label faces the ship and contact stops the ship outside it without damage.
3. Verify planet and asteroid pass-through for ships and shots.
4. Verify portrait blocking, joystick, menu, resize, and fullscreen behavior.

## Migration Notes

No snapshot migration or schema-version change is introduced. Persisted planet positions remain JSON-safe `Vector2State` values; asteroid positions remain transient presentation data.

## References

- Product contract: `context/foundation/prd.md` (US-02, FR-010, FR-012, FR-014)
- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- Architecture: `context/foundation/architecture.md`
- Testing policy: `context/foundation/testing.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deterministic Solar System and Direct Flight

#### Automated

- [ ] 1.1 Pure mechanics and presentation tests prove zero-time compatibility, canonical order, distinct CCW orbital bands, active-time pausing, tuned geometry, smooth frame-delta interpolation, chunk equivalence, and immutable input.
- [ ] 1.2 Contact and restore tests prove visible Moolaris clearance, zero post-contact velocity, unchanged non-flight state, and deterministic fallbacks.
- [ ] 1.3 Direct-flight and projectile tests prove planets and asteroids pass through while Moolaris remains the sole obstacle: `npm.cmd run test:mechanics`.
- [ ] 1.4 State continuity tests prove restore produces the same next orbital and flight state: `npm.cmd run test:domain`.
- [ ] 1.5 Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual

- [ ] 1.6 Observe named planets and visual asteroid band on distinct CCW orbits; focus loss freezes all active-clock motion.
- [ ] 1.7 Confirm readable labels, intended smaller star scale, and name-only planet labels.
- [ ] 1.8 Confirm planet/asteroid pass-through and visible, non-damaging Moolaris push-out that stops the ship.

### Phase 2: Full-Viewport Touch Controls, Orientation, and Toolbar Menu

#### Automated

- [ ] 2.1 UI component tests cover orientation text/layering, toolbar layout, dialog focus lifecycle, menu-owned audio, and GameControlPort actions.
- [ ] 2.2 Application tests cover desktop pointer flight, touch joystick behavior, orientation pause/reconciliation, menu pause/resume/teardown, and mobile fullscreen exit.
- [ ] 2.3 Resize tests cover canvas/HUD/scene reflow and unscaled world geometry: `npm.cmd run test:ui`.
- [ ] 2.4 Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual

- [ ] 2.5 On touch, confirm joystick placement and non-overlap with Cargo/Ship details.
- [ ] 2.6 Confirm resize, fullscreen, portrait blocking, toolbar readability, and menu pause behavior.

### Phase 3: Acceptance Coverage and Architecture Artifacts

#### Automated

- [ ] 3.1 Full unit, architecture, and desktop/touch Playwright suite passes: `npm.cmd run test:project`.
- [ ] 3.2 Code graph and logical data diagram regenerate and validate with no `REFACTOR_REQUIRED` finding.
- [ ] 3.3 Production build and both TypeScript projects pass: `npm.cmd run build-nolog` and `npm.cmd run typecheck`.

#### Manual

- [ ] 3.4 Complete desktop and touch menu-to-flight journey works without visual stretching or input regression.
