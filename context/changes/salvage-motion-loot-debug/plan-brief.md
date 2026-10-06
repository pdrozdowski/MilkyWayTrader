# Smooth Salvage Motion, Deterministic Cargo Drops, and Debug Spawn — Plan Brief

> Full plan: [plan.md](plan.md)
> Frame brief: [frame.md](frame.md)

## What & Why

Loose-item projection currently synchronizes a dynamic Phaser body from
authoritative state every update, making its movement visibly choppy. This
change separates display from simulation, makes cargo availability predictable
for players, and adds a practical debug path for manual salvage testing.

## Starting Point

Loose commodity simulation is already authoritative and active-time based, but
its projection owns a dynamic Arcade body unlike asteroid rendering. Cargo loot
uses a single 10% random branch and the debug dialog only supports teleport and
control toggles.

## Desired End State

Loose commodities move smoothly at a 30%-lower starting speed. Every sequence
of five eligible small-asteroid projectile kills has exactly one cargo drop,
and the existing debug menu can create a normal, nearby cargo container.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Smooth movement | Presentation-only commodity projection | Phaser no longer competes with snapshot truth. | Frame |
| Ejection speed | 126 units/second | This is a 30% reduction from 180. | Plan |
| Cargo cadence | Seeded shuffled `[0,1,0,0,0]` cycles | Guarantees one cargo per five eligible kills without losing loose-item chances. | Frame |
| Debug contents | Random commodity and 1–20 quantity | Exercises normal zero-cost cargo behavior. | Plan |
| Compatibility | Schema bump, reject old snapshots | Repository policy prohibits premature migrations. | Frame |

## Scope

**In scope:** authoritative loot schedule, loose-item projection/tuning, debug
spawn intent, focused regression tests, and matching PRD capability update.

**Out of scope:** Phaser-owned collision state, save migration, changed cargo
durability or quantity bounds, and Playwright tests.

## Architecture / Approach

The snapshot stores the remaining seeded schedule and RNG state. Mechanics
consumes it at final small-asteroid projectile kills; objects render state only;
the debug DOM control emits an event that the scene turns into a provider update.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Schedule | Persisted guaranteed cargo cadence | Deterministic RNG and schema integrity |
| 2. Motion and debug | Smooth projection and nearby debug cargo | Keeping state authoritative |
| 3. Validation | Focused regression proof | Cross-layer regressions |

**Prerequisites:** Existing S09 salvage implementation.
**Estimated effort:** ~2–3 sessions across 3 phases.

## Open Risks & Assumptions

- The cargo schedule is consumed only by final small-asteroid projectile kills.
- A new seeded shuffled cycle is created whenever the previous cycle is empty.

## Success Criteria (Summary)

- Loose commodities render smoothly with a 126-unit initial velocity.
- Every five eligible kills produce exactly one cargo while zero slots retain a
  10% loose-item chance.
- Debug-spawned cargo is 100px forward from the ship and behaves like normal
  salvage.
