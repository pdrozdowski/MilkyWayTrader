<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Catch broken saved games

- **Plan**: context/changes/catch-broken-saved-games/plan.md
- **Scope**: Phase 1 of 1
- **Reviewed phases**: 1
- **Date**: 2026-10-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 â€” Add invalid-envelope exclusion coverage

- **Severity**: OBSERVATION
- **Impact**: ðŸƒ LOW â€” quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/domain/activeRunStore.test.mjs:56
- **Detail**: Plan explicitly excludes malformed response envelopes from archival. The original test covered invalid owner and unavailable RPC outcomes but not an envelope missing required archive fields. A fixture now verifies that the adapter returns unavailable and does not call save_broken_run.
- **Fix**: Added an invalid-envelope fixture and asserted no archive RPC is issued.
- **Decision**: FIXED â€” added coverage before final review.

### F2 â€” Replay metadata shape is enforced by table constraint

- **Severity**: OBSERVATION
- **Impact**: ðŸƒ LOW â€” quick decision; behavior is explicit and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261025150900_broken_run_saves.sql:43
- **Detail**: The RPC requires replay_metadata to be non-null; its JSON array shape and maximum length are enforced by the archive table constraint. Invalid metadata therefore causes the background insert to fail and be silently ignored, consistent with the best-effort contract.
- **Fix**: No change required; the table constraint keeps archive rows aligned with active_run_saves.
- **Decision**: ACCEPTED â€” failure remains best-effort and silent as required.

## Review Evidence

- `npm.cmd run test:domain`: PASS (143 tests)
- `npm.cmd run typecheck`: PASS
- `npm.cmd run test:ui`: PASS (29 tests; one local database reset)
- `npm.cmd run test:unit`: The initial run exposed a stale auth-label assertion; the assertion now covers the established `unsigned` state label, `displayLabels.signIn`.
- Manual local Supabase authorization probe: skipped per user instruction; not marked complete.
