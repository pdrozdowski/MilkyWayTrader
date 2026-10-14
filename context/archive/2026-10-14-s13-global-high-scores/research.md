---
date: 2026-10-14T13:36:50+02:00
researcher: Codex
git_commit: e1d560b7389d1f66cd58b1879111709379e2e3b9
branch: main
repository: MilkyWayTrader
topic: "Terminal scoring and per-player global high scores"
tags: [research, results, high-scores, supabase, ui]
status: complete
last_updated: 2026-10-14
last_updated_by: Codex
last_updated_note: "User clarified cargo acquisition cost basis and which paid actions count toward authoritative spending counters; frame completed."
---

# Research: Terminal scoring and per-player global high scores

**Date**: 2026-10-14T13:36:50+02:00  
**Researcher**: Codex  
**Git Commit**: e1d560b7389d1f66cd58b1879111709379e2e3b9  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

How should S-13 be framed after the user expanded it from viewing globally eligible results to scoring and ranking every completed run?

## Summary

The user's clarified contract is broader than S-13's original “view globally eligible results” outcome: compare every end-game result regardless of outcome, update the player's single global record only when the new score is higher, and calculate the score as ending cash + cargo valued at its average acquisition cost (`totalCost / quantity`) + cumulative ship-upgrade/booster spending + cumulative facility construction/upgrade spending. Repairs are excluded. The end-game screen shows each component and the final score, which is saved to personal and global records. The user also specified a Personal Best-like top-100 dialog with rank, nickname, date, and score, no `BEST`, `OUTCOME`, or delete actions, entry points from end-game and main menus, and the global rank of the player's Personal Best.

This intentionally conflicts with the current PRD, which limits global results to authenticated freedom runs after the full time limit and defines score as liquid credits before debt repayment (`context/foundation/prd.md:65-66,138-142,287,390-402`). The user has explicitly selected all end-game outcomes for global comparison, so the frame should treat PRD reconciliation as required scope, not as an unanswered eligibility choice. The existing signed-in-only submission rule remains in force unless the user changes it.

The current implementation has a private `run_results` store and a private paginated history view. In the inspected migration, result rows allow only the `death` outcome and authenticated reads are owner-scoped; no public result-read path is present in the inspected result adapter/history view (`supabase/migrations/20261002120000_create_run_results.sql:1-27`; `src/ui/adapters/browserResultHistoryStore.ts:53-91`). The inspected terminal-result reducer also creates only death results (`src/game/mechanics/hazards/terminal.ts:3-14`).

The new request changes S-13 from a leaderboard-view slice into a terminal-score and record-lifecycle change shared by the end-game display, personal results, and global ranking. It replaces the current PRD's cash-only score and winners-only global eligibility. These are explicit product decisions; the PRD must be reconciled before implementation. The current profile migration keeps nicknames owner-readable (`supabase/migrations/20261011120000_create_player_profiles.sql:7-22`).

## Detailed Findings

### Product contract

- US-06 says the global table includes authenticated runs that survive the full active-time limit and achieve freedom; it ranks by final cash before debt repayment. Anonymous and signed-in players can view it, while anonymous players cannot submit (`context/foundation/prd.md:130-143`).
- BR-113 through BR-115 and Access Control repeat those eligibility and access rules, and state that global high scores are publicly readable (`context/foundation/prd.md:390-402`).
- The roadmap lists S-13 as proposed with S-11 as a prerequisite. It identifies the main risk as applying eligibility without exposing private run history or accepting ineligible outcomes (`context/foundation/roadmap.md:55-59,235-245`).

### Result creation and private history

- `resolveTerminalResult` records a result when HP reaches zero, with outcome `death`, elapsed active time, and final credits; the inspected reducer has no freedom-result branch (`src/game/mechanics/hazards/terminal.ts:3-14`).
- On the game-over path, the scene delivers the terminal result through the application result port. The browser adapter inserts the result for the authenticated Supabase session and treats a duplicate run ID as already saved (`src/game/scenes/gameOverScene.ts:21-39`; `src/ui/adapters/browserResultStore.ts:37-61`). This is terminal-result persistence, not a global-eligibility check.
- `TerminalResultState` currently records only `runId`, the literal `death` outcome, elapsed active time, and `finalCredits`; `GameStateSnapshot` is schema version 18 and has no ship/facility cumulative-spending fields (`src/game/state/terminalResultState.ts:1-6`; `src/game/state/gameStateSnapshot.ts:15-37`).
- Cargo stacks already contain quantity and `totalCost`; `containerAverageCost` derives unit cost as `totalCost / quantity` (`src/game/state/commodityContainerState.ts:1-6`; `src/game/application/commodityContainers.ts:1-5`). The user selected that acquisition-cost average as the score's cargo valuation.
- Current ship and facility state stores upgrade levels, not cumulative spending (`src/game/state/shipStatusState.ts:4-11`; `src/game/state/serotonMarketState.ts:14-19`). Facility upgrade quotes can apply a planet-specific price multiplier (`src/game/application/planetFacilities.ts:61-77`; `src/game/definitions/planetFacilityDefinitions.ts:11-23,52-58`). The user explicitly requires authoritative counters; include ship upgrades and booster plus facility builds and upgrades, while excluding repairs. Level-only reconstruction would not retain the actual paid amount through those quotes.
- `ResultHistoryStorePort` exposes paged history and a best result (`src/game/application/results/resultHistoryStore.ts:7-27`). Its browser adapter queries `run_results` and orders history by final credits and save time (`src/ui/adapters/browserResultHistoryStore.ts:53-91`).
- The migration defines `run_results` with `run_id`, `user_id`, outcome, active elapsed time, final credits, and creation time. Its outcome constraint accepts `death`; it enables RLS, grants authenticated insert/select, scopes inserts to `auth.uid()`, and scopes selects to the row owner (`supabase/migrations/20261002120000_create_run_results.sql:1-27`). It does not provide an anonymous or cross-user read path in that migration.

### Public identity and UI

- `player_profiles` stores a nickname for each authenticated user. The inspected profile migration grants authenticated select/insert/update and its select policy is owner-scoped (`supabase/migrations/20261011120000_create_player_profiles.sql:1-22`). The user specified nicknames in global rows, so a public-safe way to expose that identity is needed; the PRD itself does not define the identity field (`context/foundation/prd.md:390-402`).
- The inspected UI includes a private Personal Best dialog and account controls (`index.html:39-69`; `src/ui/components/personalBest.ts:49-136`). The inspected `index.html`, UI setup, and component search show no global-high-score entry point or table (`src/ui/setupUi.ts:45-105`; `src/ui/components/displayLabels.ts:1-25`).
- S-10's plan explicitly deferred public profile reads until a leaderboard read path was designed (`context/archive/2026-10-11-s10-player-account-management/plan.md:24-28,47-53`).

### User-specified global-score layout

- The global-score dialog should resemble the existing Personal Best dialog. Its table shows the top 100 players, ranked by each player's best stored global score, with columns `#`, `NICKNAME`, `DATE`, and `SCORE`, in that order. The `#` column displays global places 1 through 100.
- The global-score dialog has no `DELETE`/`DELETE ALL` actions and no `BEST` or `OUTCOME` columns. It displays the signed-in player's personal best's global position, and can be opened from both the end-game menu and main menu. These are user decisions supplied in the current conversation; they are product requirements, not deductions from existing code.
- The global leaderboard stores at most one record per player. At every end game, regardless of outcome, compare the run's final score with that record; update it if the new score is higher and retain it otherwise. This is an explicit user decision (`context/changes/s13-global-high-scores/change.md`, “UI layout”).
- The requested final score is ending cash + cargo value + cumulative ship-upgrade spending + cumulative facility-upgrade spending. The end-game screen shows each component and the final total; personal and global result records use that same total. Spending counters belong in authoritative game state by explicit user direction (`context/changes/s13-global-high-scores/change.md`, “UI layout”).
- The existing Personal Best dialog is the visual reference (`index.html:39-47`; `src/ui/components/personalBest.ts:49-109`). Existing UI surfaces include a main-menu area and a game-over result/menu flow (`index.html:51-69`; `src/game/scenes/gameOverScene.ts:21-39`). The global-score access point and table are not implemented in the inspected surfaces.

### Data boundary and dependency

- S-15's current plan requires S-13 to store eligible global results independently from personal history so private-history deletion does not remove leaderboard entries (`context/changes/s15-clear-personal-best/plan.md:5-7,76-91`).
- The current result adapter writes terminal results to `run_results`, while the personal-history adapter reads that same relation (`src/ui/adapters/browserResultStore.ts:37-61`; `src/ui/adapters/browserResultHistoryStore.ts:53-91`). **Inference:** using the private history relation itself as the public leaderboard source would couple leaderboard retention to S-15 deletion and weaken the owner-only read boundary. A separate public projection/relation or an explicitly safe server-side read boundary would need to preserve the S-15 contract.
- Because the user's new contract sends every authenticated terminal result through the same score comparison and uses the same total for personal and global records, the Personal Best score should match that player's global-record score when personal and global writes both succeed. Its displayed rank can therefore identify the player's row, including a row ranked below 100; this follows from the explicit per-player best and shared-score rules, not from current code.
- An archived S-07 frame records the earlier decision to retain every terminal outcome privately while excluding death from global eligibility (`context/archive/2026-10-01-s07-environmental-hazards-and-death/frame.md:38-48`). The user's new decision explicitly supersedes that distinction and requires PRD reconciliation.
- `utils-add-state` classifies authoritative values as snapshot state and requires updating the versioned codec when the aggregate changes; the current snapshot is version 18 (`.agents/skills/utils-add-state/SKILL.md`; `src/game/state/gameStateSnapshot.ts:15-37`). The user's spending-counter requirement adds state to this change's scope.
- The roadmap dependency is S-11 (`context/foundation/roadmap.md:55-59,235-245`). It is marked proposed in the inspected roadmap; S-06, which supplies time-expiry freedom outcomes, is also marked proposed there (`context/foundation/roadmap.md:49-57`). The present code evidence does not show eligible freedom results flowing into storage.

## Code References

- `context/foundation/prd.md:130-143,390-402` - Public viewing, eligible outcomes, ranking, and submission access.
- `context/foundation/roadmap.md:49-59,235-245` - S-06/S-11/S-13 state, dependency, and risk.
- `src/game/mechanics/hazards/terminal.ts:3-14` - Current death-result creation path.
- `src/game/state/terminalResultState.ts:1-6`; `src/game/state/gameStateSnapshot.ts:15-37` - Current terminal-result contract and versioned aggregate.
- `src/game/state/commodityContainerState.ts:1-6`; `src/game/application/commodityContainers.ts:1-5` - Cargo quantity, weighted total cost, and derived average cost.
- `src/game/state/shipStatusState.ts:4-11`; `src/game/state/serotonMarketState.ts:14-19` - Current upgrade levels without cumulative spending fields.
- `src/game/application/planetFacilities.ts:61-77`; `src/game/definitions/planetFacilityDefinitions.ts:11-23,52-58` - Facility upgrade quotes and planet-specific price multipliers.
- `src/game/application/results/resultHistoryStore.ts:7-27` - Private history and best-result port.
- `src/ui/adapters/browserResultStore.ts:37-61` - Authenticated terminal-result insertion.
- `src/ui/adapters/browserResultHistoryStore.ts:53-91` - Private history queries and ordering.
- `supabase/migrations/20261002120000_create_run_results.sql:1-27` - Current result schema and owner-scoped access.
- `supabase/migrations/20261011120000_create_player_profiles.sql:1-22` - Nickname schema and owner-scoped access.
- `index.html:39-69`; `src/ui/setupUi.ts:45-105` - Current result/account UI entry points inspected.
- `context/changes/s13-global-high-scores/change.md` - User-specified top-100 layout and menu entry points.

## Architecture Insights

The existing result path places Supabase access in browser adapters behind application ports. The existing history relation is private and owner-scoped; public leaderboard reads and public nickname display therefore need a deliberate boundary that does not expose private history. This follows the application-port and adapter boundaries in `context/foundation/architecture.md:3-17,45-47`.

## Historical Context (from prior changes)

- Archived S-12 explicitly left public leaderboards outside its private-history scope (`context/archive/2026-10-13-s12-personal-best-result/change.md`, “Data and scope”). Its research distinguishes the owner-only result table from the separate public leaderboard capability (`context/archive/2026-10-13-s12-personal-best-result/research.md`, “Existing persistence and access control”). The current migration's owner-scoped policy supports that access-control observation (`supabase/migrations/20261002120000_create_run_results.sql:12-27`).
- S-15's plan treats S-13 completion and independent global storage as prerequisites for history deletion (`context/changes/s15-clear-personal-best/plan.md:5-7,76-91`).
- S-10 deferred public profile reads pending leaderboard design (`context/archive/2026-10-11-s10-player-account-management/plan.md:24-28,47-53`).

## Related Research

- `context/archive/2026-10-13-s12-personal-best-result/research.md` - Existing private result history and the separate global-results concern.
- `context/changes/s15-clear-personal-best/research.md` - Personal-history mutation boundary and its S-13 independence prerequisite.

## Open Questions

- Equal-score tie-break order remains unspecified; the existing PRD does not define one (`context/foundation/prd.md:140-142,390-402`).
- Which paid actions increment counters is resolved: ship upgrades and booster, facility builds and upgrades count; repairs do not (`src/game/application/planetFacilities.ts:5`; `src/game/application/planetShipServices.ts:18`).
- What tie-break order should be used for equal final scores? The PRD currently gives a cash-only score and no tie-break (`context/foundation/prd.md:140-142,390-402`).
- How should write failures or anonymous runs affect the requirement that the same final score be saved in personal and global records? The current product contract does not allow anonymous submissions (`context/foundation/prd.md:377,392`).
- The score and outcome changes require PRD reconciliation. The PRD currently states cash-only scoring and freedom-only global entries (`context/foundation/prd.md:287,390`), while the user has replaced those rules for S-13; prior S-07 documented the old separation (`context/archive/2026-10-01-s07-environmental-hazards-and-death/frame.md:38-48`).
- Confirm the S-11 prerequisite and its readiness before implementation; the roadmap currently marks S-11 proposed (`context/foundation/roadmap.md:55-59,235-245`).
- This research covers repository source and migrations, not deployed Supabase state or live data.

