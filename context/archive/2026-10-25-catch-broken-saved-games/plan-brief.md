# Catch broken saved games — Plan Brief

> Full plan: `context/changes/catch-broken-saved-games/plan.md`
> Research: `context/changes/catch-broken-saved-games/research.md`

## What & Why

When a saved run's snapshot cannot be decoded, the current load flow blocks continuation and drops the raw response from the client result. This plan preserves a copy of that exact row in `broken_run_saves` while keeping the existing incompatible-save behavior unchanged. Archiving is best-effort, asynchronous, and silent on failure.

## Starting Point

`browserActiveRunStore.load` has the raw `load_active_run` response at the codec catch, but the RPC omits `replay_metadata` and the adapter does not retain the response after decoding fails. Supabase already uses owner-checked security-definer RPCs and denies direct client access to active-save rows.

## Desired End State

A codec rejection starts a background request carrying the exact row fields, including replay metadata, and immediately returns the existing incompatible result. Supabase derives `user_id` from the authenticated caller, keeps it as a column, adds a generated row ID, and skips duplicates by `(user_id, run_id)`.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Capture condition | Non-null snapshot rejected by `decodeGameState` only | Transport errors and invalid response envelopes do not prove the stored payload itself is broken | Plan |
| Archive contents | Exact row returned by the failed load, including `replay_metadata` | Preserves the payload that actually failed even if the active slot later changes | Plan |
| Row identity | Preserve `user_id`, add generated `id`, unique `(user_id, run_id)` | Allows multiple archived runs per owner while skipping duplicate pairs | Plan |
| Timing and errors | Fire in background; silence errors | Archive outcome must not block continuation flow or surface to the player | Change / Plan |
| Active save | Keep the original row unchanged | Existing incompatible-save flow supports explicit discard | Research |

## Scope

**In scope:** Add the archive table and authenticated RPC; include replay metadata in `load_active_run`; trigger detached capture on codec failure; cover adapter behavior and verify the database contract locally.

**Out of scope:** Capture transport/envelope failures, repair or delete active saves, change codec compatibility, add UI or browser E2E, or deploy to a remote project.

## Architecture / Approach

The Supabase migration creates the new table and RPC, with RLS and direct table access revoked. The RPC validates the authenticated owner, derives `user_id` server-side, and inserts idempotently. The browser adapter sends the raw loaded row at the decoder catch using a detached request whose failure is swallowed; its returned load result remains `incompatible`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Preserve rejected active-save rows | Add storage/RPC, include the full load row, trigger background capture, and verify application/database contracts | Owner validation and pair uniqueness must hold while preserving the exact row observed |

**Prerequisites:** Local development dependencies; dedicated local Supabase test database for manual RPC verification. No production access is needed.  
**Estimated effort:** One focused implementation and verification pass.

## Open Risks & Assumptions

- If the account changes before the background RPC is authorized, capture can fail and will be silenced; the active row remains unchanged.
- The generated identity column is additive to the active-save columns; `user_id` remains present as its foreign-key column.

## Success Criteria (Summary)

- Codec failures trigger one background archive attempt carrying the exact row; other load outcomes do not.
- Duplicate archive calls for one `(user_id, run_id)` retain one row, and callers cannot archive another user's record or write the table directly.
- Archive latency or failure does not alter or delay the existing incompatible result.



