# Frame Brief: Keep touch controls fixed during boost zoom

## Reported observation

While flying with booster active, the camera zooms out and the mobile joystick, fire button, and booster button move toward the center and change size. The expected behavior is for all three controls to remain in the same screen position and size.

## Initial framing (preserved)

- **Observation:** The joystick and fire/booster buttons shift inward and change size while the boost camera zoom is active.
- **User's proposed direction:** Keep the controls in an unchanged position while the camera zooms out.
- **Pre-dispatch narrowing:** The affected controls are joystick, fire, and booster; both their screen position and size change.

## Evidence map

1. **Camera transform — user's framing; confirmed.** `Game.update()` derives a zoom target from `state.ship.boosting` and updates the main camera zoom each frame (`src/game/scenes/gameScene.ts:612-617`).
2. **Touch-control rendering — confirmed.** The joystick graphics and input zone, plus the fire and booster images, are scene objects with `setScrollFactor(0)` (`src/game/scenes/gameScene.ts:356-369`). They remain subject to camera zoom.
3. **Screen-space layout — unlikely primary cause.** `layoutScreenSpace()` positions and sizes these controls from viewport dimensions (`src/game/scenes/gameScene.ts:403-444`); it runs on scene setup, resize, and touch-control visibility changes, not on boost updates. The boost transition does not trigger a layout recalculation.
4. **Input hit area — may share the visual transform, not an independent cause.** The joystick zone uses the same main camera and zero scroll factor as its graphics (`src/game/scenes/gameScene.ts:358-360`). No evidence points to an independently changing hit area.

## Hypothesis review

| Hypothesis | Result | Evidence |
| --- | --- | --- |
| Main camera zoom transforms touch controls despite `scrollFactor(0)` | **Present** | The controls share the main camera; zoom changes during boost. Phaser's local transform matrix retains camera zoom while scroll factor affects camera-scroll translation (`node_modules/phaser/src/gameobjects/components/TransformMatrix.js:709-714`). |
| Viewport relayout moves controls when boost starts | **Absent as primary cause** | Layout is called on setup, resize, and touch-control toggles, but not in the boost zoom update (`src/game/scenes/gameScene.ts:167-171, 318, 403-444, 612-617`). |
| Separate joystick hit-area defect causes all visible changes | **Absent as primary cause** | Fire and booster visuals also shift and resize; all three are rendered by the main camera. The joystick zone shares that camera. |

## Reframed problem

The mobile touch HUD is rendered in the same camera space as the world. The boost-driven main-camera zoom transforms joystick, fire, and booster controls, so the actual issue is keeping the whole touch HUD screen-fixed through camera zoom, including its visual size and input area.

## Confidence

**HIGH** — source behavior and the local Phaser transform implementation explain the full reported symptom. Two independent source inspections agreed that viewport relayout or a standalone hit-area issue is not the primary cause.

## What changes for `/10x-plan`

Plan the touch HUD's behavior across camera zoom, covering joystick, fire, and booster position, display size, and touch interaction. The existing change only covers booster ownership visibility; the zoom behavior is a distinct scope that should be planned as a separate phase or change.

## References

- `src/game/scenes/gameScene.ts:356-369` — touch-control creation.
- `src/game/scenes/gameScene.ts:403-444` — viewport-based layout.
- `src/game/scenes/gameScene.ts:612-617` — boost-driven main-camera zoom.
- `node_modules/phaser/src/gameobjects/components/TransformMatrix.js:709-714` — camera matrix and scroll-factor transform.
- Investigation tasks: `frame_camera_zoom`, `frame_hud_input`.
