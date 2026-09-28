# S-04 First Seroton Planetary Trade Implementation Plan

## Overview

Deliver the first complete landed-market loop on Seroton: inspect stock and prices, preview a bounded trade, and atomically buy or sell cargo. The work builds on S-03's landed lifecycle and pauses market simulation whenever the shared active clock is paused.

## Current State Analysis

Landing already records `landedPlanetId` and pauses the active clock, while the DOM landing dialog currently presents deferred services. Credits and cargo exist in the versioned snapshot, but no commodity catalogue, mutable market stock, prices, transaction logic, or market projection exists.

## Desired End State

After landing on Seroton, a player can select supplies, alloys, or medicines; use a centered slider to preview a sale or purchase; see the total, stock impact, and resulting price; and confirm a valid trade. Credits, cargo, and stock update together, while the market evolves once per second only during active game time.

### Key Discoveries:

- Landing creates the authoritative `landed` pause (`src/game/mechanics/planet/landing.ts:5`).
- Provider updates are the atomic immutable state boundary (`src/game/application/gameStateProvider.ts:19`).
- The existing landed dialog and typed port are the UI extension seam (`src/ui/adapters/landingStatusAdapter.ts:11`).

## What We're NOT Doing

- Markets, stock simulation, or trading UI for Lactozis-7C and Maslo-Prime.
- Shipyard services, ship upgrades, persistence backends, authentication, or sales tax.
- Snapshot migration from the pre-market schema.

## Implementation Approach

Add a JSON-safe Seroton market slice to the aggregate, with static commodity tuning and pure domain reducers. Feed active-time ticks through the existing simulation reducer. Expand the landed typed port and dialog with a derived market view model; cache price ladders only in the adapter and invalidate after confirmed trades.

## Critical Implementation Details

Landing pauses the same clock that drives market ticks, so a visit cache is valid only until a confirmed trade changes stock. A transaction must calculate all discrete marginal prices from the pre-trade state, validate the aggregate outcome, and commit credits, cargo, and market stock in one provider update.

## Phase 1: Authoritative Seroton Economy

### Overview

Introduce the commodity definitions, persisted market state, codec boundary, and pure transaction rules.

### Changes Required:

#### 1. State, definitions, and codec

**Files**: `src/game/state/`, `src/game/definitions/`, `src/game/application/gameStateCodec.ts`

**Intent**: Persist Seroton's mutable stock while keeping the commodity catalogue and balance parameters static.

**Contract**: Schema v5 adds a JSON-safe Seroton market collection for exactly `supplies`, `alloys`, and `medicines`. Definitions lock the selected starter profile: supplies `1,000 / 100 / +4 / -2 / 50–150`; alloys `5,000 / 60 / +1 / -2 / 30–100`; medicines `15,000 / 20 / +0 / -1 / 10–40` (base price, initial stock, production, consumption, lower–upper thresholds). The codec rejects invalid market identity, duplicate/missing commodity stock, negative or non-integer stock, and schema v4; it does not migrate old snapshots.

#### 2. Pure market domain rules

**Files**: `src/game/domain/`, `src/game/mechanics/`

**Intent**: Model one-second stock evolution and landed-only marginal-price transactions without Phaser or DOM imports.

**Contract**: Price follows the revised threshold curve and rounds each unit price. A buy decrements stock unit-by-unit, a sale increments it unit-by-unit, and a quote sums that path's discrete prices. Trades require Seroton landing, a nonzero selected quantity, available stock/cargo capacity, and enough credits; no sales tax applies. A valid reducer atomically changes stock, cargo, and credits.

### Success Criteria:

#### Automated Verification:

- Domain tests cover all price-curve boundaries, unit rounding, marginal buy/sell totals, stock floor, cargo capacity, insufficient credits, and immutable inputs.
- Codec/provider tests cover schema-v5 round trips, malformed market rejection, atomic trade updates, and no v4 migration.

#### Manual Verification:

- A fresh run has the specified Seroton stock and empty cargo without changing existing run-status behavior.

**Implementation Note**: Pause after automated verification for manual confirmation.

---

## Phase 2: Active-Time Market Simulation and Projection

### Overview

Advance Seroton stock once per active second and expose an immutable market view model to the UI.

### Changes Required:

#### 1. Simulation integration

**Files**: `src/game/mechanics/gameSimulation.ts`, `src/game/mechanics/`

**Intent**: Apply configured production minus consumption for every elapsed one-second boundary without a separate clock.

**Contract**: Tick derivation compares prior and next authoritative `activeElapsedMs`; it applies each crossed whole second exactly once. No market change occurs when `activeDeltaMs` is zero, including landed, menu, orientation, and background pauses.

#### 2. Application market read model

**Files**: `src/game/application/`, `src/ui/contracts.ts`, `src/ui/adapters/landingStatusAdapter.ts`

**Intent**: Project landed eligibility, player balances, commodity rows, quote data, and semantic trade actions through the existing typed-port pattern.

**Contract**: The expanded landed-market port exposes immutable snapshots and `selectCommodity`, `setTradeQuantity`, `confirmTrade`, and `launch` actions. Its adapter is the only DOM-facing layer that accesses the provider. It builds a visit-local price ladder on landing and rebuilds it after each successful trade; it never stores that cache in the snapshot.

### Success Criteria:

#### Automated Verification:

- Mechanics tests prove one-second crossing behavior, multi-second deltas, and identical uninterrupted/restored stock results.
- Tests prove every pause reason leaves stock unchanged and that an unlanded command cannot trade.

#### Manual Verification:

- Launching from Seroton resumes visible active-time market evolution; landing freezes it immediately.

**Implementation Note**: Pause after automated verification for manual confirmation.

---

## Phase 3: Accessible Landed Market

### Overview

Replace deferred landing text with the selected-commodity market workflow.

### Changes Required:

#### 1. Dialog markup, component, and styling

**Files**: `index.html`, `src/ui/components/landingStatus.ts`, `public/style.css`

**Intent**: Turn the existing landed dialog into an accessible, responsive Seroton market without creating a second modal or Phaser UI.

**Contract**: The compact catalogue selects one commodity. Its centered slider has negative sell positions down to carried quantity and positive buy positions up to free capacity or market stock. The panel displays quote total, post-trade stock and next-price impact. A buy beyond available credits remains visible with a cash-shortfall explanation and disabled confirmation. The panel is scrollable at narrow sizes, traps Tab focus, focuses its first market control on landing, and returns focus to the game canvas on Launch.

#### 2. Adapter and test-harness wiring

**Files**: `src/ui/setupUi.ts`, `tests/ui/fixtures/uiHarness.ts`, `tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`

**Intent**: Bind the component to the expanded typed port and protect the existing input/lifecycle contract.

**Contract**: All market controls remain inside `data-game-input="ignore"`; rendering refreshes from provider snapshots after confirmation rather than from local predictions. Destroy/mount behavior stays idempotent.

### Success Criteria:

#### Automated Verification:

- UI tests cover selection, slider bounds, invalid-cash messaging, quote/impact rendering, semantic action arguments, focus trapping, focus return, and cleanup.
- Application Playwright tests cover landing, a valid buy and sale, immediate HUD refresh, paused clock while trading, and no page errors.

#### Manual Verification:

- Desktop and touch-sized views retain usable controls and readable market information throughout a complete land-trade-launch loop.

**Implementation Note**: Pause after automated verification for manual confirmation.

---

## Phase 4: Vertical Market Inventory Breakdown

### Overview

Recompose the landed-market dialog around the selected commodity: a planet-stock panel, a focused trade control, and a player-stock panel. The catalogue becomes name-only, and the obsolete landed-time notice is removed.

### Changes Required:

#### 1. Authoritative cargo cost basis and market projection

**Files**: `src/game/state/`, `src/game/application/gameStateCodec.ts`, `src/game/application/serotonMarket.ts`, `src/game/application/landedMarket.ts`, `src/game/definitions/`

**Intent**: Provide a truthful average buy price for the selected commodity, including after a save/restore, without making presentation cache authoritative.

**Contract**: Each JSON-safe cargo stack carries a non-negative integer quantity and a finite non-negative weighted-average buy price. Purchases recompute the weighted average using the exact marginal trade total; sales retain the existing average while quantity remains and remove the stack at zero. The schema is incremented and rejects obsolete snapshots rather than migrating them. The market projection exposes selected-commodity production, consumption, derived Low/Medium/High supply level, planned stock delta, carried quantity with planned delta, and formatted-cost inputs.

#### 2. Semantic vertical market dialog

**Files**: `index.html`, `src/ui/components/landingStatus.ts`, `src/ui/components/displayLabels.ts`, `public/style.css`

**Intent**: Make the selected commodity's world stock, proposed transaction, and ship inventory readable as three vertical controls in the existing modal.

**Contract**: `#landing-status-trade` contains, in order: (1) a planet-stock control with commodity name, non-decorative icon, current stock plus planned signed delta, production/sec, and a Low/Medium/High supply level; (2) the existing centered quantity slider with current signed buy/sell amount, unit price, total trade value, and an explicit in-budget/out-of-budget indication; and (3) a player-stock control with carried quantity plus planned signed delta and average buy price. Catalogue buttons show only commodity names. The separate “Time is paused while landed” line is absent. Every interactive element stays inside `data-game-input="ignore"`; keyboard focus, disabled trade behavior, and launch focus return remain intact.

#### 3. Responsive UI and coverage

**Files**: `tests/domain/`, `tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`, `tests/ui/fixtures/`, `public/style.css`

**Intent**: Preserve economic correctness and verify the denser vertical layout at desktop and touch widths.

**Contract**: Domain/state tests cover cost-basis weighting, partial/full sales, immutable inputs, codec round-trip/rejection, and exact trade totals. UI tests cover the three-panel order, name-only catalogue, stock/cargo deltas, supply-level boundaries, budget status, focus behavior, and absence of the pause line. Application UI tests exercise buy/sell refreshes for the new projected values. A screenshot gate verifies one desktop and one touch-width rendered market state.

### Success Criteria:

#### Automated Verification:

- Domain and codec/provider tests cover weighted average buy price, sale behavior, schema validation, and immutability.
- UI and application Playwright tests cover the three vertical panels, commodity-name tabs, all supply levels, budget states, and immediate post-trade refresh.
- Screenshot verification covers desktop and touch-width market layouts with readable controls.

#### Manual Verification:

- In a complete Seroton land-trade-launch loop, the player can read planet stock, trade economics, and ship stock without scrolling horizontally on desktop or touch-sized views.

**Implementation Note**: The cost basis is authoritative game state; follow `utils-add-state` and do not add snapshot migration.

## Testing Strategy

Run focused domain, state, mechanics, and UI tests during each phase; then run `npm.cmd run test:project`, `npm.cmd run typecheck`, and `npm.cmd run build-nolog`. Verify the real browser interaction after code changes.

## Performance Considerations

The slider uses a visit-local derived price ladder. It is rebuilt only when landing or a confirmed trade changes the Seroton market, and never becomes authoritative state.

## Migration Notes

The market changes the persisted shape from schema v4 to v5. Per project policy, reject previous snapshots rather than implementing migration semantics.

## References

- Research: `context/changes/s04-first-planetary-trade/research.md`
- `context/foundation/prd.md`
- `src/game/mechanics/planet/landing.ts:5`
- `src/ui/adapters/landingStatusAdapter.ts:11`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Authoritative Seroton Economy

#### Automated

- [x] 1.1 Domain tests cover price boundaries, marginal totals, limits, and immutable inputs.
- [x] 1.2 Codec and provider tests cover schema-v5 market validation and atomic trades.

#### Manual

- [x] 1.3 A fresh run exposes the configured Seroton economy without status regressions.

### Phase 2: Active-Time Market Simulation and Projection

#### Automated

- [x] 2.1 Mechanics tests cover exact one-second ticks, restored continuity, and all pauses. — c796d59
- [x] 2.2 Application tests cover landed eligibility and transient cache invalidation after a trade. — c796d59

#### Manual

- [x] 2.3 Landing freezes and launch resumes the Seroton market.

### Phase 3: Accessible Landed Market

#### Automated

- [x] 3.1 UI tests cover market rendering, slider constraints, quote states, focus, and cleanup. — dfd08d3
- [x] 3.2 Playwright covers an end-to-end landed buy/sell flow and immediate HUD update. — dfd08d3

#### Manual

- [x] 3.3 Desktop and touch layouts complete a readable land-trade-launch loop.

### Phase 4: Vertical Market Inventory Breakdown

#### Automated

- [x] 4.1 State, codec, and provider tests cover weighted average buy price and sale lifecycle.
- [x] 4.2 UI and application tests cover vertical panels, supply/budget states, and refreshed trade data.
- [x] 4.3 Screenshot verification covers desktop and touch-width market layouts.

#### Manual

- [x] 4.4 A full land-trade-launch loop keeps all three inventory controls readable on desktop and touch views.
