# Frame Brief: Asteroid cargo appears away from its kill

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

“I see only once cargo shown, but i was in completely different place than the I asteroid shot - the cargo should appear there!”

## Initial Framing (preserved)

- **User's stated cause or approach**: Cargo is shown in a different place from the asteroid that was shot.
- **User's proposed direction**: Manual-check plan item 3.3; cargo should appear at the killed asteroid.
- **Pre-dispatch narrowing**: Cargo does appear once; the issue is its world position rather than absence of all drops.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Eligible-kill scheduling** — a wrong kill classification could create an unexpected drop count.
2. **Asteroid-loot construction** — cargo could be created with a coordinate unrelated to the killed asteroid.
3. **Post-spawn orbital simulation** — a valid spawn coordinate could be overwritten before presentation.  ← initial framing
4. **Debug cargo reducer** — debug and asteroid cargo could use incompatible orbit initialization.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Eligible-kill scheduling causes the position | Projectile small-asteroid kills consume the five-slot schedule, but the schedule only selects cargo versus loose/none; `gameSimulation.ts:194-210`, `:335-345`. | NONE |
| Loot construction starts at the wrong coordinate | `spawnAsteroidLoot()` copies `asteroid.position` into the new cargo; `asteroidLoot.ts:42-47`. | NONE |
| Post-spawn orbit moves new cargo immediately | The same state transition passes new cargo to `advanceOrbitalCargo()`; `gameSimulation.ts:240`. That function replaces its position from Moolaris and total active time; `salvageSimulation.ts:14-23`. | STRONG |
| Debug and asteroid initialization diverge | Debug cargo subtracts the current active-time orbit phase; `spawnDebugCargo.ts:22-35`. Asteroid cargo does not; `asteroidLoot.ts:42-47`. The debug test confirms its first advance preserves its spawn position; `tests/game-mechanics.test.mjs:809-828`. | STRONG |

## Narrowing Signals

- The reported cargo is visible once, so the count schedule is not the primary symptom.
- A newly killed asteroid cargo starts at the right coordinate, then is immediately advanced with an uncorrected phase.

## Cross-System Convention

Orbital cargo is authoritative state and is advanced from a phase plus active time. The existing debug reducer already follows the required convention: initialize the phase so the first orbit advance retains the requested world position.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: asteroid-loot cargo does not normalize its orbit phase to the current active time, so its first same-tick orbital simulation relocates it away from the destroyed asteroid.

The deterministic five-kill schedule is functioning and is independent of coordinates. The asteroid-loot initializer must meet the same first-advance position-preservation contract as the debug-cargo initializer, with focused coverage for the killed-asteroid position.

## Confidence

- **HIGH** — direct code-path evidence, a matching debug-cargo implementation, and the symptom all agree.

## What Changes for /10x-plan

Plan a narrowly scoped authoritative salvage fix: normalize asteroid cargo's orbital phase at spawn and add a regression test proving the first simulation advance keeps it at the kill coordinate. Do not alter the five-kill schedule.

## References

- Source files: `src/game/mechanics/salvage/asteroidLoot.ts:42-47`, `src/game/mechanics/gameSimulation.ts:194-240`, `src/game/mechanics/salvage/salvageSimulation.ts:14-23`, `src/game/mechanics/debug/spawnDebugCargo.ts:22-35`
- Tests: `tests/game-mechanics.test.mjs:762-828`
- Investigation tasks: `/root/cargo_position`, `/root/kill_schedule`
