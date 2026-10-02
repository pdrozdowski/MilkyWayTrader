<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-08: Interaktywny pas asteroid i fragmentacja — plan wdrożenia

- **Plan**: context/changes/s08-asteroid-combat/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-01
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 2 warnings 0 observations

## Verification

- **Automated**: Passed — `npm.cmd run test:mechanics`, `npm.cmd run test:objects`, `npm.cmd run test:audio`, `npm.cmd run test:fast`, `npm.cmd run typecheck`, and `npm.cmd run build-nolog`.
- **Manual**: Pending — all Phase 1–4 manual acceptance checks remain unchecked in the plan.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Collision resolution does not use a global earliest-impact order

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/gameSimulation.ts:220
- **Detail**: Phase 2 requires asteroid, projectile, ship, planet, and Moolaris swept intersections to be resolved by globally earliest time and stable ID. The implementation sorts celestial and projectile events separately, resolves every celestial event first, then processes projectiles. A projectile that reaches an asteroid before that asteroid's later celestial contact is therefore ignored and the later celestial source controls fragmentation. A projectile is also consumed when its selected asteroid was already removed, rather than considering a remaining target. The mechanics suite covers ordering among projectile candidates, but not cross-category ordering or invalidated near-target cases.
- **Fix**: Merge asteroid and projectile candidates into one time-and-ID-ordered queue; resolve only live candidates and consume a projectile only when its live target or blocker is resolved. Add regressions for projectile-before-celestial contact and a destroyed near asteroid with a farther target.
- **Decision**: PENDING

### F2 — Scene-level fragmentation audio contract lacks automated coverage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/game-audio.test.mjs:223
- **Detail**: Phase 3 requires tests proving exactly one SFX for a visible parent-to-children transition, no playback after restore, and AudioScope cleanup. The audio suite currently validates the generated WAV and registration only. `tests/object-scaffold.test.mjs` validates pure parent/child transition detection, but does not exercise camera visibility, `AudioScope.play` call count, restore suppression, or scene scope teardown.
- **Fix**: Add focused scene-level or suitably isolated integration tests that assert visibility-gated one-shot playback, no initial/restore playback, and owned-scope cleanup.
- **Decision**: PENDING
