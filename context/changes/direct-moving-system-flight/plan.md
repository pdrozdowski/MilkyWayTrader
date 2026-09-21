# Direct Moving System Flight Implementation Plan

## Overview

Deliver roadmap slice S-02: the player flies directly through a readable moving solar system. MOO-2187 "Moolaris" remains fixed at the origin, while the three planets follow configurable counter-clockwise orbits. The slice also replaces touch-to-steer with a left-side joystick, makes the Phaser canvas occupy the full viewport without scaling world objects, corrects portrait-orientation blocking, and reorganizes the run toolbar around an accessible paused menu.

## Current State Analysis

The game already has an immutable, codec-validated game-state aggregate, direct pointer flight, ship-following camera, three named but static planets, and a static visual sun. `GameScene` drives the pure simulation, then reconciles Phaser projections. The canvas currently uses `Scale.FIT` at a fixed 1024 x 768 logical size. Touch input uses the same whole-canvas steering path as desktop pointer input. The DOM status panel has a single horizontal control arrangement; separate floating audio and fullscreen controls sit outside it. The existing portrait notice is Polish, does not pause the active clock, and has a lower z-index than the toolbar.

## Desired End State

In an active run, MOO-2187 "Moolaris" is visibly named and stationary at `(0, 0)`. Seroton, Lactozis-7C, and Maslo-Prime move visibly on separately configured circular CCW orbits that pause with active game time. A player can fly through planets, while contact with Moolaris deterministically pushes the ship outside it without damage. Desktop keeps pointer flight; a touch device shows only a left-centre analog direction joystick. The canvas fills every viewport with an unscaled world. The toolbar places Menu and Anonymous at top-left, clock and HP at top-centre, and cash/load/Cargo details/Ship info at top-right. Portrait touch layouts show a topmost English blocking notice and pause the game.

### Key Discoveries:

- `advanceGameSimulation` owns the active clock, ship and projectile updates, but currently leaves `state.planets` unchanged (`src/game/mechanics/gameSimulation.ts:54`).
- `GameScene` converts pointer coordinates to world coordinates while preserving a Phaser 4 camera compensation; its camera follows the ship (`src/game/scenes/gameScene.ts:164`).
- `Planet.synchronize` already projects authoritative positions into static Arcade bodies (`src/game/objects/planet/planet.ts:51`), while current planet collision and projectile obstacles are wired by `GameScene`.
- Phaser uses `Scale.FIT` with fixed dimensions (`src/game/main.ts:19`); `#app` padding currently prevents the canvas itself from reaching the complete viewport (`public/style.css:12`).
- The state architecture requires JSON-safe authoritative spatial values, pure reducers, the central provider boundary, and refreshed dependency/data graphs (`context/foundation/architecture.md`).

## What We're NOT Doing

- Orbit capture, guidance, landing, launch, market access, or any landing behavior from S-03.
- Damage, death, asteroid hazards, or terminal run outcomes from S-06/S-07.
- Planet collisions, projectile-planet impacts, planet damage, or planetary physics.
- Analog speed control, touch firing controls, configurable input preferences, or a new settings system.
- Snapshot migrations: the persisted state shape remains schema v3; current planet positions are derived from existing IDs and the active clock.

## Implementation Approach

Keep orbital parameters as static, pure definition data and derive positions from the existing active clock, then commit those projected positions through the existing simulation/provider flow. Keep all world-state calculations outside Phaser. Compose touch controls inside the scene UI camera, while the semantic toolbar and modal menu remain DOM UI components connected through typed ports. Use Phaser `RESIZE` to make the canvas physical viewport-sized and re-anchor transient scene HUD on resize; keep normal camera zoom at one so objects are not stretched. Treat portrait orientation and the menu as unique composable pause reasons so visual blocking and authoritative clock state cannot diverge.

## Critical Implementation Details

`GameScene` currently forms projectile obstacles from a pre-update snapshot. Once worlds move, planet obstacles must be removed by the settled product decision, while Moolaris’s obstacle and the ship push-out must be calculated from the same simulation state that is projected that frame. Do not reintroduce a Phaser sun collider that can conflict with the pure push-out result.

## Phase 1: Deterministic Solar System and Direct Flight

### Overview

Create a configurable solar-system definition and pure orbital/collision mechanics, then wire post-tick state into scene projections without expanding gameplay scope into hazards or landing.

### Changes Required:

#### 1. Solar-system tuning and deterministic orbit projection

**Files**: new `src/game/definitions/solarSystemTuning.ts`, new `src/game/mechanics/planet/orbits.ts`, `src/game/definitions/initialGameState.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/scenes/gameObjects.ts`, `src/game/scenes/gameScene.ts`, `tests/game-mechanics.test.mjs`, `tests/domain/gameState.test.mjs`

**Intent**: Make all celestial visual/physical sizes and planet orbit parameters balance/configuration data, while producing reproducible positions only from active elapsed time.

**Contract**: Define Moolaris at `{ position: { x: 0, y: 0 } }` with configurable rendered/collision radius. Define each planet by stable ID, name, configured body radius, orbital radius, initial phase, and CCW period; defaults use 180 s, 240 s, and 300 s periods. `solarSystemTuning.ts` is the single source of truth for celestial dimensions and layout limits: `gameObjects.ts` derives Moolaris visual size and world bounds from it, and geometry tests assert those derivations rather than duplicating numeric constants. The pure projection returns the `PlanetState` list for an active-clock value. The tuning order is the canonical state/projection order. `orbits.ts` exports a deterministic canonical-order assertion; `GameScene` calls it before its index-based creation/synchronization projections and the simulation calls it before returning projected planets. It throws a descriptive v3-invariant error if snapshot IDs/order differ from tuning; tests cover a codec-valid permutation or substitution. The zero-time projection must reproduce the initial snapshot positions, preventing a first-tick teleport. `advanceGameSimulation` advances the clock, projects planets at the resulting elapsed time, and returns them in the v3 snapshot. Paused frames retain the planet list unchanged.

#### 2. Sun contact and existing collision boundaries

**Files**: `src/game/mechanics/gameSimulation.ts`, `src/game/scenes/gameScene.ts`, `src/game/scenes/gameObjects.ts`, `src/game/objects/sun/definition.ts`

**Intent**: Preserve a meaningful collision with stationary Moolaris without allowing Phaser physics to override authoritative flight state, and explicitly allow direct flight/projectiles through planets.

**Contract**: After ship movement, a pure resolver pushes any ship overlapping Moolaris to the sum of configured Moolaris and ship radii; it preserves velocity, rotation, HP, and lifecycle. A zero-length position vector uses opposite velocity, then positive X if velocity is also zero. Scene physics no longer collides ship with planets or Moolaris. Pure projectile obstacles contain Moolaris only, so planet shots pass through. World bounds are derived from the largest configured orbit plus body radius and navigation margin.

#### 3. World-object labels and projection

**Files**: `src/game/objects/planet/planet.ts`, `src/game/objects/sun/sun.ts`, `src/game/scenes/gameScene.ts`

**Intent**: Make every celestial body identifiable in player language and keep Phaser projections synchronized with current authoritative world positions.

**Contract**: Planet labels render names only, never debug coordinates. Moolaris renders the exact visible label `MOO-2187 “Moolaris”`. Each frame synchronizes post-simulation planet state before updating dependent visuals; existing landing rings/prompt remain visible and gain no functionality.

#### 4. Orientation and menu pause-state contract

**Files**: `src/game/state/gameClockState.ts`, `src/game/application/gameStateCodec.ts`, `src/game/scenes/gameScene.ts`

**Intent**: Make every visual layer that blocks play pause the same authoritative active clock, including portrait orientation and the in-game menu.

**Contract**: Add `orientation` and `menu` to the valid unique pause-reason union and codec allow-list. On a coarse-pointer portrait change, `GameScene` adds/removes `orientation`, clears held pointer, joystick, boost, and fire intent, and removes its media-query listener on shutdown. Menu presentation adds/removes `menu`; either reason composes with background and landed reasons without advancing active time. On scene creation after restore, reconcile `orientation` against current media-query state and always remove `menu`, because no menu modal is restored; scene/menu teardown also removes its owned reason. Regression tests cover restoring snapshots made while each blocker was active.

### Success Criteria:

#### Automated Verification:

- Pure mechanics tests prove zero-time compatibility with the initial v3 planet order/positions, initial phase, CCW direction, distinct periods, full-period return, paused stability, configured radii, chunked-frame equivalence, and immutable input.
- Mechanics and state continuity tests prove restore produces the same next orbital/flight state and Moolaris push-out reaches the exact configured clearance without HP or terminal-state changes.
- Existing projectile and direct-flight tests prove planets no longer block shots or ship motion while Moolaris remains the sole obstacle: `npm.cmd run test:mechanics`.
- Clock/provider tests prove orientation and menu reasons are unique, codec-valid, serializable, compose with existing pause reasons, and reconcile correctly after restore.
- Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual Verification:

- Observe all named planets moving CCW around stationary Moolaris; pause/focus loss freezes them, and the ship passes through planets but is pushed out of Moolaris without damage.
- On a portrait touch layout, confirm held flight input is cleared and time stays paused until landscape resumes.

**Implementation Note**: After automated checks pass, pause for human confirmation of this manual verification before considering the phase complete.

---

## Phase 2: Full-Viewport Touch Controls and Toolbar Menu

### Overview

Make the game canvas resize to the viewport without stretching world objects, introduce a scene-owned mobile joystick, fix the portrait blocker, and reorganize the DOM toolbar and paused menu into non-overlapping zones.

### Changes Required:

#### 1. Viewport-sized Phaser canvas and responsive scene HUD

**Files**: `src/game/main.ts`, `public/style.css`, `src/game/scenes/gameScene.ts`, `src/game/scenes/mainMenuScene.ts`, `src/game/scenes/gameOverScene.ts`, `src/game/scenes/preloaderScene.ts`, `src/game/effects/starfield.ts`

**Intent**: Use all available viewport pixels while retaining the world’s native geometry and keeping transient scene HUD readable after rotation, resize, or fullscreen changes.

**Contract**: Replace `Scale.FIT` with `Scale.RESIZE`; the game container/canvas fills the viewport without app padding. Keep normal game camera zoom at one. Every Phaser scene with fixed 1024 x 768 placement derives its initial layout from current scale dimensions, subscribes to scale resize, and removes that listener on shutdown: Game updates its UI-camera viewport, anchors help/prompt/exit, and refreshes Starfield coverage for the new visible extent; Main Menu, Preloader, and Game Over re-centre their content. On Main Menu resize, stop and restart the active cow tween from a newly computed in-bounds route, so its captured pre-resize dimensions cannot leave it off-screen. DOM controls retain safe-area positioning through their own CSS insets.

#### 2. Scene-owned touch-flight joystick

**Files**: new `src/game/scenes/touchFlightJoystick.ts`, `src/game/scenes/gameScene.ts`, `tests/ui/applicationUiTest.ts`

**Intent**: Give touch players an accessible, visually stable directional control without changing desktop flight or introducing an analog speed rule.

**Contract**: On a coarse-pointer device and only in active `Game`, create a UI-camera joystick centred on the left viewport edge at vertical midpoint: 120 px semi-transparent base and 44 px knob. `GameScene` passes its UI container and UI camera explicitly to the joystick constructor, which adds every display object to that container so the main-camera/UI-camera ignore masks apply once and resize/masking stay coherent. Its pointer gestures are exclusive touch steering; the joystick stops propagation and `GameScene.startSteering` rejects coarse-pointer touches, so canvas touches outside it do not steer. Clamped knob direction produces the same target-direction semantics as pointer flight at normal existing acceleration/max speed; release clears the target and coasts. The joystick resizes/repositions with the viewport and destroys all graphics/listeners on shutdown.

#### 3. Orientation blocker and top toolbar layout

**Files**: `index.html`, `src/ui/components/displayControls.ts`, `src/ui/components/runStatus.ts`, `src/ui/contracts.ts`, `src/ui/setupUi.ts`, `src/ui/adapters/displayAdapter.ts`, `public/style.css`, `tests/ui/fixtures/uiHarness.html`, `tests/ui/fixtures/uiHarness.ts`, `tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`

**Intent**: Present orientation blocking and game status in a stable hierarchy that never competes with toolbar or joystick interaction.

**Contract**: On a coarse-pointer portrait layout, a full-viewport `orientation-notice` has the highest visual layer, blocks all controls, and renders exactly `Rotate your device to landscape to play.` with no fullscreen action. `displayControls` renders the notice from `DisplayPort` only; `GameScene` is the sole owner of the `orientation` pause reason and input clearing. The toolbar uses three zones: top-left Menu with non-interactive `Anonymous` beneath; centred clock with HP text/bar beneath; top-right cash, `Load <used> / <capacity>`, Cargo details, then Ship info. At widths below 560 CSS px, left/right zones have fixed compact widths, cash/load stack vertically, and action labels shorten to `Cargo` and `Ship`; the centred clock/HP remains centred. Cargo/Ship detail panels anchor below the right stack with `max-width: min(280px, calc(100vw - 16px))`. They do not hide the joystick because they occupy the opposite side of the screen. All controls retain `data-game-input="ignore"`.

#### 4. Modal game menu and control lifecycle

**Files**: `index.html`, new `src/ui/adapters/gameControlAdapter.ts`, new or updated `src/ui/components/gameMenu.ts`, `src/ui/contracts.ts`, `src/ui/setupUi.ts`, `src/game/scenes/gameScene.ts`, `src/ui/components/audioControls.ts`, `public/style.css`, `tests/ui/fixtures/uiHarness.html`, `tests/ui/fixtures/uiHarness.ts`, `tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`

**Intent**: Give the player a safe full-screen operational menu without duplicating controls in the active play view.

**Contract**: `GameControlPort` exposes idempotent `pause(reason)`, `resume(reason)`, and `endGame()` commands. `setupApplicationUi` constructs the adapter/menu and replaces its normal-view `mountAudioControls` call with menu-owned audio controls; the UI harness mirrors this composition. Its adapter updates the registry provider only while Game is active and emits the payload-free `game-control:end-game` event on `game.events` for `endGame`; `GameScene` owns that listener and performs the existing GameOver transition. Menu opens an accessible full-screen modal below the orientation notice, blocks game input, owns focus, pauses using the port's `menu` reason, and restores focus to Menu on close. It contains existing audio controls (removed from normal game view), a mobile/touch-only `Exit fullscreen` control when fullscreen is active, and `End game`, which closes the menu and uses `endGame()` without recording a terminal result. Close X and Escape dismiss it. The adapter, scene listener, and port are idempotent: their teardown removes their listeners and only their owned pause reason (`menu` for the menu; `orientation` for the orientation listener), rather than reusing focus-loss cleanup.

### Success Criteria:

#### Automated Verification:

- UI component tests cover English orientation text, highest-layer visibility, revised toolbar order, Anonymous status, compact-width layout, viewport-bounded details, dialog focus lifecycle, Escape/Close behavior, audio controls mounted only in the dialog, GameControlPort action dispatch, and end-game action dispatch.
- Application tests cover desktop pointer flight unchanged; touch joystick visibility, direction, clamping, release, outside-touch non-steering, UI-camera masking, and resize; portrait pause/no clock progress/cleared input and post-restore reconciliation; menu pause/resume/teardown; and mobile fullscreen exit visibility/wiring.
- Resize tests cover canvas-to-viewport dimensions, UI-camera/HUD anchors, Main Menu/Game/Game Over/Preloader reflow, orientation/fullscreen transitions, and unscaled world-object geometry: `npm.cmd run test:ui`.
- Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual Verification:

- On a touch device, use the left-centre joystick comfortably without accidental steering from other screen touches; verify it stays screen-fixed through resize and right-side Cargo/Ship details do not overlap it.
- Resize/rotate and enter/exit fullscreen; confirm canvas fills the viewport, world objects keep their proportions, portrait notice is topmost and pauses play, the toolbar remains readable, and the menu safely pauses play.

**Implementation Note**: After automated checks pass, pause for human confirmation of this manual verification before considering the phase complete.

---

## Phase 3: Acceptance Coverage and Architecture Artifacts

### Overview

Complete end-to-end acceptance coverage, validate state/architecture boundaries, and refresh generated architecture artifacts required by the authoritative planet-state change.

### Changes Required:

#### 1. End-to-end user acceptance

**Files**: `tests/game-mechanics.test.mjs`, `tests/domain/gameState.test.mjs`, `tests/ui/applicationUiTest.ts`, UI component/harness tests as required

**Intent**: Protect the cross-layer player contract: moving world, unchanged direct desktop flight, touch joystick, responsive canvas, and paused controls.

**Contract**: Tests use deterministic pure mechanics assertions for orbital behavior and semantic Playwright selectors for toolbar/menu/orientation behavior. Desktop and touch projects retain no-page-error, focus pause/resume, portrait blocking, and scene-transition coverage.

#### 2. Generated architecture contracts

**Files**: `context/foundation/code-graph.json`, `context/foundation/data-logical-diagram.md`

**Intent**: Keep dependency and persistable-data documentation accurate after planet positions become simulation-updated authoritative state and UI/control modules are introduced.

**Contract**: Regenerate the code graph and logical data diagram using their project skills/scripts, validate the diagram, and resolve every `REFACTOR_REQUIRED` finding before completion.

### Success Criteria:

#### Automated Verification:

- Full unit, architecture, and desktop/touch Playwright suite passes: `npm.cmd run test:project`.
- Code graph and logical data diagram regenerate and validate with no `REFACTOR_REQUIRED` finding.
- Production build and both TypeScript projects pass: `npm.cmd run build-nolog` and `npm.cmd run typecheck`.

#### Manual Verification:

- Complete menu-to-flight journey works at desktop and touch sizes: status and controls are readable, direct flight is responsive, Moolaris push-out is understandable, menu audio/fullscreen/end-game controls work, and no visual stretching or input regression is visible.

## Testing Strategy

### Unit Tests

- Exercise orbit calculations at phase/period boundaries, paused active time, restore continuity, configurable body radius, and Moolaris centre/velocity fallbacks.
- Exercise touch joystick geometry and intent mapping independently from Phaser scene lifecycle where possible.

### Integration Tests

- Use Playwright desktop and touch projects for pointer-vs-joystick input, portrait pause/blocking, toolbar/dialog accessibility, full-window resize/fullscreen behavior, and browser-error smoke coverage.
- Use semantic role/label selectors for DOM controls; keep orbit correctness in pure mechanics tests rather than pixel comparisons.

### Manual Testing Steps

1. Start a run and observe labels, distinct CCW planet motion, and pause/resume stability.
2. Fly through a planet, then into Moolaris; confirm only Moolaris pushes the ship out and HP is unchanged.
3. On touch, enter portrait while steering and confirm the English orientation notice is topmost, clears input, and freezes time; return to landscape and confirm play resumes.
4. On touch, steer using the left-centre joystick, open Cargo and Ship info, and confirm their right-side panels do not overlap it.
5. Open Menu, change audio, exit fullscreen on mobile when active, close with X/Escape, and end the demo through End game.
6. Resize, rotate, and fullscreen the application; confirm canvas fill, object proportions, responsive scene HUD, and toolbar readability.

## Performance Considerations

Orbit projection is a fixed three-body pure calculation each simulation tick. Joystick graphics and menu subscriptions must be scene/UI-owned and must not accumulate resize, pointer, or keyboard listeners across scene re-entry.

## Migration Notes

No snapshot schema migration is introduced. Planet positions retain their existing JSON-safe `Vector2State` shape; their new values are deterministic projections of configured body IDs and active elapsed time. This follows the project rule against adding snapshot migrations before application maturity.

## References

- Product contract: `context/foundation/prd.md` (US-02, FR-010, FR-012, FR-014)
- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- Previous slice plan: `context/changes/anonymous-run-status/plan.md`
- Architecture: `context/foundation/architecture.md`
- Testing policy: `context/foundation/testing.md`
- State boundary: `src/game/state/AGENTS.md`
- Existing simulation and scene: `src/game/mechanics/gameSimulation.ts`, `src/game/scenes/gameScene.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deterministic Solar System and Direct Flight

#### Automated

- [ ] 1.1 Pure mechanics tests prove zero-time compatibility with the initial v3 planet order/positions, initial phase, CCW direction, distinct periods, full-period return, paused stability, configured radii, chunked-frame equivalence, and immutable input.
- [ ] 1.2 Mechanics and state continuity tests prove restore produces the same next orbital/flight state and Moolaris push-out reaches the exact configured clearance without HP or terminal-state changes.
- [ ] 1.3 Existing projectile and direct-flight tests prove planets no longer block shots or ship motion while Moolaris remains the sole obstacle: `npm.cmd run test:mechanics`.
- [ ] 1.4 Clock/provider tests prove orientation and menu reasons are unique, codec-valid, serializable, compose with existing pause reasons, and reconcile correctly after restore.
- [ ] 1.5 Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual

- [ ] 1.6 Observe all named planets moving CCW around stationary Moolaris; pause/focus loss freezes them, and the ship passes through planets but is pushed out of Moolaris without damage.
- [ ] 1.7 On a portrait touch layout, confirm held flight input is cleared and time stays paused until landscape resumes.

### Phase 2: Full-Viewport Touch Controls and Toolbar Menu

#### Automated

- [ ] 2.1 UI component tests cover English orientation text, highest-layer visibility, revised toolbar order, Anonymous status, compact-width layout, viewport-bounded details, dialog focus lifecycle, Escape/Close behavior, audio controls mounted only in the dialog, GameControlPort action dispatch, and end-game action dispatch.
- [ ] 2.2 Application tests cover desktop pointer flight unchanged; touch joystick visibility, direction, clamping, release, outside-touch non-steering, UI-camera masking, and resize; portrait pause/no clock progress/cleared input and post-restore reconciliation; menu pause/resume/teardown; and mobile fullscreen exit visibility/wiring.
- [ ] 2.3 Resize tests cover canvas-to-viewport dimensions, UI-camera/HUD anchors, Main Menu/Game/Game Over/Preloader reflow, orientation/fullscreen transitions, and unscaled world-object geometry: `npm.cmd run test:ui`.
- [ ] 2.4 Production and test TypeScript projects compile: `npm.cmd run typecheck`.

#### Manual

- [ ] 2.5 On a touch device, use the left-centre joystick comfortably without accidental steering from other screen touches; verify it stays screen-fixed through resize and right-side Cargo/Ship details do not overlap it.
- [ ] 2.6 Resize/rotate and enter/exit fullscreen; confirm canvas fills the viewport, world objects keep their proportions, portrait notice is topmost and pauses play, the toolbar remains readable, and the menu safely pauses play.

### Phase 3: Acceptance Coverage and Architecture Artifacts

#### Automated

- [ ] 3.1 Full unit, architecture, and desktop/touch Playwright suite passes: `npm.cmd run test:project`.
- [ ] 3.2 Code graph and logical data diagram regenerate and validate with no `REFACTOR_REQUIRED` finding.
- [ ] 3.3 Production build and both TypeScript projects pass: `npm.cmd run build-nolog` and `npm.cmd run typecheck`.

#### Manual

- [ ] 3.4 Complete menu-to-flight journey works at desktop and touch sizes: status and controls are readable, direct flight is responsive, Moolaris push-out is understandable, menu audio/fullscreen/end-game controls work, and no visual stretching or input regression is visible.
