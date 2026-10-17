# Automatic Save, Resume, and Terminal Cleanup Implementation Plan

## Overview

Deliver S-11 together with the former S-14 scope: a signed-in, non-anonymous player with a created profile can preserve progress automatically, inspect save feedback, continue a saved run, confirm abandonment, and retain terminal results before active progress is removed. Complexity HIGH, five substantive decisions, and the five-phase structure were approved on 2026-10-16. Planning does not authorize implementation or deployment.

## Current State Analysis

`GameStateProvider` owns an immutable aggregate and supports atomic codec-based restore. Schema 19 contains active time, world state, economy, facilities and score spending. Current persistence stores terminal results; OAuth temporarily carries a snapshot through tab session storage. Continue Game is disabled. Profile readiness is component-local, and terminal delivery makes independent personal/global requests.

The research covers session pause restoration, intro listener ownership, account changes, pending saves after deletion, and scene-scoped result notifications. Source baseline is main at `2ec8a0c6babe6b2d826652315f847fa68d4de286`; PRD, roadmap and change notes also contain local requirements. Preserve the working tree and user changes.

## Desired End State

- One active saved run per eligible account. Expected run/revision checks reject stale tabs and offer explicit authoritative reload without silent merge or overwrite.
- Autosave follows profile-ready mid-run attachment, landing, qualifying changed departure, each complete minute on the remaining-time clock, and return to Main Menu. A new eligible run establishes an initial save. Background save requests do not hold gameplay interactions.
- Completion immediately shows `Auto-save successful` or `Auto-save failed` for two seconds below the in-game Menu button or Main Menu controls, according to the currently visible screen.
- Continue restores validated state and remaining active time, including facilities, cargo cost bases, upgrades and world continuity. It bypasses the introduction and reconciles current environmental pauses while preserving intentional player/landed pause.
- New Game with an active save asks for confirmation before opening the intro. Cancellation preserves progress. Confirmation retains abandonment and deletes its progress before another saved run starts. Failure retains server state and exposes Retry.
- Mid-run sign-in with another account save asks which run to keep: load the account run, or confirm its abandonment before attaching the current run. No automatic replacement occurs before the decision.
- Unsupported/corrupt saves remain stored with an explanation and disabled Continue. Explicit confirmed discard allows New Game. Invalid data cannot yield a trustworthy abandonment score, so discard does not invent a result.
- Personal retention, global score submission and active-save cleanup complete atomically for death, freedom, imprisonment and abandonment. Successful equal/lower submissions permit cleanup without changing the global best.
- Terminal-pending data restores results/Retry, never active gameplay. A new saved run waits until finalization and cleanup succeed. Sign-out preserves account data; anonymous play remains available after sign-out.

### Key Discoveries:

- Snapshot/restore seams: `src/game/state/gameStateSnapshot.ts:15-40`, `src/game/application/gameStateCodec.ts:119-127,255-270,467-470`, `src/game/application/gameStateProvider.ts:29-62`.
- Profile readiness is local; auth lacks stable owner/profile eligibility: `src/ui/components/playerAccount.ts:101-117,153-165`, `src/game/application/auth/auth.ts:3-8`.
- Minute/landing transitions: `src/game/mechanics/clock/gameClock.ts:3-20`, `src/game/mechanics/planet/landing.ts:6-36`, `src/ui/adapters/landingStatusAdapter.ts:132-189`.
- Intro owns New Game: `src/ui/components/gameIntro.ts:94-103,127-149`. Confirmation must gate this entry rather than add a competing listener.
- Menu exit adds background pause: `src/game/scenes/gameScene.ts:449-462`. OAuth boot restores before account-save discovery: `src/game/main.ts:66-77`.
- Delivery currently uses independent requests and scene-scoped notifications: `src/ui/adapters/browserResultStore.ts:59-78`, `src/game/scenes/gameOverScene.ts:34-51`.

## What We're NOT Doing

- Multiple selectable active saves, force overwrite/takeover, or server simulation/anti-cheat scoring.
- Snapshot migrations or automatic deletion of incompatible data.
- Multiple offline pending-run queues or guarantees against clearing browser storage before an offline terminal intent reaches the server.
- Changes to OAuth provider, balance, recipes, unrelated screens or result-history deletion behavior.
- Remote/production migration deployment, commits, pushes or archive during planning. Implementation validates against local Supabase; production rollout requires separate authorization.
- Code-graph or logical-data-diagram generation, which was not requested.

## Implementation Approach

Apply `utils-add-state` to authoritative transitions and codec changes. Keep simulation values in the snapshot; owner epochs, request revisions, retry handles and notice timers belong to application services/adapters. Compose one game-lifetime save coordinator at the root, rather than scene-owned queues.

Use one owner-keyed database slot with monotonically increasing revision and `empty`, `active` or `terminal_pending` status. Empty slots retain revision/idempotency metadata without gameplay content. Mutations lock the owner slot and require expected run/revision plus request ID. Exact replays acknowledge the same operation; stale differing requests return a typed conflict. Enforce matching identity, non-anonymous session and existing profile at the database boundary.

A terminal RPC validates identity and payload, retains personal history, invokes the existing global-best update and clears progress in one transaction. Replayed completion verifies the retained result or bounded replay receipt and cannot delete a newer run or reinsert explicitly deleted personal history. A validated owner-scoped local terminal intent supports same-browser reload recovery while the server is unreachable. This is not a queue allowing new saved gameplay before completion.

### Planning decisions

| Decision | Approved behavior | Source |
| --- | --- | --- |
| Eligibility | Signed-in, non-anonymous, created profile | User / PRD Access Control |
| Save boundaries and feedback | Minute/menu/landing/changed departure/attachment; exact two-second notices | User / BR-101-104, BR-119-122 |
| Concurrent sessions | One active run; stale write rejected, authoritative reload offered | Interview 1/5 |
| Login collision | Choose account save or confirm abandonment before keeping current run | Interview 2/5 |
| Unsupported/corrupt save | Preserve and explain; confirmed discard | Interview 3/5 |
| Abandon failure | Retain prior server state, Retry, wait before new saved run | Interview 4/5 |
| Terminal failure | Recover results/Retry; wait before new saved run | Interview 5/5 |
| S-14 ownership | Terminal active-save cleanup belongs to S-11 | User / roadmap |
| Delivery consistency | Transactional RPC, revisions and owner-scoped pending intent | Plan based on research |

## Critical Implementation Details

### Timing and lifecycle

Detect minute crossings from committed authoritative elapsed/budget values, not rounded HUD text. A jump across several boundaries schedules one latest-state save; repeated notifications at the same boundary do not duplicate it. Terminal persistence takes precedence at the terminal boundary. Departure dirty checks exclude inevitable clock/lifecycle changes and compare qualifying landed economic/service fields against a landing baseline.

### State sequencing

Account changes invalidate callbacks before another owner's data is displayed. Allow one in-flight mutation and one latest-state dirty marker. Terminal intent stops active scheduling and reconciles any in-flight acknowledgement before terminal CAS. Conflict cancels automatic writes/retries and requires explicit authoritative reload. A stale acknowledgement cannot clear newer dirty state or show misleading save success.

### Durable completion

Before sending terminal delivery, retain a validated owner-scoped local intent with terminal snapshot and expected server identity. Mark terminal-pending when reachable, then finalize; clear local intent only after confirmed success. If local storage fails, report recoverability failure and retain in-memory results rather than claiming durable success. Another device cannot know about a terminal transition that never reached the server; reconnection CAS prevents deleting or overwriting changed progress.

## Phase 1: Account Eligibility and Authoritative Abandonment

### Overview

Expose stable account/profile eligibility and introduce authoritative abandonment with codec and scoring continuity.

### Changes Required:

#### 1. Shared identity and profile readiness

**Files**: `src/game/application/auth/auth.ts`, new `src/game/application/auth/playerEligibility.ts`, `src/ui/adapters/browserAuth.ts`, `src/ui/adapters/browserPlayerProfile.ts`, `src/ui/components/playerAccount.ts`, `src/main.ts`, `src/ui/setupUi.ts`.

**Intent**: Give save services a stable owner ID, anonymous flag and profile readiness without accessing component-local fields or duplicating profile creation.

**Contract**: Publish owner-scoped loading/ready/unsigned/failed eligibility. Reuse `loadOrCreate`; sign-out/account switch invalidate prior operations. UI consumes the same profile state. Public models/logs do not expose tokens or service credentials.

#### 2. Authoritative terminal contract

**Files**: `src/game/state/terminalResultState.ts`, `src/game/state/gameStateSnapshot.ts`, `src/game/definitions/initialGameState.ts`, `src/game/application/gameStateCodec.ts`, `src/game/mechanics/hazards/terminal.ts`, `src/game/application/results/terminalScoreResult.ts`, affected result/history projections.

**Intent**: Retain confirmed abandonment using actual elapsed time, cash, cargo acquisition cost and qualifying spending.

**Contract**: Add `abandonment` and a pure idempotent transition; existing terminal runs remain unchanged. Validate abandonment independently of death/timeout conditions. Increment schema 19 to 20 because the persisted outcome contract changes; reject prior schemas without migration. State stays readonly and JSON-safe. Application commands initiate abandonment.

#### 3. Focused regression coverage

**Files**: `tests/domain/gameState.test.mjs`, `tests/domain/playerAccount.test.mjs`, `tests/domain/resultStore.test.mjs`, new focused eligibility tests under `tests/domain/`.

**Intent**: Prove shared eligibility and terminal behavior before network orchestration.

**Contract**: Cover profile/account races, anonymous rejection, immutable/idempotent abandonment, score continuity, schema rejection, atomic restore and death/timeout regressions.

### Success Criteria:

#### Automated Verification:

- Domain tests pass for eligibility, abandonment, schema 20, atomic restore and scoring: `npm.cmd run test:domain`.
- Clock and terminal mechanics regressions pass: `npm.cmd run test:mechanics`.
- Type and architecture checks pass: `npm.cmd run typecheck` and `npm.cmd run test:architecture`.

**Implementation Note**: Complete automated criteria before Phase 2; active-save UI is enabled in Phase 4.

## Phase 2: Transactional Save Storage and Adapters

### Overview

Implement owner-only storage, stale-write protection, idempotent requests and transactional terminal retention/cleanup against local Supabase.

### Changes Required:

#### 1. Slot and mutation RPCs

**Files**: new timestamped migration under `supabase/migrations/`.

**Intent**: Store one active run per eligible owner while preventing stale requests from reviving deleted progress.

**Contract**: Store owner/run IDs, revision, status, encoded snapshot/schema version, updated time and bounded replay metadata. Active/pending requires a payload; empty contains no gameplay payload. Reads/mutations enforce owner, non-anonymous session and existing profile. Provide load/create/save/mark-terminal/discard RPC contracts with expected run/revision and mutation ID. Lock the owner slot, deny direct mutation bypass, validate payload envelope/finite score fields and return typed conflicts. Security-definer routines use fixed empty search paths, qualified identifiers, narrow grants and explicit caller checks. Failure leaves state unchanged.

#### 2. Atomic finalization and explicit invalid-save discard

**Files**: the same migration, `src/game/application/results/resultStore.ts`, `src/ui/adapters/browserResultStore.ts`.

**Intent**: Retain personal/global results and clear progress together, with a separate safe operation for invalid data.

**Contract**: Allow abandonment in `run_results`. Finalization verifies owner/run/revision and duplicate payload identity, writes personal history, submits global best and empties progress transactionally. Equal/lower scores succeed while preserving best-score dates. Exact replay cannot delete a newer run or recreate a deliberately deleted history record; preserve bounded finalization replay metadata after cleanup. Invalid-save discard requires confirmation plus expected revision and leaves personal/global history unchanged.

#### 3. Typed ports and browser adapters

**Files**: new `src/game/application/saves/activeRunStore.ts`, new `src/ui/adapters/browserActiveRunStore.ts`, result adapter/port, root composition.

**Intent**: Keep SQL/network access outside simulation and distinguish conflict/ineligibility/incompatibility from transient failures.

**Contract**: Load distinguishes empty, active, terminal-pending and incompatible/unavailable data. Mutations return acknowledged revision or typed failure. Decode before restore and encode before save. Capture stable owner/epoch and verify it again on completion. Replace independent signed-in terminal writes with the atomic finalizer; anonymous display makes no persistence request.

#### 4. API-level database and adapter tests

**Files**: new `tests/integration/activeRunSavesIntegrationTest.ts`, `tests/integration/testSessionFixture.ts`, `tests/testSessionSupport.ts` and session lifecycle scripts only where needed; new adapter tests under `tests/domain/`.

**Intent**: Verify RLS and transactional races using isolated local identities without browser pages.

**Contract**: Cover owner/other owner/no session/anonymous JWT/missing profile; concurrent create and CAS conflicts; response-loss replay; rollback; attempted revival; duplicate mismatch; replay after newer-run creation and private-history deletion. Use the existing cleanup lifecycle, not table truncation. Integration test titles use the prefix `active run persistence` for focused execution.

### Success Criteria:

#### Automated Verification:

- Local migrations and focused persistence/RLS integration tests pass: `npm.cmd run test:ui -- --grep "active run persistence"`.
- Adapter and result contract tests pass: `npm.cmd run test:domain`.
- Type and architecture checks pass: `npm.cmd run typecheck` and `npm.cmd run test:architecture`.

**Implementation Note**: Start local Supabase using `npx supabase start --exclude vector`. The existing runner owns its single local reset and isolated sessions. Do not target remote projects or install dependencies.

## Phase 3: Autosave and Durable Completion Coordinator

### Overview

Compose one persistence lifecycle across simulation, scenes and account changes, with background retries and terminal recovery.

### Changes Required:

#### 1. Trigger detection and coalescing

**Files**: new `src/game/application/saves/runSaveCoordinator.ts`, pure trigger/dirty selectors alongside it, root composition in `src/main.ts` and `src/game/main.ts`; extend provider subscriptions only if necessary.

**Intent**: Observe committed snapshots and save meaningful state without putting requests in reducers or per-frame scene behavior.

**Contract**: Initial eligible run/attachment request a save after collision resolution. Detect landing/minute crossings once. Changed departure compares qualifying commerce/facility/ship-service fields with the landing baseline. Coalesce pending requests to latest state; acknowledgement cannot clear later changes. Menu exit explicitly requests a save of the latest paused state.

#### 2. Retry, conflict and feedback state

**Files**: coordinator, application save-status model, browser scheduler adapter under `src/ui/adapters/`.

**Intent**: Preserve responsiveness while making failures and recovery visible.

**Contract**: Count the initial failed attempt as failure 1. Retry after one second while the consecutive failure count is below five: failures occur at t=0, 1, 2, 3 and 4 seconds under immediate failures. At failure 5 show temporary-problem feedback; the next retry is thirty seconds later (t=34), then every thirty seconds until recovery. This honors the five-consecutive-failure threshold and stays within the PRD limit of up to five one-second retries. Successful latest-state save resets the sequence. Conflict stops automatic writes and offers authoritative reload. Publish owner/operation-aware completion events. Two-second expiry uses injected presentation time and resets for a newer notice. Requests/timers are invalidated on owner change/destruction.

#### 3. Durable terminal intent and recovery

**Files**: coordinator, new `src/ui/adapters/browserPendingRunResult.ts`, `src/game/application/results/resultDelivery.ts`, result adapter, root composition.

**Intent**: Move delivery beyond scene lifetime and recover failure without replaying completed gameplay.

**Contract**: Retain owner-scoped validated intent, stop active scheduling, reconcile in-flight acknowledgement, mark terminal-pending and finalize. Success clears local intent and refreshes menu availability. Failure retains pending data, exposes Retry and blocks a new saved run. Boot checks local/server pending state before enabling actions; terminal data routes to results. Logout hides but preserves that owner's intent. Local storage failure remains explicit. No anonymous active-run snapshot is persisted by this mechanism; temporary OAuth handoff remains a separate existing flow.

#### 4. Deterministic state-machine tests

**Files**: new focused Node suites under `tests/domain/`, existing provider/result-delivery tests where contracts change.

**Intent**: Prove timing and concurrency with injected scheduler and ports.

**Contract**: Cover before/exact/after boundaries, paused/long/debug frames, terminal precedence, dirty baselines, reordered responses, retry sequence, coalescing, owner switches, conflicts, teardown, completion after scene exit, pending-intent reload and finalization replay. Use controlled promises and immutable inputs, not gameplay waits.

### Success Criteria:

#### Automated Verification:

- Deterministic autosave, retry and lifecycle tests pass: `npm.cmd run test:domain`.
- Simulation and projection regressions pass: `npm.cmd run test:fast`.
- Type checks pass: `npm.cmd run typecheck`.

**Implementation Note**: UI routing and real player actions are integrated in Phase 4.

## Phase 4: Continue, Confirmation, Recovery, and Save Feedback UI

### Overview

Connect persistent state to Main Menu, gameplay, OAuth return and results with accessible choices and correct pauses.

### Changes Required:

#### 1. Menu state and guarded New Game

**Files**: `index.html`, `src/ui/setupUi.ts`, `src/ui/components/gameIntro.ts`, new `src/ui/components/runSaveControls.ts`, relevant ports and existing shared-label modules.

**Intent**: Enable Continue for valid active progress and confirm destructive replacement before the intro opens.

**Contract**: Represent loading/empty/active/incompatible/conflict/terminal-pending states. Use one guarded New Game entry. Cancel preserves run/revision and returns focus; confirm waits for successful abandonment finalization. Failure exposes inline Retry. Invalid data uses independent persistent explanation and confirmed discard. Pending terminal data offers results/Retry while new saved gameplay is unavailable. Reuse semantic dialog/focus conventions and label constants.

#### 2. Resume and environmental pause reconciliation

**Files**: `src/game/scenes/mainMenuScene.ts`, `src/game/scenes/gameScene.ts`, `src/game/scenes/preloaderScene.ts`, `src/game/main.ts`, `src/ui/adapters/gameControlsAdapter.ts`, `src/ui/adapters/landingStatusAdapter.ts`.

**Intent**: Restore through the provider and reconstruct projections before gameplay resumes.

**Contract**: Continue bypasses initial reset/intro. Derive session background/menu/orientation pauses from actual conditions while preserving intentional player/landed pause. Clear held input and rebuild current world/landed controls. Menu exit requests save after its pause commit. Terminal snapshots route to results. Re-entry cannot duplicate subscriptions, requests or listeners.

#### 3. OAuth collision choice

**Files**: `src/ui/adapters/browserAuthReturn.ts`, `src/ui/components/playerAccount.ts`, save controls, root/preloader composition.

**Intent**: Hold anonymous return progress while profile readiness and account-save discovery resolve.

**Contract**: Do not attach/autosave before discovery and choice. If another active run exists, pause and offer load account run or confirm its abandonment before keeping current progress. Failed finalization retains current temporary progress and Retry. Selecting account save discards unsigned temporary progress without fabricating a signed-in result. Account terminal-pending work finishes before current progress attaches. A run already owned by another signed-in account is never relabeled on account switch.

#### 4. Save notices and result ownership

**Files**: `index.html`, `public/style.css`, save controls, `src/game/scenes/gameOverScene.ts`, existing game-over component/adapter/port, `src/ui/setupUi.ts`.

**Intent**: Show autosave status in the required location and let results consume game-lifetime delivery state.

**Contract**: Polite non-modal notices last two seconds and do not cover controls or scores. Detailed conflict/recovery feedback remains reachable afterward. GameOver consumes coordinator status/Retry rather than starting duplicate delivery. Explicitly label abandonment; recovered abandonment results use existing failure artwork without claiming ship death. Preserve score reveal/button behavior and shared label constants.

#### 5. Fast component tests

**Files**: focused fast UI tests alongside `tests/gameIntro.test.mjs`, existing account/result/menu tests.

**Intent**: Cover decisions, notice timing and cleanup cheaply before browser journeys.

**Contract**: Test focus/Escape, cancel/failure, intro gating, loading errors, conflict choices, invalid-save preservation, latest-notice expiry, owner invalidation and results retry after menu navigation through typed ports and injected time. These isolated rules do not require additional E2E cases.

### Success Criteria:

#### Automated Verification:

- Fast UI, account, intro and persistence wiring tests pass: `npm.cmd run test:fast`.
- Type checks pass: `npm.cmd run typecheck`.

#### Manual Verification:

- An eligible player can Continue, cancel/confirm New Game, resolve a login collision and retry failed abandonment/terminal delivery; completed runs cannot resume as gameplay.

**Implementation Note**: After automated checks, pause for this human confirmation before Phase 5 unless the user explicitly authorizes deferring manual review until the end.

## Phase 5: Responsive Audit, Browser Journeys, and Complete Validation

### Overview

Verify integrated desktop/mobile behavior and local persistence, update documentation, and deliver complete automated evidence for human review.

### Changes Required:

#### 1. Minimal admitted browser journeys

**Files**: new `tests/ui/automaticSaveResumeUiTest.ts`, existing fixture modules only where necessary.

**Intent**: Verify real reload/Continue wiring and confirmation-before-intro integration.

**Contract**: Use the isolated authenticated `tests/ui/testSessionFixture.ts`. Journey A saves through a real qualifying action, reloads, Continues and observes restored landed values plus usable gameplay; lower-level tests cannot expose browser storage/boot/scene/adapter wiring. Journey B cancels/confirms New Game and verifies saved progress is protected and intro opens after finalization; cheaper tests cannot prove actual listener/dialog/intro integration. Record these admission rationales beside implementation. Seed once; never re-inject initial state on reload. Use roles/labels/text and readiness conditions without arbitrary sleeps or minute-long play. Keep calculations, retries and RLS at lower levels.

#### 2. Responsive UI audit

**Files**: evidenced CSS/HTML/TS repairs only; artifacts under `context/responsive-ui-audit/s11-save-and-resume/`.

**Intent**: Keep Main Menu, save notices, confirmations, conflicts, incompatible data and pending-result recovery legible and usable across screens.

**Contract**: Apply `responsive-ui-audit` at 1920x1080, 844x390 touch and 640x360 touch. Enumerate changed screen/state/profile combinations; capture native viewport screenshots and DOM geometry; inspect text, stacking, focus/touch reachability and controls. Preserve desktop hierarchy while adapting mobile. Keep the execution ledger, independent layout-integrity verdicts and final report. Critical repairs are delegated sequentially and independently rechecked. No Critical or material unresolved readability/overlap defect in the new UI remains at handoff.

#### 3. Documentation and scenario inventory

**Files**: `context/foundation/architecture.md`, applicable save/lifecycle documentation, `context/foundation/e2e_scenarios.md`, active change evidence/reviews. Edit PRD only if needed to align its profile-first acceptance wording.

**Intent**: Explain implemented save/restore boundaries, eligibility, retry/recovery and actual coverage.

**Contract**: Invoke `utils-describe-e2e-scenarios` immediately after changing browser E2E tests. Update stale architecture claims about absent storage and schema migration behavior. Any PRD edit requires `10x-prd-en-capability` deterministic and semantic validation. Preserve archives and keep human acceptance pending until confirmed.

#### 4. Complete automated verification

**Files**: existing product test/build scripts and local diagnostics; product fixes only for actual failures.

**Intent**: Demonstrate all existing and new tests pass together, including Playwright.

**Contract**: Start local Supabase and invoke `cicd-run-tests` for raw logs/report; use `cicd-fix-tests` on its current failing report and rerun as that workflow requires. After product validation run `npm.cmd run build-nolog` and `npm.cmd run check:pages`. Do not install dependencies/browsers or alter normal-dev OAuth settings. Infrastructure blockers are reported distinctly, never as a pass.

### Success Criteria:

#### Automated Verification:

- All unit, mechanics, architecture, typecheck, integration and Playwright UI tests pass together with a current `cicd-run-tests` report.
- Production build and Pages asset checks pass: `npm.cmd run build-nolog` and `npm.cmd run check:pages`.
- Responsive audit passes every enumerated changed state at 1920x1080, 844x390 and 640x360 with screenshot, geometry, interaction and visual-integrity evidence.
- Documentation and E2E inventory match implemented behavior; any PRD edit passes deterministic and semantic validation.

#### Manual Verification:

- Human review confirms desktop/mobile placement, wording, focus/touch behavior, Continue continuity and result recovery; implementation-review action points are reviewed before completion/archive.

**Implementation Note**: Hand control back after automated work/evidence. Leave human criteria unchecked until confirmed; archive requires the normal workflow.

## Testing Strategy

### Unit Tests:

Cover abandonment/scoring/codec; exact minute boundaries and pause/debug jumps; landing baselines; retry schedules; coalescing/response ordering; owner/profile epochs; conflict/disposal; storage failure and pending terminal reload. Use virtual schedulers and controlled promises. Existing serialization/simulation continuity tests remain the basis for world correctness.

### Integration Tests:

Use the existing local API-level integration fixture even though its runner is Playwright; these cases create no browser page. Cover authorization, CAS/replays, rollback, equal/lower global submissions, terminal-pending recovery, abandonment, invalid-save discard, and replay after newer progress/private-history deletion. Cleanup follows identity ownership and never targets remote data.

### Browser Tests:

Phase 5 admits two focused journeys for actual boot/persistence/Continue and confirmation/intro wiring. Consult `10x-e2e-setup` for a gap audit and use `10x-e2e` for admitted risks, reusing working configuration without reinstalling it. Initial bootstrap is consumed once; subsequent reloads observe persisted data. No E2E cases for arithmetic, state transitions, timers or authorization policies.

### Manual Testing Steps:

1. Save landed changes, reload, Continue and launch; inspect time, restored values and controls.
2. Observe minute/menu autosaves and two-second success/failure feedback; restore connectivity and inspect recovery.
3. Cancel New Game, then confirm abandonment; inspect retained history and intro ordering.
4. Log in mid-run with an account save and exercise both keep-run choices.
5. Produce a stale revision in two sessions; verify reload choice and no silent overwrite.
6. Exercise invalid-save discard and terminal failure/reload/Retry with disposable data; check new saved gameplay waits.
7. Inspect the three audit viewports and implementation-review action points.

## Performance Considerations

Requests run outside simulation reducers/frame reconciliation. Observers detect lightweight transitions and encode when scheduling a save rather than every frame. One mutation is in flight per owner coordinator; keep only the latest dirty snapshot. Reuse acknowledged revisions rather than polling each frame. Stop retries on conflict, owner change or destruction. Reuse the existing fixture timing diagnostics for browser setup cost.

## Migration Notes

Add forward SQL migrations without editing applied files. Preserve existing personal/global results, including historical nullable scores. Schema 20 becomes the accepted aggregate contract; reject older snapshots and preserve them until confirmed discard. Update fixtures/schema assertions consistently; OAuth handoff remains temporary and validated.

Deploy migration before enabling the new client, under separate production authorization. Client rollback preserves tables and user saves; never drop them as rollback. Older clients cannot resume schema 20 and may use legacy result delivery, so prefer forward correction and explicitly evaluate rollback implications. Local validation resets only loopback Supabase through the dedicated test lifecycle.

## References

- `context/changes/s11-automatic-save-and-resume/change.md` and `research.md`.
- `context/foundation/prd.md`: US-05/06, FR-005/006/049-051/058, BR-100-122, Access Control.
- `context/foundation/roadmap.md`: consolidated S-11; prerequisites S-06/09/10/12/13/16 are recorded done.
- `context/foundation/architecture.md`, `testing.md`, `lessons.md`; `context/testing/playwright-principles.md`.
- `.agents/skills/utils-add-state/SKILL.md`, `responsive-ui-audit/SKILL.md`, `cicd-run-tests/SKILL.md`, `utils-describe-e2e-scenarios/SKILL.md` under the same skills root.
- `tests/integration/testSessionFixture.ts`, `tests/ui/testSessionFixture.ts`, `playwrightConfig.ts`.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append the closing commit SHA when a step lands. Do not rename step titles.

### Phase 1: Account Eligibility and Authoritative Abandonment

#### Automated

- [x] 1.1 Domain tests pass for eligibility, abandonment, schema 20, atomic restore and scoring: `npm.cmd run test:domain`. — 1a2284a
- [x] 1.2 Clock and terminal mechanics regressions pass: `npm.cmd run test:mechanics`. — 1a2284a
- [x] 1.3 Type and architecture checks pass: `npm.cmd run typecheck` and `npm.cmd run test:architecture`. — 1a2284a

### Phase 2: Transactional Save Storage and Adapters

#### Automated

- [ ] 2.1 Local migrations and focused persistence/RLS integration tests pass: `npm.cmd run test:ui -- --grep "active run persistence"`.
- [ ] 2.2 Adapter and result contract tests pass: `npm.cmd run test:domain`.
- [ ] 2.3 Type and architecture checks pass: `npm.cmd run typecheck` and `npm.cmd run test:architecture`.

### Phase 3: Autosave and Durable Completion Coordinator

#### Automated

- [ ] 3.1 Deterministic autosave, retry and lifecycle tests pass: `npm.cmd run test:domain`.
- [ ] 3.2 Simulation and projection regressions pass: `npm.cmd run test:fast`.
- [ ] 3.3 Type checks pass: `npm.cmd run typecheck`.

### Phase 4: Continue, Confirmation, Recovery, and Save Feedback UI

#### Automated

- [ ] 4.1 Fast UI, account, intro and persistence wiring tests pass: `npm.cmd run test:fast`.
- [ ] 4.2 Type checks pass: `npm.cmd run typecheck`.

#### Manual

- [ ] 4.3 An eligible player can Continue, cancel/confirm New Game, resolve a login collision and retry failed abandonment/terminal delivery; completed runs cannot resume as gameplay.

### Phase 5: Responsive Audit, Browser Journeys, and Complete Validation

#### Automated

- [ ] 5.1 All unit, mechanics, architecture, typecheck, integration and Playwright UI tests pass together with a current `cicd-run-tests` report.
- [ ] 5.2 Production build and Pages asset checks pass: `npm.cmd run build-nolog` and `npm.cmd run check:pages`.
- [ ] 5.3 Responsive audit passes every enumerated changed state at 1920x1080, 844x390 and 640x360 with screenshot, geometry, interaction and visual-integrity evidence.
- [ ] 5.4 Documentation and E2E inventory match implemented behavior; any PRD edit passes deterministic and semantic validation.

#### Manual

- [ ] 5.5 Human review confirms desktop/mobile placement, wording, focus/touch behavior, Continue continuity and result recovery; implementation-review action points are reviewed before completion/archive.
