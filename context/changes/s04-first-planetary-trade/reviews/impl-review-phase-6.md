<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-04 First Seroton Planetary Trade

- **Plan**: context/changes/s04-first-planetary-trade/plan.md
- **Scope**: Phase 6 of 6
- **Reviewed phases**: 6
- **Date**: 2026-10-07
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Configured planet identity is duplicated instead of reused

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/state/serotonMarketState.ts:1
- **Detail**: Plan item 1 lists `src/game/definitions/planetDefinitions.ts` and says "Replace the Seroton-only `planetId` restriction with the configured landable planet identity type." Instead a new union `MarketPlanetId` duplicates `PlanetId` (src/game/definitions/planetDefinitions.ts:13), and `planetDefinitions.ts` is untouched. Functionally equivalent today; `Record<MarketPlanetId, …>` plus typecheck would catch a future divergence, but two sources of truth remain. Note: the parallel duplication in `landedMarket.ts:15` (`LandedMarketCommodityTuning` vs `PlanetMarketCommodityTuning`) is architecturally forced — the application layer may import only application/domain/state, so it cannot import definitions.
- **Fix**: Single-source the identity union in the state layer and derive `PlanetId` from it in `planetDefinitions.ts` (definitions may import state; state may not import definitions).
- **Decision**: FIXED — canonical `PlanetId` now lives in `src/game/state/planetState.ts`; `planetDefinitions` derives and re-exports it; the runtime mirror `src/game/domain/planetCatalog.ts` is bound to it by `tests/domain/planetCatalog.test.mjs` and the codec exact-set rule.

### F2 — Item 3's "fast UI/component" coverage half has no home in the repo

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: tests/domain/gameState.test.mjs:387 (planned: tests/ui/componentsUiTest.ts, tests/ui/applicationUiTest.ts)
- **Detail**: The plan's item 3 file set (`tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`, `tests/ui/fixtures/`) was deleted from the repo before this change (commit 2fd2852). No fast DOM/component runner exists, so the "fast UI/component coverage proves the unchanged hub and market controls show and refresh the landed planet's market" half of automated criterion 3 is not met by a component test. The application/port-level proof was relocated to tests/domain/gameState.test.mjs:387, and the DOM hub→Market→trade→Back→Launch flow lives in the existing (unchanged) Playwright journey (tests/ui/tradingJourney.ts), which does not assert per-planet market independence. Progress rows 6.1–6.3 were checked on that basis; 6.3 is the optimistic one.
- **Fix A ⭐ Recommended**: Accept the substitution and record in the plan's item 3 that the fast UI/component lane no longer exists (AGENTS.md forbids Playwright tests for fake-port component rendering), with routing proven at the port level plus the existing journey.
  - Strength: Matches the repo's current test posture and the plan's own Playwright admission gate; invents no new test layer.
  - Tradeoff: The DOM layer's per-planet refresh is asserted nowhere; a UI wiring regression surfaces only via manual check 6.4.
  - Confidence: HIGH — AGENTS.md explicitly forbids Playwright component tests.
  - Blind spot: None significant.
- **Fix B**: Extend the existing Playwright journey (tests/ui/tradingJourney.ts) to assert market independence across two planets.
  - Strength: Restores an end-to-end DOM assertion for the routing.
  - Tradeoff: Crosses the phase's own "do not add Playwright unless routing cannot be proven lower" gate; needs the admission-gate note and a context/foundation/e2e_scenarios.md refresh.
  - Confidence: MEDIUM — the gate wording is a judgment call.
  - Blind spot: test:ui needs Docker; not runnable in this sandbox.
- **Decision**: FIXED — plan Phase 6 item 3 `Files`/`Contract` updated to record that the fast UI/component lane no longer exists and that routing is proven at the application/port level plus `tests/ui/tradingJourney.ts`.

### F3 — Planet ids are not validated against configured planets (codec → raw TypeError)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/game/application/gameStateCodec.ts:246, src/game/mechanics/serotonMarketSimulation.ts:8
- **Detail**: `state.planets[].id` is validated only as a non-empty string (codec line 246), and market ids only against that set (line 261). A v16 snapshot carrying a never-configured planet id therefore decodes; `planetMarketTunings[market.planetId]` is then indexed unguarded in the per-tick simulation and throws a raw TypeError instead of a validation error. Pre-existing gap (planet-id validation was not stricter before), now more consequential because markets key off planet ids.
- **Fix**: Reject planet ids absent from the configured planet set at the codec boundary, and/or guard `advanceMarket` with a descriptive error.
  - Strength: Moves the failure to the decode boundary; the codec already enforces one-market-per-planet, so this completes the invariant.
  - Tradeoff: Minor; touches the planets block the plan did not list.
  - Confidence: HIGH — the codec already validates configured commodity ids.
  - Blind spot: None significant.
- **Decision**: FIXED — codec rejects planet ids outside the configured set and requires exactly the configured planet set; `advanceMarket` now throws a descriptive error on an unknown market planet id.

### F4 — Un-landed projection silently falls back to `state.markets[0]`

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: src/game/application/landedMarket.ts:80
- **Detail**: When `landedPlanetId === null`, `projectLandedMarket` uses `state.markets[0]` instead of treating the missing landed market as invalid. Currently inert (the snapshot is hidden and ineligible when not landed), but the codec does not constrain market ordering.
- **Fix**: Return early or use an explicit, documented placeholder when `landedPlanetId === null` instead of assuming index 0.
- **Decision**: FIXED — un-landed projection no longer reads `state.markets[0]`; it resolves the market only from `landedPlanetId` and otherwise projects zero market data (hidden/inert).

### F5 — Adapter duplicates the application landed-market lookup with a different contract

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/ui/adapters/landingStatusAdapter.ts:26
- **Detail**: The adapter re-implements a `landedMarket()` lookup that throws when unlanded, while the application helper of the same name (src/game/application/serotonMarket.ts:18) returns `null`. Two divergent contracts for one concept; correctness currently depends on the `wasEligible` guard.
- **Fix**: Consume one shared lookup from the application layer (the adapter may import it) or mirror its contract.
- **Decision**: FIXED — `landedMarketOf` is exported from `src/game/application/serotonMarket.ts` and consumed by the adapter, which no longer re-implements the routing.

### F6 — Price ladder rebuild calls `provider.snapshot()` per quantity

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Performance
- **Location**: src/ui/adapters/landingStatusAdapter.ts:46
- **Detail**: Each loop iteration calls `quoteLandedTrade(provider.snapshot(), …)`, and each `snapshot()` is a full encode+decode round trip for one invariant state; a rebuild is roughly 100+ round trips at current bounds. Pre-existing pattern (the previous shared-market code did the same), not introduced by this phase.
- **Fix**: Capture one snapshot per rebuild and pass it to each quote.
- **Decision**: FIXED — `rebuildPriceLadder` captures one snapshot and one resolved market per rebuild and reuses them for all bounds and quotes.

### F7 — Test nits

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/domain/serotonMarket.test.mjs:89, tests/domain/gameState.test.mjs:232
- **Detail**: (a) `assert.throws(..., 'a missing landed market is invalid')` passes a plain string as the failure message, so the case only proves "something throws"; the repo convention is a RegExp matcher (e.g. tests/game-audio.test.mjs:183). (b) The test title at gameState.test.mjs:232 still reads "v15 codec round trips" while the schema is now 16.
- **Fix**: Assert the message with a RegExp; rename the v15 title to v16.
- **Decision**: FIXED — RegExp matcher in `tests/domain/serotonMarket.test.mjs`; the schema test title and body now read v16 round trips / rejects v15.
