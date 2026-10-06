<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Smooth Salvage Motion, Deterministic Cargo Drops, and Debug Spawn Implementation Plan

- **Plan**: context/changes/salvage-motion-loot-debug/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

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

### F1 — Loose-item 15px gameplay interaction radius was removed without an authoritative replacement

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/gameSimulation.ts:246
- **Detail**: Phase 2 requires removing the commodity projection's dynamic Arcade body while preserving its 15px gameplay interaction radius in mechanics. `src/game/objects/commodity/definition.ts` now correctly has no physics body, but no authoritative 15px loose-item radius was introduced. Loose-item pickup is currently tested only against `shipTuning.collisionRadius` (18px) at the cited line; the only remaining 15px radius applies to cargo projectile collision. The planned interaction contract and coverage are therefore missing.
- **Fix**: Introduce a named authoritative loose-item interaction radius of 15px in the salvage mechanic and use it in the relevant interaction calculation; add boundary coverage proving it remains independent of Phaser projection physics.
- **Decision**: FIXED — added the authoritative 20px loose-item interaction radius and mechanics coverage.

### F2 — Mid-run debug cargo jumps on its first simulation update

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/mechanics/debug/spawnDebugCargo.ts:32
- **Detail**: The helper writes the cargo's current geometric angle directly as `orbit.angleRadians`. `advanceOrbitalCargo()` interprets that field as the angle at active time zero and adds the full current active-time phase (`src/game/mechanics/salvage/salvageSimulation.ts:14-23`), which is invoked on the next simulation update (`src/game/mechanics/gameSimulation.ts:240`). Consequently, cargo spawned after time zero immediately relocates along its orbit rather than remaining 100px ahead of the ship and continuing smoothly.
- **Fix**: Store a base orbit angle adjusted by the current active-time phase (or centralize current-position orbit construction), then add a regression test that spawns debug cargo in a nonzero-active-time state and advances one frame without a discontinuity.
- **Decision**: FIXED — debug cargo now stores a base angle adjusted for the current active-time orbit phase.

### F3 — Debug control wiring has no DOM/scene regression coverage

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/game-mechanics.test.mjs:800
- **Detail**: The Phase 2 automated criterion requires the debug action's DOM/scene route to prove it creates normal state-backed cargo. The added test invokes `spawnDebugCargo` directly, so it cannot detect a missing or mismatched `#debug-spawn-cargo` selector, click listener, emitted event, or scene subscription. No test references the new event, button, `setupApplicationUi`, or scene event registration.
- **Fix**: Add a focused DOM/scene controller test with mocked game events and state provider that clicks the control and verifies the dedicated event reaches the state transition.
- **Decision**: FIXED — extracted and tested the debug-button-to-scene-event binding.
