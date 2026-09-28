# Guided orbit and landing — Plan Brief

> Full plan: `context/changes/s03-guided-orbit-and-landing/plan.md`
> Research: `context/changes/s03-guided-orbit-and-landing/research.md`

## What & Why

S-03 turns the current proximity-only planet indicator into a playable navigation loop: permanent dashed orbital paths make each planet's route visible, then the player is captured into a moving orbit, manually flies into a planet to land, and launches again. This makes planets reachable without adding autopilot or prematurely implementing their market and shipyard services.

## Starting Point

The game already has direct flight, a shared active-time clock, deterministic planet positions, and a visual `LAND ON` proximity indicator. It has no persistent orbit/landing state, landing action, route renderer, or lifecycle connection between planets and the clock.

## Desired End State

From boot, the player sees three subtle dashed orbital paths with a 50 px visible / 10 px gap pattern. Entering a capture zone makes the ship follow only the planet's displacement while retaining direct steering; flying to the centre opens a paused status modal, and `LAUNCH` returns the player to manual flight without allowing an immediate accidental relanding.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Flight control | Guidance is advisory; capture never steers the ship | Direct control is a PRD guardrail. | PRD / Plan |
| Orbit paths | Three permanent dashed rings, 50 px visible / 10 px gap | Gives a stable visual reference without runtime route solving or dynamic presentation. | Plan |
| Capture | Existing proximity radius, automatic state, relative displacement | Reuses a tested seam and preserves manual movement. | Research / Plan |
| Landing | Captured ship manually reaches within 50 px of centre | Landing remains a piloting action rather than automatic travel. | Plan |
| Launch | Explicit `LAUNCH` resumes time; lock clears outside definition radius | Prevents immediate relanding and makes time resumption clear. | Plan |
| Planet modal | Status plus deferred market/shipyard message | Establishes lifecycle now without consuming S-04/S-05 scope. | Plan |

## Scope

**In scope:** permanent dashed orbital paths, capture/detach, landing and launch lifecycle, paused status modal, snapshot/codec changes, and targeted mechanics, state, architecture, UI, and browser tests.

**Out of scope:** markets, commodity prices, shipyard transactions, hazards, gravity, collision damage, destination selection, and any automated flight.

## Architecture / Approach

Pure mechanics calculate lifecycle transitions from the authoritative snapshot. The provider commits the new lifecycle state; the scene turns player input into intents and owns a one-time static orbital-path projection, while planet and DOM projections show local lifecycle state. All time-based effects continue through the shared clock.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Orbit, landing, and launch lifecycle | Restorable state, direct-control capture, modal, pause/resume, and relanding lock | State/clock ordering and stale held input |
| 2. Permanent static orbital paths | Three always-visible dashed orbit rings | Render cost without per-frame redraws or gameplay coupling |

**Prerequisites:** S-02 direct moving-system flight is complete.
**Estimated effort:** ~2–3 focused sessions across 2 phases.

## Open Risks & Assumptions

- Schema version advances without a migration because no durable save backend exists and the project lesson forbids premature migrations.
- The existing proximity threshold is the capture zone; a later balance pass may tune it without changing lifecycle semantics.

## Success Criteria (Summary)

- The player can manually reach, orbit, land on, and launch from each configured planet while active time pauses only when landed.
- All configured orbital paths remain visible as dashed rings without route text and never change player velocity, heading, target, or control state.
- Snapshot validation, pure mechanics, UI behavior, and browser interaction checks cover the new lifecycle.
