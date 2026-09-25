<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-02 Direct Moving-System Flight Implementation Plan

- **Plan**: context/changes/s02-direct-moving-system-flight/plan.md
- **Scope**: Phase 5 of 5
- **Reviewed phases**: 5
- **Date**: 2026-09-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

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

### F1 — Fullscreen is unavailable during active flight

- **Severity**: WARNING
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: index.html:22, src/ui/components/displayControls.ts:23
- **Detail**: Phase 5 requires fullscreen to remain a HUD control that refreshes layout without pausing. The only active-run control is Menu; fullscreen lives in the portrait overlay or inside the pause menu. The existing mobile test opens the menu before requesting fullscreen, so it verifies a paused state rather than the no-pause contract.
- **Fix**: Add one `data-game-input="ignore"` fullscreen control to the active-flight HUD, wire it through the existing display port, and assert that the active clock continues through its invocation.
- **Decision**: SKIPPED — user chose to ignore this finding.

### F2 — Portrait pause does not prevent keyboard input from latching

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/game/scenes/gameScene.ts:278
- **Detail**: Entering menu/orientation pause clears input once, but keyboard handlers can re-latch Shift or Control while the portrait overlay is visible. That intent is then applied when landscape resumes, violating the blocking-input contract.
- **Fix**: Make scene keyboard input ignore and clear gameplay intent while `menu` or `orientation` is present; cover holding controls during portrait and rotating back.
- **Decision**: FIXED — ignored keyboard flight intent during menu/orientation pause and added portrait-resume coverage.

### F3 — Escape opens a pause menu outside an active run

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/ui/components/gameMenu.ts:34
- **Detail**: The global Escape listener opens the game pause dialog even from MainMenu or another ignored UI surface. This can mutate the clock when no active game scene is present and conflicts with the expected scope of a gameplay-only modal.
- **Fix**: Scope Escape to an active run and ignore other `data-game-input="ignore"` surfaces unless this menu is already open; add a MainMenu regression test.
- **Decision**: SKIPPED — user chose to ignore this finding.
