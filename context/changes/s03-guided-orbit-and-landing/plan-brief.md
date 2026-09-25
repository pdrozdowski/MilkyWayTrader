# Guided orbit and landing — Plan Brief

> Full plan: `context/changes/s03-guided-orbit-and-landing/plan.md`
> Research: `context/changes/s03-guided-orbit-and-landing/research.md`

## What & Why

S-03 turns the current proximity-only planet indicator into a playable navigation loop: the player receives advisory route guidance, is captured into a moving orbit, manually flies into a planet to land, then launches again. This makes planets reachable without adding autopilot or prematurely implementing their market and shipyard services.

## Starting Point

The game already has direct flight, a shared active-time clock, deterministic planet positions, and a visual `LAND ON` proximity indicator. It has no persistent orbit/landing state, landing action, route renderer, or lifecycle connection between planets and the clock.

## Desired End State

Near an orbit, the player sees a subtle dashed path, planet name, and both projected CW/CCW distances in km. Entering the capture zone makes the ship follow only the planet's displacement while retaining direct steering; flying to the centre opens a paused status modal, and `LAUNCH` returns the player to manual flight without allowing an immediate accidental relanding.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Flight control | Guidance is advisory; capture never steers the ship | Direct control is a PRD guardrail. | PRD / Plan |
| Guidance | 100 px radial band, dashed path, CW/CCW km labels | Meets route-information requirements while keeping the world view subtle. | Plan |
| Distance display | 1 world px = 200 km | Geometry stays in existing world units while UI uses player-facing units. | Plan |
| Capture | Existing proximity radius, automatic state, relative displacement | Reuses a tested seam and preserves manual movement. | Research / Plan |
| Landing | Captured ship manually reaches within 50 px of centre | Landing remains a piloting action rather than automatic travel. | Plan |
| Launch | Explicit `LAUNCH` resumes time; lock clears outside definition radius | Prevents immediate relanding and makes time resumption clear. | Plan |
| Planet modal | Status plus deferred market/shipyard message | Establishes lifecycle now without consuming S-04/S-05 scope. | Plan |

## Scope

**In scope:** orbit guidance, capture/detach, landing and launch lifecycle, paused status modal, snapshot/codec changes, and targeted mechanics, state, architecture, UI, and browser tests.

**Out of scope:** markets, commodity prices, shipyard transactions, hazards, gravity, collision damage, destination selection, and any automated flight.

## Architecture / Approach

Pure mechanics calculate transition and route geometry from the authoritative snapshot. The provider commits the new lifecycle state; the scene turns player input into intents and renders derived guidance, while planet and DOM projections show local lifecycle state. All time-based effects continue through the shared clock.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Orbit, landing, and launch lifecycle | Restorable state, direct-control capture, modal, pause/resume, and relanding lock | State/clock ordering and stale held input |
| 2. Advisory route guidance | Dashed orbital guidance and correctly derived route distances | Visual clarity without changing controls |

**Prerequisites:** S-02 direct moving-system flight is complete.
**Estimated effort:** ~2–3 focused sessions across 2 phases.

## Open Risks & Assumptions

- Schema version advances without a migration because no durable save backend exists and the project lesson forbids premature migrations.
- The existing proximity threshold is the capture zone; a later balance pass may tune it without changing lifecycle semantics.

## Success Criteria (Summary)

- The player can manually reach, orbit, land on, and launch from each configured planet while active time pauses only when landed.
- Guidance presents both calculated routes but never changes player velocity, heading, target, or control state.
- Snapshot validation, pure mechanics, UI behavior, and browser interaction checks cover the new lifecycle.
