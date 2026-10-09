# S-05 Planet Ship Services — Plan Brief

> Full plan: `context/changes/s05-planet-ship-services/plan.md`
> Frame brief: `context/changes/s05-planet-ship-services/frame.md`
> Research: `context/changes/s05-planet-ship-services/research.md`

## What & Why

Deliver S-05's landed shipyard services for repairs and three independent planet-specific upgrade paths, with the specified progression, costs, projectile spreads, and fixed-speed booster unlock. Players need a coherent way to repair and specialize their ship while landing pauses the active clock.

## Starting Point

The run state already has hit points, cargo/engine/weapon levels, and booster ownership, but no purchase operations apply them. The landing dialog has Market and Facilities as local views while Shipyard is disabled; normal flight is fixed at 240 and every weapon cadence beat creates one forward projectile.

## Desired End State

Shipyard opens on every landed planet. Repairs are available everywhere; Cargo Capacity is purchasable only on Seroton, Engine System and booster only on Lactozis-7C, and Weaponary System only on Maslo-Prime. State and UI update immediately after a successful purchase, and weapon levels create exact symmetric volleys.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Cargo service | Seroton only | Each upgrade category is available on one planet. | Frame |
| Engine and booster | Lactozis-7C only | Booster belongs to the engine service and is a separate 75,000 purchase. | Frame |
| Weaponary service | Maslo-Prime only | Keeps weapon progression on its dedicated planet. | Frame |
| Shipyard access | Every landed planet | Repairs remain accessible while unavailable upgrades identify their service planet. | Plan |
| Engine scope | Player-directed normal flight only | Recovery, impact, Moolaris, and boost retain their current base-speed behavior. | Plan |
| Volley identity | `projectile-<volley>-<projectile>` | One cadence beat remains one volley while every simultaneous shot has a stable unique ID. | Plan |
| Weapon geometry | Exact parity-specific degree offsets | This preserves the approved level patterns even where angular width narrows. | Frame |

## Scope

**In scope:**

- Repair, Cargo, Engine, Weaponary, and booster catalogues and atomic landed purchases.
- Engine normal-flight progression and deterministic weapon volleys.
- Shipyard application projection, adapter, component view, labels, styles, and focused tests.

**Out of scope:**

- Facilities, broader asteroid combat and salvage changes, booster fuel, snapshot migration, and Playwright tests.

## Architecture / Approach

Definition-backed service catalogues feed pure landed quote/apply reducers at the existing state-provider boundary. The game simulation reads purchased levels for ordinary movement and projectile generation; the landing adapter projects Shipyard state into a fourth local DOM view.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Catalogue and operations | Balance rules, validation, atomic purchases | Credits, caps, and planet gates must agree. |
| 2. Mechanics | Normal-flight scaling and deterministic volleys | Stable IDs and fixed non-directed speeds. |
| 3. Shipyard UI | Local view, actions, unavailable-service messaging | Immediate projection refresh and focus behavior. |
| 4. Regression verification | Focused automated and manual acceptance | Cross-layer contracts must remain aligned. |

**Prerequisites:** S-04 landing flow and existing state/weapon mechanics.
**Estimated effort:** ~3–4 implementation sessions across four phases.

## Open Risks & Assumptions

- Existing level-one snapshots use the revised level-one cargo capacity without a migration.
- Shipyard’s numeric values intentionally omit a currency suffix, while other UI formatting remains unchanged.
- No browser-only behavior justifies Playwright coverage; domain and DOM tests provide the required regression signal.

## Success Criteria (Summary)

- Every service applies only at its designated location, with repairs available everywhere and correct disabled states.
- Purchased upgrades immediately change cargo capacity, ordinary flight, or volley behavior according to the catalogue.
- Focused state, mechanics, DOM tests, and TypeScript type checking pass.
