<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S16 Planetary Facilities Implementation Plan

- **Plan**: context/changes/s16-planetary-facilities/plan.md
- **Scope**: Phase 3 of 5
- **Reviewed phases**: 3
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Reviewed scope note: Phase 3 is present in the worktree but uncommitted (HEAD e40594f); the worktree also carries the uncommitted Phase 1 and Phase 2 edits. Phase 3's own contribution was isolated by the phase's `TOUCHED` list, cross-checked against `git status --porcelain`: three new files (`src/game/application/planetFacilities.ts`, `src/game/definitions/planetFacilityDefinitions.ts`, `tests/domain/planetFacilities.test.mjs`) and six modified files (`src/game/state/serotonMarketState.ts`, `src/game/state/gameStateSnapshot.ts`, `src/game/definitions/initialGameState.ts`, `src/game/application/gameStateCodec.ts`, `tests/domain/gameState.test.mjs`, `tests/domain/planetCatalog.test.mjs`). Every planned Phase 3 file is present; no planned file was left untouched. No Phase 4/5 work leaked into the phase (no `advancePlanetFacilities`, no cycle reducer, no `projectLandedFacilities`, no `buildFacility`/`upgradeFacility` port changes, no view work). The single WARNING is a pattern-consistency observation; all severity-bearing findings are observations or one low-impact warning, the explicit contracts are met, and every re-run gate passes.

## Findings

### F1 - `landedMarketOf` is duplicated across two application modules

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/game/application/planetFacilities.ts:37
- **Detail**: The private `landedMarketOf` in `planetFacilities.ts:37-44` is byte-identical to the exported `landedMarketOf` in `src/game/application/serotonMarket.ts:18-25`, which `src/ui/adapters/landingStatusAdapter.ts:6` already imports. Two copies in the same layer can drift independently (e.g. different throw text or landed-resolution rules) with no test binding them.
- **Fix**: Import `landedMarketOf` from `./serotonMarket.ts` and delete the local copy (or extract it into a shared application module both import).
- **Decision**: FIXED (triage) - `planetFacilities.ts` now imports `landedMarketOf` from `./serotonMarket.ts`; the local duplicate was deleted.

### F2 - Codec hand-codes a third copy of the facility allow-list

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/game/application/gameStateCodec.ts:13
- **Detail**: The codec declares `facilityIds` and `facilityMaximumLevel = 3` as local literals, duplicating both the `PlanetFacilityId`/`PlanetFacilityStatus` unions in `src/game/state/serotonMarketState.ts` and the catalogue in `src/game/definitions/planetFacilityDefinitions.ts`. Commodities and planets instead consume a single domain allow-list (`serotonCommodityIds`, `planetIds`), which the codec already imports (`gameStateCodec.ts:7-8`) - so a domain-level facility id list is reachable from the codec. There are three independent facility-id literals with no test binding them, and the single global `facilityMaximumLevel` cannot express a future per-facility `maxLevel`.
- **Fix**: Add `src/game/domain/planetFacilityCatalog.ts` exporting `planetFacilityIds` (mirroring `serotonCommodityIds`), consume it in the codec, and assert in `tests/domain/planetCatalog.test.mjs` that it equals `planetFacilityDefinitions.map(definition => definition.id)`.
- **Decision**: FIXED (triage) - added `src/game/domain/planetFacilityCatalog.ts` (`planetFacilityIds`, `planetFacilityMaximumLevel`); the codec and `tests/domain/planetCatalog.test.mjs` consume it instead of hand-coding the list.

### F3 - `investmentStep` does not bound `priceIndex` against `upgradePrices.length`

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/game/application/planetFacilities.ts:60
- **Detail**: `investmentStep` derives `priceIndex` from the current level and compares only against `definition.maxLevel`. If a future catalogue entry declared `maxLevel > upgradePrices.length`, `upgradePrices[priceIndex]` would be `undefined`, the product would be `NaN`, the `price > state.credits` check would pass, and the aggregate would briefly carry `NaN` credits/level until the provider re-decodes. Today every entry has `maxLevel: 3` and two prices, so this is latent, not live.
- **Fix**: Return `null` (mapping to the `unavailable` failure) when `priceIndex >= definition.upgradePrices.length`, so a mismatched catalogue degrades safely instead of emitting `NaN`.
- **Decision**: FIXED (triage) - `investmentStep` returns `null` when `priceIndex >= priceCount`, so a catalogue/level mismatch degrades to `unavailable` instead of `NaN`.

### F4 - Opening facility levels are inlined away from the other facility tunables

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/game/definitions/initialGameState.ts:14
- **Detail**: The per-facility opening levels live as a private literal in `initialGameState.ts`, while the sibling opening balance data (per-planet/commodity stock) lives in `src/game/definitions/serotonMarketDefinitions.ts` as `planetMarketTunings`. Facility balance values are therefore split across two files with different conventions. The record is exhaustively typed (`Record<PlanetFacilityId, number>`), so a missing entry is a compile error rather than a silent gap.
- **Fix**: Move the opening levels next to the other facility tunables in `planetFacilityDefinitions.ts`, or add a test asserting the record covers every configured facility.
- **Decision**: FIXED (triage) - `tests/domain/planetCatalog.test.mjs` asserts the opening facility levels and statuses for every planet, covering the inlined opening levels.

### F5 - Definition literal values (outputs, recipes) are not asserted anywhere

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (coverage)
- **Location**: tests/domain/planetCatalog.test.mjs:15
- **Detail**: The catalogue test asserts order, `maxLevel`, array lengths, commodity membership and the exact specialization set, but no test asserts the literal `outputByLevel` values (10/20/40 for farms, 5/10/20 for the rest) or the literal `inputsPerOutput` recipes (2 milk, 2 grain, 2 cheese + 1 bun + 1 milk). Exact upgrade prices are covered only indirectly through the investment-command tests. This satisfies the phase's stated test contract (schema + investment guards), so it is not MISSING; it is a residual coverage gap on the definitions intent.
- **Fix**: Add one literal-value assertion per facility in `tests/domain/planetCatalog.test.mjs` for `outputByLevel` and `inputsPerOutput`.
- **Decision**: FIXED (triage) - `tests/domain/planetCatalog.test.mjs` asserts literal `outputByLevel` and `inputsPerOutput` values per facility.

## Verified Phase 3 Contracts (evidence)

- Facility catalogue: `planetFacilityDefinitions.ts` declares the five facilities in the plan order (dairyFarm, grainFarm, cheeseFactory, bakery, foodProcessor), `maxLevel` 3, outputs dairy/grain 10/20/40 and cheese/bakery/processor 5/10/20, inputs cheese 2 milk / bun 2 grain / ration 2 cheese + 1 bun + 1 milk / farms none, upgrade prices dairy-grain 25 000/75 000, cheese-bakery 35 000/100 000, processor 50 000/150 000. Modifiers `{ upgradePriceMultiplier: 0.8, outputMultiplier: 1.2 }` are set for exactly cheeseFactory@seroton, dairyFarm@maslo-prime, grainFarm@lactozis-7c; all other pairs are neutral. MATCH.
- State and schema: `PlanetFacilityId`, `PlanetFacilityStatus` union (`'notBuilt' | 'working' | 'insufficientResources'`), `PlanetFacilityState`, and `facilities` on the per-planet record exist as specified (`serotonMarketState.ts:11-26`). The version moves 16 to 17 in the type (`gameStateSnapshot.ts:17`), the check (`gameStateCodec.ts:110`) and the decoder output (`gameStateCodec.ts:392`). `facilities` joins the per-planet exact key set (`gameStateCodec.ts:265`). MATCH.
- Codec validation: exactly one entry per facility id (length check 287), unknown id (295), duplicate (298), integer level 0..3 (301), status union (304), level/status invariant `(level === 0) !== (status === 'notBuilt')` (308) and full coverage (311). `cloneAndFreeze` deep-clones and freezes accepted data (90-101), and `tests/domain/gameState.test.mjs:175-180` proves detachment. MATCH.
- Initial state: dairy 1, grain 1, cheese 1, bakery 0, processor 0 with `working`/`notBuilt`, applied to every configured planet (`initialGameState.ts:13-19,48-51`). MATCH.
- Investment commands: landed-only via `landedMarketOf`; build is 0 to 1 at the first price; upgrade is n to n+1 at that step's price and blocked at max level (`planetFacilities.ts:53-57`); all four failures returned (`not-landed`, `unknown-facility`, `unavailable`, `insufficient-credits`); discount applied as `Math.round(price * upgradePriceMultiplier)`; success changes only `credits` and the landed planet's matching facility (`planetFacilities.ts:84-97`). MATCH. The build price also receives the planet `upgradePriceMultiplier` (build uses `upgradePrices[0]`), which follows the plan's "build at the first price" for that planet - treated as intended.
- Tests: `tests/domain/planetFacilities.test.mjs` asserts the four failure cases, discount arithmetic (28 000/80 000, 20 000/60 000, 25 000/75 000, 35 000), credits-only deduction with cargo/orbital-cargo/loose-items/stock and sibling-facility/other-planet immutability, the 0 to 1 build price, both upgrade steps, and the blocked max-level path. `tests/domain/planetCatalog.test.mjs` asserts catalogue order, `maxLevel`, and the specialization set. Assertions use literal expected values. MATCH.

## Gate Re-runs

| Gate | Result | Evidence |
|------|--------|----------|
| `npm.cmd run test:domain` (Phase 3 automated) | PASS | 50/50, 0 fail, exit 0 (run with `node --test --experimental-test-isolation=none`, see note) |
| `npm.cmd run typecheck` (Phase 3 automated) | PASS | `tsc --noEmit && tsc --noEmit -p tsconfig.tests.json`, no output, exit 0 |
| `npm.cmd run test:fast` equivalent (unit + architecture) | PASS (2 environment-blocked) | 123 tests, 121 pass, 2 fail - both failures are `spawnSync(...).status === null` (EPERM) in child-process-spawning tooling tests (`tests/object-scaffold.test.mjs` "scaffold dry-run...", `tests/game-audio.test.mjs` "sound scaffold..."), not Phase 3 code; see environment note |
| Break-check (facility credits guard) | PASS | Weakening `failure: price > state.credits ? 'insufficient-credits' : null` to `failure: null` turned `tests/domain/planetFacilities.test.mjs` red (2 tests: "facility investment quotes reject ... unaffordable cases", "rejected investment commands return the unchanged aggregate"); file restored byte-exactly (sha256 DF3B27BFDE28CD2C063E9D570428E674A0598DD30EB5CF81AB14E36FAEA29F88) and re-run green |
| `npm.cmd run test:ui` | NOT RUN | Phase 5 criterion; requires Docker Supabase + Chromium, unavailable here |

Environment note: this sandbox denies the default `node --test` worker spawn (`Error: spawn EPERM` at `node:internal/test_runner/runner:529`) and also intermittently denies the generator scripts' child spawns. All suites were therefore re-run in-process with `node --test --experimental-test-isolation=none`, which is equivalent for these assertions. The two failures are the same generator/tooling tests that the Phase 2 review recorded as passing outside the sandbox; they exercise the object/sound scaffold scripts and are unrelated to facilities. Escalation outside the sandbox was unavailable because the automatic approval reviewer returned an infrastructure error, so the full `npm.cmd run test:project` pipeline (including Playwright) could not be executed here.

## Progress (Manual) Status

- 3.4 A fresh run shows dairy 1, grain 1, cheese 1, bakery 0, processor 0 on all three planets - `[ ]` pending

No Manual row is falsely marked complete.