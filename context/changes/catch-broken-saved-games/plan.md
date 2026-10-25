# Catch broken saved games Implementation Plan

## Overview

Preserve a copy of an active saved-run record when its game-state snapshot fails codec decoding and thereby blocks the player from continuing. Capture is best-effort and runs in the background; the existing incompatible-save response and player flow remain unchanged.

## Current State Analysis

`createBrowserActiveRunStore.load` receives the `load_active_run` RPC response and calls `decodeGameState(data.snapshot)`. A decoding exception returns an `incompatible` result and drops the raw response; the coordinator then blocks continuation. RPC errors and invalid response envelopes are returned as `unavailable`, outside this change's capture scope. The load RPC currently omits `replay_metadata`, even though it is a column in `active_run_saves`.

The active table is owner-keyed with `user_id` as its primary key. Client access is mediated by security-definer RPCs, with direct table privileges revoked. The archive needs multiple records per owner, so it retains `user_id` as a column, adds a separate generated `id`, and enforces uniqueness on `(user_id, run_id)`.

## Desired End State

- When an active or terminal-pending row has a non-null snapshot and `decodeGameState` rejects it, the browser adapter starts an archive RPC without waiting for it and still returns the same `incompatible` result.
- The archive contains the exact row fields observed by the failed load, including `snapshot`, `revision`, `status`, `schema_version`, `updated_at`, and `replay_metadata`; the RPC derives `user_id` from the authenticated caller.
- `broken_run_saves` retains the active-save columns and types, preserves `user_id`, adds a generated row ID, and uses a unique `(user_id, run_id)` constraint. A repeated insert for the same pair is a no-op.
- The archive RPC is owner-checked, and direct table access remains revoked. RPC-returned errors and rejected requests do not affect loading or surface to the player.
- Compatible snapshots, empty saves, RPC errors, and invalid response envelopes do not invoke the archive operation.

### Key Discoveries:

- The raw RPC response and codec failure meet in `src/ui/adapters/browserActiveRunStore.ts:57-67`; the coordinator consumes only the reduced load result.
- `load_active_run` returns `owner_id`, `run_id`, revision, status, snapshot, schema version, and update time, but omits `replay_metadata` (`supabase/migrations/20261017120000_transactional_active_run_saves.sql:28-36`).
- Direct authenticated/anonymous table privileges are revoked and owner checks use `require_save_owner` (`supabase/migrations/20261017120000_transactional_active_run_saves.sql:14-26`).
- The archived automatic-save plan keeps incompatible saves available for explicit discard; this change adds a separate copy without deleting or repairing the active row (`context/archive/2026-10-16-s11-automatic-save-and-resume/plan.md:21`).

## What We're NOT Doing

- Capturing RPC transport failures, malformed response envelopes, empty saves, or snapshots that are rejected before codec decoding.
- Changing codec acceptance, snapshot schema versions, migration behavior, restore logic, or the active save's lifecycle.
- Deleting, rewriting, or repairing the original active save.
- Showing archive success/failure feedback, retrying archive writes, or adding archive management UI.
- Adding a browser E2E scenario or deploying the migration to a remote/production database.

## Implementation Approach

Add a forward-only Supabase migration that creates `broken_run_saves` with the active-save columns, a generated `id` primary key, preserved `user_id`, and unique `(user_id, run_id)` identity. Enable RLS and revoke direct client access. Extend `load_active_run` to return `replay_metadata`, then add a narrowly scoped security-definer RPC that derives `user_id` from the authenticated owner, checks that it matches the owner captured by the client, validates the required broken-row fields, and inserts with `ON CONFLICT (user_id, run_id) DO NOTHING`.

At the codec catch in `createBrowserActiveRunStore.load`, pass the exact response fields and captured owner to that RPC through a detached promise whose returned error and rejection are swallowed. Return the existing incompatible result immediately. Extend the adapter's Node test coverage for the capture trigger, exclusion cases, non-blocking behavior, and silenced failure. Verify the actual SQL/RPC contract against local Supabase without adding a browser E2E test.

## Critical Implementation Details

The archive request intentionally carries the row returned by the earlier load so it retains the exact snapshot that failed even if the active slot changes before the background RPC runs. The RPC must derive `user_id` from `auth.uid()` and reject an owner mismatch; it must not trust a client-supplied user ID. A session change or any other archive failure is silenced as requested, and the original active row remains available for the existing explicit-discard flow.

## Phase 1: Preserve rejected active-save rows

### Overview

Add the archive table and owner-checked RPC, expose the missing replay metadata in the load response, and trigger a detached archive attempt only when snapshot decoding fails.

### Changes Required:

#### 1. Supabase archive schema and RPC

**File**: `supabase/migrations/<new timestamp>_broken_run_saves.sql`

**Intent**: Add durable storage for one broken record per owner/run pair and an authenticated RPC that accepts the exact row returned by active-save loading.

**Contract**: Preserve `user_id` as a `uuid` foreign key column; add a generated `bigint` identity primary key; retain the active-save columns and their types; retain the active table's column nullability and enforce `unique (user_id, run_id)`; reject a null `run_id` in the capture RPC; enable RLS and revoke direct `anon`/`authenticated` table privileges. The RPC obtains the owner through `require_save_owner`, validates the expected owner and required row fields, derives `user_id` from that owner, and inserts with `ON CONFLICT (user_id, run_id) DO NOTHING`. Grant execution only to authenticated callers.

#### 2. Active-save load payload

**File**: `supabase/migrations/<new timestamp>_broken_run_saves.sql`

**Intent**: Extend the existing `load_active_run` function so the browser has every active-row data field needed to retain an exact copy after decode failure.

**Contract**: Keep the existing response fields and add `replay_metadata`; continue to provide the authenticated owner as `owner_id`. Do not alter the active table or its save/load semantics.

#### 3. Browser active-save adapter

**File**: `src/ui/adapters/browserActiveRunStore.ts`

**Intent**: Start best-effort archival at the codec failure boundary while preserving current load outcomes.

**Contract**: For an authenticated, owner-verified `active` or `terminal_pending` response with a non-null snapshot that throws in `decodeGameState`, issue one `save_broken_run` RPC containing the captured owner and the returned row fields, including `replay_metadata`. Do not await it; silence both an RPC error result and a promise rejection. Return the same `incompatible` result with its current revision/runId/message behavior. Do not issue this RPC for successful decoding, empty saves, RPC errors, or invalid response envelopes.

#### 4. Adapter regression coverage

**File**: `tests/domain/activeRunStore.test.mjs`

**Intent**: Prove the adapter starts capture at the intended boundary and that archive timing/failure cannot change the player's load result.

**Contract**: Cover a decode failure that starts one archive RPC with the captured owner and exact row fields; a delayed archive response that does not delay the `incompatible` result; a returned RPC error and a rejected promise that are silenced; and compatible/empty/unavailable load cases that do not call the archive RPC.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:domain` passes with regression coverage for archive trigger, payload, non-blocking return, failure silencing, and excluded load outcomes.
- `npm.cmd run typecheck` passes for the adapter and RPC payload changes.

#### Manual Verification:

- Against the local Supabase test database, apply the migration and verify the archive RPC stores the exact supplied row under the authenticated owner, a second insert for the same `(user_id, run_id)` leaves one row, and anonymous/other-owner or direct-table access is rejected.

## Testing Strategy

### Unit Tests:

Extend `tests/domain/activeRunStore.test.mjs` with a deferred mocked archive RPC to demonstrate that `load()` resolves with `incompatible` before the archive request resolves. Also verify exact request arguments, success-path exclusion, and silenced resolved/rejected failures.

### Integration Tests:

No browser E2E test is needed: the change adds no browser interaction or visible UI behavior. Verify the SQL/RPC authorization and uniqueness contract directly against the local Supabase test database during implementation; do not use production or the normal-development `.env.local` project for destructive setup.

### Manual Testing Steps:

1. Apply the new migration to the dedicated local test database.
2. Using an authenticated local test identity, call `load_active_run` for a seeded active row and submit the returned row fields to `save_broken_run`.
3. Confirm one `broken_run_saves` row retains the same snapshot, revision, status, schema version, update time, and replay metadata, and that `user_id` is the authenticated owner.
4. Repeat the archive call and confirm the row count for that pair remains one; verify anonymous, different-owner, and direct-table attempts are denied.
5. Exercise a malformed stored snapshot through the adapter test and confirm the load result remains `incompatible` even when archive RPC fails.

## Performance Considerations

The archive request runs concurrently with the normal incompatible-load result. It adds one RPC only for snapshots rejected by the codec; no retry or foreground wait is introduced.

## Migration Notes

The migration is additive: it creates the archive table and RPC and replaces the `load_active_run` function body to add `replay_metadata`. Existing active rows remain unchanged. Local migration and SQL/RPC verification are part of implementation; remote deployment is outside this plan.

## References

- Research: `context/changes/catch-broken-saved-games/research.md`
- Active-save adapter: `src/ui/adapters/browserActiveRunStore.ts:52-67`
- Active-save schema and RPC: `supabase/migrations/20261017120000_transactional_active_run_saves.sql:1-36`
- Existing incompatible-save behavior: `src/game/application/saves/runSaveCoordinator.ts:306-311,454-459`
- Testing policy: `context/foundation/testing.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Preserve rejected active-save rows

#### Automated

- [ ] 1.1 Adapter regression tests pass for exact archive request, trigger exclusions, non-blocking behavior, and silenced failures.
- [ ] 1.2 TypeScript typecheck passes.

#### Manual

- [ ] 1.3 Local Supabase verification confirms exact row retention, pair deduplication, owner authorization, and denied direct access.


