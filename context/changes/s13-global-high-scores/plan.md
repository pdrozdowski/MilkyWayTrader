# Terminal Scores and Global High Scores Implementation Plan

## Overview

Define one final score for every terminal run, retain it in private run history, and maintain one best score per signed-in player in a public global leaderboard. The end-game screen will explain the score components; the leaderboard will show the top ranks and the signed-in player's Personal Best rank.

## Current State Analysis

- Authoritative game state uses snapshot schema v18 and has no cumulative upgrade spending counters. State changes flow through the aggregate, snapshot codec, and initial-state construction.
- Cargo stacks retain `quantity` and `totalCost`, so acquisition-cost cargo valuation is already available without recomputing trades.
- The existing terminal result carries final credits and supports death. Private `run_results` rows are owner-scoped, keyed per run, and the current Personal Best is based on cash.
- `player_profiles` are private to their owners. A separate public-safe projection is needed for global results and ranks.
- End-game delivery already tracks persistence status and retry behavior. Personal Best UI and its main-menu/end-game entry points provide the visual and integration pattern.

## Desired End State

Every end game computes `ending cash + cargo value + ship upgrade/booster spending + facility construction/upgrade spending`. Cargo value is the sum of stack `totalCost` (equivalent to quantity times average acquisition cost); round the combined score once to the nearest whole number. Debt does not change this formula. Repairs, trades, and refunds do not add or subtract spending.

The end-game screen lists each component and displays `YOUR FINAL SCORE IS: xxx,xxx`. That integer is used consistently for private Personal Best and global ranking. Regardless of terminal reason, a signed-in player's global row is inserted if absent or updated only for a strictly higher score; ties and lower scores preserve the existing score and achieved date.

GLOBAL HI-SCORE is reachable from main menu and end-game menu and follows the Personal Best visual pattern. The board displays rank, nickname, achieved date, and score, includes all rows tied at rank 100, and has no delete controls, BEST column, or OUTCOME column. Signed-in players also see the global position of their actual private Personal Best score, even when that score differs from their global row. Anonymous users can read the public board but cannot submit scores or see a private PB rank.

### Key Discoveries:

- State updates and codecs are centralized; follow `.agents/skills/utils-add-state/SKILL.md` when adding spending counters and increment the snapshot schema version.
- Paid ship upgrade/booster reducers and facility investment reducer are the authoritative points to record successful spending at the actual paid amount. Repairs, trades, and refunds use separate paths.
- Cargo `totalCost` already equals the desired acquisition-cost valuation.
- The current result persistence path stores raw final credits and supports retry; preserve raw cash separately from the new composite score.
- Public reads must not expose private `run_results`, profile rows, or user IDs. The global projection should return only rank, current nickname, achieved date, and score.
- OAuth temporarily serializes game state in `sessionStorage`. There is no long-term run save yet; after a schema-version bump, an old v18 return snapshot follows the existing invalid-snapshot recovery path. No snapshot migration is planned.

## What We're NOT Doing

- Adding future abandonment, freedom, or imprisonment end-game producers; any producer added later must use the shared terminal scoring and result delivery path.
- Adding automatic run save/resume or a v18 snapshot migration.
- Backfilling or deleting legacy private results. Legacy rows without `final_score` remain readable as history but are excluded from score-based Personal Best; the user will clear legacy results manually.
- Server-authoritative simulation or anti-cheat. The MVP accepts a validated score submitted by the authenticated client.
- Deploying schema changes to production.
- Exposing private result history or adding delete controls, BEST/OUTCOME leaderboard columns.

## Implementation Approach

First reconcile the PRD with the agreed scoring and ranking behavior, then add authoritative spending counters and a pure terminal score calculation. Extend private result storage with a distinct composite score and add a separate one-row-per-player global store with constrained public reads and authenticated, strictly-better writes. Finally, wire joint retryable delivery and build the end-game breakdown and leaderboard UI on the existing Personal Best patterns.

## Critical Implementation Details

The client snapshot version must move from v18 to v19 with strict decoding and no migration; an OAuth return carrying an old snapshot is handled by the current invalid-snapshot recovery. Treat private and global writes as one user-visible save operation: retry both idempotently after partial failure and show “saved” only when both succeed. For PB rank, compare the exact private PB score against other players while excluding the caller's own global row; this preserves the requested rank when private history and the global best later diverge.

## Phase 1: Reconcile the Score Contract and Calculate Terminal Results

### Overview

Make the score definition explicit in the PRD, track eligible cumulative spending in authoritative state, calculate one terminal score for any outcome, and show its component breakdown.

### Changes Required:

#### 1. PRD score and global-ranking requirements

**File**: `context/foundation/prd.md`

**Intent**: Align the source-of-truth requirements with the user's final-score formula, all-outcome comparison, one-row-per-player rule, and leaderboard presentation. Apply the required `10x-prd-en-capability` deterministic validation and semantic review.

**Contract**: Update only the relevant US-01/US-06, business rules, FRs, access control, and non-goals; each FR remains a solution-independent capability.

#### 2. Authoritative cumulative spending

**Files**: `src/game/**` state aggregate, initial-state construction, snapshot type/codec, and paid ship/facility reducers identified in research.

**Intent**: Retain cumulative amounts actually paid for ship upgrades/boosters and facility construction/upgrades so terminal scoring survives the complete run.

**Contract**: Add `shipUpgradeSpend` and `facilityUpgradeSpend` to authoritative state and schema v19. Increment only after a successful purchase, by the actual amount charged. Do not increment for repair, trade, failed purchase, or refunded amounts.

#### 3. Shared terminal score calculation and presentation

**Files**: `src/game/application/results/`, shared result delivery and existing end-game UI modules.

**Intent**: Calculate the same score for every terminal reason and make the arithmetic understandable to the player.

**Contract**: Carry ending cash, cargo value, ship upgrade/booster spend, facility build/upgrade spend, and rounded `finalScore` in the terminal result. Cargo value is the sum of cargo `totalCost`; round only the final combined value once. Preserve the raw ending cash field for existing semantics. Render each component and the exact final-score label; the private and global persistence layers consume the same `finalScore`.

### Success Criteria:

#### Automated Verification:

- Pure score tests cover empty cargo, cargo acquisition cost, each spending component, rounding once, and all terminal reasons.
- State tests verify successful payment counters and exclusion of repairs, trades, failures, and refunds; snapshot codec round-trip and validation pass at v19.
- PRD deterministic capability validation and semantic review both pass.

#### Manual Verification:

- End a run and verify each score component and `YOUR FINAL SCORE IS: xxx,xxx` match the displayed final result.

## Phase 2: Persist Personal Scores and Maintain the Global Best

### Overview

Keep private run history while adding composite-score PB selection and an isolated public leaderboard that can only replace a player's row with a strictly better result.

### Changes Required:

#### 1. Private composite-score history

**Files**: run-result migration, result-history model/adapter, and Personal Best query.

**Intent**: Preserve raw final cash while selecting Personal Best by the new score contract.

**Contract**: Add nullable `final_score` for legacy compatibility and populate it for all new terminal results. Keep `final_credits` as ending cash. Exclude null-score legacy rows from PB ranking; do not backfill or delete them.

#### 2. One-row-per-player global store and safe rank queries

**Files**: Supabase migration, global-score repository/application port, and result-history query integration.

**Intent**: Atomically retain a player's global best and allow public leaderboard reads without revealing private identifiers or history.

**Contract**: Store one row per authenticated user with score and achieved timestamp. The authenticated submit operation inserts if absent and updates only when strictly higher; equal/lower submissions preserve score and date. Public projection returns rank, current nickname, achieved date, and score only. Use competition ranking (`1, 2, 2, 4`); return all rows whose rank is at most 100, including ties. The authenticated PB-rank operation accepts the exact private PB score and ranks it against other players, excluding the caller's own global row.

#### 3. Joint end-game persistence and retry

**Files**: result store port, delivery service, persistence status UI, and Supabase adapters.

**Intent**: Keep private and global score records consistent from the player's perspective despite transient partial failures.

**Contract**: Signed-in result delivery attempts both idempotent writes. Retry both after a partial error; show saved only after both succeed. Anonymous runs are not submitted. Validate score shape/range at persistence boundaries. The MVP trusts the authenticated client's computed score.

### Success Criteria:

#### Automated Verification:

- Repository tests prove higher updates, equal/lower retention, one row per user, and stable achieved date for non-improving submissions.
- Delivery tests cover private/global partial failure and retry, plus signed-out behavior and idempotency.
- Database integration tests prove public-safe fields, current nickname, anonymous reads, authenticated writes, private owner isolation, PB-rank semantics, ties, and rank-100 cutoff inclusion.

#### Manual Verification:

- With isolated local sessions, submit a lower, equal, and higher score and confirm the global row changes only for the higher score and reveals only the intended public fields.

## Phase 3: Deliver the Leaderboard UI and Validate the Full Flow

### Overview

Expose the global board from both menus, show the signed-in player's private PB position, and validate the score journey through the application's real integration.

### Changes Required:

#### 1. Global HI-SCORE and menu entry points

**Files**: `index.html`, `src/ui/setupUi.ts`, UI components, and `public/style.css`.

**Intent**: Present public global results in a familiar dialog and make the view discoverable from both requested menus.

**Contract**: Match Personal Best visual conventions. Columns are `#`, `NICKNAME`, `DATE`, `SCORE`; show top 100 ranked places with ties at rank 100 included. Add no delete/delete-all controls and no BEST or OUTCOME columns. Show the current profile nickname. Display the signed-in player's actual Personal Best global rank, including ranks beyond the displayed top 100; omit the private PB rank when anonymous or when no PB exists.

#### 2. End-game score breakdown and status states

**Files**: Existing end-game UI component and shared result status handling.

**Intent**: Explain the run score and make joint persistence state clear.

**Contract**: Render all score components followed by `YOUR FINAL SCORE IS: xxx,xxx`; include loading, empty, error, retry, anonymous, and saved states consistent with the existing UI patterns.

#### 3. UI and cross-layer verification

**Files**: UI component tests and one Playwright journey in the existing local Supabase harness.

**Intent**: Verify both component behavior and one player-visible cross-layer route.

**Contract**: The Playwright journey covers opening GLOBAL HI-SCORE from a menu and receiving the real session/database-backed result. This verifies the player-visible menu-to-board flow, which component tests with fake ports cannot prove across Phaser menu events, authenticated session wiring, and the browser database client. Do not add overlapping browser tests.

### Success Criteria:

#### Automated Verification:

- Component tests cover columns, rank callout, empty/anonymous states, errors, and menu access wiring.
- The single admitted Playwright journey passes using the isolated local Supabase session fixture.
- `npm.cmd run test:domain`, `npm.cmd run test:fast`, `npm.cmd run typecheck`, and `npm.cmd run test:ui` pass.

#### Manual Verification:

- Open GLOBAL HI-SCORE from main menu and end-game menu; inspect visual similarity, score formatting, PB rank, and the tie at rank 100.

## Testing Strategy

### Unit Tests:

- Cover pure final-score arithmetic, rounding, paid-spend counter semantics, and outcome-independent result construction.
- Cover strict-better global replacement, PB rank based on the private score, and joint persistence retries.
- Cover UI rendering and states with component-level tests.

### Integration Tests:

- Extend the existing result-history Supabase integration suite to verify one-row uniqueness, owner-private history, public-safe global projection, authenticated submission, anonymous reads, and rank/tie cutoff behavior.
- Use the existing isolated local Supabase Playwright lifecycle only for the admitted browser journey; never point feature tests at a remote project.

### Manual Testing Steps:

1. Start a run, make a successful ship/booster purchase and facility investment, then finish; compare the end-game components with the recorded actions and cargo costs.
2. From main menu and end-game menu, open GLOBAL HI-SCORE and verify public rows, displayed nickname, ranks, and the Personal Best rank callout.
3. With local test accounts, submit lower/equal/higher scores and verify only the higher score replaces the single global record; verify anonymous users can view but cannot submit.

## Performance Considerations

There is one global row per player. Use a score index and a bounded rank query for the board; the PB-rank query is a separate score comparison. Keep public responses limited to the four display fields and avoid fetching private history for anonymous board reads.

## Migration Notes

Apply the additive database migration before clients that write `final_score` or global rows. Legacy private rows retain `final_score = NULL` and are excluded from score PB selection; no conversion or app-side deletion is performed. Schema v19 has no v18 game-state migration. No production deployment is part of this plan.

## References

- Frame: `context/changes/s13-global-high-scores/frame.md`
- Research: `context/changes/s13-global-high-scores/research.md`
- Architecture: `context/foundation/architecture.md`
- State workflow: `.agents/skills/utils-add-state/SKILL.md`
- PRD validation: `.agents/skills/10x-prd-en-capability/SKILL.md`
- Result delivery and Personal Best patterns: see source references in `research.md`.
- Playwright admission rules: `context/testing/playwright-principles.md` and `AGENTS.md`.

## Progress

### Phase 1: Reconcile the Score Contract and Calculate Terminal Results

#### Automated

- [ ] 1.1 Pure score calculation tests cover cargo cost, each component, rounding, and terminal reasons.
- [ ] 1.2 Spending-counter and v19 snapshot codec tests pass.
- [ ] 1.3 PRD capability validation and semantic review pass.

#### Manual

- [ ] 1.4 End-game component breakdown and final score are correct.

### Phase 2: Persist Personal Scores and Maintain the Global Best

#### Automated

- [ ] 2.1 Private score selection and strict-better global replacement tests pass.
- [ ] 2.2 Joint persistence retry, idempotency, and partial-failure tests pass.
- [ ] 2.3 Database access, privacy, PB rank, tie, and cutoff integration tests pass.

#### Manual

- [ ] 2.4 Local sessions confirm public fields and strict-better replacement.

### Phase 3: Deliver the Leaderboard UI and Validate the Full Flow

#### Automated

- [ ] 3.1 Component and menu integration tests cover the required UI states.
- [ ] 3.2 The admitted menu-to-board Playwright journey passes with local Supabase.
- [ ] 3.3 Focused domain, fast, typecheck, and UI validation commands pass.

#### Manual

- [ ] 3.4 Both entry points, score formatting, PB rank, and rank-100 tie display are verified.
