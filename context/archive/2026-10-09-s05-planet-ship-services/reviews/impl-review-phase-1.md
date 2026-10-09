<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-05 Planet Ship Services

- **Plan**: context/changes/s05-planet-ship-services/plan.md
- **Scope**: Phase 1 of 4
- **Reviewed phases**: 1
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

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

### F1 — Plan lists `gameStateProvider.ts` but the diff does not touch it

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/application/gameStateProvider.ts
- **Detail**: Phase 1 "Changes Required" names `src/game/application/gameStateProvider.ts`. The file is unchanged because `GameStateProvider.update` already decodes/validates the reducer result and publishes exactly one detached snapshot (`update`:24-29), which is the atomic boundary the phase needs. The sibling change S-16 (`7bbd253`, planetary facilities — the pattern this phase mirrors) likewise left that file untouched and only added `planetFacilities.ts` plus the codec. The ship-service quote/apply pair is exercised through `provider.update` in `tests/domain/planetShipServices.test.mjs`, so the boundary is covered by test.
- **Fix**: No change. Recorded as an intentional no-op.
- **Decision**: ACCEPTED — change signed off without action.

### F2 — Upgrade price is read positionally from the catalogue ladder

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/application/planetShipServices.ts:128 (`definition.upgradePrices[level - 1]`)
- **Detail**: A definition whose `upgradePrices` were shorter than `maximumLevel - 1` would yield `undefined` and produce `NaN` credits. The catalogue is static and the invariant `upgradePrices.length + 1 === maximumLevel` is asserted for every path in `tests/domain/planetShipServices.test.mjs` ("each ship-service path is sold on exactly one planet with its configured maximum level"), so the current three definitions cannot reach that state. The sibling `planetFacilities.ts` uses the same positional pattern.
- **Fix**: No change. The ladder-length invariant stays test-enforced.
- **Decision**: ACCEPTED — change signed off without action.

## Notes

- `TOUCHED` cross-check against `git status --porcelain` at staging time matched: runBalance.ts, shipStatusState.ts, gameStateCodec.ts, planetShipServices.ts, three test files, plan.md, change.md, roadmap.md.
- Deliberate small extensions beyond the plan's literal text: failure variants `unknown-service` (mirrors the facility module's `unknown-facility`) and `ship-destroyed` (prevents `applyShipRepair` from writing a non-zero-HP snapshot that the codec rejects as an invalid terminal state); exported `shipBoosterServicePlanetId`; a bounds doc comment on `ShipStatusState` (field shape unchanged).
- Catalogue placement deviation: the plan puts the service definition in `src/game/domain/runBalance.ts`. The domain layer may not import `PlanetId` from `src/game/state/` (architecture layer table; enforced by `tests/domain/domain-boundaries.test.mjs`), so the level/pricing balance tables live in `runBalance.ts` and the planet-bound catalogue lives next to its operations in `src/game/application/planetShipServices.ts`. The phase's file list is unchanged.
- Success criteria evidence: `npm.cmd run test:domain` — 64/64 pass, covering every catalogue level, price, planet assignment, next-level rule, repair cap, affordability and rejection path, plus codec rejection of unsupported levels with valid-snapshot preservation. `npm.cmd run typecheck` passes. Break-check: removing the wrong-planet guard and removing the codec level bound each turned 2 tests red, then both files were restored from staging.
- Manual row 1.3 ("Service planet assignments are inspected") stays unchecked: manual verification is deferred to the user's end-of-run pass by explicit instruction.
