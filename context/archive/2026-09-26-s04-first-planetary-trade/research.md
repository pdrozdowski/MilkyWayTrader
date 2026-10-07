---
date: 2026-09-26T00:00:00+02:00
researcher: Codex
git_commit: 45d42e8cfd8e2783bda8a2b7ee7bd0094a0aa482
branch: main
repository: MilkyWayTrader
topic: "S-04 first Seroton planetary market and trade"
tags: [research, economy, market, landing, ui]
status: complete
last_updated: 2026-09-28
last_updated_by: Codex
---

# Research: S-04 first Seroton planetary market and trade

## Research Question

How should the first landed market work, be presented in the UI, and be divided into coherent implementation phases?

## Summary

The existing landing lifecycle already supplies a landed-only, active-time-paused seam. S-04 needs a new authoritative Seroton market model, pure economic rules, and an expansion of the existing DOM landing dialog; it does not need a Phaser scene or a separate overlay.

## Detailed Findings

### Landing and active-time seam

- `tryLandAtCapturedPlanet` records the landed planet, stops ship motion, and adds the `landed` pause reason (`src/game/mechanics/planet/landing.ts:5`).
- `advanceGameSimulation` derives its active delta from the shared clock and returns before world simulation when that delta is zero (`src/game/mechanics/gameSimulation.ts:61`).
- The existing landing adapter projects `landedPlanetId` into the DOM modal and launches through the provider (`src/ui/adapters/landingStatusAdapter.ts:11`).

### Economy and state seam

- The snapshot already owns credits and generic commodity cargo stacks, but it has no market stock, commodity definitions, prices, or transaction reducer (`src/game/state/gameStateSnapshot.ts:10`, `src/game/state/cargoState.ts:1`).
- The provider is the atomic immutable update boundary (`src/game/application/gameStateProvider.ts:19`); market trades must update credits, cargo, and stock through one reducer.
- The strict codec validates the exact snapshot shape and rejects unsupported schemas (`src/game/application/gameStateCodec.ts:77`); adding market state needs a schema increment without a snapshot migration.

### UI and lifecycle seam

- The landed DOM dialog is already visible only while landed and is marked to ignore game input (`index.html:57`, `src/ui/components/landingStatus.ts:11`).
- The game menu demonstrates the required focus trap and focus return behavior for a modal with interactive controls (`src/ui/components/gameMenu.ts:10`).
- The run-status projection already updates credits and cargo from provider subscriptions (`src/game/application/runStatus.ts:24`).

## Architecture Insights

Persist mutable Seroton stock in `GameStateSnapshot`; keep commodity definitions, thresholds, and balance tuning static. Keep marginal-price ladders and selected slider state transient in the UI adapter. Domain calculation and validation stay pure; the DOM emits semantic trade intent only.

## Historical Context

- S-03 supplies capture, landing, launch, and the landed pause boundary (`context/changes/s03-guided-orbit-and-landing/plan.md`).
- S-02 established active-time-driven simulation and presentation separation (`context/archive/2026-09-23-s02-direct-moving-system-flight/plan.md`).

## Related Research

`context/changes/s03-guided-orbit-and-landing/research.md`

## Decisions Recorded for Planning

- S-04 offers a live market only on Seroton.
- Supplies, alloys, and medicines are the first commodity catalogue.
- Seroton updates stock once per active second; a trade sums discrete marginal unit prices and has no sales tax.
- A selected-commodity, centered slider sells leftward and buys rightward. It clamps cargo and stock bounds, but shows unaffordable purchases as invalid.
- The transient price cache is rebuilt at landing and after every confirmed trade.

## Phase 5 Follow-up: Planet Hub UI

### Landing hub and modal lifecycle

- The inspected landing dialog is visible for a non-null `landedPlanetId`, while its market projection currently grants eligibility only when that id is `seroton` (`src/game/application/landedMarket.ts:69-97`). The temporary Phase 5 decision supersedes the earlier Seroton-only rule: every currently landable planet uses the existing shared Seroton market until planet-specific market changes are planned.
- The landing component currently hard-codes `SEROTON MARKET`, immediately renders the trade controls, focuses the quantity slider on entry, traps Tab within its one dialog, and restores canvas focus after launch (`src/ui/components/landingStatus.ts:14-125`). A hub and market are therefore presentation-local views of that dialog, not nested dialogs or authoritative state.
- The adapter already preserves the authoritative launch path through `launchFromPlanet` and emits `landing-modal-transition` for the scene to clear flight input (`src/ui/adapters/landingStatusAdapter.ts:96-100`; `src/game/scenes/gameScene.ts:104-110`). Hub-to-market and Back navigation must not emit that transition.

### UI-system audit

- `index.html:57-70` mounts the market workflow as the landing dialog and `public/style.css:108-115` styles it as a capped, scrolling, centered card. This prevents the requested full-window landing composition and place selection.
- The CSS root exposes surface, border, overlay, and focus values, while selected, border, and status values are repeated as literals in the landed-market rules (`public/style.css:1`, `118`, `120`, `126-138`). Phase 5 should add semantic action, danger, disabled, and title-outline tokens before adding a red Launch control.
- Landing and game-menu buttons repeat comparable button geometry and action styling (`public/style.css:113`, `143`). A shared in-repository action style is the smallest reusable component contract for the new landing rail.
- The supplied visual asset is `public/assets/landing_bg_seroton.png`; it is present in this worktree and should be tracked with the Phase 5 implementation.

### Phase 5 decisions

- The hub fills the available viewport with a visual column and a fixed 200px action rail. The visual column uses the supplied Seroton artwork, a contrast scrim, and the actual landed planet name.
- The title reveal uses CSS stepped character animation and respects `prefers-reduced-motion`; assistive technology receives the full heading rather than partial animated text.
- Shipyard is shown as disabled and marked unavailable. Market opens the existing trade view; Back returns to the hub; Launch remains the sole action that ends landing.
