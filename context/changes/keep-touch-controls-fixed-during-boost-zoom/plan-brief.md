# Keep Mobile Touch Controls Fixed During Boost Zoom — Plan Brief

> Full plan: `context/changes/keep-touch-controls-fixed-during-boost-zoom/plan.md`
> Frame brief: `context/changes/fix-booster-button-on-mobile/frame.md`

## What & Why

The mobile touch HUD is rendered in the same camera space as the world. The boost-driven main-camera zoom transforms the joystick, fire, and booster controls, so the actual issue is keeping the whole touch HUD screen-fixed through camera zoom, including its visual size and input area.

## Starting Point

The Game scene currently creates touch controls as ordinary display objects with `scrollFactor(0)`, while the main camera changes zoom during boost. The layout already calculates positions from the viewport, and the project architecture specifies a UI camera for viewport HUD.

## Desired End State

The mobile joystick, fire button, and unlocked booster button keep their screen position and size throughout boost zoom. Their hit areas remain aligned with their graphics, their touch interactions keep working, and scene re-entry does not duplicate the HUD or camera.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| HUD rendering strategy | Dedicated screen-space UI camera | The project architecture already assigns viewport HUD to a UI camera, independent from world transforms. | Plan |
| Scope | Mobile touch controls: joystick, fire, and booster | These are the controls reported to move and resize during boost zoom. | Frame |
| Touch verification | Check position, size, and actual touch behavior during zoom | This covers both the visible symptom and interaction target alignment. | Plan |
| Phase structure | One phase for camera ownership, input alignment, and verification | These changes form one cohesive screen-space HUD behavior. | Plan |
| Automated browser test | No new Playwright test; perform manual touch viewport verification | The existing harness cannot deterministically inspect individual Phaser canvas objects, and full-canvas snapshots would include a changing world. | Plan |

## Scope

**In scope:**

- Render mobile joystick, fire, and booster controls outside the boost-zoomed world-camera transform.
- Keep control layout, visibility rules, pointer interaction, and camera lifecycle consistent.

**Out of scope:**

- Boost zoom tuning or mechanics, booster purchase rules, non-touch HUD redesign, and persisted state changes.

## Architecture / Approach

Keep the main camera responsible for the world and boost zoom. Add a stable screen-space UI camera for the touch controls and joystick zone, filter both cameras deliberately, and preserve the existing viewport layout and pointer input flow.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Render and interact with touch controls in screen space | Fixed control position and size with aligned working touch targets. | Camera filters and input picking must use the same HUD viewport coordinates. |

**Prerequisites:** Existing booster visibility phase remains intact; obtain a run with the booster unlocked for zoom verification.
**Estimated effort:** One implementation phase with typecheck, fast checks, and mobile touch verification.

## Open Risks & Assumptions

- Phaser's camera filtering and input camera selection must leave each touch target interactive only in the HUD viewport; verify on a real touch viewport.
- A UI camera should be cleaned up on Game scene shutdown so scene re-entry cannot accumulate cameras.

## Success Criteria (Summary)

- All three mobile touch controls keep the same visible position and size through boost zoom.
- The touch targets remain aligned and joystick, fire, and booster input continue working during zoom.
- Booster visibility by ownership and desktop keyboard boost behavior are unchanged.
