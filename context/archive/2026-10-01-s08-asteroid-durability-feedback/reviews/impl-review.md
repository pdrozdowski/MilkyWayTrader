<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-08 follow-up: Asteroid durability and collision feedback

- **Plan**: context/changes/s08-asteroid-durability-feedback/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 1 warning 0 observations

## Verification

- **Automated**: Passed — `npm.cmd run test:domain`, `test:mechanics`, `test:objects`, `test:audio`, `test:fast`, `typecheck`, and `build-nolog`.
- **Manual**: Pending — health-bar readability, boosted-ship warning, planetary impact effect, star ingestion, and player-facing acceptance.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Asteroid and projectile collision categories are not globally time ordered

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/gameSimulation.ts:205
- **Detail**: Celestial asteroid impacts are fully resolved before projectile impacts. Thus a later planet, ship, or Moolaris event can remove or redirect an asteroid before a projectile event that occurs earlier in the same frame is considered. This contradicts the intended earliest-contact resolution and can affect durability/fragment attribution.
- **Fix**: Merge celestial and projectile candidates into one stable time-and-ID ordered queue, resolving only live candidates. Add a regression for a projectile impact preceding a celestial impact in the same frame.
- **Decision**: SKIPPED — next-frame resolution is acceptable for this edge case.
