---
date: 2026-09-25T00:00:00+02:00
researcher: Codex
git_commit: 0cf3c332e05eb867be486446233c6379684f69f4
branch: main
repository: MilkyWayTrader
topic: "S-03 guided orbit, manual landing, launch, and route guidance"
tags: [research, orbit, landing, navigation, game-state]
status: complete
last_updated: 2026-09-25
last_updated_by: Codex
---

# Research: S-03 guided orbit, manual landing, launch, and route guidance

**Date**: 2026-09-25T00:00:00+02:00
**Researcher**: Codex
**Git Commit**: 0cf3c332e05eb867be486446233c6379684f69f4
**Branch**: main
**Repository**: MilkyWayTrader

## Research Question

What existing code and product constraints determine how S-03 should deliver advisory route guidance, orbit capture, manual landing, and launch?

## Summary

The current game has deterministic, active-time planet movement and direct pointer/joystick flight, but its planet landing indicator is presentation-only. S-03 must add a JSON-safe lifecycle to the snapshot and pure simulation rules while preserving player steering: capture follows a planet's displacement but never changes heading or velocity, and landing is initiated only by the player's manual flight into the planet centre.

## Detailed Findings

### Flight, planet movement, and the current landing seam

- `advanceGameSimulation` derives active delta from the authoritative clock and returns before movement when no active time elapsed; when active, it advances ship flight and recalculates all configured planet positions from active elapsed time (`src/game/mechanics/gameSimulation.ts:65`, `src/game/mechanics/gameSimulation.ts:122`).
- The scene supplies a transient world target and the pure flight reducer turns that target into capped direct velocity; neither module has destination, waypoint, or autopilot state (`src/game/scenes/gameScene.ts:341`, `src/game/mechanics/spaceship/flight.ts:9`).
- Planet orbits are deterministic circular projections from configured periods and phase values (`src/game/mechanics/planet/orbit.ts:5`, `src/game/definitions/planetDefinitions.ts:15`).
- The existing 72 px surface-gap helper supplies proximity feedback only; it does not change state or the clock (`src/game/mechanics/planet/proximity.ts:1`, `src/game/objects/planet/planet.ts:160`).

### State, lifecycle, and presentation boundaries

- The snapshot currently has schema version 3 and no orbit or landed-planet fields (`src/game/state/gameStateSnapshot.ts:9`, `src/game/definitions/initialGameState.ts:8`). The codec validates the exact snapshot shape, so a new lifecycle requires corresponding codec and state tests (`src/game/application/gameStateCodec.ts:84`).
- `GameStateProvider` is the central atomic replacement boundary; Phaser objects synchronize read-only state and do not own authoritative gameplay fields (`src/game/application/gameStateProvider.ts:19`, `context/foundation/architecture.md:24`).
- `landed` is an existing composable pause reason, and the clock reducer already supports idempotent overlapping reasons (`src/game/state/gameClockState.ts:1`, `src/game/mechanics/clock/gameClock.ts:10`).
- Scene-level guidance belongs in a scene/effect projection, while planet-local rings and labels belong to the planet object (`src/game/objects/planet/planet.ts:146`, `context/foundation/architecture.md:30`).

### Product contract and agreed decisions

- The PRD requires a subtle full orbital path, both clockwise and counter-clockwise predicted distances, a shorter-route emphasis, no emphasis for effective equality, and no guidance outside the band or after capture (`context/foundation/prd.md:251`). It explicitly forbids guidance from changing velocity, heading, target, or control state (`context/foundation/prd.md:259`).
- Capture is automatic on entering the orbit zone, inherits planet displacement, and detaches when the ship flies beyond the zone; only landing pauses active time (`context/foundation/prd.md:260`, `context/foundation/prd.md:263`).
- This plan adopts a 100 px radial guidance band, dashed orbit rendering, CW/CCW values computed in world pixels and displayed in kilometres at 200 km per pixel. It uses the existing proximity radius as the capture zone.
- This plan adopts automatic capture without automatic steering; manual landing is available only while captured and occurs at distance at most 50 px from the planet centre. A landed modal presents status and deferred service information. Its explicit `LAUNCH` action resumes time and control; relanding remains blocked until the ship centre exits the planet definition radius.

## Code References

- `src/game/mechanics/gameSimulation.ts:58` - authoritative active-time simulation and direct-flight integration point.
- `src/game/mechanics/planet/orbit.ts:5` - deterministic planet position projection.
- `src/game/mechanics/planet/proximity.ts:1` - configured surface-gap threshold to reuse as capture radius.
- `src/game/state/gameStateSnapshot.ts:9` - versioned state aggregate.
- `src/game/application/gameStateCodec.ts:84` - strict snapshot validation boundary.
- `src/game/scenes/gameScene.ts:292` - existing clock/UI synchronization seam.
- `src/game/objects/planet/planet.ts:146` - planet-local proximity presentation.
- `tests/game-mechanics.test.mjs:74` - proximity and flight mechanics coverage.
- `tests/domain/gameState.test.mjs:132` - composable pause and restore coverage.
- `tests/ui/applicationUiTest.ts:129` - real-browser clock freeze/resume assertions.

## Architecture Insights

Persist capture, landed identity, and launch lock as JSON-safe authoritative state. Keep route geometry and display text derived, with no DOM or Phaser values in the snapshot. Use pure mechanics for transitions and state simulation; scene and objects collect input, render state, and clear transient held flight intent during modal lifecycle changes.

## Historical Context (from prior changes)

- S-02 deliberately retained pass-through planets until S-03 introduces capture semantics (`context/archive/2026-09-23-s02-direct-moving-system-flight/plan.md:80`).
- The S-02 plan established deterministic planet periods and surface-gap spacing as the foundation for this slice (`context/archive/2026-09-23-s02-direct-moving-system-flight/plan-brief.md:21`).
- A prior S-02 review found that held input must be cleared around pause/UI transitions; the landed modal must follow that rule (`context/archive/2026-09-23-s02-direct-moving-system-flight/reviews/impl-review-phase-5.md:34`).
- Per `context/foundation/lessons.md`, this early application must not add snapshot migrations; the new snapshot schema must reject old shapes rather than invent migration semantics.

## Related Research

Not applicable; no prior research artifact for this active change existed at the time of investigation.

## Open Questions

None. Product and implementation choices required by S-03 were resolved during planning.
