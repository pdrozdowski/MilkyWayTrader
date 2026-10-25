---
date: 2026-10-25 15:55:08 Europe/Warsaw
researcher: Codex
git_commit: 65cdfc0d90b04efef783997a07d693dc677a4a55
branch: main
repository: MilkyWayTrader
topic: "Preserve unreadable active run saves"
tags: [research, active-run-saves, game-state-codec, supabase]
status: complete
last_updated: 2026-10-25
last_updated_by: Codex
last_updated_note: Planning decisions from the user resolved the capture scope, exact-row behavior, and archive ID/unique-pair design.
---

# Research: Preserve unreadable active run saves

**Date**: 2026-10-25 15:55:08 Europe/Warsaw  
**Researcher**: Codex  
**Git Commit**: 65cdfc0d90b04efef783997a07d693dc677a4a55  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

For `catch-broken-saved-games`, where does active save loading fail on unreadable game-state payloads, what data is available at that point, and what database constraints affect preserving a broken save once per `(user_id, run_id)`?

## Summary

- For an authenticated player with a valid `load_active_run` response whose `active` or `terminal_pending` snapshot fails `decodeGameState`, `createBrowserActiveRunStore.load` returns `incompatible` with the revision, an optional run ID extracted from the snapshot, and the decoder message; it does not retain the full response in the returned result ([browserActiveRunStore.ts:52-67](../../../src/ui/adapters/browserActiveRunStore.ts:52)).
- The coordinator blocks continuation for this `incompatible` result in the inspected owner-load path and account-attachment path ([runSaveCoordinator.ts:306-311,454-459](../../../src/game/application/saves/runSaveCoordinator.ts:306)).
- In the inspected migration, `active_run_saves.user_id` is the primary key, while the row also stores `run_id`, `revision`, `status`, `snapshot`, `schema_version`, `updated_at`, and `replay_metadata`; the load RPC returns all of these except `user_id` and `replay_metadata` ([20261017120000_transactional_active_run_saves.sql:1-11,28-36](../../../supabase/migrations/20261017120000_transactional_active_run_saves.sql:1)). A copied table retaining that exact primary-key constraint could not hold multiple run IDs for a user, so the requested pair-based deduplication needs its own key/uniqueness design.
- The load RPC is `security definer` and obtains the caller using `require_save_owner`; direct `anon` and `authenticated` privileges on the active table are revoked after RLS is enabled ([20261017120000_transactional_active_run_saves.sql:14-26,28-35](../../../supabase/migrations/20261017120000_transactional_active_run_saves.sql:14)). This is the existing server boundary for reading caller-owned save data.

## Detailed Findings

### Client loading and codec boundary

`createBrowserActiveRunStore.load` captures the signed-in owner, calls `load_active_run`, validates the returned record/revision/status, and decodes `data.snapshot` ([browserActiveRunStore.ts:52-65](../../../src/ui/adapters/browserActiveRunStore.ts:52)). `decodeGameState` can reject invalid JSON text, a root with the wrong fields, schema versions other than 20, or invalid nested values ([gameStateCodec.ts:119-134](../../../src/game/application/gameStateCodec.ts:119)). When decoding throws, the adapter returns `incompatible`, preserving `revision`; it adds `runId` only if `data.snapshot.runId` is a string, and it returns the error message. The RPC's outer `data.run_id` is not copied into that result ([browserActiveRunStore.ts:63-66](../../../src/ui/adapters/browserActiveRunStore.ts:63)).

RPC errors are mapped to `ineligible` or `unavailable`, and invalid response shapes/statuses are `unavailable` in this inspected load path. Therefore those failures are distinct from a codec rejection and do not currently enter the `incompatible` coordinator branch ([browserActiveRunStore.ts:57-67](../../../src/ui/adapters/browserActiveRunStore.ts:57)).

### Player impact

In the initial owner-load path, an `incompatible` result sets `ownerLoaded` and `blocked`, emits a conflict notice, and returns false ([runSaveCoordinator.ts:306-311](../../../src/game/application/saves/runSaveCoordinator.ts:306)). In account attachment, either `active` or `incompatible` stops attachment and publishes a conflict notice ([runSaveCoordinator.ts:454-459](../../../src/game/application/saves/runSaveCoordinator.ts:454)). This matches the change note's condition that an unreadable saved state prevents continuation.

### Persistence schema and access

The active table's inspected schema has eight columns: `user_id`, `run_id`, `revision`, `status`, `snapshot`, `schema_version`, `updated_at`, and `replay_metadata`; `user_id` is its primary key ([20261017120000_transactional_active_run_saves.sql:1-12](../../../supabase/migrations/20261017120000_transactional_active_run_saves.sql:1)). `load_active_run` constructs a JSON object with `owner_id`, `run_id`, `revision`, `status`, `snapshot`, `schema_version`, and `updated_at`; it omits `replay_metadata` ([20261017120000_transactional_active_run_saves.sql:28-36](../../../supabase/migrations/20261017120000_transactional_active_run_saves.sql:28)). The authenticated user's ID is available in the SQL function as `caller`, while it is not included in the client response.

A second table that copies the active table's column shapes but keeps `user_id` as its primary key would permit at most one retained row per user, which conflicts with retaining separate `(user_id, run_id)` pairs over time. The change note requires deduplication by that pair, so the new table's key design must support multiple `run_id` values for one user. Also, exact row copying includes `replay_metadata`, which the current load response does not supply; a server-side copy from the active row or an expanded RPC payload would be needed to preserve that column faithfully. These are schema/interface implications, not settled implementation choices.

Direct client table privileges are revoked for `anon` and `authenticated`, with RLS enabled. `require_save_owner` rejects calls without an authenticated account/profile; `load_active_run` is a `security definer` function ([migration:14-35](../../../supabase/migrations/20261017120000_transactional_active_run_saves.sql:14)). Existing database functions use `ON CONFLICT ... DO NOTHING` for idempotent insertion, including save-slot initialization by `user_id` in this migration ([migration:42-47](../../../supabase/migrations/20261017120000_transactional_active_run_saves.sql:42)).

### Historical context

The archived automatic-save plan records that unsupported or corrupt saves remain stored with an explanation and disabled Continue, and that explicit confirmed discard allows New Game ([archived plan:21](../../../context/archive/2026-10-16-s11-automatic-save-and-resume/plan.md:21)). This is consistent with preserving the original active save while separately retaining a broken-save copy. The prior plan does not address a `broken_run_saves` table or its uniqueness rule.

## Code References

- `src/ui/adapters/browserActiveRunStore.ts:52-67` - RPC load, response checks, codec boundary and incompatible result.
- `src/game/application/saves/runSaveCoordinator.ts:306-311` - incompatible save blocks owner-load continuation.
- `src/game/application/saves/runSaveCoordinator.ts:454-459` - incompatible account save blocks attachment.
- `src/game/application/gameStateCodec.ts:119-134` - root and schema validation entry point.
- `supabase/migrations/20261017120000_transactional_active_run_saves.sql:1-15` - active table columns and direct-access policy.
- `supabase/migrations/20261017120000_transactional_active_run_saves.sql:17-36` - owner check and load RPC payload.
- `context/archive/2026-10-16-s11-automatic-save-and-resume/plan.md:21` - historical policy for incompatible saves.

## Architecture Insights

The UI adapter is the boundary that has both the raw RPC response and the codec exception; the coordinator sees a reduced typed result. Capturing a broken record is therefore naturally adjacent to this adapter or through a port it invokes. Because active-table access is mediated by security-definer RPCs and the returned object omits `replay_metadata`, a database-side copy can retain the complete row without exposing direct table privileges. If an asynchronous operation is launched from the adapter, its failure can be swallowed there while leaving the load result unchanged; the change note requests this best-effort behavior.

## Historical Context (from prior changes)

- `context/archive/2026-10-16-s11-automatic-save-and-resume/plan.md:21` - incompatible/corrupt active saves remain available for explicit discard; no automatic deletion or migration is described.
- `context/archive/2026-10-16-s11-automatic-save-and-resume/reviews/impl-review-phase-2.md` - references the transactional active-save migration; no prior broken-save retention mechanism was found in the inspected migration or available history references.

## Related Research

Not applicable; no existing `research.md` for this feature or a directly related active-run-save research artifact was identified in the inspected change/archive paths.

## Decisions Resolved During Planning

- Capture applies to codec failures for a concrete returned snapshot; RPC transport and invalid-envelope failures remain outside scope.
- Preserve the exact row returned by the failed load, including `replay_metadata`, even if the active slot changes before the detached archive RPC completes.
- Keep `user_id` as a column, add a generated row ID, and enforce uniqueness on `(user_id, run_id)`; duplicate inserts are no-ops.
- Archive work runs in the background and errors are silenced, as specified in `change.md`. See `plan.md` for the agreed implementation contract.
