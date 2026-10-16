# Frame Brief: S-06 timed debt run lifecycle

> Framing step before /10x-plan. This document separates the agreed product need from current implementation assumptions.

## Reported Observation

User can abandon a run or reach timeout and see the debt outcome and final cash score.

## Initial Framing (preserved)

- **User's stated cause or approach**: No separate root cause was asserted. The user defined the desired flow: after New Game, show four full-screen illustrated story pages; clicking anywhere on each page advances; show the debt amount in a separate popup; start the run after it closes. Use one existing end-game screen with outcome-selected backgrounds and a button back to the main menu.
- **User's proposed direction**: Treat the introduction, debt notice, run start, abandonment, timeout, and three endings as the S-06 scope.
- **Pre-dispatch narrowing**: “Cały przepływ: wprowadzenie, start runu, porzucenie, timeout i 3 zakończenia.” The user confirmed ship destruction is already implemented (“1 i jest to juz zaimplementowane”), and that clicking anywhere on an introduction page advances. When asked which end-game presentation an abandoned run should use, the user said “s11 to rozstrzygnie.” Record the abandonment presentation as deferred to S-11.

## Dimension Map

The observed S-06 lifecycle spans these dimensions:

1. **Pre-run entry and clock boundary** — whether a run and its 30-minute clock begin before or after the introduction and debt notice.
2. **Timed terminal lifecycle** — whether reaching the active-time budget creates a terminal outcome, distinct from merely clamping the displayed clock.
3. **Terminal result and presentation** — whether one shared end-game screen can present score-based freedom/imprisonment and the already-supported destroyed-ship outcome.
4. **Cross-slice contract and persistence** — whether result values, score metric, displayed outcome, and retained result agree across PRD, roadmap, state validation, result delivery, and database rules. This is where the original single-S-06 framing sits.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Pre-run lifecycle is missing | `MainMenu` handles `start-new-game` by creating/resetting game state, starting telemetry, then entering `Game` (`src/game/scenes/mainMenuScene.ts:35-64`). The UI emits that event directly (`src/ui/setupUi.ts:176-177`). The four pages and debt popup are absent from this path. | STRONG |
| Timeout is not a terminal event | `advanceGameClock` clamps elapsed time at its budget (`src/game/mechanics/clock/gameClock.ts:2-7`). `advanceGameSimulation` returns early when active delta is zero, and the terminal resolver creates only a death result (`src/game/mechanics/gameSimulation.ts:78-83, 253-254`; `src/game/mechanics/hazards/terminal.ts:3-14`). | STRONG |
| End-game presentation is partly present but limited to death | There is one `GameOver` scene with score display and a return-to-menu-on-pointer interaction, but it always loads `game-over:destroyed-ship`; the user requires an explicit menu button and three backgrounds (`src/game/scenes/gameOverScene.ts:20-47`; `src/ui/setupUi.ts:78-91`). Death itself is already implemented, as the user confirmed. | STRONG |
| Product and persistence contracts are not fully aligned | The PRD's detailed rules use final composite score, while FR-009 still says “final cash score” (`context/foundation/prd.md:192`); the roadmap S-06 summary also says “final cash score” (`context/foundation/roadmap.md:50,151-160`). Snapshot/codec and the database constraint currently support death only (`src/game/state/terminalResultState.ts:1-6`; `src/game/application/gameStateCodec.ts:254-261`; `supabase/migrations/20261002120000_create_run_results.sql:7-10`). Archived S-12/S-13 contracts assign the remaining outcome producers and persistence support to S-06 (`context/archive/2026-10-13-s12-personal-best-result/plan.md:158`; `context/archive/2026-10-14-s13-global-high-scores/plan.md:32-36,77-79`). | STRONG |

The final-score calculation already exists and combines ending cash, cargo acquisition cost, and qualifying spending (`src/game/domain/finalScore.ts:18-28`). The current game-over result UI already displays that score (`src/ui/setupUi.ts:78-91`). These are reusable capabilities, not evidence that timeout classification is implemented.

## Narrowing Signals

- The user explicitly selected the whole flow as S-06 scope: introduction, run start, abandonment, timeout, and three endings.
- Ship destruction is already an implemented ending; S-06 should preserve it while adding timeout outcomes and selecting the corresponding background.
- The whole introduction page is clickable to advance, as well as the Next control.
- The user deferred the abandoned-run end-game presentation to S-11. S-06 should not invent that mapping.
- Independent code and contract reviews converge on missing introduction/timeout handling and death-only result production. The shared GameOver scene and score renderer already exist.

## Cross-System Convention

Terminal results currently flow through one result-scoring and delivery path from the shared GameOver scene. Archived S-12/S-13 plans likewise expect later terminal producers to use shared scoring and result delivery. The lifecycle is therefore designed around a common terminal-result boundary, while the current producer, state codec, and persisted outcome constraint remain death-only.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: S-06 does not yet fulfill its end-to-end timed-run lifecycle contract: the pre-run objective introduction is absent, timeout does not produce a terminal result from the final composite score, and the existing shared result experience only supports the already-implemented death ending; the abandoned-run presentation is explicitly deferred to S-11.

The user's desired whole-flow scope is supported by the code and archived slice contracts, so it does not need to be narrowed to a screen-only change. The key framing is lifecycle completeness across entry, active-time expiry, terminal scoring, presentation, and persistence, while retaining the existing death path and keeping abandonment presentation outside this slice per the user's direction.

## Confidence

- **HIGH** — strong source evidence, independent investigation agreement, and direct user narrowing. The visual treatment for abandonment is intentionally deferred to S-11.

## What Changes for /10x-plan

Plan S-06 as an end-to-end lifecycle change covering the agreed introduction/start boundary and score-based timeout outcome on the existing end-game experience, while preserving ship-destruction death. Treat abandoned-run presentation as a documented S-11 handoff rather than deciding it here; reconcile stale “final cash score” references against the user's final-composite-score decision.

## References

- Source files: `src/game/scenes/mainMenuScene.ts:35-64`; `src/game/mechanics/clock/gameClock.ts:2-7`; `src/game/mechanics/gameSimulation.ts:78-83,253-254`; `src/game/mechanics/hazards/terminal.ts:3-14`; `src/game/scenes/gameOverScene.ts:20-47`; `src/game/domain/finalScore.ts:18-28`; `src/ui/setupUi.ts:78-91,176-177`.
- Related research: `context/changes/s06-timed-debt-outcome/research.md`.
- Investigation tasks: `/root/terminal_state`, `/root/scene_flow`, `/root/scope_contract`.