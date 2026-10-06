<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S09 Asteroid Salvage Implementation Plan

- **Plan**: context/changes/s09-asteroid-salvage/plan.md
- **Scope**: Phase 3 of 4
- **Reviewed phases**: 3
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Sun-consumption feedback infers a gameplay transition

- **Severity**: WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/game/scenes/gameScene.ts:579
- **Detail**: The scene classifies a removed loose item as sun-consumed from its old position and a fixed maximum travel distance. This invents the removal reason in the projection layer: a future ship pickup/removal near the sun can be faded and played as sun consumption, while a large active-time delta broadens the false-positive range. Phase 3 requires state-driven projections that do not own gameplay truth.
- **Fix**: Relay a simulation-owned removal reason (or an explicit set of sun-consumed IDs) with the simulation result, and fade/play the effect only for that authoritative transition.
  - Strength: Preserves the authoritative state boundary and distinguishes sun consumption from every other removal.
  - Tradeoff: Requires a small explicit transition/effect contract between simulation and scene.
  - Confidence: HIGH — the simulation already determines the removal transition.
  - Blind spot: The eventual Phase 4 pickup integration was not present to exercise the false-positive path.
- **Decision**: PENDING

### F2 — Scene effect dispatch has no transition-level regression coverage

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/game/scenes/gameScene.ts:475
- **Detail**: Object tests cover mocked projection reconciliation and audio tests cover a stand-alone AudioScope. Neither proves Game dispatches the correct effect for an actual before-to-after cargo destruction or loose-item sun-consumption transition, nor that ordinary removals do not dispatch one.
- **Fix**: Add focused tests for extracted transition classifiers or a scene adapter with a fake AudioScope, covering final destruction, non-destruction removal, sun consumption, and ship pickup.
- **Decision**: PENDING

### F3 — Unrelated untracked prompt is in the implementation worktree

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .agents/prompts/bulk-implment-prompt.md
- **Detail**: This untracked prompt is unrelated to the Phase 3 product plan. It is not referenced by the Phase 3 changes and would expand a Phase 3 commit beyond the planned implementation.
- **Fix**: Keep the prompt out of the Phase 3 commit; handle it as separate tooling work if it is intentional.
- **Decision**: PENDING

## Validation

- `npm.cmd run test:objects` — PASS (6 tests).
- `npm.cmd run test:audio` — PASS (10 tests; Node emitted the pre-existing module-type warning).
- `npm.cmd run typecheck` — PASS.
- `git diff --check` — PASS (only CRLF normalization warnings from Git).
- Manual P3-B remains unchecked in the plan and requires player review; P3-A is also currently unchecked despite the focused automated suites passing.
