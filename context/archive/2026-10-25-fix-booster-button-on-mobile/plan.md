# Hide the Mobile Booster Button Until Purchase — Implementation Plan

## Overview

Hide the touch boost control while the ship's booster is locked, and show it once the booster has been purchased. Keep the existing touch-layout and death-transition visibility rules intact.

## Current State Analysis

`GameScene.layoutScreenSpace()` positions the fire and boost controls and currently gives both the same `touchLayoutVisible` condition. Booster ownership already lives in `shipStatus.boosterUnlocked`, starts false, and is set true by the purchase reducer. The layout runs on scene creation, resize, and touch-control visibility changes; the purchase path does not call it directly. See [research](research.md) for source-backed findings.

## Desired End State

On a touch layout, the boost button is hidden while `shipStatus.boosterUnlocked` is false and becomes visible after it changes to true. The existing touch-layout condition still controls whether touch controls are shown, so an unlocked booster does not expose the button when touch controls are hidden. Fire, desktop input, and the authoritative boost mechanics remain unchanged.

### Key Discoveries:

- `layoutScreenSpace()` applies the shared touch visibility condition to fire and boost at `src/game/scenes/gameScene.ts:403-429`.
- The authoritative ownership flag is `shipStatus.boosterUnlocked`, initialized false and set by the purchase reducer at `src/game/definitions/initialGameState.ts:61-63` and `src/game/application/planetShipServices.ts:157-162`.
- Touch controls are transient scene presentation/input and do not belong in the persisted snapshot; see `context/archive/2026-09-23-s02-direct-moving-system-flight/plan.md:168-189`.

## What We're NOT Doing

- Changing booster purchase rules, price, persisted state, or boost mechanics.
- Hiding or changing the fire button or desktop keyboard controls.
- Redesigning touch-control layout or adding new booster UI.

## Implementation Approach

Keep visibility derived from the current touch-layout eligibility and the latest booster ownership state. Ensure the scene refreshes this presentation when ownership changes, including immediately after purchase, while retaining the existing resize and touch-control refresh behavior.

## Phase 1: Synchronize mobile boost visibility with booster ownership

### Overview

Update the Game scene's boost-button presentation so the control is available on touch layouts only after the snapshot records an unlocked booster.

### Changes Required:

#### 1. Game scene touch control visibility

**File**: `src/game/scenes/gameScene.ts`

**Intent**: Hide the boost button until the booster is owned, and reveal it after purchase. Preserve the current touch-layout and death-transition rules.

**Contract**: The boost button is visible exactly when touch controls are eligible for display and the latest `shipStatus.boosterUnlocked` value is true. Its visibility is refreshed when the ownership state changes as well as when the scene lays out or refreshes touch controls. The fire button and keyboard input keep their current behavior.

### Success Criteria:

#### Automated Verification:

- TypeScript typecheck passes with `npm.cmd run typecheck`.

#### Manual Verification:

- On a touch viewport with a new run, the boost button is hidden while the booster is locked.
- After purchasing the booster, the boost button appears without requiring a resize or scene restart.
- When the booster is owned, hiding touch controls hides the boost button; showing them restores it.
- The fire button and desktop keyboard boost behavior remain unchanged.

## Testing Strategy

Use the TypeScript typecheck for the scene contract. Verify the Phaser touch presentation manually at a touch viewport because this change concerns visibility of a scene-owned canvas control. Do not add domain or mechanics tests: ownership and boost eligibility already have coverage at their authoritative layers, while this change only changes scene presentation.

## Performance Considerations

No material performance impact is expected; visibility is reconciled with scene presentation state.

## Migration Notes

None. No state shape or persistence changes are planned.

## References

- Research: `context/changes/fix-booster-button-on-mobile/research.md`
- Touch control layout: `src/game/scenes/gameScene.ts:403-429`
- Booster ownership and purchase: `src/game/state/shipStatusState.ts:1-12`, `src/game/application/planetShipServices.ts:157-162`
- Architecture: `context/foundation/architecture.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append — <commit sha> when a step lands. Do not rename step titles.

### Phase 1: Synchronize mobile boost visibility with booster ownership

#### Automated

- [x] 1.1 TypeScript typecheck passes with `npm.cmd run typecheck`. — cf26cda
#### Manual

- [x] 1.2 Touch viewport hides the locked booster button and shows it after purchase without resize or scene restart. — cf26cda
- [x] 1.3 When the booster is owned, hiding touch controls hides the boost button; showing them restores it. — cf26cda
- [x] 1.4 The fire button remains unchanged. — cf26cda
- [x] 1.5 Desktop keyboard boost behavior remains unchanged. — cf26cda