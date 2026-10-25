# Hide the Mobile Booster Button Until Purchase — Plan Brief

> Full plan: `context/changes/fix-booster-button-on-mobile/plan.md`
> Research: `context/changes/fix-booster-button-on-mobile/research.md`

## What & Why

The mobile touch boost button currently appears whenever the touch controls are visible, even when the booster is still locked. This plan ties the button's visibility to the existing booster ownership state so players see the control after purchase.

## Starting Point

The Phaser scene lays out the fire and boost buttons together in `GameScene.layoutScreenSpace()`. The game already stores booster ownership in `shipStatus.boosterUnlocked`; purchase updates that state, but does not explicitly refresh the scene layout.

## Desired End State

On touch layouts, the boost button stays hidden until the booster is owned, then appears immediately after purchase. Existing touch-control visibility continues to govern it, and fire and desktop keyboard controls behave as before.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Ownership signal | Use `shipStatus.boosterUnlocked` | It is the existing authoritative purchase result | Research |
| Visibility rule | Require both touch-layout eligibility and ownership | Preserves current layout behavior while hiding a locked booster | Plan |
| Refresh timing | Reflect ownership changes without waiting for resize | Purchase does not directly rerun the layout function | Research and Plan |
| Scope | Presentation only; preserve mechanics and persisted state | The existing ownership and boost rules already enforce gameplay | Research |

## Scope

**In scope:**

- Hide the touch boost button while the booster is locked.
- Show it after purchase and preserve touch-layout eligibility behavior.

**Out of scope:**

- Changes to purchase, save-state, boost mechanics, fire control, or desktop keyboard control.

## Architecture / Approach

Keep the Phaser scene responsible for touch-control presentation. Derive boost-button visibility from touch-layout eligibility and the latest authoritative booster ownership, refreshing the presentation when ownership changes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Synchronize mobile boost visibility | Locked button hidden, purchased button visible, existing controls preserved | Ownership changes must refresh visibility immediately |

**Prerequisites:** None.  
**Estimated effort:** One small implementation and verification pass.

## Open Risks & Assumptions

- Assumes the current touch-layout eligibility remains the definition of when mobile controls are displayed.

## Success Criteria (Summary)

- The boost button is hidden on touch layouts before purchase and appears after purchase without a resize.
- Existing touch-control visibility, fire-button behavior, and desktop keyboard boost remain unchanged.
