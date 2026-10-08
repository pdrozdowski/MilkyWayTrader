# S16 Planetary Facilities Implementation Plan

## Overview

Deliver a persistent, all-planet, five-commodity facility economy: facilities attempt their recipes every active second against each planet's shared stock, stock drives prices, and a landed-only Facilities view lets the player inspect, build, and upgrade facilities with credits.

## Current State Analysis

- `GameStateSnapshot` is v16 with an exact root key set; each planet needs exactly one market with exactly one stock entry per catalogue commodity, and obsolete versions are rejected. Facility state does not exist anywhere in `src/`.
- The catalogue is duplicated across the state id union, the domain catalog, the definitions module, UI labels, `index.html`, `public/style.css`, the commodity object, and the Supabase ingest function; only `serotonCommodityIds` (`src/game/domain/serotonMarketCatalog.ts:3`) is a runtime allow-list.
- Market evolution is linear drift applied on crossed active seconds (`src/game/mechanics/gameSimulation.ts:84-85`, `src/game/mechanics/serotonMarketSimulation.ts:4-19`); all pauses freeze it through `activeDeltaMs <= 0`.
- The landed dialog is `view: 'hub' | 'market'`; the Facilities button is disabled with no handler; the reusable seam is `LandingStatusPort` plus `landingStatusAdapter` plus `projectLandedMarket` plus the `serotonMarket` quote/apply split.
- The PAUSED indicator lives only in the HUD (`z-index: 3`), which the dialog (`z-index: 5`) covers.
- Salvage and orbital manifests already draw from the commodity definition array, so the catalogue swap propagates automatically; only the commodity object texture mapping hardcodes ids.

## Desired End State

A fresh run on any planet shows Dairy Farm, Grain Farm and Cheese Factory at level 1 plus Bakery and Food Processor not built; the Facilities view renders a horizontal row of five cards with the paused clock, credits and cargo; building or upgrading deducts credits immediately; and after launch every planet's facilities move their own stock each second so prices respond.

## Types & Interfaces

- `SerotonCommodityId` becomes `'milk' | 'grain' | 'cheese' | 'bun' | 'spaceRation'`, derived from the single `serotonCommodityIds` array.
- `PlanetFacilityId` becomes `'dairyFarm' | 'grainFarm' | 'cheeseFactory' | 'bakery' | 'foodProcessor'`.
- `PlanetFacilityState = { facilityId: PlanetFacilityId; level: number; status: 'notBuilt' | 'working' | 'insufficientResources' }`, added as `facilities: readonly PlanetFacilityState[]` inside each per-planet economy record. Invariant: `status === 'notBuilt'` if and only if `level === 0`.
- `PlanetFacilityDefinition = { id; label; maxLevel: 3; outputByLevel: readonly number[]; inputsPerOutput: readonly { commodityId; quantity }[]; upgradePrices: readonly [number, number] }`, with planet modifiers `{ upgradePriceMultiplier; outputMultiplier }` keyed by facility and planet.
- New application surface: `quoteFacilityInvestment`, `applyFacilityBuild`, `applyFacilityUpgrade`, and `projectLandedFacilities`. `LandingStatusPort` gains `buildFacility(facilityId)` and `upgradeFacility(facilityId)` plus a facilities view model.
- Mechanics surface: `advancePlanetFacilities(economy, cycles)` replaces `advanceMarket(market, elapsedSeconds)`.

## What We're NOT Doing

- No snapshot migration: the version moves 16 to 17 once, in phase 3, and older snapshots are rejected (the codec's commodity allow-list already rejects pre-change snapshots after phase 1).
- No base-price changes; only stock thresholds and initial stock are rescaled, and every one of those values remains a balance tunable.
- No new telemetry event types and no facility analytics; only the existing trade events have their allow-lists corrected.
- No change to ship cargo capacity, repair, shipyard, or the 30-minute budget.
- No edits to `context/foundation/prd.md` (BR-078 still lists the legacy catalogue); correcting the PRD requires the `10x-prd-en-capability` skill as a follow-up.
- No regeneration of `code-graph.json` or `data-logical-diagram.md`.
- No new Playwright journey; the Facilities view is covered by a fast DOM component test, and `/utils-describe-e2e-scenarios` is invoked only if an existing spec must change.

## Implementation Approach

Static definitions hold the commodity price profiles and the facility recipes, levels, prices and modifiers. JSON-safe per-planet facility state joins the existing per-planet economy record in the snapshot. A pure mechanics reducer applies sequential, all-or-nothing cycles on the existing active-time boundary. Landed application projections and commands sit behind the existing typed UI port, and the Facilities view is presentation-local, mirroring the market view.

## Critical Implementation Details

- **Cycle count, not per-second frames.** A single frame can cross several active seconds; the reducer must run one full sequential pass per crossed second so a 3 500 ms frame equals 3 500 ms applied one second at a time. Sequence matters because a farm's same-second output may feed a consumer processed later in the fixed order.
- **Whole units only.** Every level's output and every derived input must stay a whole number. The +20% planet output bonus was chosen because it keeps the brief's 5/10/20 and 10/20/40 outputs integral (6/12/24 and 12/24/48).
- **Status is evaluated inside the cycle, not in the UI.** Selling an input while landed does not change a facility's stored status until the next cycle after launch; the view must render the stored status rather than recomputing it.
- **The dialog must render the paused clock itself.** The HUD indicator is hidden behind the dialog, so the Facilities view owns the visible paused-clock state.

## Phase 1: Commodity catalogue replacement

### Overview

Swap the five-commodity catalogue in everywhere the three legacy ids are asserted, rescale the stock balance for the faster economy, and remove the automatic per-second drift so phases 1-3 have a clean, honest intermediate state.

### Changes Required:

#### 1. Catalogue source of truth

**File**: `src/game/domain/serotonMarketCatalog.ts`

**Intent**: Make this module the only declaration of the commodity ids and their price profiles, and rescan the thresholds for the new throughput.

**Contract**: `serotonCommodityIds = ['milk','grain','cheese','bun','spaceRation'] as const`; `SerotonMarketCommodityId` derived from it; base prices unchanged at 100/150/300/250/1250 with rescaled thresholds milk 1 000/10 000, grain 1 000/10 000, cheese 500/5 000, bun 500/5 000, spaceRation 200/2 000.

#### 2. State, definitions and initial state

**Files**: `src/game/state/serotonMarketState.ts`, `src/game/definitions/serotonMarketDefinitions.ts`, `src/game/definitions/initialGameState.ts`

**Intent**: Replace the duplicated id union with the derived one, define the five commodity definitions, and seed differentiated opening stock. Drop the `productionPerSecond` and `consumptionPerSecond` tuning fields.

**Contract**: per-planet initial stock - the specialized facility's output sits above its upper threshold and the commodity that consumes it sits below its lower threshold; all other commodities start at their upper threshold. Seroton: cheese 6 000, milk 400. Maslo-Prime: milk 12 000, cheese 200. Lactozis-7C: grain 12 000, bun 200. All values are balance tunables (PRD BR-093).

#### 3. Remove automatic drift

**Files**: `src/game/mechanics/gameSimulation.ts`, `src/game/mechanics/serotonMarketSimulation.ts`

**Intent**: Delete the crossed-second market dispatch and the drift reducer so the catalogue swap does not need throwaway rates; facilities reintroduce stock movement in phase 4.

**Contract**: `state.markets` passes through the frame unchanged in this phase; the pause path (`activeDeltaMs <= 0`) is untouched.

#### 4. Allow-lists

**Files**: `src/game/application/gameStateCodec.ts`, `supabase/functions/ingest-game-events/index.ts`

**Intent**: Point the codec's commodity allow-list at the five-id catalog and widen the ingest allow-lists so trade telemetry is not silently dropped.

**Contract**: the codec keeps version 16 and its exact-shape checks; `allowedCommodities` becomes the five ids and `allowedPlanets` becomes the configured planet list.

#### 5. Legacy-catalogue tests

**Files**: `tests/domain/serotonMarket.test.mjs`, `tests/domain/gameState.test.mjs`, `tests/game-mechanics.test.mjs`, `tests/domain/planetCatalog.test.mjs`

**Intent**: Rewrite every assertion that names `supplies`, `alloys`, or `medicines`, and drop the drift assertions that no longer apply.

**Contract**: expected stock values follow the rescaled seeding; the drift boundary and continuity cases in `tests/game-mechanics.test.mjs:456-514` are removed here and re-added as facility-cycle cases in phase 4.

### Success Criteria:

#### Automated Verification:

- No legacy commodity identifiers remain in product code: `rg "supplies|alloys|medicines" src supabase` returns nothing
- Focused domain tests pass: `npm.cmd run test:domain`
- Focused mechanics tests pass: `npm.cmd run test:mechanics`
- Type checking passes: `npm.cmd run typecheck`
- Round-trip tests confirm the five-commodity catalogue serializes and restores

#### Manual Verification:

- Landing on each planet shows five commodities with the intended opening spread
- A buy and a sell each move the displayed stock and price
- A snapshot written before the change is rejected on restore

---

## Phase 2: Commodity presentation

### Overview

Give the five commodities a consistent identity across the market, the cargo surfaces, and the in-world loose-item object.

### Changes Required:

#### 1. Icon assets

**Files**: `public/assets/icons/commodity-{milk,grain,cheese,bun,spaceRation}-placeholder_32x32.png`

**Intent**: Add five 32x32 placeholder icons matching the existing placeholders' size and PNG format, and remove the three legacy ones.

**Contract**: exact filename convention `commodity-<id>-placeholder_32x32.png`; flat-coloured tile identity is sufficient because these are placeholders.

#### 2. Commodity object

**Files**: `src/game/objects/commodity/definition.ts`, `src/game/objects/commodity/commodity.ts`

**Intent**: Register all five assets and map every id to its own texture, removing the silent supplies fallback.

**Contract**: five `image` assets and a variant per id; `commodityTexture` resolves each known id without a default branch.

#### 3. Labels and DOM

**Files**: `src/ui/components/displayLabels.ts`, `index.html`, `public/style.css`, `src/ui/components/landingStatus.ts`, `src/ui/components/cargoTransfer.ts`, `src/ui/components/runStatus.ts`

**Intent**: Extend the label map to five commodities, add the two new market catalogue buttons and cargo-transfer rows, and give each commodity a distinct icon colour.

**Contract**: `commodityLabels` covers all five ids; market catalogue and cargo-transfer rows carry the five `data-commodity-id` values; the catalogue grid and icon palette cover five entries.

#### 4. Presentation tests

**Files**: `tests/object-scaffold.test.mjs`, `tests/run-status-clock.test.mjs`

**Intent**: Assert five asset paths and five textures, and rebuild the cargo-transfer DOM expectations for five rows.

**Contract**: the object test enumerates all five asset paths and textures; the component test enumerates five rows.

### Success Criteria:

#### Automated Verification:

- Object-scaffold tests assert five placeholder paths and five textures
- Focused object tests pass: `npm.cmd run test:objects`
- Unit tests pass with five cargo-transfer rows: `npm.cmd run test:unit`

#### Manual Verification:

- Market catalogue, cargo HUD, and cargo transfer show five commodities with distinct icons and labels
- Loose salvage items render with the matching commodity texture

---

## Phase 3: Facility definitions and authoritative facility state

### Overview

Introduce the facility catalogue and make per-planet facility identity, level and status part of the authoritative aggregate.

### Changes Required:

#### 1. Facility definitions

**File**: `src/game/definitions/planetFacilityDefinitions.ts` (new)

**Intent**: Define the five facilities, their fixed processing order, per-level output, per-unit input recipes, upgrade prices and planet modifiers.

**Contract**: order dairyFarm, grainFarm, cheeseFactory, bakery, foodProcessor; max level 3; output by level dairy/grain 10/20/40 and cheese/bakery/processor 5/10/20; inputs per output: cheese 2 milk, bun 2 grain, ration 2 cheese + 1 bun + 1 milk, farms none; upgrade prices dairy/grain 25 000/75 000, cheese/bakery 35 000/100 000, processor 50 000/150 000; modifiers 20% upgrade discount and +20% output for cheeseFactory@seroton, dairyFarm@maslo-prime, grainFarm@lactozis-7c.

#### 2. Snapshot state and codec

**Files**: `src/game/state/serotonMarketState.ts`, `src/game/state/gameStateSnapshot.ts`, `src/game/application/gameStateCodec.ts`, `src/game/definitions/initialGameState.ts`

**Intent**: Add facility state to each per-planet record and validate it exactly, bumping the schema once.

**Contract**: `facilities` joins the exact key set of the per-planet record; the version moves 16 to 17 in the type, the version check and the decoder output; validation requires exactly one entry per facility id, an integer `level` in 0..3, a `status` in the union, and the level/status invariant; initial levels are dairy 1, grain 1, cheese 1, bakery 0, processor 0 with `working` and `notBuilt` statuses.

#### 3. Investment commands

**File**: `src/game/application/planetFacilities.ts` (new)

**Intent**: Provide the landed-only, credits-only build and upgrade path with a matching quote for the UI.

**Contract**: `quoteFacilityInvestment`, `applyFacilityBuild` (level 0 to 1 at the first price) and `applyFacilityUpgrade` (level n to n+1 at that step's price, blocked at 3). All three reject when not landed, when the facility is unknown, when the transition is unavailable, or when credits are insufficient; a successful call changes only the landed planet's facility record and `credits`, atomically through the provider.

#### 4. State and domain tests

**Files**: `tests/domain/gameState.test.mjs`, `tests/domain/planetCatalog.test.mjs`, plus a new domain test for the investment commands

**Intent**: Cover the revised schema and every investment guard.

**Contract**: codec tests cover v16 rejection, v17 acceptance, duplicate/missing/unknown facility ids, out-of-range levels, invalid statuses, the level/status invariant and detached snapshots; command tests cover discount arithmetic, credits-only deduction, landed-only enforcement, max level and the unaffected facilities on other planets.

### Success Criteria:

#### Automated Verification:

- Codec tests cover v16 rejection, v17 acceptance, and facility validation
- Domain tests cover build/upgrade guards, discounts, credits-only deduction, and max level
- Type checking passes: `npm.cmd run typecheck`

#### Manual Verification:

- A fresh run shows dairy 1, grain 1, cheese 1, bakery 0, processor 0 on all three planets

---

## Phase 4: Facility cycle simulation

### Overview

Replace the removed drift with deterministic per-second facility cycles that mutate each planet's shared stock.

### Changes Required:

#### 1. Cycle reducer

**File**: `src/game/mechanics/planetFacilitySimulation.ts` (new)

**Intent**: Run, for each crossed active second, one sequential pass over the five facilities in fixed order, applying an all-or-nothing recipe.

**Contract**: `advancePlanetFacilities(economy, cycles)`; per pass, for each facility with level greater than 0 compute that level's output (with the planet output multiplier, whole units) and required inputs; if every input is covered by current stock, subtract inputs, add outputs and set `working`; otherwise leave stock untouched and set `insufficientResources`; level 0 stays `notBuilt`; stock never goes negative and the reducer is pure.

#### 2. Frame wiring

**File**: `src/game/mechanics/gameSimulation.ts`

**Intent**: Call the reducer on the existing crossed-active-second boundary for every market, keeping pause semantics unchanged.

**Contract**: cycle count is `Math.floor(nextActiveMs/1000) - Math.floor(previousActiveMs/1000)`; every pause reason, including `landed`, still freezes it through the existing `activeDeltaMs <= 0` guard.

#### 3. Mechanics tests

**File**: `tests/game-mechanics.test.mjs`

**Intent**: Cover the boundary, determinism and status behaviour of the new cycle.

**Contract**: cases for the one-second boundary, a multi-second frame equalling repeated single-second frames, the fixed order with a same-second farm-to-consumer dependency, shortfall flipping the status without stock change and recovery back to `working`, every pause reason, encode/restore continuity, and per-planet isolation.

### Success Criteria:

#### Automated Verification:

- Mechanics tests cover the one-second boundary and multi-cycle frames
- Mechanics tests cover fixed ordering with a same-cycle input dependency
- Mechanics tests cover all-or-nothing shortfall and status changes
- Mechanics tests cover every pause reason and restore continuity
- Mechanics tests cover per-planet isolation

#### Manual Verification:

- Stock is frozen while landed and starts moving again after launch
- A facility's status reacts after the player sells its input and resumes flight

---

## Phase 5: Landed Facilities view

### Overview

Deliver the landed-only Facilities view with the authoritative projection, typed port, five cards, the paused clock, and credit-paid build/upgrade actions.

### Changes Required:

#### 1. Projection and port

**Files**: `src/game/application/landedFacilities.ts` (new), `src/game/application/landedMarket.ts`, `src/ui/contracts.ts`, `src/ui/adapters/landingStatusAdapter.ts`

**Intent**: Mirror the landed market seam for facilities, reusing the existing eligibility rule and credits/cargo figures.

**Contract**: `projectLandedFacilities` returns an immutable view model with visibility/eligibility, planet identity, credits, cargo used/capacity, clock paused/running and remaining time, and one row per facility with label, level, max level, stored status, per-cycle production and consumption, modifier summary, and the next investment price and affordability; `LandingStatusPort` gains `buildFacility` and `upgradeFacility`, which route through the provider and keep the existing telemetry pattern.

#### 2. Component and markup

**Files**: `src/ui/components/landingStatus.ts`, `index.html`, `public/style.css`

**Intent**: Extend the dialog's view union to `'hub' | 'market' | 'facilities'`, enable the Facilities button, and render the five cards with the paused clock in the nav.

**Contract**: a new `#landing-status-facilities-view` sibling of the hub and market views; nav places Back to Planet and the paused clock on the left and credits and cargo on the right; the upper 30% is unobstructed artwork under the nav and the lower 70% holds five equal-width cards in a single row at the target resolution with no horizontal scrolling; each card shows level, status, recipe, modifier and price with the Build / Upgrade / Max Level action anchored at the bottom, disabled when unaffordable; opening the view focuses its first meaningful control and Launch still returns focus to the canvas.

#### 3. Component test

**File**: a new DOM component test alongside `tests/run-status-clock.test.mjs`

**Intent**: Prove rendering, actions, states and cleanup with a fake port rather than a browser.

**Contract**: asserts five cards, the three visible states, Build versus Upgrade versus Max Level, the disabled unaffordable state, the paused-clock text, first-control focus, and idempotent destroy.

### Success Criteria:

#### Automated Verification:

- A DOM component test renders the facilities view, states, and actions from a fake port
- The complete local pipeline passes: `npm.cmd run test:project`

#### Manual Verification:

- Landing then Facilities shows five cards with the paused clock, credits, and cargo
- Build and Upgrade deduct credits and update the card immediately
- The affected commodity's market price changes after resuming flight
- Tab stays inside the dialog and Launch returns focus to the canvas
- Cards fit one row without horizontal scrolling at the target resolution

---

## Testing Strategy

### Unit and Domain Tests

- Five-commodity catalogue: price profiles, thresholds, per-planet seeding, and differentiated opening spread.
- Codec: v16 rejection, v17 acceptance, exact facility collection identity, level/status invariant, detached snapshots, JSON round trip.
- Investment commands: discount arithmetic on both steps, credits-only deduction, landed-only enforcement, max level, other planets untouched.

### Mechanics Tests

- One-second boundary and multi-second frames.
- Fixed order with a same-second farm-to-consumer feed.
- All-or-nothing shortfall, status flip and recovery.
- Every pause reason freezes stock and status; encode/restore continuity; per-planet isolation.

### Component Tests

- Facilities view rendering, Build/Upgrade/Max Level, disabled affordability, paused clock, first-control focus, idempotent cleanup.

### Manual Testing Steps

1. Land on each planet and confirm the differentiated opening stocks and the five facilities with correct initial levels.
2. Build Bakery, then upgrade it, and confirm credits and the card update immediately.
3. Sell Dairy Farm's output on a specialized planet, resume flight, and confirm the facility status flips and prices move.

## Performance Considerations

No new per-frame cost beyond one sequential five-facility pass per crossed active second per planet; a multi-second frame runs the bounded number of passes its active delta crossed and is clamped by the existing 30-minute budget.

## Migration Notes

No migration is implemented. The schema moves 16 to 17 when facility state enters the snapshot, and any older snapshot is rejected by the codec; after the catalogue swap the pre-change commodity ids are rejected by the allow-list even while the version is still 16.

## Assumptions and Defaults

- Facility cycle cadence is one active second and each cycle attempts the brief's full recipe (your decision), so a level-1 Dairy Farm yields 10 Milk per second and a level-1 Cheese Factory consumes 10 Milk per second.
- The planet output bonus is +20%, chosen so every level's output and every derived input stay whole numbers; the 20% upgrade discount applies to both upgrade steps.
- Base prices stay as supplied; only stock thresholds and initial stock are rescaled, and all of them remain balance tunables under PRD BR-093.
- Stored facility status is the source of truth for the UI; level 0 is always Not Built.
- Facility state lives inside the existing per-planet economy record, and the schema version bumps once, 16 to 17, in phase 3.
- Salvage draws uniformly over all five commodities with no tier weighting.
- The PRD is not edited; its BR-078 legacy catalogue wording is a follow-up for the `10x-prd-en-capability` skill.

## References

- Frame: `context/changes/s16-planetary-facilities/frame.md`
- Research: `context/changes/s16-planetary-facilities/research.md`
- Architecture: `context/foundation/architecture.md`
- Testing: `context/foundation/testing.md`
- Lessons: `context/foundation/lessons.md`
- Prior seam: `context/archive/2026-09-26-s04-first-planetary-trade/plan.md:261-301`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `- <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Commodity catalogue replacement

#### Automated

- [ ] 1.1 No legacy commodity identifiers remain in product code
- [ ] 1.2 Focused domain tests pass with the five-commodity catalogue
- [ ] 1.3 Focused mechanics tests pass with the automatic drift removed
- [ ] 1.4 Type checking passes
- [ ] 1.5 Round-trip tests confirm the five-commodity catalogue serializes and restores

#### Manual

- [ ] 1.6 Landing on each planet shows five commodities with the intended opening spread
- [ ] 1.7 A buy and a sell each move the displayed stock and price
- [ ] 1.8 A snapshot written before the change is rejected on restore

### Phase 2: Commodity presentation

#### Automated

- [ ] 2.1 Object-scaffold tests assert five placeholder paths and five textures
- [ ] 2.2 Focused object tests pass
- [ ] 2.3 Unit tests pass with five cargo-transfer rows

#### Manual

- [ ] 2.4 Market catalogue, cargo HUD, and cargo transfer show five commodities with distinct icons and labels
- [ ] 2.5 Loose salvage items render with the matching commodity texture

### Phase 3: Facility definitions and authoritative facility state

#### Automated

- [ ] 3.1 Codec tests cover v16 rejection, v17 acceptance, and facility validation
- [ ] 3.2 Domain tests cover build/upgrade guards, discounts, credits-only deduction, and max level
- [ ] 3.3 Type checking passes

#### Manual

- [ ] 3.4 A fresh run shows dairy 1, grain 1, cheese 1, bakery 0, processor 0 on all three planets

### Phase 4: Facility cycle simulation

#### Automated

- [ ] 4.1 Mechanics tests cover the one-second boundary and multi-cycle frames
- [ ] 4.2 Mechanics tests cover fixed ordering with a same-cycle input dependency
- [ ] 4.3 Mechanics tests cover all-or-nothing shortfall and status changes
- [ ] 4.4 Mechanics tests cover every pause reason and restore continuity
- [ ] 4.5 Mechanics tests cover per-planet isolation

#### Manual

- [ ] 4.6 Stock is frozen while landed and starts moving again after launch
- [ ] 4.7 A facility's status reacts after the player sells its input and resumes flight

### Phase 5: Landed Facilities view

#### Automated

- [ ] 5.1 A DOM component test renders the facilities view, states, and actions from a fake port
- [ ] 5.2 The complete local pipeline passes

#### Manual

- [ ] 5.3 Landing then Facilities shows five cards with the paused clock, credits, and cargo
- [ ] 5.4 Build and Upgrade deduct credits and update the card immediately
- [ ] 5.5 The affected commodity's market price changes after resuming flight
- [ ] 5.6 Tab stays inside the dialog and Launch returns focus to the canvas
- [ ] 5.7 Cards fit one row without horizontal scrolling at the target resolution