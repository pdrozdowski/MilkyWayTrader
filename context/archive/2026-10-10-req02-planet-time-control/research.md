---
date: 2026-10-10T20:12:59+02:00
researcher: Codex
git_commit: dcd3970a78df93d44816e3a5b291aa0108802c13
branch: main
repository: MilkyWayTrader
topic: "Safe time control from planet menus"
tags: [research, clock, landing, simulation, planet-menu]
status: complete
last_updated: 2026-10-10
last_updated_by: Codex
---

# Research: Safe time control from planet menus

**Date**: 2026-10-10T20:12:59+02:00  
**Researcher**: Codex  
**Git Commit**: dcd3970a78df93d44816e3a5b291aa0108802c13  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

What must change to let the player start and stop active time from the Market, Facilities, and Shipyard planet menus, while planet economy advances during Play, other pause causes still stop time, and the landed ship remains safe from asteroid impacts?

## Summary

The current clock treats any non-empty `pauseReasons` list as paused, while the codec requires the `landed` reason whenever a planet is landed (`src/game/mechanics/clock/gameClock.ts:3-6`; `src/game/application/gameStateCodec.ts:341-342`). Therefore, clearing `landed` to make the clock run would violate the current state invariant, and retaining it leaves the clock paused. The landed pause reason also blocks flight input at the scene boundary (`src/game/scenes/gameScene.ts:459-464`).

When an active delta advances in `advanceGameSimulation`, the same update advances facility cycles over each entry in `state.markets` and proceeds into orbital simulation and impact resolution (`src/game/mechanics/gameSimulation.ts:81-85,179-181`). Existing landed gating blocks boost and firing, but the movement and collision paths still execute (`src/game/mechanics/gameSimulation.ts:92-127,129-130,179-181`). The requested landed safety therefore needs a distinct impact-protection rule, while the clock policy needs to allow active time during landing without letting `background`, `menu`, or other independent pause causes through.

The UI has a shared clock header mounted for Market, Facilities, and Shipyard, but its clock is currently display-only and the landing port exposes no time-control action (`src/ui/components/landingStatus.ts:505-507`; `src/ui/components/landingMenuHeader.ts:19-44`; `src/ui/components/landingClock.ts:14-44`; `src/ui/contracts.ts:76-94`). The design must separate the player’s requested run/pause state from environmental pause causes and from the `landed` lifecycle/safety state. No code was changed and no tests were run.

## Detailed Findings

### Clock state and pause reasons

- `advanceGameClock` returns the existing clock when `pauseReasons.length > 0`; when the list is empty and delta is positive, it advances `activeElapsedMs` up to `budgetMs` (`src/game/mechanics/clock/gameClock.ts:2-7`). The inspected `GamePauseReason` union contains `background`, `landed`, `manual`, `menu`, and `orientation` (`src/game/state/gameClockState.ts:1-7`).
- When a reason is added or removed, `pauseGameClock` and `resumeGameClock` change only the named reason (`src/game/mechanics/clock/gameClock.ts:9-19`). The controls adapter also checks and changes only the requested reason (`src/ui/adapters/gameControlsAdapter.ts:11-23`). This gives a reusable composition pattern for pause causes.
- If `landedPlanetId` is non-null, the current decoder requires `landed` in `pauseReasons`; if no planet is landed, it rejects `landed` in that list (`src/game/application/gameStateCodec.ts:341-342`). `encodeGameState` validates through the decoder and `GameStateProvider.restore` validates restored state through the same boundary (`src/game/application/gameStateCodec.ts:453`; `src/game/application/gameStateProvider.ts:36`).
- The scene adds/removes `background` on focus loss/gain (`src/game/scenes/gameScene.ts:431-438`). Thus, under the current clock predicate, a `background` reason continues to stop active time even if another policy permits time while landed (`src/game/mechanics/clock/gameClock.ts:3-6`).
- The existing `manual` reason is also used by Cargo Transfer visibility to pause and resume time (`src/ui/adapters/cargoTransferAdapter.ts:96-97`). Reusing that same reason for a persistent player toggle would need careful ownership so one control cannot clear a pause established by another.

### Active simulation and landed safety

- If `advanceGameClock` produces no active delta, `advanceGameSimulation` returns before market or world updates; when active time advances, the simulation calculates facility cycles and calls `advancePlanetFacilities` for each element of `state.markets` (`src/game/mechanics/gameSimulation.ts:81-85`). Planetary facility production is therefore coupled to active clock progression and currently applies across the markets collection, not just the open planet.
- In the active simulation path, the landed flag is checked when deciding boost and firing, while the ship target/movement calculations and position updates are not guarded by the landed flag (`src/game/mechanics/gameSimulation.ts:92-127,129-130`). The scene independently treats `landed` as an input-blocking pause reason (`src/game/scenes/gameScene.ts:459-464`). These are separate safety seams to preserve when time runs.
- The active simulation advances asteroid motions and calls impact resolution (`src/game/mechanics/gameSimulation.ts:179-181`). The inspected collision path includes the ship in impact evaluation (`src/game/mechanics/gameSimulation.ts:272-285,323-327`). **Inference:** letting active time run under the existing collision path can still damage a landed ship; the user’s requirement needs impact protection that does not depend on freezing the clock.
- The current mechanics expectations cover landing adding the `landed` pause reason (`tests/game-mechanics.test.mjs:314`), landed flight input while also background-paused (`tests/game-mechanics.test.mjs:328-336`), and each listed pause reason including `landed` freezing active time and facility stocks (`tests/game-mechanics.test.mjs:1147-1167`). These tests document present behavior that conflicts with the newly confirmed run-while-landed requirement.

### Planet menu control surface

- `landingStatus.ts` mounts `mountLandingMenuHeader` separately for Market, Facilities, and Shipyard (`src/ui/components/landingStatus.ts:505-507`). The shared header renders the clock and back navigation (`src/ui/components/landingMenuHeader.ts:19-44`), so it is the shared presentation seam for the requested control.
- The current landing clock renders remaining time and `RUNNING`/`PAUSED` without a click handler (`src/ui/components/landingClock.ts:14-44`). Its projection derives `PAUSED` whenever `pauseReasons` is non-empty (`src/game/application/landedFacilities.ts:106-108`; `src/game/application/landedShipyard.ts:100-102`). A revised time policy needs matching clock projections so the icon and label reflect whether active time can actually advance under the remaining pause causes.
- `LandingStatusPort` contains market, facility, shipyard, and launch actions but no time-control operation (`src/ui/contracts.ts:76-94`). `GameControlsPort` covers menu and orientation pauses without a planet time toggle (`src/ui/contracts.ts:67-74`).

## Architecture Insights

The current model couples a persisted lifecycle invariant (`landed` is required while landed) to an active-clock pause predicate (any pause reason stops time). Scene input blocking also reads the `landed` reason. A coherent design must distinguish at least three concerns: whether the player requested time to run, whether an environmental pause cause is active, and whether the ship is landed and protected. Keeping independent pause causes composable avoids clearing browser-background, menu, orientation, or other pauses when the player presses Play.

The simulation is a shared active-time pipeline: facility cycles, planet motion, asteroid motion, projectiles, collisions, salvage movement, and terminal-time resolution share its active delta (`src/game/mechanics/gameSimulation.ts:81-85,137-181,238-254`). The user explicitly chose to advance active time and planetary economy while landed and to protect the ship from asteroid impacts. Whether other orbital simulation effects should continue during landed running remains to be specified in planning; the current pipeline advances them together when active time advances.

## Historical Context (from prior changes)

- **Supported as the earlier S16 decision, superseded for this change:** the S16 planetary-facilities brief says “Nothing advances while landed” (`context/archive/2026-10-08-s16-planetary-facilities/plan-brief.md:66-68`), and the archived S16 research says the landing view keeps the `landed` pause reason and facilities resume on launch (`context/archive/2026-10-08-s16-planetary-facilities/research.md:69-74`). Those statements describe the earlier accepted behavior; the current user has explicitly requested active time and economy while landed.
- **Current product-document conflict:** the PRD describes landing as a “safe, paused planning state” (`context/foundation/prd.md:24`), and its success criteria require continuous display of whether the clock is running or paused (`context/foundation/prd.md:34-36`). The new behavior changes the paused-landing assumption; planning should decide how the PRD is updated under the repository’s PRD workflow.

## Related Research

- `context/archive/2026-10-08-s16-planetary-facilities/research.md` — earlier facilities economy and landed-time contract.
- `context/changes/req02-planet-time-control/frame.md` — framing and confirmed player requirements for this change.

## Open Questions

- Which non-economic simulation effects should continue while landed Play is active? The current active-time pipeline moves planets, asteroids, projectiles, and salvage as it advances facility cycles (`src/game/mechanics/gameSimulation.ts:81-85,137-181,238-254`); the user has specifically required continued economy and asteroid-impact safety, but has not separately specified the other effects.
- What is the planned state boundary for the player’s run/pause choice so that the `landed` safety/lifecycle invariant remains valid and unrelated pause causes continue to hold? The present codec and pause predicate impose the constraints described above (`src/game/application/gameStateCodec.ts:341-342`; `src/game/mechanics/clock/gameClock.ts:3-6`).

