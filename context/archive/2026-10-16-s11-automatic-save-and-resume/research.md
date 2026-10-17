---
date: 2026-10-16T22:56:01+02:00
researcher: Codex
git_commit: 2ec8a0c6babe6b2d826652315f847fa68d4de286
branch: main
repository: MilkyWayTrader
topic: "Existing contracts and gaps for signed-in active-run save and resume"
tags: [research, codebase, persistence, authentication, game-state]
status: complete
last_updated: 2026-10-16
last_updated_by: Codex
last_updated_note: "Refreshed at 2026-10-16T23:05:55+02:00 against current main working tree for consolidated S-11/S-14; verified profile eligibility, terminal delivery, minute boundaries, resume pauses, UI entry points, and test seams."
---

# Research: Signed-in active-run save and resume

**Date**: 2026-10-16T22:56:01+02:00  
**Researcher**: Codex  
**Git Commit**: 2ec8a0c6babe6b2d826652315f847fa68d4de286  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

For S-11, what existing state, authentication, persistence, lifecycle, UI, and product contracts apply to a signed-in player preserving progress, seeing save status, abandoning a run, and resuming an active run?

## Summary

The repository has a validated, versioned in-memory snapshot and a restore codec, but the inspected persistence adapters and database schema store terminal results rather than resumable active snapshots. The current OAuth round-trip saves a snapshot in tab-scoped `sessionStorage` only while signing in; it does not provide account-linked saves after closing or restarting the app. The PRD already specifies the intended save boundaries, retry/status behavior, abandonment semantics, and resume behavior. The user requires active-save eligibility to be limited to a signed-in player after a profile has been created; anonymous runs remain non-persistent. One contract mismatch needs explicit treatment in planning: the PRD includes abandonment among retained outcomes, while the current terminal model and `run_results` constraint accept death, freedom, and imprisonment only (`src/game/state/terminalResultState.ts:1`; `supabase/migrations/20261015120000_allow_timed_run_outcomes.sql:1-3`).

## Detailed Findings

### State snapshot and persistence boundary

- `GameStateSnapshot` is the version-19 JSON-safe aggregate for a run, including its `runId`, clock, credits, cargo, markets, ship, planets, combat entities, and optional terminal result (`src/game/state/gameStateSnapshot.ts:15-40`). The decoder accepts JSON text or an object and rejects schema versions other than 19 (`src/game/application/gameStateCodec.ts:119-127`); `encodeGameState` validates through the decoder before producing JSON (`src/game/application/gameStateCodec.ts:467-470`).
- `GameStateProvider` owns the in-memory snapshot and exposes `snapshot`, `update`, `restore`, and `reset`; these methods do not call a storage adapter (`src/game/application/gameStateProvider.ts:7-49`). The architecture document states that future persistence adapters serialize through the codec and that no storage backend is part of this boundary yet (`context/foundation/architecture.md:26-34`).

### Existing saves, results, and authentication

- In the inspected migrations, `public.run_results` is a terminal-results table with `run_id`, `user_id`, `outcome`, elapsed time, final credits, and creation time; its owner policies restrict insert/select to the authenticated user (`supabase/migrations/20261002120000_create_run_results.sql:1-27`). Later migrations add nullable final score and owner deletion, while the timed-outcome migration allows `death`, `freedom`, and `imprisonment` (`supabase/migrations/20261014120000_persist_global_high_scores.sql:1-37`; `20261014130000_allow_owner_run_result_deletion.sql:1-7`; `20261015120000_allow_timed_run_outcomes.sql:1-3`). These inspected migrations do not define an active snapshot table or save-status field.
- `ResultStorePort` persists a `TerminalScoreResult` and reports `saved`, `failed`, or `unsigned` (`src/game/application/results/resultStore.ts:1-14`). `createBrowserResultStore` gets the current session and inserts a row into `run_results`, alongside submitting the global score; it is a terminal-result path, not an active-run save API (`src/ui/adapters/browserResultStore.ts:47-80`). The result delivery layer exposes pending/failure/retry/status publication for that terminal flow (`src/game/application/results/resultDelivery.ts:6-23`), and game-over UI consumes it (`src/ui/setupUi.ts:85-93`).
- In the inspected browser auth setup, Supabase session persistence is enabled (`src/ui/adapters/browserAuth.ts:6-11`), and the auth port exposes session status, sign-in, sign-out, and token access (`src/ui/adapters/browserAuth.ts:34-86`). A new active-save adapter must additionally enforce the user's profile-existence requirement; the existing terminal result adapter demonstrates authenticated user scoping subject to database owner policies (`src/ui/adapters/browserResultStore.ts:59-70`).
- The OAuth return adapter writes an encoded snapshot under `milky-way-trader.auth-return` in `sessionStorage` and consumes/removes that entry when returning (`src/ui/adapters/browserAuthReturn.ts:7-13,47-75`). Sign-in preparation supplies the current snapshot for non-main-menu origins (`src/ui/setupUi.ts:138-148`), and startup restores a returned snapshot (`src/game/main.ts:66-77`). This is a temporary sign-in redirect handoff, not a durable, account-linked run save.
- The result history contract exposes paged history, best result, and result deletion/clear operations, but no active-run lookup (`src/game/application/results/resultHistoryStore.ts:1-35`). Its browser adapter queries and deletes rows in `run_results` (`src/ui/adapters/browserResultHistoryStore.ts:80-143`).

### Run lifecycle and visible controls

- The new-game path creates a fresh initial run and resets the provider before starting gameplay (`src/game/scenes/mainMenuScene.ts:34-64`). The inspected main-menu initialization has no active-save lookup or resume selection. The markup already contains a disabled Continue Game button (`index.html:21`); the inspected menu wiring does not bind it (`src/ui/setupUi.ts:165-167,210-217`). In the active game menu, Resume returns to the current in-memory game; Return to Main Menu pauses and changes scenes while leaving the current provider instance in memory (`src/ui/adapters/gameControlsAdapter.ts:20-25`; `src/game/scenes/gameScene.ts:459-463`). Neither path persists the snapshot for a later boot.
- Existing save feedback is connected to game-over terminal-result delivery (`src/ui/setupUi.ts:85-93`). The inspected code does not show an active-run save-status surface; S-11 will need a status contract and UI for that flow.

### Product contract already recorded for S-11

- The PRD says anonymous play does not create persistent saves, and a run signed in during play is attached and saved after the player's profile is created (`context/foundation/prd.md:420-421,445-450`). It specifies a save on landing and another on departure only when persisted state changed while landed; unsaved progress since the most recent successful save may be lost if the application closes before another save succeeds (`context/foundation/prd.md:422-424`).
- The PRD requires background saves not to delay gameplay, retries once per second up to five times, then every thirty seconds with a temporary-problem notice, and a recovery notice after a failed save recovers (`context/foundation/prd.md:281-284`).
- The PRD requires signed-in freedom, imprisonment, death, and abandonment outcomes to be retained; after a terminal result is saved to personal history and score submission succeeds, all of that player's active-run saves are removed; a resumed run restores saved remaining active time and the state required to continue; and completed runs cannot resume as active gameplay (`context/foundation/prd.md:127-138,425-428`). If Continue is available, selecting New Game requests confirmation: confirming abandons the saved run and deletes its active progress, while cancelling preserves it (`context/foundation/prd.md:134,425`).
- The consolidated roadmap records S-11 prerequisites as S-06, S-09, S-10, S-12, S-13, and S-16. Its risk includes full-state restoration, retry behavior and retaining active saves until required terminal writes succeed, with confirmed abandonment treated separately (`context/foundation/roadmap.md:234-244`).
- After the initial research, the user added four product requirements: save whenever the remaining-time clock completes another full minute, save when returning to Main Menu, display `Auto-save successful` or `Auto-save failed` for two seconds below the menu controls, and offer `Continue` from Main Menu when a saved active run exists. The user clarified that a save completed during gameplay must show its message immediately below the in-game Menu button. These are recorded in the PRD acceptance criteria for US-05 and business rules BR-119 through BR-122 (`context/foundation/prd.md`, US-05 and Authentication, persistence, and scores).
- The user further specified that selecting New Game while Continue is available must request confirmation; confirming abandons the prior saved run and deletes its active progress, while cancelling preserves it. After a signed-in terminal result is retained in personal history and its global score submission succeeds, all active-run saves belonging to that player must be deleted. This does not delete the retained result-history record. The PRD records these requirements in US-05 and BR-106, BR-109 (`context/foundation/prd.md:134-136,425,428`).
- The user clarified that persistent active-run saves are available only to signed-in players after a player profile exists; anonymous players cannot access saved game state (`context/foundation/prd.md:419-421,445-448`).

### Refresh for the consolidated S-11/S-14 scope

These findings extend the initial research; the disabled Continue markup and expanded roadmap prerequisites above correct the earlier incomplete descriptions. Source revision remains the recorded commit; the PRD, roadmap and change notes have local uncommitted requirements. This refresh inspected source and local migrations, without querying a deployed database or exercising browser restoration.

- **Eligibility must be shared with the save service.** `AuthSnapshot` exposes status, email and message, without an owner ID or profile-readiness field (`src/game/application/auth/auth.ts:3-8`). The account component loads/creates profiles and guards late responses locally (`src/ui/components/playerAccount.ts:101-117,153-165,230-232`). The browser profile adapter re-reads after a failed creation attempt, accommodating concurrent creation (`src/ui/adapters/browserPlayerProfile.ts:32-45`). The inspected profile owner policies use `auth.uid()` but do not explicitly reject anonymous JWT sessions (`supabase/migrations/20261011120000_create_player_profiles.sql:7-22`). S-11 must enforce the specified non-anonymous, existing-profile requirement at the storage boundary as well as in UI eligibility.
- **Minute triggers belong to active state transitions.** The clock advances when player pause is false and environmental pause reasons are empty, and clamps at its budget (`src/game/mechanics/clock/gameClock.ts:10-20`). Simulation advances that clock before committing state; provider subscribers observe commits (`src/game/mechanics/gameSimulation.ts:80-92`; `src/game/application/gameStateProvider.ts:29-62`). The HUD rounds remaining seconds upward (`src/game/application/runStatus.ts:37`). Infer autosave boundaries from authoritative elapsed/budget values rather than displayed text. The debug shortcut directly jumps elapsed time to three seconds before the deadline (`src/game/mechanics/clock/gameClock.ts:3-8`); planning must define how multiple crossed boundaries coalesce into a current-state save.
- **Departure needs a meaningful dirty baseline.** Landing sets landed identity and pauses player time; launch clears landing and resumes player time (`src/game/mechanics/planet/landing.ts:6-36`). Trading, facilities and shipyard actions mutate provider state; launch commits before publishing its modal transition (`src/ui/adapters/landingStatusAdapter.ts:132-189`). A whole-snapshot inequality would also detect the lifecycle/clock changes inherent in departure, so it cannot by itself prove the PRD's qualifying landed changes.
- **New Game has an existing intro owner.** The intro component binds New Game and opens the story modal, then starts the run after its debt screen (`src/ui/components/gameIntro.ts:94-103,126-148`). Confirmation must coordinate that entry point; adding an unrelated button listener could open the intro before the player confirms abandonment.
- **Resume must reconcile session pauses.** Return to Menu removes the menu pause and emits its command (`src/ui/adapters/gameControlsAdapter.ts:22`). Game then adds background pause through `loseFocus` before starting MainMenu, and shutdown calls `loseFocus` again (`src/game/scenes/gameScene.ts:174-175,449-462`). The codec retains player pause and environmental reasons (`src/game/application/gameStateCodec.ts:229-242,429`). Inference: restoring this snapshot verbatim can leave the resumed game frozen until a later focus event. Preserve intentional player/landed pause while deriving current browser/menu/orientation pause conditions. Existing Game construction rebuilds world projections from provider state and active time (`src/game/scenes/gameScene.ts:125-138,205-213`); runtime Continue reconstruction is not yet verified.
- **Cleanup follows successful delivery, including an unchanged global best.** The terminal adapter waits for private and global writes, reports failure if either fails, and accepts private duplicate-key code `23505` on retry (`src/ui/adapters/browserResultStore.ts:59-78`). The global SQL updates an existing best for a strictly higher submitted score; an equal or lower submission can succeed without changing it (`supabase/migrations/20261014120000_persist_global_high_scores.sql:15-37`). Cleanup therefore follows successful score submission, not an increase in the leaderboard value. Existing result delivery exposes a manual retry, without the active-save retry scheduler required by the PRD (`src/game/application/results/resultDelivery.ts:6-23`).
- **Identity and scene lifetime need explicit guards.** Private delivery captures a session owner, while global delivery obtains its session separately (`src/ui/adapters/browserResultStore.ts:59-70`; `src/ui/adapters/browserGlobalScoreStore.ts:45-58`). Inference: an intervening account switch can split delivery ownership. GameOver publishes completion while active and permits return to Main Menu before the asynchronous write settles (`src/game/scenes/gameOverScene.ts:34-51`). Cleanup cannot depend solely on a visible scene notification. The future save orchestration must reject stale account completions and order autosave, abandonment and terminal cleanup so retries cannot recreate deleted progress or a late player-wide delete erase a newly started run.
- **Abandonment requires a coordinated contract extension.** The current terminal outcome union is death/freedom/imprisonment (`src/game/state/terminalResultState.ts:1`); terminal reduction handles HP loss and timeout (`src/game/mechanics/hazards/terminal.ts:6-20`), and codec validation checks those outcome-specific conditions (`src/game/application/gameStateCodec.ts:255-270`). Expanding the database constraint alone will not implement the retained abandonment result required by BR-106.

### Verification seams for planning

- Existing fast tests cover snapshot round trips, atomic restore failure, paused restoration and simulation continuity (`tests/domain/gameState.test.mjs:129,296,315,337,884,898`), facility continuity (`tests/game-mechanics.test.mjs:1232,1256`), and private/global partial-delivery retries (`tests/domain/resultStore.test.mjs:44-64`). Their presence is evidence of reusable test seams, not a claim that they passed during this research.
- The UI fixture provides isolated authenticated sessions and configurable initial game state (`tests/ui/testSessionFixture.ts:30-89`). `prepareGameState` enters via New Game and prepares a landed state (`tests/ui/gameStateFixture.ts:30-65`); MainMenu consumes its local fixture entry once (`src/game/scenes/mainMenuScene.ts:38-57`). A future persistence journey must resume through real storage after reload, without reinstalling that initial fixture. Clock calculations, retries, cleanup ordering, codec validation and database authorization belong in fast or integration tests; a browser journey is justified for actual reload/Continue wiring and restored gameplay (`context/foundation/testing.md:5-9,31-35`; `context/testing/playwright-principles.md`, P9 and P15).
- No build or product tests were run: this refresh answers source-contract questions and edits the research artifact. Deployed schema, real request failures and visual desktop/mobile toast placement remain implementation verification work.

## Code References

- `src/game/state/gameStateSnapshot.ts:15-40` - Versioned aggregate available for persistence.
- `src/game/application/gameStateCodec.ts:119-127,467-470` - Strict decode and JSON encoding boundary.
- `src/game/application/gameStateProvider.ts:7-49` - In-memory authoritative state and atomic restore/reset boundary.
- `src/ui/adapters/browserAuthReturn.ts:7-13,47-75` - Temporary OAuth return snapshot in session storage.
- `src/ui/adapters/browserResultStore.ts:47-80` - Authenticated terminal-result write path.
- `supabase/migrations/20261002120000_create_run_results.sql:1-27` - Terminal-result schema and owner policies.
- `src/game/scenes/mainMenuScene.ts:34-64` - New-run reset path.

## Architecture Insights

The intended persistence seam is the application-owned JSON codec around `GameStateSnapshot`, with storage and Supabase access kept in adapters. The current snapshot contains active-clock time and pause state, and the architecture excludes wall-clock time, so closing/backgrounding does not itself advance the saved run (`context/foundation/architecture.md:26-34`). Any save-status failure handling should remain outside reducers and must not block gameplay, in line with the PRD (`context/foundation/prd.md:50,281-284`).

The project lesson says not to add snapshot migration support before the application reaches the required maturity; plan compatibility around the current codec contract and explicitly assess whether schema changes are necessary (`context/foundation/lessons.md:12-16`).

## Historical Context (from prior changes)

- An archived state-commit fix explicitly retained `encodeGameState` as the future S-11 save/restore contract while prohibiting persistence work in that change (`context/archive/2026-10-09-bug01-state-commit-issue-fix/plan.md:56-57,259-260`). The current codec remains present and tested; this history supports reuse of the codec, not a persistence backend.

## Related Research

This document extends the existing S-11 research in place; no separate companion research artifact was created for this refresh.

## Open Questions

The PRD resolves the player-facing save boundaries, retry schedule, autosave triggers, status feedback and placement, profile eligibility, abandonment confirmation, cleanup condition, and resume semantics. Planning still needs to choose and validate the implementation contracts for active-save storage/upsert and retrieval, concurrent tabs or multiple active saves, sign-out/account-switch behavior during a run, how an abandoned result is persisted given the current terminal outcome mismatch, transient-pause reconciliation, departure dirty baselines, minute-jump coalescing, and ordering of pending writes versus deletion. The confirmed product requirements remain fixed; these are implementation decisions. There is a wording mismatch between US-05's immediate mid-run sign-in acceptance criterion and BR-101/Access Control's explicit profile-first condition; planning must preserve the latter, as clarified by the user. The user folded the former S-14 terminal-save cleanup scope into S-11; the roadmap now represents that work only in S-11 (`context/foundation/roadmap.md`, S-11 and Scope Changes).
