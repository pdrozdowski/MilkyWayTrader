# S09 Asteroid Salvage — Plan Brief

> Full plan: [plan.md](plan.md)  
> Framing: [frame.md](frame.md)  
> Research: [research.md](research.md)

## What and Why

Small asteroids become a meaningful loot source. Players collect loose commodities and can use a destructible orbital cargo container as temporary storage. Cost belongs to the particular container holding the commodity, never an inferred historical unit or a global pool.

## Locked Decisions

| Topic | Decision |
| --- | --- |
| Final small-asteroid projectile drop | One result only: 10% cargo, 10% loose item, 80% none. |
| Asteroid cargo | One uniformly selected commodity, 1–20 units, zero total cost. |
| Accounting | Independent weighted-average `{ quantity, totalCost }` containers. |
| Transfer | Proportional source cost; exact residual for complete move/final spill item. |
| Cargo | Star-centred orbit; projectile-only 2 HP; 20px activation; 15px collider. |
| Loose item | 15px collider; ejection→sun vector blend in 10 active seconds; no boundary cull. |
| Interaction | Range opens a paused modal; Close resumes and suppresses until departure. |
| Capacity | Failed loose pickup: `WARNING - CARGO IS FULL` for two seconds. |

## Scope

Included: strict state/codec model, deterministic lifecycle, transfer UI, state-driven projections, approved effects, and focused tests.

Excluded: durable persistence/migrations (S11), historical item lots, legacy crates, orbital direct market sales, final asset review, and Playwright.

## Architecture and Sequence

Snapshot state owns cargo and loose-item truth. Pure mechanics owns active-time movement, random outcomes, collision consequences, and cost movement. Phaser/DOM only project state and dispatch intents.

1. Update PRD, state schema/codec, and ship-market accounting.
2. Add exclusive seeded loot, orbital/loose simulation, damage, pickup, sun consumption, and capacity outcomes.
3. Add projections, activation/HP feedback, placeholders, cargo frames, and scoped audio.
4. Wire modal/warning and finish focused validation.

## Validation

- State/domain: schema rejection, round-trip, weighted averages, transfer residuals, market P/L.
- Mechanics: 10/10/80 outcome, orbit/blend timing, damage and collision rules.
- Object/audio/UI-controller: state-driven lifecycle, effects, pause/reopen suppression, disabled controls, warning expiry.
- Integration gate: `npm.cmd run typecheck` and `npm.cmd run test:fast`.

## Risks to Preserve

- Cargo and loose item never co-spawn from one asteroid death.
- Zero-cost loss stays local; it cannot change the ship's average.
- Exact residual handling prevents cost loss through floating-point arithmetic.
- Physical salvage remains snapshot-complete; only Close suppression is transient.
