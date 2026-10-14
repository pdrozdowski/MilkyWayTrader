<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Terminal Scores and Global High Scores Implementation Plan

- **Plan**: `context/changes/s13-global-high-scores/plan.md`
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 0 observations

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

### F1 — PB-rank integration assertion expects the wrong rank

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/integration/runResultsRlsIntegrationTest.ts:79`
- **Detail**: The test originally expected rank 1 for personal score 450 even though another player had score 500. Since the RPC excludes the caller's own row and counts strictly higher scores, the correct competition rank is 2. The assertion was corrected to expect 2. The test also accepts successful PostgREST statuses 200, 201, and 204 for RPC calls that return no row representation.
- **Fix**: Corrected the expected rank for score 450 to 2; the focused database integration now passes.
- **Decision**: FIXED; the user approved review triage and the corrected assertion passed the full local Playwright integration run.

## Success Criteria Evidence

- **2.1** Private composite-score selection and strict-better store behavior are implemented. Focused Node tests and `npm.cmd run test:fast` passed on the final Phase 2 tree.
- **2.2** Joint persistence uses `Promise.allSettled`, treats a duplicate private result as idempotent success, and only reports saved when both private and global writes succeed. Focused Node tests and typecheck were reported passing after the final changes.
- **2.3** Integration coverage has been added for private owner isolation, public-safe projection fields, current nickname, authenticated strict-better writes, PB rank, ties, and both rows tied at rank 100. The score-450 rank expectation is corrected, and the focused local database integration passed: 3 tests passed in 1.2 minutes.
- **2.4 Manual** was confirmed complete by the user on 2026-10-14.

## Review Notes

The migration keeps direct table access revoked, exposes only rank/nickname/date/score from its public read RPC, and limits write and PB-rank RPCs to authenticated callers. The upsert changes score and achieved date only for a strictly higher submission. The local rank-cutoff fixture validates that `.env.test` targets the active loopback Supabase instance, uses the local CLI service key in memory, provisions and deletes users in bounded batches, and relies on the user foreign-key cascades for dependent rows. No additional safety, privacy, architecture, or scope findings were identified.

The focused 18 Node tests, `npm.cmd run test:fast`, typecheck, and focused local database integration (3 passed in 1.2 minutes) passed after the correction. A CommonJS bridge was added for the local rank-cutoff fixture loader, and PostgREST success status handling was corrected. The final full Playwright run passed all 20 tests, including the RLS, global rank-cutoff, and leaderboard journey checks. F1 is resolved.
