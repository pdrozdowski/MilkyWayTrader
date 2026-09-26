# S-04 First Seroton Planetary Trade — Plan Brief

> Full plan: `context/changes/s-04/plan.md`
> Research: `context/changes/s-04/research.md`

## What & Why

S-04 turns the first landing into a meaningful economic decision: the player trades supplies, alloys, or medicines at Seroton before launching again. It proves the core loop connecting direct flight, landing, paused planning, cargo, credits, and local stock.

## Starting Point

Landing already supplies an authoritative landed pause and a DOM dialog, while credits and cargo already belong to the immutable game snapshot. No market state or economics rules currently exist.

## Desired End State

At Seroton, players select one commodity and use a centered slider to sell cargo or buy stock. The UI previews marginal totals and stock/price impact, blocks invalid confirmations, and updates the market, cargo, and credits immediately after a valid trade.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Market scope | Seroton only | Keeps the first proof slice focused. | Plan |
| Catalogue | Supplies, alloys, medicines | Provides low, medium, and high-value choices. | Plan |
| Market timing | One active-time second | Gives visible market movement while respecting pause semantics. | Plan |
| Transaction pricing | Marginal unit sum, no sales tax | Makes the stock slider's impact exact and readable. | Plan |
| Trade control | Selected-commodity centered slider | Supports buy and sell in one responsive control. | Plan |

## Scope

**In scope:** Seroton stock, commodity definitions, pure economy rules, schema-v5 validation, active-time ticks, landed market projection, and responsive accessible trade UI.

**Out of scope:** Other planetary markets, shipyard services, persistence backend work, sales tax, and snapshot migration.

## Architecture / Approach

Static definitions provide commodity tuning; authoritative Seroton stock lives in the snapshot; pure reducers calculate ticks and trades; the provider commits atomic changes; a typed UI adapter projects read-only market data into the existing landing dialog.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Authoritative economy | State, codec, definitions, and trade rules | Schema and atomicity correctness |
| 2. Simulation and projection | One-second ticks and landed-market port | Pause/restore continuity |
| 3. Accessible market | Slider, previews, interaction, and tests | Focus and small-screen usability |

**Prerequisites:** S-03 acceptance and the revised PRD/roadmap economics contract.
**Estimated effort:** ~3 focused implementation sessions across 3 phases.

## Open Risks & Assumptions

- The explicit schema-v5 boundary rejects old snapshots; no migration is included.
- A visit-local price cache remains safe because landing pauses active-time ticks and is invalidated after each successful trade.

## Success Criteria (Summary)

- A landed player on Seroton can complete a valid buy or sale and immediately see stock, cargo, and credits update.
- The same prices and stock outcomes result from uninterrupted and restored active-time simulation.
- The market remains usable by keyboard and at desktop and touch viewport sizes.
