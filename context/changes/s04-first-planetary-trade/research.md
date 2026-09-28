---
date: 2026-09-26T00:00:00+02:00
researcher: Codex
git_commit: 45d42e8cfd8e2783bda8a2b7ee7bd0094a0aa482
branch: main
repository: MilkyWayTrader
topic: "S-04 first Seroton planetary market and trade"
tags: [research, economy, market, landing, ui]
status: complete
last_updated: 2026-09-26
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
