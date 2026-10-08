# S16 Planetary Facilities - Plan Brief

> Full plan: `context/changes/s16-planetary-facilities/plan.md`
> Frame brief: `context/changes/s16-planetary-facilities/frame.md`
> Research: `context/changes/s16-planetary-facilities/research.md`

## What & Why

Replace the temporary three-commodity, static per-second market with a persistent, all-planet, five-commodity facility economy whose recipes run every active second and mutate the same local stock that drives prices, and make that state understandable and investable in a landed-only Facilities view. Facilities never set prices directly; they change supply and demand through real commodity flows.

## Starting Point

`GameStateSnapshot` v16 holds one market per configured planet with an exact-shape codec and old-version rejection; prices already derive from stock versus thresholds; a landed trade atomically changes stock, cargo, and credits; and every pause already freezes all time-driven state. The landed dialog has `hub` and `market` views, with Facilities present only as a disabled button with no handler. The `supplies|alloys|medicines` catalogue is duplicated across roughly ten files, and no milk/grain/cheese/bun/spaceRation art exists.

## Desired End State

On any of the three planets a player lands, opens Facilities, reads each facility's level, per-cycle recipe, planet modifier and operating state, then builds or upgrades with credits. When the player launches, every planet's facilities attempt their recipes each active second against that planet's shared stock, so prices shift and trading opportunities appear and disappear.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Commodity catalogue | Milk, Grain, Cheese, Bun, Space Ration everywhere | Replaces the legacy placeholder set across market, cargo, salvage, presentation | Frame |
| Recipe / level capacity | Brief table, doubling per level (dairy/grain 10/20/40; cheese/bakery/processor 5/10/20) | Matches the table that also defines the upgrade prices | Plan |
| Cycle cadence | Full recipe each active second, all-or-nothing | Your explicit answer; keeps integer stock | Plan |
| Same-cycle order | Fixed order dairy -> grain -> cheese -> bakery -> processor | Deterministic, matches existing fixed-order convention | Plan |
| Planet specialization | 20% upgrade-price discount and +20% output for the specialized pair | Creates real inter-planet divergence for the frame's trading-opportunity outcome | Plan |
| Economy scale | Keep base prices; rescale stock thresholds and initial stock upward | Facility output is 40x the brief's per-40s table, so thresholds must grow with it | Plan |
| Initial stock | Differentiated per planet around the specialization | Creates an opening arbitrage route | Plan |
| Commodity icons | Five new 32x32 placeholder PNGs | Deterministic across platforms, consistent with the asset pipeline | Plan |
| Salvage pool | Uniform over all five commodities | Simplest; matches the replace-everywhere decision | Plan |
| Upgrades | Credits only, max level 3, discount on both steps | Frame narrows upgrades to credits | Frame |
| Old snapshots | Rejected, no migration | Project lesson: no snapshot migrations before maturity | Research / Lessons |

## Scope

**In scope:** the five-commodity catalogue and its rescaled balance; five facility definitions with recipes, levels, prices and planet modifiers; per-planet facility state in the snapshot with a schema bump; the per-second facility cycle mechanism; the landed Facilities view; the affected cargo, salvage, HUD, and telemetry surfaces.

**Out of scope:** snapshot migration; base-price changes; ship, repair, or shipyard changes; new telemetry event types; PRD edits; regenerating `code-graph.json` / `data-logical-diagram.md`; new Playwright journeys.

## Architecture / Approach

Static definitions hold the commodity price profiles and the facility recipes, levels, prices and modifiers. JSON-safe per-planet facility state joins the existing per-planet economy record in the snapshot. A pure mechanics reducer applies sequential, all-or-nothing cycles on the existing active-time boundary. Landed application projections and commands sit behind the existing typed UI port, and the Facilities view is presentation-local, mirroring the market view.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Commodity catalogue replacement | Five commodities everywhere, rescaled balance, drift removed | Wide blast radius across roughly twenty files |
| 2. Commodity presentation | Five icons, labels, market/cargo surfaces, object textures | Missing art; DOM row count changes |
| 3. Facility state and definitions | Recipes, levels, prices, snapshot v17, build/upgrade commands | Codec validation must stay exact |
| 4. Facility cycle simulation | Per-second sequential atomic cycles | Ordering and multi-cycle determinism |
| 5. Landed Facilities view | The five-card view with the paused clock | Layout at target resolution; focus and Tab trap |

**Prerequisites:** S-04 landed-market work in place; local Node and Chromium available for the pipeline runs.
**Estimated effort:** roughly five sessions across five phases.

## Open Risks & Assumptions

- Phases 1-2 have no automatic market evolution until phase 4 supplies it - an intentional intermediate state.
- Upgrade affordability depends on the rescaled prices and remains a balance tunable.
- Placeholder-only art means the visual identity of the five commodities is intentionally provisional.

## Success Criteria (Summary)

- A landed player can read all five facilities, their recipes, modifiers and states, and build or upgrade them with credits.
- Facility cycles visibly change local stock, and the resulting prices change trading opportunities.
- Nothing advances while landed; everything resumes on launch.