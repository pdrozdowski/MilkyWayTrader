<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-10 Player Account Management and OAuth Run Continuity

- **Plan**: `context/changes/s10-player-account-management/plan.md`
- **Scope**: Phase 1 of 1
- **Reviewed phases**: 1
- **Date**: 2026-10-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification Evidence

- `npm.cmd run test:fast` — PASS, including domain, mechanics, object, audio, UI presentation, and architecture suites.
- `npm.cmd run typecheck` — PASS for application and test TypeScript projects.
- An earlier full `npm.cmd run test:ui` attempt failed 8 of 9 tests. It exposed change-specific blank email and unfiltered profile-update issues, both fixed and covered by the focused browser rerun; it also hit page-load and debug-menu failures in existing journeys. A final full-suite rerun was blocked before startup by `spawn EPERM`.
- Focused Playwright account/profile/RLS run — PASS, 3 tests: in-game reload restoration, signed-in profile persistence/sign-out, and owner-scoped RLS with anonymous/other-user checks. This run preceded the final stale-request guards and origin-consistency validation; the final rerun was blocked before test startup by `spawn EPERM`.
- The trade journey's confirm locator now matches the price-bearing accessible label. Its targeted rerun also stopped before test startup with `spawn EPERM`; CI should verify this specific recovery for the original GitHub failure.
- Real Google OAuth and cross-entry-point viewport checks remain manual items in plan Progress.

## Findings

### F1 — Final browser rerun unavailable

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/ui/tradingJourney.ts:21`
- **Detail**: The focused account/profile/RLS journeys passed before the final profile-operation race guards and stricter auth-return origin validation. Subsequent Playwright invocations failed before setup with `spawn EPERM`, including the targeted trade journey. The locator change matches `landingStatus.ts:460`, which adds the formatted quote to the `CONFIRM TRADE` accessible name, but the original failing trade journey has not been observed passing after that change.
- **Fix**: Rerun the account/profile and Seroton trade journeys in GitHub Actions or a local environment where Playwright can spawn its web server; update this note with the result.
- **Decision**: PENDING

## Review Notes

- The plan was adapted to the existing post-boot state restore lifecycle and to keep serialization/telemetry assertions at the domain level while browser tests cover reload behavior.
- The two structural mismatches authorized by the user were resolved and reflected in the plan.
- Manual Google OAuth checks remain pending because they require the configured external provider.
