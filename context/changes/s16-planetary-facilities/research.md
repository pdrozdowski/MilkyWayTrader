---
date: 2026-10-08T12:57:57+02:00
researcher: Codex
git_commit: 2a03146528d47294b8f6a21d2e3793c891fffa53
branch: main
repository: MilkyWayTrader
topic: "S16 planetary facilities: authoritative facility economy, five-commodity catalogue, and landed interaction"
tags: [research, facilities, economy, state, market, landing]
status: complete
last_updated: 2026-10-08
last_updated_by: Codex
last_updated_note: "Recorded the horizontal UI, initial facility levels, and planet-specific upgrade discounts."
---

# Research: S16 planetary facilities

**Date**: 2026-10-08T12:57:57+02:00
**Researcher**: Codex
**Git Commit**: 2a03146528d47294b8f6a21d2e3793c891fffa53
**Branch**: main
**Repository**: MilkyWayTrader

## Research Question

What code and product contracts must S16 preserve or replace to deliver all-planet, persistent facilities whose 40-second active-time recipes change shared market stock and whose landed view supports credit-paid upgrades?

## Summary

In the inspected v16 aggregate, the codec requires one mutable market record for each configured planet, and a landed trade atomically changes that planet's stock, cargo, and credits (`src/game/application/gameStateCodec.ts:259-287`; `src/game/application/serotonMarket.ts:44-88`). S16 should extend that aggregate with planet-local facility state, replace the static per-second market drift with deterministic 40-second recipe cycles, and retain stock-derived price calculation rather than assigning prices from facilities (`src/game/mechanics/serotonMarketSimulation.ts:4-19`; `context/changes/s16-planetary-facilities/frame.md:31-34`).

The frame names a replacement catalogue of five commodities, which reaches stock validation, market UI, salvage, and commodity-object presentation (`context/changes/s16-planetary-facilities/frame.md:19-21`; `src/game/application/gameStateCodec.ts:185-209`; `src/game/mechanics/salvage/asteroidLoot.ts:66-77`; `src/game/objects/commodity/commodity.ts:103-109`). The landing dialog is the established presentation seam: it needs a `facilities` view and an application projection/command contract, not a Phaser scene or a second authoritative location state (`context/archive/2026-09-26-s04-first-planetary-trade/research.md:65-72`; `src/ui/components/landingStatus.ts:48-64`).

Two product choices remain for planning: any operational-output modifier beyond the defined upgrade-price discounts, and deterministic same-cycle recipe ordering. The initial facilities state, three planet-specific upgrade discounts, and in-dialog paused-clock treatment are now user-decided in this document. No implementation, plan approval, or lifecycle change is implied by this research.

## Detailed Findings

### Authoritative state and catalogue boundary

- `GameStateSnapshot` is the versioned authoritative aggregate and currently contains the `markets` collection, cargo, orbital cargo, and loose items (`src/game/state/gameStateSnapshot.ts:15-34`). `GameStateProvider` validates its initial input, reducer outputs, restores, and snapshots through the codec (`src/game/application/gameStateProvider.ts:13-36`). Facility identity, level, and operation status therefore belong in JSON-safe snapshot state, while recipes and balance values belong in static definitions.
- In the inspected v16 decoder, the root shape is exact and the version must be `16`; market decoding requires one record per configured planet and one stock entry per catalogue commodity (`src/game/application/gameStateCodec.ts:20-31`, `src/game/application/gameStateCodec.ts:100-108`, `src/game/application/gameStateCodec.ts:259-287`). Adding facilities requires a schema revision, initial-state construction, codec validation, and matching state tests.
- The project lesson says not to add snapshot migrations before sufficient application maturity (`context/foundation/lessons.md:18-23`). This agrees with the inspected decoder's old-version rejection, so planning should reject obsolete snapshots rather than introduce a v16 migration.
- The current canonical market IDs are `supplies`, `alloys`, and `medicines` (`src/game/state/serotonMarketState.ts:3-14`; `src/game/domain/serotonMarketCatalog.ts:3-10`). S16's frame makes Milk, Grain, Cheese, Bun, and Space Ration the replacement catalogue (`context/changes/s16-planetary-facilities/frame.md:19-21`). The supplied brief gives base prices of 100, 150, 300, 250, and 1,250 credits respectively (`C:/Users/pdroz/.codex/attachments/c8fc1d53-a93f-4c4a-8526-1f7c076ca294/Pasted text.txt:56-70`).
- Generic ship cargo and loose-item decode paths accept a non-empty commodity ID, whereas orbital-cargo manifests are checked against the current catalogue (`src/game/application/gameStateCodec.ts:125-135`, `src/game/application/gameStateCodec.ts:185-209`). A unified five-commodity invariant is a plan choice; the current asymmetry should not be preserved accidentally.
- Salvage draws from the commodity-definition array, so a canonical catalogue replacement propagates to loose drops and manifests (`src/game/mechanics/salvage/asteroidLoot.ts:66-77`; `src/game/mechanics/salvage/cargoManifest.ts:13-38`). Commodity-object presentation has explicit three-ID textures with a fallback (`src/game/objects/commodity/commodity.ts:103-109`; `src/game/objects/commodity/definition.ts:4-17`), requiring corresponding five-commodity visual handling.

### Causal facility simulation and investment

- The simulation first advances the shared clock and returns before market simulation when no active time advanced; the current market reducer receives crossed active seconds (`src/game/mechanics/gameSimulation.ts:61-85`). Landing adds the `landed` pause reason and launch removes it (`src/game/mechanics/planet/landing.ts:7-35`). The existing mechanics suite covers no change for `background`, `landed`, `manual`, `menu`, and `orientation` pauses (`tests/game-mechanics.test.mjs:456-513`).
- The inspected static reducer applies `(productionPerSecond - consumptionPerSecond) * elapsedSeconds` to each stock value and clamps at zero (`src/game/mechanics/serotonMarketSimulation.ts:4-19`). It cannot represent input-dependent transformations and must be replaced, rather than combined with facility flows.
- A cycle count derived as `floor(nextActiveElapsedMs / 40000) - floor(previousActiveElapsedMs / 40000)` uses the same restorable active-time boundary as the current simulation. The 40-second period is specified by the frame and supplied brief (`context/changes/s16-planetary-facilities/frame.md:31-34`; `C:/Users/pdroz/.codex/attachments/c8fc1d53-a93f-4c4a-8526-1f7c076ca294/Pasted text.txt:72-90`).
- Prices already derive from stock and rounded marginal trade prices (`src/game/domain/marketPricing.ts:8-32`). A landed trade atomically changes credits, cargo, and the current planet's selected stock (`src/game/application/serotonMarket.ts:44-88`). Facilities should mutate stock through this model and must not directly set price.
- The supplied recipes are Cheese: two Milk to one Cheese, Bun: two Grain to one Bun, and Space Ration: two Cheese plus one Bun plus one Milk to one Space Ration (`C:/Users/pdroz/.codex/attachments/c8fc1d53-a93f-4c4a-8526-1f7c076ca294/Pasted text.txt:56-70`). Its successful-operation wording and the frame's atomicity requirement support an all-or-nothing recipe attempt; an unavailable input leaves that facility's stock changes unapplied and marks it insufficient (`context/changes/s16-planetary-facilities/frame.md:31-34`).
- Upgrade prices are credits: dairy/grain 25,000 then 75,000; cheese/bakery 35,000 then 100,000; processor 50,000 then 150,000 (`C:/Users/pdroz/.codex/attachments/c8fc1d53-a93f-4c4a-8526-1f7c076ca294/Pasted text.txt:72-90`). The newer frame governs the older PRD wording about a required resource investment by explicitly narrowing S16 upgrades to credits (`context/changes/s16-planetary-facilities/frame.md:49-53`; `context/foundation/prd.md:205-210`).
- User decision: every configured planet starts with Dairy Farm level 1, Grain Farm level 1, Cheese Factory level 1, Bakery level 0, and Food Processor level 0. The level-zero Bakery and Food Processor render as Not Built and use Build; the three level-one facilities render as built and use Upgrade. This establishes S16 construction scope without adding a separate per-planet initial-state exception.
- User decision: upgrade-price specializations apply a 20% discount to the configured upgrade price for Cheese Factory on Seroton, Dairy Farm on Maslo-Prime, and Grain Farm on Lactozis-7C. These are price modifiers for the named facility/planet pairs; they do not define an output or recipe-rate modifier.

### Landed facilities interaction

- The existing full-screen landing dialog is visible when `landedPlanetId` is non-null and maintains presentation-local `hub` and `market` views (`src/ui/components/landingStatus.ts:48-64`). The Facilities hub button is disabled and has no click handler in the inspected markup/component (`index.html:77`; `src/ui/components/landingStatus.ts:81-84`, `src/ui/components/landingStatus.ts:163-178`).
- The landing adapter derives eligibility from authoritative `landedPlanetId`, resets transient market selection on landing, and rejects trade while unlanded (`src/ui/adapters/landingStatusAdapter.ts:58-85`). Facilities should reuse that identity and introduce semantic facility commands through the typed UI/application boundary (`src/ui/contracts.ts:7-78`; `src/game/application/landedMarket.ts:44-101`).
- Launch remains the action that ends landing, clears flight input through `landing-modal-transition`, and returns focus to the canvas (`src/ui/adapters/landingStatusAdapter.ts:117-128`; `src/ui/components/landingStatus.ts:145-153`). Hub-to-facilities and facilities-to-hub navigation should remain presentation-only transitions.
- Enabled visible dialog controls enter the existing Tab trap automatically (`src/ui/components/landingStatus.ts:56-76`, `src/ui/components/landingStatus.ts:140-153`). A facilities view should set focus to its first meaningful interactive control when opened and retain the existing canvas-focus return on launch.
- The HUD's `#run-status` has z-index 3 while the full landing dialog has z-index 5 and an opaque surface, so its existing PAUSED indicator is obscured during landing (`public/style.css:157-161`). The facilities/landing composition must expose an accessible paused-clock indicator within the visible dialog or deliberately revise stacking; merely preserving the HUD projection does not satisfy the frame's visible-paused-clock requirement.

### Accepted horizontal facilities UI direction

The user supplied this layout direction for the S16 plan. It is a product/UI decision, rather than evidence inferred from the current implementation:

- The existing landing dialog gains a presentation-local Facilities view. Its top navigation places Back to Planet and the paused clock on the left, then credits and ship cargo on the right. Returning to the hub is not a launch transition.
- The upper 30% of the landing composition is unobstructed planet-themed artwork, with the navigation bar overlaid at its top. The lower 70% is the facility-management area. This resolves the previously open paused-clock presentation question: the Facilities view renders the clock itself while the authoritative `landed` pause reason remains unchanged.
- The management area presents one horizontal row of five equal-width, equal-height cards at the target game resolution, without horizontal scrolling. The cards represent Dairy Farm, Grain Farm, Cheese Factory, Bakery, and Food Processor.
- Each card uses the existing cartoon UI language and commodity icons, aligns operational status, the 40-second production period, modifier, and recipe information at common vertical positions, and anchors its action to the bottom. Multi-line recipes may wrap within the card while the card height remains fixed.
- Cards render authoritative game data: level, production and consumption quantities, planet modifier, configured price, and operating status. Working, Insufficient Resources, and Not Built are distinct visible states. A built facility offers Upgrade with the next level and its credit price, disabled when unaffordable; an unbuilt facility offers Build with its configured credit price; level three renders Max Level in place of an upgrade action.
- Opening the Facilities view occurs while landing has already paused gameplay and economy updates. Facility cycles resume automatically when the player launches and active time advances; the view does not create an additional timer or pause mechanism.

### Validation scope

- State and codec tests must cover the revised schema, exact collection identity, detached snapshots, and old-schema rejection; the existing focused state coverage uses legacy catalogue assumptions (`tests/domain/gameState.test.mjs:236-389`).
- Domain/application tests should cover stock-price causality, landed-only credit-paid upgrades, insufficient-credit rejection, and that an upgrade changes only the landed planet's facility state and credits. Mechanics tests should cover the 40-second boundary, multi-cycle advancement, every existing pause reason, restore continuity, unsuccessful atomic recipe attempts, and selected ordering behavior.
- Browser coverage is justified only for a player-visible landing-to-facilities journey that cannot be proven through the component/application boundary. Calculation, state, and recipe rules remain lower-level test risks under `context/foundation/testing.md:3-22` and the repository Playwright admission gate.

## Architecture Insights

The architecture assigns `GameStateSnapshot` and `GameStateProvider` as the aggregate and atomic replacement boundary, places pure economy in domain/mechanics, and keeps DOM components on typed ports (`context/foundation/architecture.md:7-36`, `context/foundation/architecture.md:45-60`). The resulting S16 seam is: static facility definitions and commodity pricing profiles; JSON-safe planet-local facilities and market stock in the snapshot; pure active-time facility reducers; landed application projections and commands; then a presentation-local facilities view.

## Historical Context (from prior changes)

- Supported: S04 chose the landed dialog as the market presentation seam and maintained hub/market navigation as presentation-local (`context/archive/2026-09-26-s04-first-planetary-trade/research.md:65-72`). That seam remains compatible with S16.
- Contradicted for current scope: S04's three-commodity and Seroton-specific decisions are replaced by the S16 frame's five commodities and all configured planets (`context/archive/2026-09-26-s04-first-planetary-trade/research.md:51-59`; `context/changes/s16-planetary-facilities/frame.md:19-21`, `context/changes/s16-planetary-facilities/frame.md:49-53`).
- Supported: the completed independent-market work requires each configured planet to retain an evolving local market, which facilities can affect through the same stock (`context/archive/2026-09-26-s04-first-planetary-trade/plan.md:261-301`).

## Related Research

- `context/archive/2026-09-26-s04-first-planetary-trade/research.md`
- `context/changes/s16-planetary-facilities/frame.md`

## Open Questions

- Resolved by the user: each configured planet begins with Dairy Farm, Grain Farm, and Cheese Factory at level 1, plus Bakery and Food Processor at level 0. Upgrade-price specializations are 20% off Cheese Factory on Seroton, Dairy Farm on Maslo-Prime, and Grain Farm on Lactozis-7C. Any operational-output modifier remains undefined; the plan must either define one or record that the current S16 specialization is price-only.
- The sources do not define same-cycle ordering when facilities compete for inputs or one facility's output could supply a later facility. A fixed documented definition order with sequential atomic recipe attempts is a deterministic candidate, but it is a decision rather than a sourced requirement.
- The brief calls unavailable output both non-produced and constrained. This research treats a recipe attempt as all-or-nothing because the frame requires atomic mutation; the plan should record that resolution explicitly.
- Resolved by the user: level-zero Bakery and Food Processor are constructed through the Facilities view, while the three level-one facilities start built. The frame's credits-only decision governs both Build and Upgrade costs.
- Resolved by the user-provided horizontal UI direction: the Facilities view renders the paused clock in its top navigation bar while the existing `landed` pause reason governs gameplay and the economy.
