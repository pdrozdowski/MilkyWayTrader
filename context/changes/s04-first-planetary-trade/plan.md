# S-04 First Seroton Planetary Trade Implementation Plan

## Overview

Deliver a complete landed-market loop with an independent market for every currently landable planet: inspect stock and prices, preview a bounded trade, and atomically buy or sell cargo. The work builds on S-03's landed lifecycle and pauses market simulation whenever the shared active clock is paused.

## Current State Analysis

Landing already records `landedPlanetId` and pauses the active clock, while the DOM landing dialog presents the landed hub and market view. Credits, cargo, the commodity catalogue, market stock, prices, transaction logic, and market projections now exist. The completed Phase 5 intentionally retained one Seroton-identified market even when landed elsewhere; Phase 6 replaces that temporary shared-market model with one authoritative market per configured landable planet.

## Desired End State

After landing on any currently landable planet, a player can select supplies, alloys, or medicines; use a centered slider to preview a sale or purchase; see that planet's total, stock impact, and resulting price; and confirm a valid trade. Credits, cargo, and only the landed planet's stock update together, while every planet's market evolves once per second during active game time.

### Key Discoveries:

- Landing creates the authoritative `landed` pause (`src/game/mechanics/planet/landing.ts:5`).
- Provider updates are the atomic immutable state boundary (`src/game/application/gameStateProvider.ts:19`).
- The existing landed dialog and typed port are the UI extension seam (`src/ui/adapters/landingStatusAdapter.ts:11`).

## What We're NOT Doing

- Shipyard services, ship upgrades, persistence backends, authentication, or sales tax.
- Snapshot migration from the pre-market schema.
- Per-planet UI navigation state, distinct commodity catalogues, or per-planet clocks.

## Implementation Approach

Use a JSON-safe market collection keyed by every configured landable planet, with static per-planet tuning and pure domain reducers. Feed all market updates through the existing common active-time simulation reducer. Route landed quotes, trades, projections, and adapter-local price ladders through `landedPlanetId`; keep hub/market navigation presentation-local and invalidate a ladder after its landed market changes.

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

---

## Phase 5: Full-Window Planet Hub and Shared Market Entry

### Overview

Replace the direct landed-market entry with a full-window planet hub that makes landing feel distinct, then enters the existing market through an explicit place action.

### Changes Required:

#### 1. Shared landed-market eligibility

**Files**: `src/game/application/landedMarket.ts`, `src/game/application/serotonMarket.ts`, `src/ui/adapters/landingStatusAdapter.ts`

**Intent**: Until dedicated planetary markets are introduced, make the existing Seroton market usable from every currently landable planet while retaining its one authoritative shared stock and price model.

**Contract**: A non-null landed planet makes the shared market eligible and permits quotes and confirmed trades; unlanded trade remains invalid. The projected `planetName` remains the actual landing destination. Local hub/market navigation is not added to the snapshot or typed port. Entering a new landing and reopening Market resets the transient selection to Supplies and quantity to zero.

#### 2. Planet hub and market-panel markup

**Files**: `index.html`, `src/ui/components/landingStatus.ts`, `src/ui/components/displayLabels.ts`

**Intent**: Present a named landing destination before services, retain the established market controls, and ensure navigation remains accessible without nested DOM dialogs.

**Contract**: The one `#landing-status` dialog contains mutually exclusive `hub` and `market` views. The hub has a visual heading reading `Landed on <planet name>`, Market, disabled Shipyard with an accessible unavailable label, and LAUNCH. Market replaces its launch control with BACK. The component keeps navigation state locally, preserves `data-game-input="ignore"`, maintains its Tab trap, focuses Market on hub entry, the first trade control on Market entry, Market after Back, and the game canvas after Launch. Only Launch calls the existing port `launch` action and emits the existing scene transition.

#### 3. Landing UI contract and responsive presentation

**Files**: `public/style.css`, `public/assets/landing_bg_seroton.png`

**Intent**: Give the landing hub a durable, game-native visual hierarchy instead of extending the centered market card with one-off styles.

**Contract**: Extend the existing root variables with semantic action, danger, disabled, and title-outline tokens, and apply a reusable action-button class to landing and existing menu actions. The hub fills the available safe-area viewport as `minmax(0, 1fr) 200px`: a left visual column uses the supplied artwork as a cover background with a readable scrim, and the right rail stacks its top-aligned place actions with LAUNCH aligned to the bottom. The title is large white text with a dark-gray outline, uses a stepped letter-reveal animation, and renders without animation under `prefers-reduced-motion`. Desktop and touch-landscape layouts retain the fixed rail, visible focus, readable contrast, and no horizontal overflow.

#### 4. Regression and visual coverage

**Files**: `tests/ui/fixtures/uiHarness.ts`, `tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`, `tests/domain/gameState.test.mjs`

**Intent**: Protect shared-market behavior and the new landed navigation from lifecycle, focus, and layout regressions.

**Contract**: Tests exercise the shared market on each currently landable planet, reject unlanded trade, and enter market actions through the hub. Component tests cover the planet title, disabled Shipyard, Market/Back focus behavior, preserved landed pause, launch focus return, and cleanup. Application tests cover an end-to-end land → Market → trade → Back → Launch flow without page errors. Screenshot coverage captures hub and market at desktop and touch-landscape widths, including the reduced-motion title state.

### Success Criteria:

#### Automated Verification:

- Domain/application and UI tests prove any landed planet can use the shared market, while unlanded trade remains invalid.
- Component and application tests prove hub-to-market-to-back navigation, focus handling, paused time, launch lifecycle, and disabled Shipyard behavior.
- Screenshot verification covers readable desktop and touch-landscape hub and market layouts, including reduced motion.

#### Manual Verification:

- Landing on each currently landable planet shows its own name over the shared Seroton landing artwork; Market trades successfully and BACK returns to the hub without resuming time.
- LAUNCH resumes flight, hides the dialog, and restores canvas control; Shipyard remains visibly unavailable.

**Implementation Note**: Preserve the single DOM dialog and the existing launch event boundary. Hub and market switches are presentation changes, whereas only Launch may alter the authoritative landed lifecycle.

---

## Phase 6: Independent Planetary Markets

### Overview

Replace the deliberately temporary shared Seroton market with a complete, independently tuned market for every configured landable planet. Preserve the existing hub and market UI contract while making the landed planet the single market-routing identity.

### Changes Required:

#### 1. Per-planet state, definitions, and codec

**Files**: `src/game/state/serotonMarketState.ts`, `src/game/state/gameStateSnapshot.ts`, `src/game/definitions/planetDefinitions.ts`, `src/game/definitions/initialGameState.ts`, `src/game/definitions/serotonMarketDefinitions.ts`, `src/game/application/gameStateCodec.ts`

**Intent**: Make the authoritative aggregate hold exactly one mutable market for every configured landable planet and keep each market's initial stock, production, and consumption in static definitions.

**Contract**: Replace the Seroton-only `planetId` restriction with the configured landable planet identity type. Retain the shared `supplies`, `alloys`, and `medicines` catalogue and its existing price profiles; add a planet-keyed static market-tuning layer for only initial stock, production, and consumption. A fresh snapshot seeds one market per configured planet in deterministic definition order. Increment schema v15 to v16 and reject obsolete shared-market v15 snapshots rather than migrating them. The codec rejects missing, duplicate, unknown, or non-integer market identities/stocks and requires each market to contain every configured commodity.

#### 2. Common-clock market simulation and landed routing

**Files**: `src/game/mechanics/serotonMarketSimulation.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/application/serotonMarket.ts`, `src/game/application/landedMarket.ts`, `src/ui/adapters/landingStatusAdapter.ts`

**Intent**: Advance every planet independently on the existing active clock and ensure each landed-market operation uses the actual landed planet's authoritative market.

**Contract**: Generalize the market simulation to use each market's `planetId`, while retaining the shared commodity price curve; each crossed whole active-time second advances every market exactly once by that planet's configured production minus consumption. Generalize/rename the Seroton-named quote and transaction boundary so it resolves the market from the non-null `landedPlanetId`; a missing landed market is invalid, and a trade atomically changes only that market's stock plus shared ship cargo and credits. Projection rows, adapter bounds, and price ladders resolve that same landed market. The adapter's ladder stays transient, resets when a new landing begins, and rebuilds after a successful trade without adding UI state to the snapshot or typed port.

#### 3. Independent-market regression coverage

**Files**: `tests/domain/gameState.test.mjs`, `tests/domain/serotonMarket.test.mjs`, `tests/game-mechanics.test.mjs`, `tests/ui/componentsUiTest.ts`, `tests/ui/applicationUiTest.ts`, `tests/ui/fixtures/`

**Intent**: Replace the completed shared-market assertion with executable proof that market identity, deterministic time progression, and the existing landed workflow remain correct for every landable planet.

**Contract**: State/codec/provider tests cover initial complete market identity, JSON round trips, frozen immutable snapshots, and rejection of v15, missing, duplicate, or unknown market records. Replace the existing shared-market assertion with domain/application cases demonstrating quotes and trades route to the landed planet and leave every other market unchanged. Mechanics tests prove all markets advance by their own tuning on exact one-second boundaries, remain frozen for every pause reason, and produce identical market state through uninterrupted and restore-then-continue runs. Update fast UI/component and application coverage to verify the existing hub → Market → trade → Back → Launch flow on more than one planet, including immediate projection refresh from that planet's market. Do not add a Playwright test unless this routing cannot be proven by the existing lower-level and application coverage.

### Success Criteria:

#### Automated Verification:

- Codec, provider, and state tests prove every configured landable planet has one valid independent market, while obsolete shared snapshots and invalid market collections are rejected.
- Domain/application and mechanics tests prove a landed trade affects only that planet and all markets evolve deterministically on the common active clock, including restore continuity and pauses.
- Existing fast UI/application coverage proves the unchanged hub and market controls show and refresh the landed planet's market; `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

#### Manual Verification:

- Land on each currently landable planet, enter Market, make a trade, launch and return after active flight; each planet retains its own stock and price evolution, with no UI-flow regression.

**Implementation Note**: This is an authoritative state change. Follow `utils-add-state`: keep mutable stock in the snapshot, static profiles in definitions, updates through `GameStateProvider`, and no migration from the shared-market schema.

## Testing Strategy

Run focused domain, state, mechanics, and UI tests during each phase; then run `npm.cmd run test:project`, `npm.cmd run typecheck`, and `npm.cmd run build-nolog`. Verify the real browser interaction after code changes.

## Performance Considerations

The slider uses a visit-local derived price ladder. It is rebuilt only when landing or a confirmed trade changes the currently landed market, and never becomes authoritative state.

## Migration Notes

The market first changed the persisted shape from schema v4 to v5; Phase 6 changes the completed shared-market shape again. Each breaking schema revision rejects obsolete snapshots rather than implementing migration semantics.

## References

- Research: `context/changes/s04-first-planetary-trade/research.md`
- `context/foundation/prd.md`
- `src/game/mechanics/planet/landing.ts:5`
- `src/ui/adapters/landingStatusAdapter.ts:11`
- Phase 5 UI research: `context/changes/s04-first-planetary-trade/research.md`
- Frame: `context/changes/s04-first-planetary-trade/frame.md`
- `src/game/state/serotonMarketState.ts:9`
- `src/game/application/gameStateCodec.ts:255`
- `src/game/mechanics/gameSimulation.ts:84`
- `src/game/application/serotonMarket.ts:18`
- `src/game/application/landedMarket.ts:71`

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

### Phase 5: Full-Window Planet Hub and Shared Market Entry

#### Automated

- [x] 5.1 Domain/application and UI tests prove any landed planet can use the shared market, while unlanded trade remains invalid.
- [x] 5.2 Component and application tests prove hub-to-market-to-back navigation, focus handling, paused time, launch lifecycle, and disabled Shipyard behavior.
- [x] 5.3 Screenshot verification covers readable desktop and touch-landscape hub and market layouts, including reduced motion.

#### Manual

- [x] 5.4 Landing on each currently landable planet shows its own name over the shared Seroton landing artwork; Market trades successfully and BACK returns to the hub without resuming time.
- [x] 5.5 LAUNCH resumes flight, hides the dialog, and restores canvas control; Shipyard remains visibly unavailable.

### Phase 6: Independent Planetary Markets

#### Automated

- [ ] 6.1 State, definitions, codec, and provider tests prove complete independent per-planet markets and reject obsolete or invalid collections.
- [ ] 6.2 Domain, application, and mechanics tests prove landed routing, isolated trades, exact per-market active-time updates, pauses, and restored continuity.
- [ ] 6.3 UI and application coverage proves existing hub-market behavior refreshes the market for the actual landed planet without a presentation-state regression.

#### Manual

- [ ] 6.4 Every currently landable planet retains its own evolving market through a land-trade-launch-return loop.
