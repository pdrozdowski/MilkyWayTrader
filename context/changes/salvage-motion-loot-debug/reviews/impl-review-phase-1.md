<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Smooth Salvage Motion, Deterministic Cargo Drops, and Debug Spawn Implementation Plan

- **Plan**: context/changes/salvage-motion-loot-debug/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Codec permits an impossible marker-free full schedule

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/application/gameStateCodec.ts:109
- **Detail**: The decoder accepts `cargoSchedule: [0, 0, 0, 0, 0]`. A fresh five-entry cycle must contain exactly one cargo marker; after that marker has been consumed, a marker-free suffix can contain at most four entries. A malformed persisted snapshot can therefore suppress the required cargo outcome for a whole cycle while still passing the authoritative-state boundary.
- **Fix**: Reject a five-entry schedule unless it contains exactly one `1`, while retaining the current zero-or-one rule for schedules of length zero through four; add `[0, 0, 0, 0, 0]` to the codec rejection coverage.
- **Decision**: FIXED — replaced shuffle-based allocation with a five-zero table and one seeded index; full schedules must contain exactly one marker.

### F2 — Mechanics coverage does not prove seeded replay across a cycle boundary

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/game-mechanics.test.mjs:749
- **Detail**: The test verifies a hand-authored five-entry schedule, its first full consumption, and that the next kill leaves four entries. It does not run two identical seeded simulations through a replenishment boundary and compare schedule order, RNG state, cargo contents, and loose outcomes, although the Phase 1 intent and manual criterion require fixed-seed replay across cycle boundaries.
- **Fix**: Add a focused test that advances two equivalent seeded states through at least six eligible kills and deep-compares their resulting schedules, RNG state, cargo, and loose-item output.
- **Decision**: FIXED — added deterministic lazy-cycle replay coverage across six eligible kills.
