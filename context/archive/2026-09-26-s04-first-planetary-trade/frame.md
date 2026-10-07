# Frame Brief: Independent Planetary Markets

> Framing step before refining the implementation plan. This document separates
> the requested outcome from the previously intentional shared-market slice.

## Reported Observation

The working market is currently a single shared market, even when the player
lands on different planets.

## Initial Framing (preserved)

- **User's stated cause or approach**: Independent planetary markets affect the state model and planetary update-cycle loop; the UI can remain unchanged but must read and write the right instance state.
- **User's proposed direction**: Refine S-04 so each planet has an independent market.
- **Pre-dispatch narrowing**: Every currently landable planet must always have its own distinct stock and prices; all markets evolve with global active game time while the player is away; commodities remain the same, while stock, production, and consumption are per planet.

## Dimension Map

The observation could originate at these dimensions:

1. **Authoritative market identity and persistence** — the aggregate and codec may only represent one Seroton market.
2. **Static economic definitions and active-time simulation** — all persisted markets may receive Seroton's common rates rather than planet-specific rates.
3. **Landed-market command and projection routing** — trade, quote, bounds, and read models may choose Seroton rather than the actual landed planet.  ← initial framing

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Snapshot/codec cannot represent an independent market for every landable planet | `serotonMarketState.ts:9-13` fixes `planetId` to `seroton`; `initialGameState.ts:34-37` seeds one market; `gameStateCodec.ts:255-274` requires one Seroton market; `gameState.test.mjs:308-320` locks shared behavior. | STRONG |
| Economy/simulation use only Seroton economic tuning | `gameSimulation.ts:84-85` advances every stored market on global active-time boundaries, but `serotonMarketSimulation.ts:1-17` imports Seroton definitions; `serotonMarketDefinitions.ts:15-18` is the sole source of initial stock and rates. | STRONG |
| Landed-market operations route to shared Seroton state | `landedMarket.ts:71-115` exposes the actual landed planet while reading Seroton stock; `serotonMarket.ts:18-79` quotes and mutates Seroton; `landingStatusAdapter.ts:26-45,95` derives bounds and confirms through that same shared path. | STRONG |

## Narrowing Signals

- The user confirmed the scope is all currently landable planets, not a visual label correction or a Seroton-only variation.
- The user confirmed all markets must continue to evolve during active flight, ruling out a visit-only or landed-only market lifecycle.
- The user confirmed commodity identities remain shared, while initial stock, production, and consumption vary by planet.

## Cross-System Convention

The authoritative aggregate owns mutable market stock; definitions own static tuning; the active clock drives deterministic restoration-safe updates; the provider commits atomic trades. This matches `context/foundation/architecture.md` and `context/foundation/testing.md`. The existing implementation deliberately violates the new product goal only because Phase 5 explicitly retained "one authoritative shared stock and price model" (`plan.md:210-214`), not because the UI requires a shared market.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Replace the deliberately temporary, Seroton-identified shared-market aggregate with one complete market state per configured landable planet, driven by a common active-time clock and selected consistently by the landed planet across simulation, pricing, trades, projections, and validation.

The UI layout and local hub/market navigation are not the problem and should remain presentation-local. The common commodity catalogue can remain static, but the definition layer must associate planet-specific initial stock, production, and consumption with each market. Since global active-time simulation already maps all markets, the plan should preserve that timing model rather than create per-planet clocks.

## Confidence

- **HIGH** — the exact shared-market behavior is structurally enforced and explicitly tested; the user supplied decisive scope and lifecycle signals; the existing global-time iteration matches the desired away-from-planet behavior.

## What Changes for /10x-plan

The refined plan should supersede Phase 5's shared-market contract with an authoritative market-identity, codec, and static-per-planet economy change. It must route all existing quotes, transactions, price-ladder bounds, and projections through `landedPlanetId`, add exact per-market active-time coverage, and preserve the current UI contract without adding UI state to the snapshot.

## References

- `src/game/state/serotonMarketState.ts:9-13`
- `src/game/definitions/initialGameState.ts:34-37`
- `src/game/application/gameStateCodec.ts:255-274`
- `src/game/mechanics/gameSimulation.ts:84-85`
- `src/game/mechanics/serotonMarketSimulation.ts:1-17`
- `src/game/application/serotonMarket.ts:18-79`
- `src/game/application/landedMarket.ts:71-115`
- `src/ui/adapters/landingStatusAdapter.ts:26-45,95`
- `tests/domain/gameState.test.mjs:308-320`
- `context/foundation/architecture.md`
- `context/foundation/testing.md`
- Investigation tasks: `/root/state_identity`, `/root/simulation_economy`, `/root/trade_projection`
