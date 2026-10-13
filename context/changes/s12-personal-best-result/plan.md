# S-12 Personal Best and Run History Implementation Plan

## Overview

Add a private Personal Best screen that combines the signed-in player's highest final-cash result with a paginated history of saved runs. The screen is reachable from the in-game menu and from a dedicated button on the Game Over screen. S-11 is not required; complete four-outcome coverage assumes S-06 has made those terminal results writable.

## Current State Analysis

The `run_results` table already stores the owner, outcome, final credits, and `created_at`, and its select policy restricts reads to the authenticated owner. The browser result-store path only persists results; there is no history query contract or Personal Best view. The current TypeScript result contract and database outcome check are death-only, so S-06 must provide the remaining writable outcomes before S-12 can meet full acceptance.

The existing account UI establishes the modal conventions to follow: semantic dialog markup, focus restoration, Escape handling, and an existing sign-in flow. The current game-over panel has result details but no Personal Best action. The S-12 roadmap entry incorrectly depends on S-11.

## Desired End State

A player can open one dark navy dialog from either requested entry point and see their highest score and saved run history, five rows per page. Loading, signed-out, empty, error, and authenticated states are explicit. Reads remain owner-scoped; DELETE controls are inert placeholders for S-15.

### Key Discoveries

- Result persistence already uses an application port and a Supabase browser adapter; history should follow that boundary.
- Existing RLS allows authenticated owners to read only their own results; S-12 needs no new delete policy.
- S-06 is the prerequisite for persisted `freedom`, `imprisonment`, `death`, and `abandoned` outcomes. The UI label for `imprisonment` is `PRISON`.
- `created_at` is the saved timestamp and is the source for DATE; display it in the player's local timezone.

## What We're NOT Doing

- Do not implement deletion, a confirmation modal, or delete error handling; S-15 owns deletion of any result belonging to the player.
- Do not implement public/global leaderboards; those remain S-13.
- Do not depend on S-11 or change active-run saving and restoration.
- Do not change the PRD in S-12. Before planning or implementing S-15, reconcile its user-confirmed any-owned-result scope with the PRD's narrower Personal-Best-only wording using the required PRD validation workflow.

## Implementation Approach

Add a result-history read port in the application layer and a Supabase adapter that uses the authenticated browser session and existing RLS. The port returns one page of five records plus the total count, and separately returns the best record. Add a DOM component for the dialog and wire it to the in-game menu and Game Over controls through the existing UI setup boundary.

The history page is ordered by final credits descending, then saved timestamp descending, with `run_id` as a stable final ordering key. The best record is the highest score; ties select the earliest saved timestamp, then the smallest `run_id`. The best marker follows that single record even if pagination places it on a later page.

## Critical Implementation Details

On sign-out, close Personal Best immediately, clear its rows and best-score data, and ignore any outstanding read response from the prior session. The signed-out prompt should reuse the existing account sign-in flow rather than implementing OAuth in the new component.

## Phase 1: Owner-Scoped Result History Read

### Overview

Introduce the typed read contract and implement page and best-record queries without changing result writes or ownership policy.

### Changes Required

#### 1. Application result-history contract

**File**: `src/game/application/results/resultHistoryStore.ts` (new)

**Intent**: Define the application-facing capability for reading a player's saved history independently of Supabase and the DOM.

**Contract**: Expose a page operation returning records and total count, and a best-record operation returning a record or `null`. Each record carries `runId`, final credits, outcome, and saved timestamp. Page size is five records.

#### 2. Supabase result-history adapter

**File**: `src/ui/adapters/browserResultHistoryStore.ts` (new)

**Intent**: Implement history reads through the active authenticated client and rely on the existing owner-scoped RLS policy.

**Contract**: Request an exact total count and the requested five-row range. Order page results by final credits descending, `created_at` descending, then `run_id` ascending. Select the best with final credits descending, `created_at` ascending, then `run_id` ascending, limited to one row. Map database fields into the application contract and return errors for the UI to present; do not accept a caller-supplied user ID.

### Success Criteria

#### Automated Verification

- Adapter tests cover database-row mapping, page boundaries and count, page ordering, best-score tie resolution, and read failures.
- Type checking passes for the new read contract and adapter.

## Phase 2: Personal Best Dialog and Entry Points

### Overview

Build the requested history screen and connect it to both menu entry points, authentication state, and the existing sign-in flow.

### Changes Required

#### 1. Dialog markup and presentation

**Files**: `index.html`, `public/style.css`

**Intent**: Add the Personal Best dialog structure and landscape-readable compact table using existing dark navy modal conventions.

**Contract**: Center `★ PERSONAL BEST ★`, show the highest score above the table in gold, and provide DATE, SCORE, OUTCOME, BEST, and DELETE columns. Render compact borderless rows with alternating existing-palette accent colors. Format saved dates as uppercase `DD MON YYYY` in the player's local timezone. Provide Previous/Next controls, a page indicator, and a centered `CLOSE` button; omit the X control. DELETE is disabled and has no handler or request.

#### 2. History component and UI wiring

**Files**: `src/ui/components/personalBest.ts` (new), `src/ui/setupUi.ts`, `src/ui/components/displayLabels.ts`

**Intent**: Render the data contract, handle explicit states and page navigation, and expose the view from in-game and Game Over UI.

**Contract**: Add a Personal Best action to the in-game menu and a separate button to the Game Over result panel; opening is user-triggered, not automatic. Support loading, signed-out prompt linked to the existing account sign-in flow, `NO SCORES YET`, load error with retry, and populated history. Mark only the selected best `runId` as BEST. Show `FREEDOM`, `PRISON`, `DEATH`, and `ABANDONED`. Close on `CLOSE` or Escape, restore focus to the originating control, and close/clear on sign-out.

### Success Criteria

#### Automated Verification

- Fast component tests cover all view states, five-row page navigation and boundaries, the single BEST marker including timestamp and ID ties, outcome labels, disabled DELETE placeholders, retry behavior, and sign-out clearing/close behavior.
- Application UI wiring tests cover opening from the in-game menu and Game Over button and returning focus to the correct control.

#### Manual Verification

- Review the populated five-row table in landscape orientation for compact height, alternating colors, readable columns, gold best-score treatment, and no clipping.
- Verify the signed-out prompt opens the existing sign-in UI and the Personal Best view remains correct after returning from sign-in.

## Phase 3: Roadmap Alignment and Browser Verification

### Overview

Record the corrected S-12 prerequisite and validate the real browser overlay and responsive layout.

### Changes Required

#### 1. S-12 roadmap dependency

**File**: `context/foundation/roadmap.md`

**Intent**: Remove the stale S-11 prerequisite and align S-12's description with the combined best-score and saved-history experience.

**Contract**: Update the roadmap summary, S-12 detail, and backlog entry to name S-06 as the prerequisite and set the S-12 status to planning. Leave S-13 and S-15 scope unchanged in this change.

#### 2. Browser integration coverage

**Files**: `tests/ui/` (one focused Personal Best journey using the existing session fixture)

**Intent**: Verify the authenticated player can reach the dialog in a real landscape browser layout.

**Contract**: Use the existing `testSessionFixture.ts` and local Supabase lifecycle. Exercise the in-game menu entry, dialog visibility and close/return behavior at a landscape viewport. Record the Playwright admission rationale: player-visible failure is a clipped, obscured, or unreachable personal-history dialog in landscape; fake-port component tests cannot expose actual viewport/layout stacking; the unique browser behavior is the dialog's real relationship to the Phaser canvas and responsive game UI.

### Success Criteria

#### Automated Verification

- The roadmap summary, S-12 detail, and backlog consistently show S-06 as the prerequisite and S-12 as planning.
- `npm.cmd run test:unit` passes.
- `npm.cmd run typecheck` passes.
- The focused authenticated landscape Playwright journey passes under the repository's local Supabase test lifecycle.
- Refresh `context/foundation/e2e_scenarios.md` with `/utils-describe-e2e-scenarios` after adding the Playwright test.

#### Manual Verification

- Confirm in the running UI that opening from both entry points works, closing returns to the source control, and signing out while the view is open does not leave private rows visible.

## Testing Strategy

- Use fast adapter and component tests for mapping, ordering, selection, pagination, states, and actions.
- Use one Playwright journey only for the real browser layout and overlay behavior described in Phase 3; do not use Playwright to test calculations or fake-port component rendering.
- Validate with `npm.cmd run test:unit`, `npm.cmd run typecheck`, and the focused `npm.cmd run test:ui` journey. Do not install dependencies or browsers as part of ordinary validation.

## Performance Considerations

Fetch only the requested five-row page and total count. Fetch the best record with a separate one-row ordered query rather than downloading the full history. The PRD retains all runs, so avoid client-side full-history pagination.

## Migration Notes

S-12 introduces no database migration. S-06 must first expand terminal-result production and persisted outcome support to all four outcomes. Existing owner-scoped RLS remains the authorization boundary.

## References

- Frame: `context/changes/s12-personal-best-result/frame.md`
- Research: `context/changes/s12-personal-best-result/research.md`
- Product contract: `context/foundation/prd.md` (US-06, FR-052, BR-105–112)
- Existing result table and owner RLS: `supabase/migrations/20261002120000_create_run_results.sql`
- Existing result write contract and adapter: `src/game/application/results/resultStore.ts`, `src/ui/adapters/browserResultStore.ts`
- UI architecture and test guidance: `context/foundation/architecture.md`, `context/foundation/testing.md`

## Progress

### Phase 1: Owner-Scoped Result History Read

#### Automated

- [ ] 1.1 Adapter tests cover mapping, count, page boundaries and ordering, best-score tie resolution, and failures.
- [ ] 1.2 Type checking passes for the read contract and adapter.

### Phase 2: Personal Best Dialog and Entry Points

#### Automated

- [ ] 2.1 Fast component tests cover states, pagination, BEST selection, labels, inert DELETE, retry, and sign-out behavior.
- [ ] 2.2 UI wiring tests cover both entry points and focus restoration.

#### Manual

- [ ] 2.3 The populated five-row table is readable in landscape with no clipping.
- [ ] 2.4 Verify the signed-out prompt reuses the existing account flow and returns to Personal Best.

### Phase 3: Roadmap Alignment and Browser Verification

#### Automated

- [ ] 3.1 S-12 roadmap entries name S-06 and show planning status.
- [ ] 3.2 `npm.cmd run test:unit` passes.
- [ ] 3.3 `npm.cmd run typecheck` passes.
- [ ] 3.4 The focused authenticated landscape browser journey passes.
- [ ] 3.5 The E2E scenario inventory is refreshed with `/utils-describe-e2e-scenarios`.

#### Manual

- [ ] 3.6 Both entry points, close behavior, focus return, and sign-out clearing are verified in the running UI.
