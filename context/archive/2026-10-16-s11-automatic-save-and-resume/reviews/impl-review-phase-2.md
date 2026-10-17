<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Automatic save and active run resume

- **Plan**: context/changes/s11-automatic-save-and-resume/plan.md
- **Scope**: Phase 2 of 5
- **Reviewed phases**: 2
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 5 resolved observations

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

### F1 — Save envelope validation could raise cast errors for malformed JSON

- **Severity**: WARNING — resolved
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261017120000_transactional_active_run_saves.sql
- **Detail**: Malformed values could reach numeric casts before their JSON types were checked.
- **Fix**: Validate the envelope and numeric JSON types before comparing values; integration coverage confirms rejected malformed payloads leave the acknowledged revision intact.
- **Decision**: FIXED

### F2 — Terminal finalization needed complete idempotency identity and null validation

- **Severity**: WARNING — resolved
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20261017120000_transactional_active_run_saves.sql
- **Detail**: Replay identity omitted expected revision and nullable final fields needed explicit rejection.
- **Fix**: Include expected revision in replay identity and reject null finalization fields. Tests cover mismatched replay payloads and null score rejection.
- **Decision**: FIXED

### F3 — A never-saved signed-in run could not retain its terminal result

- **Severity**: WARNING — resolved
- **Impact**: MEDIUM
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20261017120000_transactional_active_run_saves.sql
- **Detail**: Finalization of a run without an active slot was rejected, which could lose a result before first autosave.
- **Fix**: Permit only the empty revision-zero case, record replay metadata, and advance to empty revision one. A different mutation cannot then finalize against the cleared slot.
- **Decision**: FIXED

### F4 — Transaction race and stale cleanup protections lacked direct regression coverage

- **Severity**: OBSERVATION — resolved
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: tests/integration/activeRunSavesIntegrationTest.ts
- **Detail**: Initial coverage did not exercise simultaneous first-run creation or a different finalization after cleanup.
- **Fix**: Added concurrent creation and stale post-cleanup finalization cases; exactly one concurrent create wins and stale finalization is rejected.
- **Decision**: FIXED

### F5 — Global best preservation was not verified through the supported read boundary

- **Severity**: OBSERVATION — resolved
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: tests/integration/activeRunSavesIntegrationTest.ts
- **Detail**: Equal/lower finalization behavior was not directly tested, and authenticated clients cannot select the protected score table.
- **Fix**: Seed a local best through the existing fixture utility, finalize lower and equal scores, and verify the public `global_high_scores` RPC retains the score and timestamp.
- **Decision**: FIXED

## Review Notes

- Anonymous and unauthenticated API-key-only requests are rejected; there is no anonymous auth JWT in the existing API integration fixture, so the test exercises the public `anon` role boundary directly.
- The plan's `npm.cmd run test:ui -- --grep "active run persistence"` forwards the grep incorrectly through the nested script. The equivalent direct runner `npm.cmd run playwright:test -- --grep "active run persistence"` passed all five cases.
- `npm.cmd run test:domain` passed 122 tests; `npm.cmd run typecheck` and `npm.cmd run test:architecture` passed (8 architecture checks).
- Phase 2 has no manual Progress criteria.
