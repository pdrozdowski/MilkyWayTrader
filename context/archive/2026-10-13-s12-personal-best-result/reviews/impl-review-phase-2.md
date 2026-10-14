<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-12 Personal Best and Run History

- **Plan**: context/changes/s12-personal-best-result/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Verification

- `npm.cmd run test:ui-presentation` — PASS (20 tests)
- `npm.cmd run test:architecture` — PASS (8 tests)
- `npm.cmd run typecheck` — PASS
- Manual checks 2.3 and 2.4 remain pending in `plan.md`.

## Findings

### F1 — OAuth return does not restore Personal Best

- **Severity**: WARNING
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: src/game/scenes/preloaderScene.ts:72-79
- **Detail**: Opening the existing account flow from Personal Best starts OAuth, which reloads the page. The auth-return context restores the run and may reopen the account dialog, but it does not record or restore the Personal Best view. The planned behavior that Personal Best remains correct after returning from sign-in is therefore not met until verified or implemented.
- **Fix**: Extend the auth-return flow to retain a Personal Best return intent and restore the view after OAuth, then verify account-dialog close returns to it.
- **Decision**: PENDING

### F2 — Sign-out from the account overlay can move focus behind it

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/ui/components/personalBest.ts:139
- **Detail**: If Player Account is open over Personal Best and the user signs out there, Personal Best closes and focuses its original trigger even though the account dialog remains open above it. Focus can land behind the active modal.
- **Fix**: Keep focus inside the topmost open dialog during this sign-out transition, and cover the overlay sequence with a component test.
- **Decision**: PENDING

### F3 — UI setup wiring assertion is source-based

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/personalBest.test.mjs:205-211
- **Detail**: Entry behavior is exercised at component level, while the setup wiring test checks source text with regular expressions rather than invoking the application composition boundary. This gives a limited regression signal if runtime setup behavior changes.
- **Fix**: Consider a focused composition test with fake adapters if the existing test harness can instantiate `setupApplicationUi` without browser-specific behavior.
- **Decision**: PENDING
