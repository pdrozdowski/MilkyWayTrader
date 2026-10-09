<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-05 Planet Ship Services

- **Plan**: context/changes/s05-planet-ship-services/plan.md
- **Scope**: Phase 3 of 4
- **Reviewed phases**: 3
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 1 observation

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

### F1 — `failure` is projected but never read by the Shipyard view

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/game/application/landedShipyard.ts:36,55,66 (`failure` on repair/service/booster rows)
- **Detail**: The plan asks the snapshot to carry "action availability", which `available`, `affordable`, `maximum` and `owned` express directly and the component consumes. The extra `failure` field is the quote's raw rejection code; the DOM never reads it, so it is currently contract-only data. It is not harmful (the projection is the typed seam to the domain quotes and the tests use it to prove the rejection reasons), but a reader may wonder which field drives the view.
- **Fix A (recommended)**: Keep `failure` as the documented reason code and annotate the interface as diagnostic, since `tests/domain/planetShipServices.test.mjs` asserts the exact rejection reason per planet.
- **Fix B**: Drop `failure` from the snapshot and keep the booleans only; tests read the quotes directly from `planetShipServices`.
- **Decision**: PENDING

## Notes

- `TOUCHED` cross-check at staging time: src/game/application/landedShipyard.ts, src/game/application/planetShipServices.ts (row labels), src/ui/contracts.ts, src/ui/adapters/landingStatusAdapter.ts, src/ui/components/landingStatus.ts, src/ui/components/displayLabels.ts, index.html, public/style.css, tests/domain/planetShipServices.test.mjs, tests/domain/gameState.test.mjs, tests/landing-status.test.mjs, plan.md, reviews/impl-review-phase-2.md.
- Plan file list satisfied in full; no file outside the plan's Phase 3 list was modified apart from tests.
- The hub's Shipyard control lost its `disabled` attribute and its `Shipyard unavailable` label, so the now-dead `displayLabels.shipyardUnavailable` constant was removed rather than left as unreachable text.
- Row labels ('Cargo Capacity', 'Engine System', 'Weapon System') live in `shipServiceDefinitions` and reach the DOM through the projection, keeping user-visible text in one place (team lesson: reuse display-label constants). Booster effect text and the not-available / service-planet phrasing come from `displayLabels`.
- The repair increment renders as a computed `+10% max HP` from `incrementHitPoints / maximumHitPoints`, so a balance change cannot leave the label lying.
- Only local rows dispatch: every command calls the adapter, which ignores anything outside a landed state, and the DOM additionally disables off-planet, maximum-level, owned and unaffordable actions.
- A markup/selector cross-check was run against `index.html` for every selector the component requires; all new Shipyard ids, classes and data attributes are present.
- Success criteria evidence: `npm.cmd run test:domain` 66/66 (projection eligibility on all three planets plus adapter refresh after repair, every local upgrade and the booster purchase), `npm.cmd run test:ui-presentation` 9/9 (new Shipyard DOM test: open, render, dispatch, disabled states, immediate refresh, Back without launch, teardown), `npm.cmd run test:fast` green (architecture included), `npm.cmd run typecheck` passes. Break-check: forcing `available: false` in the projection turned both projection/adapter tests red; forcing every Shipyard action enabled turned the DOM test red; both files were restored from staging and re-verified green.
- Manual rows 3.4 and 3.5 stay unchecked: manual verification is deferred to the user's end-of-run pass by explicit instruction.
