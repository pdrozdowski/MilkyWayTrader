# Delete Individual Results and Clear Personal History — Implementation Plan

## Overview

Let a signed-in player delete any result in their personal history or clear the entire history after a yes/no confirmation. Both actions preserve active game saves, profile and nickname data, other players’ results, and global scores.

**Prerequisite:** S-13 must be complete and store eligible global results independently from personal history. S-15 must not delete data that the global leaderboard depends on.

## Current State Analysis

- The Personal Best UI renders a disabled `DELETE` placeholder for each result and has no delete handler or clear-all action (`src/ui/components/personalBest.ts:96-110`; `index.html:39-49`).
- The result-history port exposes reads only; its browser adapter reads `run_results` and derives the personal best (`src/game/application/results/resultHistoryStore.ts:23-27`; `src/ui/adapters/browserResultHistoryStore.ts:53-91`).
- The existing migration grants authenticated insert/select and owner-scoped policies, but no delete permission (`supabase/migrations/20261002120000_create_run_results.sql:12-27`).
- The PRD currently describes clearing a personal-best result. It needs to reflect deletion of any history row and clearing the full history.

### Key Discoveries

- S-12 reserved the row-delete placeholder and assigned deletion of any owned result to S-15 (`context/archive/2026-10-13-s12-personal-best-result/change.md:47-53`).
- The modal already has a live status region and loads history pages plus the personal best (`index.html:43-45`; `src/ui/components/personalBest.ts:113-136`).
- Existing tests cover read ordering, pagination, empty/error states and owner-scoped reads, but not deletion (`tests/domain/resultHistoryStore.test.mjs`; `tests/personalBest.test.mjs`; `tests/integration/runResultsRlsIntegrationTest.ts`).

## Desired End State

A signed-in player can delete any one result or clear all results in their private history, after confirming either action. The confirmation identifies the selected result by score/date/outcome, or shows the number of results for a clear-all action. Canceling leaves data unchanged. Successful deletion refreshes the current page and personal best; if the last page becomes invalid, the UI moves to the nearest remaining page. A failed mutation keeps the confirmation open, preserves the visible rows and presents an accessible error. Owner-scoped database authorization prevents deleting another player’s data. Global results, active saves, profile and nickname remain unchanged.

### Success Criteria

- The PRD and roadmap describe individual-row deletion and confirmed history clearing, with S-13 as a prerequisite.
- Database authorization allows a signed-in owner to delete their own history and denies other users and anonymous clients.
- Both actions require confirmation; cancel performs no mutation.
- Success refreshes history, page, personal best and count; page selection remains valid after deleting the last row on a page.
- Failure preserves the rows, leaves confirmation open and exposes an accessible error.
- Clearing history does not change global scores, active saves, profile or nickname.

## What We're NOT Doing

- Implementing S-13 or changing global eligibility/ranking rules.
- Deleting or changing active saves, profiles, nicknames or another player’s data.
- Adding undo or recovery for deleted history.
- Changing which results qualify for global ranking.

## Implementation Approach

First reconcile the product contract and verify that S-13 stores eligible global entries independently of private history. Then add owner-scoped delete operations through the existing history port and browser adapter, enforce ownership in Supabase RLS, and connect the Personal Best UI to confirmed single-row and clear-all mutations. Cover the data boundary with adapter and RLS tests, and use one browser journey for modal stacking, accessibility and keyboard focus behavior.

## Critical Implementation Details

S-13 must be complete, with global entries stored independently, before implementing S-15 deletion. Mutation methods must not accept a caller-provided owner ID; the adapter uses the authenticated session and RLS `auth.uid()` remains authoritative. Keep mutation errors distinct from history-read errors. The confirmation overlay must manage focus: focus enters the dialog, cancel returns focus to its trigger, and successful row deletion moves focus to the next row action, the previous action, or closes the dialog if no rows remain. Disable repeat submission while pending. If sign-out or identity changes during confirmation, close it and discard stale responses.

## Phase 1: Reconcile the Contract and Confirm the Prerequisite

### Overview

Align the PRD and roadmap with the user's clarified scope, and establish that S-13's global data is independent before any S-15 deletion implementation begins.

### Changes Required

#### 1. Product requirements

**File**: `context/foundation/prd.md`

**Intent**: Update the signed-in result-history requirements to cover deleting any individual result and clearing all personal history, while preserving global results and unrelated player data.

**Contract**: Revise US-06/access control and FR-054; add FR-057 for clearing history; update BR-112 and add BR-116. Run the `10x-prd-en-capability` deterministic validator and semantic review as required by repository rules.

#### 2. Roadmap slice

**File**: `context/foundation/roadmap.md`

**Intent**: Make S-15's outcome, prerequisites and relationship to S-13 match the clarified product contract.

**Contract**: Describe individual deletion plus confirmed clear-all, require S-12 and S-13, and remove the S-13 parallel-work assumption. Record the slice as planning after this plan is saved.

#### 3. Global-results prerequisite

**Files**: S-13 implementation and the relevant global-results storage/migration files, identified during the prerequisite review.

**Intent**: Verify that public eligible results are persisted independently from the private history rows S-15 deletes.

**Contract**: S-13 is complete and a global result remains available when its source player's private result history is cleared. If independence is not present, finish the necessary S-13 separation before proceeding to Phase 2.

### Success Criteria

#### Automated Verification

- The PRD capability validator passes.

#### Manual Verification

- Semantic review confirms every PRD requirement expresses one solution-independent capability.
- S-13 is complete and its independent global-storage boundary is verified before Phase 2.

**Implementation Note**: After completing this phase and its automated verification, pause for human confirmation of the manual checks before proceeding to Phase 2.

## Phase 2: Add Owner-Scoped History Deletion

### Overview

Extend the existing history data boundary with single-result and bulk deletion, protected by owner-scoped database authorization.

### Changes Required

#### 1. Result-history port and browser adapter

**Files**: `src/game/application/results/resultHistoryStore.ts`; `src/ui/adapters/browserResultHistoryStore.ts`

**Intent**: Expose deletion operations through the existing result-history boundary and implement them in the browser adapter.

**Contract**: Add `deleteResult(runId)` and `clearHistory()` operations with explicit success/error outcomes. `clearHistory()` accepts no user ID; the adapter uses the active authenticated session and reports missing-session or database errors without hiding them.

#### 2. Supabase authorization migration

**File**: New forward migration under `supabase/migrations/`

**Intent**: Permit authenticated users to delete only their own personal-history rows.

**Contract**: Grant DELETE to authenticated clients and add an RLS DELETE policy constrained by `user_id = auth.uid()`. Do not grant anonymous deletion or modify the S-13 global-results relation. Add a `user_id` index if query-plan inspection confirms the existing index is insufficient for owner-scoped bulk deletion.

### Success Criteria

#### Automated Verification

- The new migration applies locally and result-history adapter deletion tests pass: `npm.cmd run test:domain`.
- TypeScript checks pass: `npm.cmd run typecheck`.

#### Manual Verification

- Review the grant and RLS policy to confirm owner-only deletion, anonymous denial and no global-data mutation path.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation of the manual authorization review before proceeding to Phase 3.

## Phase 3: Add Confirmed Deletion to Personal Best

### Overview

Make each row's delete control functional and add a confirmed clear-history action with reliable refresh, focus and error behavior.

### Changes Required

#### 1. Personal Best UI

**Files**: `index.html`; `src/ui/components/personalBest.ts`; `src/ui/components/displayLabels.ts`

**Intent**: Add the clear-history control and confirmation overlay, and connect both confirmed actions to the history-store operations.

**Contract**: Enable row deletion; show a yes/no confirmation for single and bulk actions with contextual result details or current history count; disable clear-all while loading or empty; prevent duplicate submission while pending. Cancel performs no mutation and restores focus. Success refreshes history and personal best while keeping the page if valid or selecting the nearest last page. Failure leaves confirmation open, preserves rows and presents an accessible error. Empty history after clear-all renders correctly.

#### 2. Personal Best component tests

**File**: `tests/personalBest.test.mjs`

**Intent**: Cover user-visible state transitions for single and bulk history deletion at the component presentation level.

**Contract**: Cover confirmation, cancel, successful mutation, refreshed personal best, clear-all count, disabled empty/loading state, final-page adjustment, mutation failure and authentication identity change.

### Success Criteria

#### Automated Verification

- `npm.cmd run test:ui-presentation` passes for the Personal Best interaction states.
- TypeScript checks pass: `npm.cmd run typecheck`.

#### Manual Verification

- Confirm deleting a non-best row and the current best updates the displayed history and best correctly.
- Confirm clear-all displays the current count; NO preserves history and YES empties it.
- Confirm mutation errors keep the dialog open and that keyboard focus remains usable through cancel and success.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation of the manual UI checks before proceeding to Phase 4.

## Phase 4: Verify Ownership and Global-Data Isolation

### Overview

Prove the database boundary for single and bulk deletion and verify the browser confirmation journey against the real local application.

### Changes Required

#### 1. RLS integration coverage

**File**: `tests/integration/runResultsRlsIntegrationTest.ts`

**Intent**: Verify owner-scoped deletion against Supabase RLS, including its effect on the separately persisted global result.

**Contract**: Cover owner deletion and clear-all; prove another signed-in user and an anonymous client cannot delete those rows; assert an independent global entry remains. Use isolated IDs/data per case.

#### 2. Browser confirmation journey

**File**: `tests/ui/personalBestUiTest.ts`

**Intent**: Verify the stacked confirmation experience and keyboard/accessibility behavior in an actual browser.

**Contract**: Use `test` from `tests/ui/testSessionFixture.ts` and an isolated authenticated local test session. Immediately above the test, document (1) the player-visible failure scenario, (2) why a cheaper fake-DOM/component test cannot expose it, and (3) the unique browser behavior verified: dialog stacking, accessible dialog semantics and keyboard focus movement. Never log session artifacts or credentials.

### Success Criteria

#### Automated Verification

- With local Supabase running and the configured browser available, `npm.cmd run test:ui` passes the RLS integration and the single browser journey.
- The integration scenario demonstrates that private history deletion leaves the independent global entry unchanged.

#### Manual Verification

- In a local authenticated session, delete one row and clear history; verify global results remain, and active save, profile and nickname are unchanged.

**Implementation Note**: After automated verification, pause for human confirmation of the manual end-to-end data-boundary check.

## Testing Strategy

### Unit and component tests

- Exercise adapter success, missing session, database failure and owner-scoped request behavior.
- Exercise component confirmation/cancel/success/error transitions, best refresh, empty/loading clear-all state, focus destination and nearest-page behavior.

### Integration tests

- Apply the forward migration locally and verify owner deletion, bulk deletion, other-user denial, anonymous denial and independent global-entry retention.

### Browser test

One authenticated Playwright journey covers the player-visible failure where the nested confirmation can obscure the Personal Best dialog or trap focus incorrectly. A cheaper component test cannot expose browser dialog stacking or actual keyboard focus traversal. The journey verifies accessible dialog semantics and focus movement in the browser. This test is justified by real browser behavior; it must include the three-part admission rationale directly above the test.

### Manual Testing Steps

1. Delete a non-best history row and verify other rows remain.
2. Delete the current best and verify the next retained result becomes the personal best.
3. Open clear-all and choose NO; verify history remains unchanged.
4. Open clear-all and choose YES; verify history and personal best are empty.
5. Verify global scores, active save, profile and nickname remain unchanged.
6. Force a mutation failure and verify the confirmation remains open, rows remain visible and an accessible error is announced.
7. Navigate to a final page, delete its last row and verify the page moves to the nearest valid page.

## Performance Considerations

Clear history with one owner-scoped bulk database operation rather than issuing one delete per row. Check the query plan for the `user_id` filter before adding a supporting index; keep the clear-all action disabled when there are no rows or while history is loading.

## Migration Notes

Use a new forward-only Supabase migration to add the deletion grant and RLS policy; do not rewrite the existing migration. S-13's global storage must be independent before the deletion migration is exercised against global results. No active-save, profile or nickname migration is in scope.

## References

- `context/changes/s15-clear-personal-best/research.md`
- `context/changes/s15-clear-personal-best/frame.md`
- `context/foundation/architecture.md:3-17,45-47`
- `context/foundation/prd.md:138-143,389-402`
- `context/foundation/roadmap.md:59,262-269`
- `context/archive/2026-10-13-s12-personal-best-result/change.md:47-53`
- `src/game/application/results/resultHistoryStore.ts:23-27`
- `src/ui/adapters/browserResultHistoryStore.ts:53-91`
- `src/ui/components/personalBest.ts:96-136`
- `index.html:39-49`
- `supabase/migrations/20261002120000_create_run_results.sql:12-27`
- `tests/domain/resultHistoryStore.test.mjs`
- `tests/personalBest.test.mjs`
- `tests/integration/runResultsRlsIntegrationTest.ts`
- `tests/ui/testSessionFixture.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append a commit SHA when a step lands. Do not rename step titles.

### Phase 1: Reconcile the Contract and Confirm the Prerequisite

#### Automated

- [ ] 1.1 PRD capability validator passes.

#### Manual

- [ ] 1.2 PRD semantic review and S-13 independent-storage prerequisite verified.

### Phase 2: Add Owner-Scoped History Deletion

#### Automated

- [ ] 2.1 Migration applies locally and result-history adapter deletion tests pass.
- [ ] 2.2 TypeScript typecheck passes.

#### Manual

- [ ] 2.3 Owner-only grant and RLS policy review passes.

### Phase 3: Add Confirmed Deletion to Personal Best

#### Automated

- [ ] 3.1 Personal Best presentation tests pass.
- [ ] 3.2 TypeScript typecheck passes.

#### Manual

- [ ] 3.3 Manual single-delete, clear-all, error and focus flows pass.

### Phase 4: Verify Ownership and Global-Data Isolation

#### Automated

- [ ] 4.1 Local Supabase RLS integration checks pass.
- [ ] 4.2 Authenticated browser confirmation journey passes.

#### Manual

- [ ] 4.3 Local verification confirms global results, active save, profile and nickname are unchanged.
