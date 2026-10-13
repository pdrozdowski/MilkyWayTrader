# S-10 Player Account Management and OAuth Run Continuity Implementation Plan

## Overview

Add a reusable account-management modal to the existing Google authentication flow. Signed-in players can view their email and manage a persisted public nickname; signed-out players can sign in. Preserve an active run and its existing telemetry session when OAuth returns through a full-page redirect.

## Current State Analysis

The preceding `s10-player-sign-in-status` change provides a browser `AuthPort` with auth status, email, Google sign-in, local sign-out, and session subscription. Its Main Menu Sign In control is moved to the Game Over screen, while the in-game menu currently has no account action. There is no player profile table or nickname service. `GameStateProvider` already supports validated restore, the preloader handles a one-time Game Over return, and telemetry currently keeps its run session ID and start time in memory.

## Desired End State

Players can open one state-aware Player Account modal from the Main Menu, Game Over screen, or in-game menu. Signed-in players can read their email and save a public nickname; signed-out players can start Google sign-in. OAuth return restores the active run, the existing telemetry session context, the modal, and its originating screen without adding durable game saves.

### Key Discoveries:

- The Main Menu Sign In button is reused on Game Over: `src/ui/setupUi.ts:78-81,130-132`.
- The in-game dialog is mounted by `mountGameMenu`; its controls are declared in `index.html:38-57` and wired in `src/ui/components/gameMenu.ts:10-40`.
- Auth exposes only status/email and sign-in/sign-out: `src/game/application/auth/auth.ts:1-19`.
- The codec-backed state provider can restore a candidate: `src/game/application/gameStateProvider.ts:37-42`; the preloader currently routes to Main Menu or the stored Game Over result: `src/game/scenes/preloaderScene.ts:68-70`.
- Telemetry session identity is currently held in memory: `src/game/application/telemetry/telemetry.ts:40-45`.
- `run_results` already uses authenticated owner-scoped RLS: `supabase/migrations/20261002120000_create_run_results.sql:1-27`.

## What We're NOT Doing

- Durable game save/resume or high-score submission/leaderboards. The signed-out modal may describe these as upcoming signed-in benefits and must not imply they are already available.
- Public reads of player profiles before a leaderboard read path is designed.
- Any change to the current telemetry event catalog, emitters, payloads, or ingestion behavior.
- Changes to authoritative gameplay fields or their schema version; OAuth continuity uses the existing validated snapshot format temporarily.

## Implementation Approach

Keep account/profile behavior outside `GameStateSnapshot`. Add a focused profile port and Supabase adapter backed by an owner-only profile row. Compose one modal at the DOM UI root and route all three entry points to it. Before an OAuth redirect from an active run, capture a validated game snapshot, telemetry session ID/start time, and modal return context in tab-scoped session storage. Restore the snapshot through `GameStateProvider` in the game post-boot hook, restore telemetry context there, then let the Preloader select the originating scene and reopen the modal. This ordering follows the existing bootstrap lifecycle and completes before the normal Main Menu can start or replace a run.

## Critical Implementation Details

OAuth return restoration must run before the normal Main Menu route can offer a new game or reset the restored state. On every callback, including cancellation and provider failure, restore valid saved context and reopen the account modal at its originating screen. If the temporary snapshot is invalid, clear it, avoid restoring partial state, and return to the Main Menu with a recoverable message. Telemetry queue delivery remains best effort under its existing policy; preserve the current session ID and start time without changing events or payloads. Test serialization, malformed-context handling, and telemetry continuity at the application/domain level; the browser regression covers session-storage survival, Phaser startup ordering, and restored UI, without automating Google OAuth.

## Phase 1: Player Account and OAuth Continuity

### Overview

Deliver the profile persistence boundary and complete account flow as one vertical slice. Retain the existing S-10 change and its telemetry work as a dependency; this follow-up does not rewrite that change's plan or progress.

### Changes Required:

#### 1. Owner-scoped player profile

**Files**: new Supabase migration; new player-profile application port and browser adapter; profile tests.

**Intent**: Give each authenticated user one durable nickname without exposing profiles publicly before a leaderboard exists.

**Contract**: Add a profile row keyed by `auth.users.id` with cascade-on-user-delete, a non-unique nickname, and an update timestamp. Enable RLS and permit only the authenticated owner to select, insert, and update their row. Trim nicknames and accept 3â€“20 ASCII letters, digits, or underscores. When no row exists, generate `spaceTrader` plus a random integer from 10000 through 99999, persist it during profile creation, and resolve concurrent first-load creation by returning the winning row. The profile port supports load-or-create and update operations without exposing a caller-supplied user ID.

#### 2. OAuth run-return context

**Files**: auth/run-return application contracts; browser session-storage adapter; `src/main.ts`, `src/ui/setupUi.ts`, `src/game/scenes/preloaderScene.ts`, telemetry session lifecycle.

**Intent**: Keep in-memory gameplay and telemetry continuity when Google OAuth reloads the page.

**Contract**: Temporarily serialize the validated `GameStateSnapshot`, telemetry session ID/start time, account-modal return state, and originating surface in `sessionStorage` before OAuth navigation. Restore the snapshot through the existing codec/provider boundary, restore the same telemetry session context without emitting a duplicate `session_started`, then reopen the account modal. Consume the return context once on success, cancellation, or failure. A malformed/unrestorable snapshot is discarded as a whole and must not partially mutate live state. Use the repository's `utils-add-state` workflow for this snapshot save/restore behavior.

#### 3. Shared Player Account modal and entry points

**Files**: `index.html`, `public/style.css`, `src/ui/setupUi.ts`, new account modal component, `src/ui/components/authControls.ts`, `src/ui/components/gameMenu.ts`, UI contracts/adapters.

**Intent**: Give players one consistent place to manage authentication and nickname from the Main Menu, Game Over screen, and active game.

**Contract**: Reuse the existing Main Menu/Game Over Sign In action and add an in-game Sign In / Account action. All open the same accessible, themed `PLAYER ACCOUNT` modal with X and Close controls; authenticated entry points may say `ACCOUNT`. The signed-out variant shows a `NOT SIGNED IN` status, the two upcoming signed-in benefits (save/resume and high-score submission), Google sign-in, and Close; it hides profile controls. The signed-in variant shows signed-in status, read-only email, editable nickname, Update Nickname, Sign Out, and Close. Disable update when unchanged, invalid, or saving; prevent duplicate auth/profile submissions and show success/failure feedback. Profile loading/creation failures are retryable while Sign Out and Close remain available. Auth changes update the modal and every entry point. Closing returns focus and visibility to the originating screen; from the in-game menu it returns to the still-paused menu. Opening the modal never resets the run. The layout supports current game sizes and orientations, and all interactive DOM controls use `data-game-input="ignore"`.

### Success Criteria:

#### Automated Verification:

- Profile migration and local Supabase integration checks prove owner select/insert/update, denial to anonymous and other authenticated users, and non-unique nickname acceptance. The migration foreign key enforces cascade deletion.
- Domain tests cover generated persisted defaults, race-safe first creation, nickname trimming/validation, and updates. A browser account journey covers email/profile display, nickname persistence, and the signed-in to signed-out transition; duplicate-submission guards, retry handling, and other entry points are reviewed in code and exercised manually.
- Run-return tests cover valid state serialization, one-time consumption, malformed-context discard without partial restoration, and telemetry resuming the same session ID/start time without a duplicate start event. OAuth success/cancel/provider-error flows require the configured real provider and remain manual checks.
- One Playwright regression journey proves that an in-progress run survives a full-page reload, the account modal reopens at the originating surface, and the paused game can resume. Lower-level tests cannot verify browser session-storage survival, Phaser startup order, and restored UI together. After changing a Playwright test, refresh `context/foundation/e2e_scenarios.md` with `/utils-describe-e2e-scenarios`.
- `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

#### Manual Verification:

- Verify signed-out/signed-in layouts and focus behavior from Main Menu, Game Over, and the in-game menu at supported desktop/mobile sizes and orientations.
- Complete real Google OAuth from each entry point; verify successful, cancelled, and failed returns preserve the run and return to the account modal at the same surface.
- Create a first profile, close/reopen the modal, update the nickname, and verify the same value remains after signing out and back into that account.

---

## Testing Strategy

### Unit and application tests:

- Test profile provisioning, race-safe default creation, non-unique nicknames, validation, and successful updates using the existing fast Node suites and typed ports; use local Supabase sessions for RLS.
- Test OAuth return serialization/consumption and telemetry context continuity independently of Google OAuth.
- Verify signed-in and signed-out modal behavior, nickname persistence, and sign-out in the browser; review duplicate-submission guards, retry handling, focus behavior, and cleanup in code and manual verification.

### Integration and browser tests:

- Verify profile-table RLS against local Supabase with owner, other-user, and anonymous sessions.
- Use a browser journey for account profile persistence and a browser journey for session storage/Phaser boot restoration after a page reload; do not automate Google OAuth itself.

### Manual Testing Steps:

1. Open the account modal from each of its three entry points and close it; verify the player returns to the same screen and the active run remains paused and unchanged.
2. Sign in with Google from an in-game run; verify success, cancellation, and provider failure all return to that run and reopen the account modal.
3. Update a nickname, sign out, sign back into the same account, and verify the saved nickname and read-only email.
4. Inspect local Supabase access as the owner, another user, and anonymous; only the owner can access the profile row.

## Performance Considerations

Profile access occurs only when opening/loading the account modal or saving a nickname. OAuth return storage is a one-time serialization of the current snapshot; it does not run per frame or alter simulation behavior.

## Migration Notes

Add the profile table through a new versioned Supabase migration. Existing users have no profile row; their first profile load creates a generated default. Deleting an auth user cascades to their profile row. The temporary OAuth snapshot is session-scoped and is not a durable save format; no gameplay state schema version change is introduced.

## References

- Existing auth contract: `src/game/application/auth/auth.ts:1-19`
- UI composition and Game Over entry point: `src/ui/setupUi.ts:78-81,130-132`
- Existing game menu component: `src/ui/components/gameMenu.ts:10-40`
- State restore boundary: `src/game/application/gameStateProvider.ts:37-42`
- Preloader return routing: `src/game/scenes/preloaderScene.ts:68-70`
- Telemetry in-memory session context: `src/game/application/telemetry/telemetry.ts:40-45`
- Existing owner-scoped result migration: `supabase/migrations/20261002120000_create_run_results.sql:1-27`
- Existing temporary Game Over return adapter: `src/ui/adapters/browserGameOverReturn.ts:22-39`
- Project architecture: `context/foundation/architecture.md`
- Project test policy: `context/foundation/testing.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Player Account and OAuth Continuity

#### Automated

- [x] 1.1 Local Supabase integration verifies owner select/insert/update, denial of owner-row access to another user, anonymous denial, and non-unique nicknames; the migration declares cascade deletion.
- [x] 1.2 Domain tests cover generated defaults, race-safe creation, nickname validation/update; browser journeys cover both auth states, email/profile display, nickname persistence, and sign-out. Duplicate-submission guards and retry handling are covered by implementation review.
- [x] 1.3 Domain tests cover return-context validation and one-time consumption, malformed-context discard, and telemetry session continuity without a duplicate start event.
- [x] 1.4 Playwright journeys verify full-page reload restoration of the paused run, reopening Player Account at the game-menu origin, profile persistence, and sign-out. Lower-level tests cannot verify browser session-storage survival, Phaser startup order, and restored UI together. After changing a Playwright test, refresh `context/foundation/e2e_scenarios.md` with `/utils-describe-e2e-scenarios`.
- [x] 1.5 `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

#### Manual

- [ ] 1.6 Verify signed-out/signed-in layouts and focus behavior from Main Menu, Game Over, and the in-game menu at supported desktop/mobile sizes and orientations.
- [ ] 1.7 Complete real Google OAuth from each entry point; verify successful, cancelled, and failed returns preserve the run and return to the account modal at the same surface.
- [ ] 1.8 Create a first profile, close/reopen the modal, update the nickname, and verify the same value remains after signing out and back into that account.
