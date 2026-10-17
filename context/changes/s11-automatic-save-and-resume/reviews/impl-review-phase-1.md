<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Automatic save and active run resume

- **Plan**: context/changes/s11-automatic-save-and-resume/plan.md
- **Scope**: Phase 1 of 5
- **Reviewed phases**: 1
- **Date**: 2026-10-17
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 3 resolved observations

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

### F1 — Delayed auth initialization could restore stale ownership

- **Severity**: WARNING — resolved
- **Impact**: LOW — quick, narrowly scoped fix
- **Dimension**: Safety & Quality
- **Location**: src/ui/adapters/browserAuth.ts
- **Detail**: The initial `getSession()` response could arrive after a newer auth event and overwrite the published owner.
- **Fix**: Ignore the initial response and its error after any auth event has arrived.
- **Decision**: FIXED

### F2 — Profile creation needed an initiating owner boundary

- **Severity**: WARNING — resolved
- **Impact**: MEDIUM — owner correctness at an external boundary
- **Dimension**: Safety & Quality
- **Location**: src/ui/adapters/browserPlayerProfile.ts
- **Detail**: `loadOrCreate` could read or create under a different account if auth changed during the operation.
- **Fix**: Pass the expected owner from eligibility, verify the current session around profile operations, and bind inserts to that owner so RLS rejects a switched session.
- **Decision**: FIXED

### F3 — Timeout classification admitted abandonment

- **Severity**: OBSERVATION — resolved
- **Impact**: LOW — narrow type correction
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/hazards/terminal.ts
- **Detail**: The expanded terminal outcome union made abandonment type-valid as a timeout classification even though only freedom and imprisonment are timeout outcomes.
- **Fix**: Exclude both death and abandonment from `TimeoutClassifier`.
- **Decision**: FIXED

## Review Notes

- The abandonment reducer is placed in the application layer so the dependency direction remains valid; the application command updates the authoritative provider through that pure transition.
- The score assertion was corrected to 505, matching the established formula that adds ending cash, cargo acquisition cost, and qualifying spending.
- Domain, mechanics, typecheck, and architecture gates pass. Phase 1 automated Progress rows are complete; manual rows remain for later human review.
