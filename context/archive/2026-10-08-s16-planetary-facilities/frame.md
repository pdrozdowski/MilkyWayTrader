# Frame Brief: Planetary facilities

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

After landing on any planet, a player needs to be able to inspect and invest in
its facilities, understand their operation, and see the resulting local trading
opportunities.

## Initial Framing (preserved)

- **User's stated cause or approach**: Facilities produce, consume, and transform
  commodities against each planet's shared stock; stock changes affect prices.
- **User's proposed direction**: Add a Facilities modal and automatic facility
  upgrades using the supplied five-commodity recipes and rates.
- **Pre-dispatch narrowing**: All three outcomes (investment, understandable
  operation, and changed market opportunities) are equally important; every
  configured planet is in scope. Facilities tick only during active flight,
  upgrades cost credits only, and Milk/Grain/Cheese/Bun/Space Ration replace the
  legacy placeholder commodity set everywhere.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Authoritative facility state** — persistent planet-local facility identity,
   level, status, and cycle state must fit the snapshot and codec.
2. **Commodity and stock model** — the market must contain the five requested
   commodities and let all facility flows affect the same traded stock.
3. **Active-time facility simulation** — recipe attempts must run atomically on
   40-second active-time boundaries and be frozen for every pause, including landing.
4. **Landed interaction contract** — the user needs a landed-only facility view
   while retaining a clear visible paused-clock state on landing screens.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Existing state boundary already has all-planet local economics. | `initialGameState.ts:34-37` creates one market per configured planet; `gameStateCodec.ts:259-287` requires exactly one; `serotonMarket.ts:18-24` routes actions through the landed planet. But `serotonMarketState.ts:10-14` has no facilities and schema v16 validation is exact (`gameStateCodec.ts:107-108`, `261-284`). | STRONG — compatible boundary, missing state. |
| Existing market can express the requested causal facility economy unchanged. | Prices derive from stock (`marketPricing.ts:8-21`; `landedMarket.ts:93-105`) and trades change that same stock (`serotonMarket.ts:63-88`). However the catalog is only `supplies/alloys/medicines` (`serotonMarketState.ts:3`; `serotonMarketCatalog.ts:3-10`) and the simulation is static net drift (`serotonMarketSimulation.ts:4-19`), not recipes. | STRONG — causal hook exists; current model is insufficient. |
| Existing active-time simulation provides the correct time semantics. | Crossed active seconds drive all markets (`gameSimulation.ts:81-85`); landing adds the landed pause (`planet/landing.ts:8-23`), and tests assert that pause freezes markets (`tests/game-mechanics.test.mjs:500-513`). The user confirmed ticking only during flight. | STRONG — preserve active-time, add cycle semantics. |
| Existing landing UI exposes facilities. | Landed identity and market gating already use `landedPlanetId` (`landingStatusAdapter.ts:58-75,91-103`), but Facilities is a disabled placeholder (`index.html:77`; `landingStatus.ts:42,80-84,146-178`) and the view union is only `hub | market` (`landingStatus.ts:49,61-62`). | STRONG — access guard exists; facility contract is absent. |

## Narrowing Signals

- The user confirmed that all configured planets, not a Seroton-only vertical
  slice, must expose the complete facility capability.
- The user confirmed 40-second cycles advance only during flight; existing pause
  behavior therefore matches the intended player-visible result.
- The user resolved the contradictory wording in the PRD and pasted brief:
  upgrades consume credits only, while commodity availability gates operation.
- The user confirmed the new five-commodity catalogue replaces placeholders
  globally, including market, cargo, salvage, and presentation consumers.

## Cross-System Convention

The completed independent-market change deliberately made the landed planet the
single local-market identity and requires each configured planet to retain an
independent evolving market (`context/archive/2026-09-26-s04-first-planetary-trade/plan.md:261-301`).
The facilities design reinforces that convention only if it changes shared local
stock rather than directly overriding prices. The architecture likewise assigns
the `GameStateSnapshot` and provider as the authoritative, atomic boundary
(`context/foundation/architecture.md:20-31`).

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: replace the temporary three-commodity,
> static per-second market model with a persistent, all-planet, five-commodity
> facility economy whose 40-second active-time recipe cycles atomically mutate the
> same local stock that drives trade prices, and make that state understandable in
> a landed-only facilities view.

This is not a modal-only enhancement: the requested catalogue replaces the
existing one across market, cargo, salvage, codec, and projections. The present
all-planet market routing, stock-derived pricing, active-time clock, and landed
pause are valid foundations and should be retained. Facility data and recipe
execution must become authoritative state rather than UI or Phaser state.

## Confidence

- **HIGH** — source evidence establishes all four dimensions, the user resolved
  the only material product ambiguities, and the reframe follows the project's
  existing independent-market and active-clock conventions.

## What Changes for /10x-plan

The plan must cover a coherent market-economy replacement: commodity catalogue,
definitions, authoritative facilities and codec, deterministic active-time recipe
simulation, all affected cargo/salvage/market projections, and landed facilities
UI with the paused clock visible. It must not treat the Facilities modal as an
isolated UI feature or introduce wall-clock ticking/direct price overrides.

## References

- Source files: `src/game/state/serotonMarketState.ts:3-14`,
  `src/game/application/gameStateCodec.ts:107-108,259-287`,
  `src/game/mechanics/gameSimulation.ts:81-85`,
  `src/game/mechanics/serotonMarketSimulation.ts:4-19`,
  `src/game/mechanics/planet/landing.ts:8-35`,
  `src/ui/components/landingStatus.ts:42-84,146-178`.
- Product scope: `context/foundation/prd.md` (US-08; FR-027–032).
- Supplied facility brief: `C:\\Users\\pdroz\\.codex\\attachments\\c8fc1d53-a93f-4c4a-8526-1f7c076ca294\\Pasted text.txt`.
- Investigation tasks: `/root/state_boundary`, `/root/economic_cycles`,
  `/root/landed_ui`.
