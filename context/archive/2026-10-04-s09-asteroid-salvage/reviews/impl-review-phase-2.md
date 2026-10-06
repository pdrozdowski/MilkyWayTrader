<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S09 Asteroid Salvage Implementation Plan

- **Plan**: context/changes/s09-asteroid-salvage/plan.md
- **Scope**: Phase 2 of 4
- **Reviewed phases**: 2
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Spawned cargo does not begin at the asteroid destruction position

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/salvage/asteroidLoot.ts:30; src/game/mechanics/salvage/salvageSimulation.ts:17
- **Detail**: Loot records the asteroid's current polar angle, then the same simulation tick projects it as that angle plus the entire global `activeElapsedMs` orbit phase. A cargo spawned after the game has run therefore jumps away from the destruction position instead of beginning there and advancing from that moment.
- **Fix**: Store a phase aligned to the current active time, or store a creation timestamp and orbit relative to it; add a test that the first simulated cargo position equals the destroyed asteroid position.
  - Strength: Preserves the required state-to-world continuity at spawn.
  - Tradeoff: Changes the cargo orbit representation or its construction formula.
  - Confidence: HIGH — the current construction and projection formulas directly compose the incompatible phases.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — Cargo projectile targeting is order-dependent and ignores cargo movement

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/game/mechanics/gameSimulation.ts:348
- **Detail**: Projectile resolution selects the first matching entry in `orbitalCargo`, not the earliest swept collision. It treats every cargo as stationary at its end position even though cargo was advanced during the tick. A shot can damage a later-listed cargo ahead of an earlier target, or tunnel through moving cargo.
- **Fix**: Build swept projectile-versus-cargo candidates from each cargo's previous and current positions, order them by intersection time and stable ID, and resolve the earliest valid target.
  - Strength: Matches the existing deterministic swept-collision approach for asteroids.
  - Tradeoff: Requires retaining or deriving each cargo's start position during simulation.
  - Confidence: HIGH — `find` observes array order while asteroid resolution already orders swept candidates.
  - Blind spot: The desired tie-breaking rule for cargo IDs is inferred from the asteroid pattern.
- **Decision**: PENDING

### F3 — Loose items can tunnel through Moolaris on a long active tick

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/mechanics/salvage/salvageSimulation.ts:45
- **Detail**: Sun consumption checks only the post-move position. A sufficiently large active delta can carry an item through the sun and leave it alive beyond the opposite edge, violating the required sun-consumption lifecycle.
- **Fix**: Test the movement segment against the Moolaris circle and remove an item on any crossing; add a large-delta crossing test.
- **Decision**: PENDING

### F4 — Required salvage collision and commodity coverage is incomplete

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/game-mechanics.test.mjs:729
- **Detail**: The new tests prove exclusive branch existence, bounded zero-cost cargo, deterministic replay, and direct reducer calls. They do not prove every commodity is selectable, actual two-hit projectile collision behavior, cargo immunity to contact damage, or projectile immunity for loose items. Those cases are explicitly required by Phase 2 automated success criteria.
- **Fix**: Add focused `advanceGameSimulation` tests for commodity selection across seeds, cargo contact versus two projectile hits, and loose-item projectile pass-through.
- **Decision**: PENDING
