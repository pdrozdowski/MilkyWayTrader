# S09 Asteroid Salvage Implementation Plan

## Overview

Replace the legacy crate flow with collectible loose commodities and destructible orbital cargo. Small-asteroid salvage becomes authoritative game state, and transfers preserve correct weighted-average cost within each independent commodity container.

The latest product decisions supersede conflicting earlier wording in the frame/research: asteroid loot rolls are mutually exclusive, and accounting is container-based rather than per-unit, FIFO/LIFO, or globally pooled.

## Current State Analysis

- `GameStateSnapshot` owns JSON-safe run and world truth; `gameStateCodec.ts` strictly validates its schema.
- Ship cargo and market logic currently use aggregate cargo price data, so they need one reusable `{ quantity, totalCost }` commodity-container primitive.
- `gameSimulation.ts` already owns deterministic active-time world progression and asteroid destruction, making it the boundary for seeded loot, movement, sun consumption, and removal.
- `landingStatus` is the existing pattern for a proximity-driven paused modal; cargo needs the same scene-to-UI direction plus per-visit Close suppression.
- Asteroid fragmentation supplies the ejection-direction visual language. Simulation owns vectors; projections must not invent gameplay state.

## Desired End State

A final projectile hit on a small asteroid chooses exactly one result: 10% orbital cargo, 10% one loose commodity item, or 80% none. Asteroid-spawned cargo holds 1–20 units of one uniformly chosen commodity at zero total cost. It orbits the star, has two projectile-only HP, opens a paused transfer modal within 20px, and spills its contents when destroyed.

Loose items have a 15px collider, linearly transition in ten seconds of active time from their asteroid-style ejection vector to a sun-directed vector, and can only be collected by the ship or consumed at the sun. They never get world-boundary culled. A capacity-failed pickup shows `WARNING - CARGO IS FULL` for two seconds only.

Each holder is an independent weighted-average container: one ship container per commodity, every orbital cargo container, and every loose one-unit item. It stores `quantity` and `totalCost`; average is derived. Purchases add paid cost to the ship, free loot adds zero, transfers move source-proportional cost, complete transfers move the exact residual, and sales use the ship container only.

## Key Discoveries

- [`src/game/state/gameStateSnapshot.ts`](../../../src/game/state/gameStateSnapshot.ts) is the authoritative snapshot boundary, so cargo and loose items belong there rather than in Phaser objects.
- [`src/game/state/gameStateCodec.ts`](../../../src/game/state/gameStateCodec.ts) rejects unsupported data; S09 should schema-bump and reject old snapshots instead of adding a premature migration.
- [`src/game/mechanics/gameSimulation.ts`](../../../src/game/mechanics/gameSimulation.ts) is the single owner of active-time asteroid and sun lifecycle transitions.
- [`src/game/scenes/gameScene.ts`](../../../src/game/scenes/gameScene.ts) composes state, scene input, and UI adapters; it should project salvage state and relay intents without duplicate truth.
- [`context/foundation/lessons.md`](../../foundation/lessons.md) prohibits snapshot migrations before persistence maturity; durable save/load stays in S11.

## What We Are Not Doing

- Durable save/load plumbing or backward snapshot migration.
- Historical per-unit lots, FIFO/LIFO sale selection, or global averaging across ship and orbital storage.
- Legacy frozen/live crates, contact damage to cargo, projectile damage to loose items, or direct market trading from orbital cargo.
- Final asset review beyond approved cargo frames, approved sound effects, and existing 32×32 placeholder commodity icons.
- Playwright tests: authoritative state, mechanics, audio, and controller behavior have cheaper focused coverage.

## Implementation Approach

Establish the PRD contract and a schema-versioned state model first. Then add deterministic loot and active-time lifecycle mechanics. Build Phaser/audio projections from that truth. Finally wire the paused transfer UI and transient warning, followed by focused validation.

## Critical Implementation Details

- Define `CommodityContainerState` as `commodityId`, `quantity`, and `totalCost`; derive average as `totalCost / quantity` for non-empty containers and normalize empty containers to zero total cost.
- A partial move transfers `movedQuantity * sourceAverage`; a full move transfers the source's exact remaining `totalCost`. On spill, allocate proportional one-unit costs and assign the final item the residual.
- Purchases and sales affect ship containers only. Free loot has zero cost. Loss removes proportional cost from the affected container only, never from an unrelated ship container.
- Draw one seeded outcome on final small-asteroid projectile destruction: cargo `[0, .10)`, loose `[.10, .20)`, otherwise none. Never make two independent rolls.
- Cargo follows the planet star-centred orbit convention using `round(radius * 300000 / 1902.6)`. Loose motion blends creation 100%→0% and sun 0%→100% linearly in ten active seconds.
- Close records a transient suppression latch for that cargo ID until ship exit. The pause reason is authoritative; the UI latch is session interaction state and not persisted.
- Bump the snapshot schema and reject legacy cargo data. Do not silently reinterpret it.

## Phase 1: Product Contract, State Schema, and Container Economics

### Changes Required

1. **Write the S09 capability contract**
   - Files: `context/foundation/prd.md`.
   - Replace legacy crate/cargo wording with capabilities for exclusive loot, independent weighted-average containers, transfer, pickup, and loss.
   - After editing, run `.agents/skills/10x-prd-en-capability/SKILL.md` through its deterministic and semantic validation.

2. **Model all commodity holders at the state boundary**
   - Files: `src/game/state/`, `src/game/state/gameStateSnapshot.ts`, `src/game/state/gameStateCodec.ts`, initial-state factories, and focused tests.
   - Add JSON-safe container, orbital-cargo (ID, position, orbit data, HP, container), and loose-item (ID, position, motion state, one-unit container) structures. Replace ship cargo accounting with this primitive, schema-bump, and strictly validate it.
   - Use `.agents/skills/utils-add-state/SKILL.md` for this authoritative state, timer, and codec work.

3. **Make market accounting use the ship container**
   - Files: market/economy application modules, landed-market adapters/views, and domain tests.
   - Derive display average from `totalCost`; implement paid buys, sales, zero-cost additions, partial/full transfer, and permanent loss with proportional-cost rules.

### Success Criteria

#### Automated

- Focused state/domain tests round-trip the complete S09 model, reject the prior schema, and preserve totals through partial/full transfers and spill residuals.
- Market tests prove free pickup changes only the ship container it enters and selling uses that container's weighted average.
- PRD capability validation has no deterministic or semantic findings.

#### Manual

- A reviewer can trace quantity and total cost separately in ship, one orbital cargo, and one loose item without hidden per-unit history.

## Phase 2: Deterministic Asteroid Loot and World Lifecycle

### Changes Required

1. **Add tuning and deterministic spawn transitions**
   - Files: mechanics/object definitions, `src/game/mechanics/gameSimulation.ts`, asteroid lifecycle helpers, seeded-random tests.
   - On final small-asteroid projectile destruction select cargo, loose item, or none at 10%/10%/80%. Uniformly select a commodity; asteroid cargo gets a uniform 1–20 quantity and zero cost.

2. **Implement active-time cargo and loose-item simulation**
   - Files: cargo/commodity mechanics modules, shared vector helpers, simulation tests.
   - Advance star-centred cargo orbit, allow only projectile damage, reveal 50% health at one HP, and spill on the second hit. Advance loose-item vector blending, pickup, and sun consumption; omit other collisions and boundary culling.

3. **Provide pure interaction intents and capacity results**
   - Files: mechanics/application intent handlers and tests.
   - Provide deterministic transfer, pickup, and destruction outcomes so UI can disable impossible actions and warn without owning a state mutation.

### Success Criteria

#### Automated

- Seeded mechanics tests cover all three exclusive branches, cargo bounds, zero-cost cargo, two-hit projectile destruction, and no contact damage.
- Motion tests prove cargo orbit and the ten-second vector blend only progress in active game time.
- Pickup/capacity tests prove loose items cannot be shot, only interact with ship/sun, and remain unchanged on full-ship pickup.

#### Manual

- Replaying a fixed seed gives the same loot type, commodity, quantity, vectors, and transitions.

## Phase 3: Phaser Projections, Visual Feedback, and Audio

### Changes Required

1. **Create state-driven salvage projections**
   - Files: `src/game/objects/cargo/`, `src/game/objects/commodity/`, object definitions, `src/game/scenes/gameScene.ts`, object tests.
   - Use `.agents/skills/utils-add-object-to-scene/SKILL.md` to create ID-driven cargo and loose-item projections with 15px colliders; projections never own gameplay truth.

2. **Render cargo affordances**
   - Files: cargo projection/visual helpers and orbit-indicator rendering.
   - Loop `cargo_32x32.png` for 0.2 seconds then `cargo2_32x32.png` for one second, render the 20px activation affordance in planet-orbit style, and show a 50% bar only at one HP.

3. **Connect approved effects and placeholders**
   - Files: `src/game/audio/definitions/`, scene/object audio scopes, icon registrations, audio tests.
   - Use `.agents/skills/utils-add-sound/SKILL.md`. Play `asteroid_crash_metal_clean.wav` on cargo destruction and `sun_asteroid_low_slurp_loud_no_noise.wav` on sun consumption; render existing 32×32 commodity placeholders.

### Success Criteria

#### Automated

- Object/audio tests prove projections follow salvage IDs, frames/assets load, and effects are scoped and cleaned up.

#### Manual

- Cargo orbits, shows activation and one-HP feedback, flips at the approved cadence, spills on destruction, and loose icons fade at sun consumption.

## Phase 4: Paused Transfer Modal, Warning, and Completion Validation

### Changes Required

1. **Build the cargo transfer UI**
   - Files: `src/ui/`, `index.html`, `public/style.css`, scene-to-UI adapters, controller tests.
   - Entering range auto-opens a vertical modal and pauses active time. Show quantities/averages and bidirectional controls; disable transfer-to-cargo when full and transfer-to-ship when ship capacity is exhausted. Close resumes and suppresses that cargo until exit/re-entry.

2. **Add transient full-cargo feedback**
   - Files: UI warning controller/adapter and tests.
   - A capacity-failed loose pickup shows exactly `WARNING - CARGO IS FULL` for two seconds, never for other outcomes, and it is not persisted.

3. **Validate at the correct level**
   - Run focused domain, mechanics, objects, and audio suites, then `npm.cmd run typecheck` and `npm.cmd run test:fast`. Do not add Playwright unless a browser-only risk passes the repository admission gate.

### Success Criteria

#### Automated

- UI/controller tests prove entry pauses time, Close resumes, re-open suppression lasts to exit, capacity disables the correct control, and warning expiry is two seconds.
- `npm.cmd run typecheck` and `npm.cmd run test:fast` pass after integration.

#### Manual

- A player collects loot, stores it orbitally, destroys cargo, sees individual spill items, and observes independent ship/cargo averages throughout.

## Testing Strategy

Use focused Node tests for codec/container arithmetic, seeded simulation, projection lifecycle, audio registration, and UI/controller behavior. Keep random draws and active-time progression injectable/seeded. Do not add Playwright unless a true browser-only journey remains after lower-level coverage.

## Migration and Compatibility

S09 intentionally breaks the snapshot schema. The codec rejects older snapshots rather than migrating legacy aggregate cargo data. Durable persistence is deferred to S11.

## Progress

### Phase 1: Product Contract, State Schema, and Container Economics

- [x] P1-A: Focused state/domain tests round-trip the complete S09 model, reject the prior schema, and preserve totals through partial/full transfers and spill residuals. — e261da9
- [x] P1-B: Market tests prove free pickup changes only the ship container it enters and selling uses that container's weighted average. — e261da9
- [x] P1-C: PRD capability validation has no deterministic or semantic findings. — e261da9
- [ ] P1-D: A reviewer can trace quantity and total cost separately in ship, one orbital cargo, and one loose item without hidden per-unit history.

### Phase 2: Deterministic Asteroid Loot and World Lifecycle

- [x] P2-A: Seeded mechanics tests cover all three exclusive branches, cargo bounds, zero-cost cargo, two-hit projectile destruction, and no contact damage. — cc43ea1
- [x] P2-B: Motion tests prove cargo orbit and the ten-second vector blend only progress in active game time. — cc43ea1
- [x] P2-C: Pickup/capacity tests prove loose items cannot be shot, only interact with ship/sun, and remain unchanged on full-ship pickup. — cc43ea1
- [ ] P2-D: Replaying a fixed seed gives the same loot type, commodity, quantity, vectors, and transitions.

### Phase 3: Phaser Projections, Visual Feedback, and Audio

- [x] P3-A: Object/audio tests prove projections follow salvage IDs, frames/assets load, and effects are scoped and cleaned up. — 8ea2133
- [ ] P3-B: Cargo orbits, shows activation and one-HP feedback, flips at the approved cadence, spills on destruction, and loose icons fade at sun consumption.

### Phase 4: Paused Transfer Modal, Warning, and Completion Validation

- [x] P4-A: UI/controller tests prove entry pauses time, Close resumes, re-open suppression lasts to exit, capacity disables the correct control, and warning expiry is two seconds.
- [x] P4-B: `npm.cmd run typecheck` and `npm.cmd run test:fast` pass after integration.
- [ ] P4-C: A player collects loot, stores it orbitally, destroys cargo, sees individual spill items, and observes independent ship/cargo averages throughout.
