# Keep Mobile Touch Controls Fixed During Boost Zoom — Implementation Plan

## Overview

Keep the mobile joystick, fire button, and booster button at a stable screen position and size while the world camera zooms out during booster flight. Preserve their touch interaction throughout the zoom.

## Current State Analysis

`Game` uses the main camera for the scene and changes its zoom according to `state.ship.boosting` in `Game.update()` (`src/game/scenes/gameScene.ts:612-617`). The joystick graphics and zone, plus fire and booster images, are scene display objects with `setScrollFactor(0)` (`src/game/scenes/gameScene.ts:356-369`). This removes camera scrolling from their transform, but the main camera zoom still scales and displaces them.

`layoutScreenSpace()` calculates control positions and button sizes from the viewport, and runs on scene setup, resize, and touch-control visibility changes (`src/game/scenes/gameScene.ts:167-171, 318, 413-444`). It does not run during boost zoom. Joystick handling uses screen pointer coordinates (`src/game/scenes/gameScene.ts:298-306, 397`), so the rendering camera and hit-testing behavior must remain aligned.

The architecture already specifies that viewport HUD uses the UI camera (`context/foundation/architecture.md`, Presentation ownership). The existing change `fix-booster-button-on-mobile` controls booster visibility based on ownership; this plan preserves that behavior and addresses the separate zoom issue.

### Key Discoveries:

- `scrollFactor(0)` does not cancel camera zoom; the main camera zoom changes continuously during boost (`src/game/scenes/gameScene.ts:356-369, 612-617`).
- The viewport layout is already computed independently of boost and should remain the source of control positions and sizes (`src/game/scenes/gameScene.ts:413-444`).
- Architecture expects viewport HUD to use the UI camera (`context/foundation/architecture.md`, Presentation ownership).
- Touch pointer coordinates are used directly for joystick positioning and direction (`src/game/scenes/gameScene.ts:298-306, 397`).

## Desired End State

On a mobile touch viewport, the joystick, fire button, and unlocked booster button remain at the same screen coordinates and display sizes while boost zoom enters, stays active, and exits. Their interactive regions remain aligned with their visible graphics, and all three controls continue to work. Existing booster ownership visibility and desktop keyboard behavior remain unchanged.

## What We're NOT Doing

- Changing the boost camera zoom amount, timing, or flight mechanics.
- Changing booster purchase rules or the ownership-based visibility contract from `fix-booster-button-on-mobile`.
- Redesigning the touch-control layout or changing non-touch HUD elements.
- Persisting camera or touch-control presentation state.

## Implementation Approach

Render the touch-control objects through a dedicated screen-space UI camera whose viewport and zoom remain independent of the world camera. Configure the world and UI cameras so the game world is rendered once by the world camera and the joystick graphics, joystick zone, fire button, and booster button are rendered and hit-tested in the UI camera's viewport coordinates. Keep `layoutScreenSpace()` as the position/size source and preserve the existing pointer-based input flow. Own the additional camera through the Game scene lifecycle so scene shutdown and re-entry do not leave stale cameras or duplicate rendering/input.

## Critical Implementation Details

### Camera filtering and input

An added camera sees scene objects unless its render list is filtered. Assign camera visibility deliberately so the world is not drawn twice and the touch controls are not transformed by the world camera. Confirm Phaser input resolves interactive game objects against the UI camera; pointer coordinates used by the joystick must continue to match the HUD viewport coordinates.

### Scene lifecycle

The Game scene registers shutdown cleanup in `create()` (`src/game/scenes/gameScene.ts:192+`). The additional camera must be removed or otherwise reset at the same lifecycle boundary so restarting or re-entering the scene cannot accumulate cameras.

## Phase 1: Render and interact with touch controls in screen space

### Overview

Move the mobile touch HUD out of the boost-zoomed world-camera transform while preserving its layout, visibility, pointer input, and scene lifecycle.

### Changes Required:

#### 1. Game scene touch HUD camera ownership

**File**: `src/game/scenes/gameScene.ts`

**Intent**: Render the joystick, fire button, booster button, and joystick input zone in a screen-space camera layer so camera zoom on the world cannot change their apparent position or size. Keep the HUD objects and input zone on the same screen-space coordinate system.

**Contract**: The world camera continues to render and zoom the game world. A stable UI camera renders the touch controls at viewport coordinates, excluding those controls from the world camera and excluding world objects from the UI camera. `layoutScreenSpace()` remains responsible for their viewport position and size; the joystick, fire, and boost pointer handlers continue to receive input at the visible control locations. Camera creation and cleanup are owned by the Game scene lifecycle. Existing touch visibility rules, including booster ownership, remain in effect.

### Success Criteria:

#### Automated Verification:

- TypeScript typecheck passes with `npm.cmd run typecheck`.
- Focused fast checks pass with `npm.cmd run test:fast`.

#### Manual Verification:

- On a mobile touch viewport, compare the joystick and fire/unlocked-booster controls before, during, and after boost zoom; their screen positions and display sizes do not change.
- During boost zoom, the joystick steers, fire activates, and the booster button activates/releases boost; visible controls and touch targets remain aligned.
- The booster button remains hidden while locked and appears after purchase; desktop keyboard boost behavior remains unchanged.
- Return to the menu and start another run; the touch HUD renders once and responds without duplicate camera or input behavior.

## Testing Strategy

Use `npm.cmd run typecheck` for scene and camera API typing, and `npm.cmd run test:fast` for the existing unit and architecture checks affected by a scene-level integration change. Verify camera rendering, visual anchoring, and real pointer hit-testing manually on a touch viewport because those behaviors depend on Phaser's browser renderer and camera input routing. Do not add a Playwright test: the current test harness has no deterministic way to inspect individual Phaser canvas objects, and a full-canvas image assertion would mix the HUD with the changing world; manual comparison plus direct touch interaction gives a clearer signal for this visual risk.

## Performance Considerations

The UI camera renders only the small touch HUD set and does not change authoritative simulation state. Avoid rendering world objects a second time through the UI camera.

## Migration Notes

None. This changes transient scene presentation only; no saved state or snapshot shape changes.

## References

- Frame brief: `context/changes/fix-booster-button-on-mobile/frame.md`
- Existing booster visibility plan: `context/changes/fix-booster-button-on-mobile/plan.md`
- Touch controls and layout: `src/game/scenes/gameScene.ts:356-369, 413-444`
- Boost camera zoom: `src/game/scenes/gameScene.ts:612-617`
- Camera and screen-space HUD ownership: `context/foundation/architecture.md`, Presentation ownership
- Test policy: `context/foundation/testing.md`, UI behavior and Commands and failures

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Render and interact with touch controls in screen space

#### Automated

- [x] 1.1 TypeScript typecheck passes with `npm.cmd run typecheck`.
- [x] 1.2 Focused fast checks pass with `npm.cmd run test:fast`.

#### Manual

- [x] 1.3 On a mobile touch viewport, compare the joystick and fire/unlocked-booster controls before, during, and after boost zoom; their screen positions and display sizes do not change.
- [x] 1.4 During boost zoom, the joystick steers, fire activates, and the booster button activates/releases boost; visible controls and touch targets remain aligned.
- [x] 1.5 The booster button remains hidden while locked and appears after purchase; desktop keyboard boost behavior remains unchanged.
- [x] 1.6 Return to the menu and start another run; the touch HUD renders once and responds without duplicate camera or input behavior.
