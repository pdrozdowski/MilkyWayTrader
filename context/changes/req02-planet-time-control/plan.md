# Planet Menu Time Control â€” Implementation Plan

## Problem and Outcome

The actual problem to plan around is: define safe on-planet time progression across all landing menus, because the current `landed` pause reason simultaneously enforces clock pause and ship input safety, while the full active simulation also advances markets and hazards.

Players need a persistent Play/Pause control on the Planet hub, Market, Facilities, and Shipyard. Playing from a planet menu advances active time and economies while retaining landed input and asteroid safety; any independent environmental pause still holds the clock.

## Current State Analysis

- The clock advances only when `pauseReasons` is empty. Landing currently requires the `landed` pause reason, which both pauses time and prevents flight input.
- Active simulation advances facility cycles for every market and also advances orbital hazards and impact resolution.
- The three service menus share a header with a display-only clock; the landing UI port has no time-control action. The Planet hub is a separate menu surface.
- The agreed behavior separates the player's run/pause choice from environmental pause reasons and landed lifecycle safety. It supersedes the earlier assumption that nothing advances while landed.

## Goals

- Let the player explicitly start and pause active time from all planet menus, including the Planet hub.
- Keep landing safe while active time and planetary economy advance.
- Preserve independent pause causes: Play does not override background or other environmental pauses, and the player's run choice resumes automatically when blockers clear.
- Keep time control, clock/resource status, and navigation behavior consistent across planet menus.

## Non-Goals

- Changing general flight time controls or the meaning of unrelated pause reasons.
- Adding save-backend support or migration from older state schemas.
- Adding new facility or market economy rules.
- Implementing the debt-run timeout outcome; that behavior belongs to a separate story.
- Reworking the flight HUD or planet service interactions beyond the shared time/status presentation and hub header.

## Decisions and Constraints

- A landing starts with the player-paused choice set, so time begins paused and the player must press Play.
- The player pause is authoritative state (`playerPaused`); environmental pause reasons remain independently composable.
- Effective clock state is paused if `playerPaused` is true or any environmental pause reason remains.
- Landing lifecycle, rather than an active-clock pause reason, gates flight input and landed ship safety.
- Launch clears the planet-only player pause; environmental blockers continue to hold time.
- While Play is active, all markets' facility cycles and the active simulation continue. The landed ship remains attached to its moving planet, receives no free-flight steering/boost/fire behavior, and is protected from asteroid impacts.
- The state schema advances to v18. Version 17 is rejected; no migration is added because there is no active save backend and repository lessons favor explicit schema changes over speculative migration.
- The Planet hub uses the same full-width shared header structure and presentation as Market, Facilities, and Shipyard, with its Back button hidden. The clock and Play/Pause stay left; credits and cargo stay right with transparent counters. On narrow screens the resources wrap to a second right-aligned row, and service buttons begin below the header. An animated LANDED badge sits above the planet name at lower left.

## Implementation Approach

Introduce `playerPaused: boolean` in `GameClockState`, defaulting to true on landing. Update clock advancement so it requires both `playerPaused === false` and no environmental pause reasons. Remove landing from the clock pause-reason invariant while retaining landing lifecycle checks at scene and simulation boundaries. On launch clear the player pause. Keep environmental pause add/remove operations scoped to their own reasons, so a background pause continues to hold time after Play is pressed.

Update the game-state codec and default state to schema v18, with v17 rejected. Revise the PRD to describe the landed running-time capability and run the required `10x-prd-en-capability` deterministic and semantic validations.

Extend clock projections and the landing UI port/adapter with the player's toggle action and effective state. Provide one accessible shared Play/Pause control and full-width resource/clock header to Market, Facilities, Shipyard, and the Planet hub. Preserve service-menu Back navigation and hide the Back button in the hub while keeping the clock/control left and transparent credit/cargo counters right.

At the simulation boundary, retain planet-relative attachment and disable flight input/actions while landed. Gate asteroid impact damage to the landed ship while allowing time, facility cycles, and the rest of active simulation to advance. Verify that the landed running clock reaches its active-time budget; timeout outcome handling belongs to a separate story.

## Files and Contracts

| File / area | Intent | Contract |
| --- | --- | --- |
| `context/foundation/prd.md` | Update the landed time-control capability and acceptance criteria. | Landing may run active time and economies by player choice; environmental pauses still hold the clock and landing remains safe. Run the required PRD capability validator and semantic review. |
| `src/game/state/gameClockState.ts` and initial-state construction | Add authoritative player pause state. | `playerPaused` is a boolean; a newly landed planet begins paused. |
| `src/game/mechanics/clock/gameClock.ts` and clock projections | Apply effective pause policy. | Clock advances only when the player has requested running and no environmental pause reason is active. |
| `src/game/application/gameStateCodec.ts` | Validate the new state shape. | Encode/decode schema v18; reject v17; no landed-reason requirement for clock pause. |
| Landing/launch lifecycle and `src/game/scenes/gameScene.ts` | Keep flight input and lifecycle safe independently of clock state. | Landing gates flight controls; launch clears the player-only pause; unrelated environmental reasons remain untouched. |
| `src/game/mechanics/gameSimulation.ts` and collision mechanics | Permit active simulation while protecting a landed ship. | Facility cycles and active simulation continue; landed ship remains planet-relative and cannot be damaged by asteroid impacts while landed. |
| `src/ui/contracts.ts`, `src/ui/adapters/`, landing clock/header/status components | Expose consistent player control and status. | Play/Pause toggles player intent only; effective paused/running status reflects environmental blockers; all planet menus stay synchronized. |
| Planet hub menu component(s) | Reuse the shared landing header and add the hub service layout. | Hub uses the full-width shared header with Back hidden; clock/control remain left and transparent credit/cargo counters right; narrow layouts wrap resources right and keep services below; animated LANDED badge appears above the planet name at lower left. |
| Clock, codec, lifecycle, simulation, adapter, and UI unit/integration suites | Cover the changed contracts at their appropriate level. | Tests cover landing default, toggle, blocker composition and auto-resume, launch, landed movement/safety, economy ticks, countdown-to-budget while landed, and UI action/state projection. |

## Phase 1: Authoritative Clock and Safe Landed Simulation

### Intent

Separate player run/pause intent from environmental blockers and landing safety, then make active simulation safe when it advances during landing.

### Success Criteria

**Automated**

- Clock/state tests prove landing starts paused; Play/Pause updates player intent; all-market economy advances only while effectively running; environmental blockers hold time and auto-resume after clearing; Launch clears only the player pause; the landed running clock reaches its active-time budget. Timeout outcome handling is a separate story.
- Codec, lifecycle, and mechanics tests prove schema v18 behavior, landed ship planet-relative movement, disabled flight actions, and asteroid-impact protection while active time advances.
- `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

**Manual**

- The PRD's updated behavior and acceptance criteria pass semantic review against the agreed landed-running and safety behavior.

### Verification Approach

Use focused unit/mechanics coverage for clock and simulation rules, codec and lifecycle integration coverage for authoritative transitions, then the repository's fast and TypeScript validation commands. Manually review the PRD against the player's observed behavior.

## Phase 2: Shared Landing Controls and Planet Hub Header

### Intent

Make player time control and resource/clock status available consistently across the hub and all planet service menus.

### Success Criteria

**Automated**

- Landing UI/adapter tests verify the shared accessible Play/Pause control, action routing, state rendering under environmental blockers, and component cleanup across Market, Facilities, Shipyard, and the hub.
- UI projection tests verify clock, credits, cargo, hub navigation/layout contract, and consistent toggle state across menus.
- `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

**Manual**

- In a browser, verify responsive layout and control behavior on the Planet hub, Market, Facilities, and Shipyard; pressing Play advances time while landed, Pause stops it, backgrounding holds it and clears back to the chosen player state, and Launch resumes unless another pause reason remains.

### Verification Approach

Cover state-to-view and view-to-action contracts with lower-level UI/adapter tests. Perform a browser walkthrough of each planet menu and responsive layout because the visible shared control and hub composition are browser presentation risks.

## Testing Strategy

### Unit and Mechanics Tests

- Clock policy: paused by player choice; running only after Play when no environmental blocker exists; multiple reasons compose; removing one blocker does not clear others.
- State lifecycle and codec: landing default, launch behavior, schema v18 acceptance, v17 rejection.
- Simulation: all markets' facility cycles progress while effectively running; landed ship stays attached to planet movement, ignores flight inputs/actions, and receives no asteroid impact damage; the countdown reaches its active-time budget while landed. Timeout outcome handling belongs to a separate story.

### UI and Adapter Tests

- Toggle updates only player intent and renders the effective state after blocker composition.
- Shared control routes correctly in Market, Facilities, Shipyard, and hub; listeners clean up with menu teardown.
- Hub header projects clock/resources and its distinct navigation/service/badge layout contract.

### Manual Testing Steps

1. Land and confirm time is paused until Play is pressed; check the control from the hub and each service menu.
2. Press Play and confirm active time and facility production advance while the ship remains attached to the planet, cannot be steered or fired, and takes no asteroid damage.
3. Pause manually, then test backgrounding while running: effective time pauses in the background and resumes only if the player's choice remains Play.
4. Launch while running and while an environmental blocker is active; confirm the player-only pause clears and other blockers remain effective.
5. Let the active-time countdown reach its budget from a landed running state. Timeout outcome resolution is verified by its separate story.

## Risks and Mitigations

- **Pause ownership can become coupled again.** Keep `playerPaused` separate from named environmental reasons and test overlapping blockers.
- **Landed safety may be enforced at only one simulation seam.** Trace and test steering, boost/fire, planet-relative movement, and collision damage as separate outcomes.
- **Running all active simulation while landed may alter hazards and other worlds.** This is intentional under the agreed active-time behavior; make all-market facility ticking explicit in tests and preserve landed ship protection.
- **PRD and codec contracts can drift from runtime behavior.** Update and validate the PRD in Phase 1, and test v18 encode/decode constraints.

## Performance Considerations

No new per-frame work is expected beyond existing simulation and UI state projection. The active simulation already advances the same systems while running in flight; the added pause predicate and landed impact gate are constant-time checks.

## Migration Notes

Advance the authoritative game-state schema to v18. Reject v17 instead of migrating it; there is no active save backend, and migration behavior is outside this change.

## References

- Frame: `context/changes/req02-planet-time-control/frame.md`
- Research: `context/changes/req02-planet-time-control/research.md`
- Architecture: `context/foundation/architecture.md`
- Testing conventions: `context/foundation/testing.md`
- State workflow: `.agents/skills/utils-add-state/SKILL.md`
- PRD capability validation: `.agents/skills/10x-prd-en-capability/SKILL.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` â€” <commit sha>` when a step lands.

### Phase 1: Authoritative Clock and Safe Landed Simulation

#### Automated

- [x] 1.1 Clock/state tests prove landing starts paused; Play/Pause updates player intent; all-market economy advances only while effectively running; environmental blockers hold time and auto-resume after clearing; Launch clears only the player pause; the landed running clock reaches its active-time budget. Timeout outcome handling is a separate story. â€” 08aa9d4
- [x] 1.2 Codec, lifecycle, and mechanics tests prove schema v18 behavior, landed ship planet-relative movement, disabled flight actions, and asteroid-impact protection while active time advances. â€” 08aa9d4
- [x] 1.3 `npm.cmd run test:fast` and `npm.cmd run typecheck` pass. â€” 08aa9d4

#### Manual

- [x] 1.4 The PRD's updated behavior and acceptance criteria pass semantic review against the agreed landed-running and safety behavior. â€” 08aa9d4

### Phase 2: Shared Landing Controls and Planet Hub Header

#### Automated

- [x] 2.1 Landing UI/adapter tests verify the shared accessible Play/Pause control, action routing, state rendering under environmental blockers, and component cleanup across Market, Facilities, Shipyard, and the hub.
- [x] 2.2 UI projection tests verify clock, credits, cargo, hub navigation/layout contract, and consistent toggle state across menus.
- [x] 2.3 `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

#### Manual

- [ ] 2.4 In a browser, verify responsive layout and control behavior on the Planet hub, Market, Facilities, and Shipyard; Play advances time while landed, Pause stops it, backgrounding holds it and clears back to the chosen player state, and Launch resumes unless another pause reason remains.
