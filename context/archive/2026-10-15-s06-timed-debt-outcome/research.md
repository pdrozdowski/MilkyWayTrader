---
date: 2026-10-15T22:01:34+02:00
researcher: Codex
git_commit: 8f84b2d87f3d26a74b976805b10318861817f196
branch: main
repository: MilkyWayTrader
topic: "S-06 timed debt outcomes, abandonment, and final cash score"
tags: [research, codebase, terminal-results, active-time, final-score]
status: partial
last_updated: 2026-10-15
last_updated_by: Codex
last_updated_note: "User clarified the finalScore threshold and four-screen illustrated introduction followed by a separate debt popup before run start."
---

# Research: S-06 timed debt outcomes, abandonment, and final cash score

**Date**: 2026-10-15 22:01:34 Europe/Warsaw  
**Researcher**: Codex  
**Git Commit**: `8f84b2d87f3d26a74b976805b10318861817f196`  
**Branch**: `main`  
**Repository**: MilkyWayTrader

## Research Question

For S-06, how do active-time expiry and abandonment currently produce a terminal debt outcome, and how does the game calculate, display, and retain the final cash and score?

## Summary

The PRD now maps the 1,000,000-point debt threshold to final composite score at timeout. Freedom, imprisonment, and death select the winning, failure, and destroyed-ship backgrounds respectively on the existing end-game screen (`context/foundation/prd.md:65-70, 293-297`). The thirty-minute active-time limit, early-continuation rule, and immediate confirmed-abandonment rule remain in the PRD (`context/foundation/prd.md:56-70, 282-299`).

In the inspected simulation path, the clock clamps elapsed active time to its budget, but timeout does not create a terminal result. The current terminal producer and snapshot codec accept death tied to zero HP; they do not represent freedom, imprisonment, or abandonment (`src/game/mechanics/clock/gameClock.ts:2-7`; `src/game/mechanics/gameSimulation.ts:79-83, 248-255`; `src/game/mechanics/hazards/terminal.ts:3-14`; `src/game/state/terminalResultState.ts:1-6`; `src/game/application/gameStateCodec.ts:254-261`).

The existing result screen already shows ending cash and the separate composite final score with its components. That path is reached after death. The in-game exit path instead goes straight to the main menu; no terminal result is sent to the result screen from that path (`src/game/scenes/gameScene.ts:543-547, 650-670`; `src/game/scenes/gameOverScene.ts:17-48`; `src/ui/setupUi.ts:78-95, 175-182`; `src/game/scenes/gameScene.ts:141-148, 456-460`).

**User clarification (2026-10-15):** The debt amount is 1,000,000 credits. At timeout, compare the final composite score: a score at or above 1,000,000 points wins; a lower score fails. Exactly 1,000,000 points is a win.

## Detailed Findings

### Debt outcome and active clock

- The PRD maps final composite score at timeout to the 1,000,000-point target: at or above grants freedom, and below results in imprisonment (`context/foundation/prd.md:54-70, 282-299`). Reaching the target early does not end a run.
- When the clock is not player-paused, has no pause reasons, and receives a positive delta, `advanceGameClock` adds the delta but clamps `activeElapsedMs` to `budgetMs` (`src/game/mechanics/clock/gameClock.ts:2-7`).
- In `advanceGameSimulation`, a pre-existing terminal result returns the snapshot unchanged. Otherwise it advances the clock and returns after the clock step when active delta is zero or less; after a positive step, the inspected function ends by calling `resolveTerminalResult` (`src/game/mechanics/gameSimulation.ts:79-83, 248-255`). That resolver creates a result only when HP is zero and currently assigns outcome `death`, elapsed active time, and current credits (`src/game/mechanics/hazards/terminal.ts:3-14`). Thus, on the inspected run-simulation path, reaching the time budget leaves `terminalResult` unset unless death independently occurs.
- `TerminalResultState` has fields for run ID, outcome, elapsed milliseconds, and final credits, with its outcome typed as the literal `death` (`src/game/state/terminalResultState.ts:1-6`). The codec validates a non-null result against zero HP, matching run ID, the death outcome, clock time, and current credits (`src/game/application/gameStateCodec.ts:254-261`). Extending terminal outcomes therefore affects authoritative state and codec validation as well as the producer.

### Abandonment and scene transition

- The scene creates an “Exit demo” control but immediately hides it and disables interaction (`src/game/scenes/gameScene.ts:141-148`). The `return-to-menu` event and that control's callback both use `exitToGameOver`; in the inspected method, it ends telemetry with current credits, loses focus, and starts `MainMenu` without writing `terminalResult` (`src/game/scenes/gameScene.ts:144-148, 456-460`). The PRD requires confirmed abandonment to end the run immediately (`context/foundation/prd.md:68-70, 297-299`).
- The existing game-over transition is entered when `terminalResult` changes from null, then calculates a score result and begins the death transition (`src/game/scenes/gameScene.ts:543-547`). After the destruction animation, it starts `GameOver` with that result (`src/game/scenes/gameScene.ts:650-670`). `GameOver.create` throws when no terminal result is supplied and initiates result delivery for the supplied result (`src/game/scenes/gameOverScene.ts:17-48`).

### Cash and final score presentation

- `createTerminalScoreResult` takes `terminalResult.finalCredits` as `endingCash` and supplies cargo plus ship/facility spend to the domain score calculation (`src/game/application/results/terminalScoreResult.ts:13-30`). `calculateTerminalScore` values cargo by summing each carried stack's `totalCost`, adds that to ending cash and the two spend totals, then rounds the combined amount once (`src/game/domain/finalScore.ts:18-28`). This is the composite score used by the user-specified timeout comparison, now reflected in the PRD (`context/foundation/prd.md:65-67, 295-297`).
- When `game-over-open` carries a terminal result, the UI displays elapsed time, final cash, cargo value, ship upgrade spend, facility spend, and final score (`src/ui/setupUi.ts:78-95, 175-182`). The inspected presentation does not render a freedom/imprisonment/abandonment outcome label; its values come from the death-only terminal path.

### Result retention and prior change contracts

- The game-over scene passes its result through `createResultDelivery`, which submits it to the result store and publishes pending/saved/failed/unsigned status (`src/game/scenes/gameOverScene.ts:30-35`; `src/game/application/results/resultDelivery.ts:5-22`). The database migration's outcome constraint currently permits `death` (`supabase/migrations/20261002120000_create_run_results.sql:2-10`). In contrast, the application history outcome union and Personal Best label mapping name `freedom`, `imprisonment`, `death`, and `abandoned` (`src/game/application/results/resultHistoryStore.ts:1-11`; `src/ui/components/personalBest.ts:39-46`). The PRD uses “abandonment” as prose, while the existing history value is `abandoned` (`context/foundation/prd.md:69, 297`; `src/game/application/results/resultHistoryStore.ts:1-2`).
- The archived S-12 plan states that S-06 must expand terminal-result production and persisted outcome support to all four outcomes (`context/archive/2026-10-13-s12-personal-best-result/plan.md:158`). The archived S-13 plan defers producers for abandonment, freedom, and imprisonment, and says future producers should use shared terminal scoring and result delivery (`context/archive/2026-10-14-s13-global-high-scores/plan.md:32-36`). Its scoring contract says terminal results carry ending cash, cargo value, ship/booster spend, facility spend, and a once-rounded final score (`context/archive/2026-10-14-s13-global-high-scores/plan.md:77-79`). These archived statements align with the inspected current score utility; they do not mean the deferred terminal producers are already implemented.

## Architecture Insights

S-06 crosses the pure active-clock/mechanics path, authoritative state and codec, scene transition, DOM result presentation, application result delivery, and the persisted outcome constraint. The architecture assigns authoritative clocks and terminal state to the snapshot/mechanics boundary, while scenes compose transitions and adapters handle browser persistence (`context/foundation/architecture.md:3-17, 19-23`). Because the change adds authoritative terminal outcomes and lifecycle transitions, implementation must follow `.agents/skills/utils-add-state/SKILL.md` per repository instructions.

The code-level score calculation is already shared and independent of Phaser/DOM (`src/game/domain/finalScore.ts:18-28`). Tests should cover the timeout/abandonment state transitions and debt threshold at a fast domain/mechanics level; a browser test is warranted only for a distinct browser integration or visible player journey that cheaper levels cannot prove (`context/foundation/testing.md:3-16`; `context/testing/playwright-principles.md`).

## Historical Context (from prior changes)

- S-12's archived plan deferred all four outcome production and persistence support to S-06 (`context/archive/2026-10-13-s12-personal-best-result/plan.md:158`). Current application history labels already include four outcome values, but authoritative state and the database constraint remain death-only (`src/game/application/results/resultHistoryStore.ts:1-10`; `src/game/state/terminalResultState.ts:1-6`; `supabase/migrations/20261002120000_create_run_results.sql:8`).
- S-13's archived plan explicitly deferred the freedom, imprisonment, and abandonment producers while requiring later producers to reuse terminal score and delivery (`context/archive/2026-10-14-s13-global-high-scores/plan.md:32-36, 77-79`). The current death result path uses those score and delivery modules (`src/game/scenes/gameScene.ts:543-547`; `src/game/application/results/terminalScoreResult.ts:13-30`; `src/game/scenes/gameOverScene.ts:30-35`).

## Related Research

- `context/archive/2026-10-13-s12-personal-best-result/research.md`
- `context/archive/2026-10-14-s13-global-high-scores/research.md`

## Open Questions

The existing persisted and history vocabulary uses `abandoned`, while the PRD describes an abandonment outcome; use the repository's existing value when planning the result contract unless another authoritative requirement supersedes it.

