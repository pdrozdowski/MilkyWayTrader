<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S16 Planetary Facilities Implementation Plan

- **Plan**: context/changes/s16-planetary-facilities/plan.md
- **Scope**: Phase 1 of 5
- **Reviewed phases**: 1
- **Date**: 2026-10-08
- **Verdict**: REJECTED
- **Findings**: 1 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Reviewed scope note: Phase 1 is complete in the worktree but not committed (HEAD e40594f), so the diff is `git diff HEAD` over the implementer's file list plus the deletion of `src/game/mechanics/serotonMarketSimulation.ts`. Progress 1.1-1.5 are `[x]` and were re-verified; 1.6-1.8 (Manual) remain `[ ]` (pending, as expected for a landed-only human check).

## Findings

### F1 - Missing commodity variants crash loose-item rendering for bun and spaceRation

- **Severity**: CRITICAL
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/objects/commodity/definition.ts:13 (also src/game/objects/commodity/commodity.ts:27, src/game/objects/_shared/sceneObject.ts:13)
- **Detail**: The catalogue now yields five ids and salvage draws uniformly over all of them (src/game/mechanics/salvage/cargoManifest.ts:18, src/game/mechanics/salvage/asteroidLoot.ts:69). `Commodity` forwards `variant: state.container.commodityId` to `SceneObject`, which throws `Unknown commodity variant: <id>` when `definition.variants[id]` is absent; `definition.ts` declares only `milk`/`grain`/`cheese`. Proof: transpiling the real `sceneObject.ts` plus `definition.ts` with a stubbed Phaser and constructing every variant yields `milk`/`grain`/`cheese` -> OK, `bun`/`spaceRation` -> `Unknown commodity variant: bun` / `Unknown commodity variant: spaceRation`. The milk fallback in `commodityTexture()` is unreachable because the base constructor throws first, so the reported Phase-1 fallback does not work. `CommodityProjection.synchronize` is called unguarded from the scene render/reconcile path (src/game/scenes/gameScene.ts:190 and :518), so a single `bun`/`spaceRation` loose item (small-asteroid drop or spilled orbital cargo) throws inside the frame loop. Existing fast tests cannot catch this: tests/object-scaffold.test.mjs stubs `SceneObject` and only uses `medicines`. Context: the milk/grain/cheese PNGs also do not exist yet, so the interim loose-item visual is a missing texture until Phase 2 adds assets.
- **Fix**: Add fallback variants so no catalogue id can throw, e.g. `bun: { texture: 'object:commodity:milk' }, spaceRation: { texture: 'object:commodity:milk' }` in `variants`; Phase 2 replaces them with real textures.
- **Decision**: FIXED (orchestrator, after review) — added `bun` and `spaceRation` variants with the `object:commodity:milk` fallback texture in `src/game/objects/commodity/definition.ts`; typecheck green and all five catalogue ids now have a variant. Phase 2 replaces them with real textures.

### F2 - Removed per-second tuning fields leave dead markup and unused labels

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: index.html:87
- **Detail**: `landingStatus.ts` no longer reads or writes `#landing-status-production` / `#landing-status-consumption`, but both `<p>` elements remain in the market inventory panel, and `displayLabels.produces` / `displayLabels.consumes` (src/ui/components/displayLabels.ts:26) are now unused. The plan's drop-`productionPerSecond`/`consumptionPerSecond` contract is therefore complete in code but not in the landing markup/labels.
- **Fix**: Remove the two `<p id="landing-status-production">` / `<p id="landing-status-consumption">` elements and drop the unused `produces`/`consumes` label keys while Phase 2 rewrites this markup.
- **Decision**: FIXED (Phase 2) - the dead `#landing-status-production`/`#landing-status-consumption` markup and the unused `produces`/`consumes` labels were removed when Phase 2 rewrote the catalogue; re-confirmed by the Phase 2 review evidence.

### F3 - SerotonCommodityId remains a hand-written mirror instead of a derived union

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/state/serotonMarketState.ts:3
- **Detail**: The plan (Phase 1.2) says to replace the duplicated id union with the derived one, but the state union is still written by hand. This is forced by architecture rather than a defect: tests/architecture.test.mjs:54 enforces `assertPureLayer(game/state, [game/state])`, and `serotonCommodityIds` lives in `game/domain/serotonMarketCatalog.ts`, so `state/` cannot import it. The union mirrors `serotonCommodityIds` exactly like `PlanetId` mirrors `domain/planetCatalog.planetIds`, and the type system binds the mirror through `planetMarketTunings: Readonly<Record<SerotonCommodityId, ...>>` plus its indexed use in `initialGameState.ts`. Verified: `npm.cmd run test:architecture` passes 8/8.
- **Fix**: No code change required. Optionally record the constraint: add the mirror-documentation note used by `src/game/domain/planetCatalog.ts` (and/or a commodity mirror assertion like tests/domain/planetCatalog.test.mjs), and correct the plan wording.
- **Decision**: ACCEPTED (no code change) - the mirror is forced by the pure-layer rule (`game/state` may import only `game/state`) and is bound by the typed `planetMarketTunings` Record; `test:architecture` stays green. Plan wording left as-is.

### F4 - Plan lists initialGameState.ts among Phase 1 changed files but it needed no edit

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/definitions/initialGameState.ts
- **Detail**: Plan Phase 1.2 lists `src/game/definitions/initialGameState.ts` under Files, but it was not modified. No change was needed: per-planet opening stock is data-driven from `planetMarketTunings` (`serotonCommodityDefinitions.map(... planetMarketTunings[definition.id][commodity.id].initialStock)`), so the rescaled seeding flows through untouched. Verified: tests/domain/gameState.test.mjs asserts the new per-planet stocks and passes.
- **Fix**: None required; the plan's file list is over-specified.
- **Decision**: ACCEPTED (no code change) - `initialGameState.ts` needed no edit because per-planet opening stock flows through `planetMarketTunings`; the plan file list is over-specified.

## Verified Phase 1 Contracts (evidence)

- Catalogue: `serotonCommodityIds = ['milk','grain','cheese','bun','spaceRation'] as const` with `SerotonMarketCommodityId` derived; prices 100/150/300/250/1250; one uniform stock band, every commodity 100/300 (src/game/domain/serotonMarketCatalog.ts:3-13). MATCH.
- Opening stock: seroton milk 4, grain 100, cheese 60, bun 50, spaceRation 20; lactozis-7c milk 100, grain 120, cheese 50, bun 2, spaceRation 20; maslo-prime milk 120, grain 100, cheese 2, bun 50, spaceRation 20 (src/game/definitions/serotonMarketDefinitions.ts:31-57). MATCH.
- Drift removed: `advanceMarket` dispatch deleted from `gameSimulation.ts`, `serotonMarketSimulation.ts` deleted, `markets: state.markets` passes through, `if (activeDeltaMs <= 0) return { ...state, clock };` untouched. MATCH.
- Codec: allow-list derived from `serotonCommodityIds`, planets from `planetIds`, version still exactly 16 with its exact-shape checks (src/game/application/gameStateCodec.ts:107-108, 268-283); no v17 bump. MATCH (Phase 3 owns 16->17).
- Supabase ingest: `allowedCommodities` = the five ids; `allowedPlanets` = `['seroton','lactozis-7c','maslo-prime']` (supabase/functions/ingest-game-events/index.ts:15-16). MATCH.
- Scope: no facility state/icons/Phase 2-5 code (`rg -l facilit src` returns only the pre-existing Facilities label/button); index.html/style.css changes are the pre-flagged id renames. MATCH.
- Tests: the three named suites are rewritten for the five ids; the drift boundary/continuity cases were removed from tests/game-mechanics.test.mjs (return in Phase 4). MATCH.

## Gate Re-runs

| Gate | Result | Evidence |
|------|--------|----------|
| `rg supplies|alloys|medicines src supabase` | PASS | no matches, exit 1 |
| `npm.cmd run test:domain` | PASS | 42/42 |
| `npm.cmd run test:mechanics` | PASS | 41/41 |
| `npm.cmd run typecheck` | PASS | tsc --noEmit (both configs) clean |
| `npm.cmd run test:architecture` | PASS (extra) | 8/8 |
| `npm.cmd run test:objects` | EXPECTED-RED | fails only on legacy asset paths supplies/alloys/medicines vs milk/grain/cheese (Phase 2 owns it) |
| `npm.cmd run test:ui-presentation` | EXPECTED-RED | fails only on the five-row cargo-transfer expectations (Missing cargo transfer control: [data-commodity-id=milk], Phase 2 owns it) |

Both expected-red failures match the reported intentional adaptations; neither reveals an unexpected failure mode.

## Progress (Manual) Status

- 1.6 Landing on each planet shows five commodities with the intended opening spread - `[ ]` pending
- 1.7 A buy and a sell each move the displayed stock and price - `[ ]` pending
- 1.8 A snapshot written before the change is rejected on restore - `[ ]` pending

No Manual row is falsely marked complete.