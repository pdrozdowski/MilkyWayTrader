# Frame Brief: Asteroid salvage

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Space should contain collectible individual commodities and destructible cargo
containers, while small asteroids can drop them.

## Initial Framing (preserved)

- **User's stated cause or approach**: Cargo holds 1-20 units of one commodity,
  orbits the star, can be used as orbital storage, and drops every contained
  unit as a loose item when destroyed. Loose commodity items move linearly,
  gradually toward the star, are collected by ship contact, and have zero
  acquisition price. Small asteroids have independent 10% cargo and 10% loose
  commodity drop chances; commodity odds are initially equal and tunable.
- **User's proposed direction**: Add cargo containers, loose commodity pickups,
  asteroid drops, a bidirectional transfer modal, durability/explosion feedback,
  and a full-cargo warning.
- **Pre-dispatch narrowing**: The main outcome is the combat-to-loot loop;
  orbital storage is a deliberately permitted side effect. Cargo must be part
  of session and saved state. This replaces the earlier salvage-crate design.
  A unit moved out of ship cargo preserves its acquisition price; a loose or
  newly dropped unit costs zero. A market transaction recomputes one weighted
  average and assigns it to all carried units of that commodity.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Salvage product contract** - the PRD still specifies expiring, freezable,
   manually opened crates rather than the requested persistent orbital cargo.
2. **Commodity cost-basis model** - the current stack average cannot preserve
   a unit's cost while it is stored outside the ship. <- initial framing
3. **Authoritative world lifecycle** - containers and loose items need stable
   IDs, motion, damage, contents, and active-time behavior in the snapshot.
4. **Asteroid destruction/drop boundary** - drops must happen exactly once on
   qualifying small-asteroid projectile destruction, not in visual diffing.
5. **World interaction projection** - item pickup, cargo range/modal, sun
   ingestion, and projectile exclusions need explicit simulation contracts.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| The older crate rules remain the contract | `prd.md:294-314` defines live/frozen crates, a 60-second lifetime, and shooting outcomes; the owner explicitly chose replacement. | STRONG |
| Existing cargo can preserve external-storage cost basis | `cargoState.ts:1-6` holds only a stack average; `serotonMarket.ts:53-70` has no per-unit provenance. | NONE |
| Snapshot lifecycle supports persistent loot entities | `gameStateSnapshot.ts:13-31`, `gameStateProvider.ts:13-44`, and `gameStateCodec.ts:98-125,234-314` already own/validate JSON-safe asteroids and cargo; the new collections are absent. | STRONG |
| The asteroid simulation provides the correct loot boundary | `asteroidSimulation.ts:91-114` and `gameSimulation.ts:240-318` deterministically resolve asteroid destruction, but no cargo/item roll exists. | STRONG |
| Phaser collision/projection can be the source of loot truth | `gameScene.ts:508-544` derives effects from asteroid-list diffs; this is presentation-only and unsuitable as the authoritative drop source. | NONE |

## Narrowing Signals

- The owner selected asteroid loot as the primary purpose; storage is permitted,
  not the feature to optimize around.
- The owner confirmed that the new model replaces live/frozen salvage crates.
- The owner clarified the accounting rule: provenance survives ship<->cargo
  transfer, while every market trade normalizes all carried units to its newly
  computed weighted average.

## Cross-System Convention

S-08 deliberately left salvage to S-09 (`context/archive/2026-10-01-s08-asteroid-combat/frame.md:38-56`).
The architecture requires simulation values that survive restoration to belong
to the snapshot, and treats Phaser objects as projections (`architecture.md`,
"Presentation ownership"). The revised requirement follows both conventions.

## Reframed Problem Statement

> **The actual problem to plan around is**: replace the obsolete salvage-crate
> contract with an authoritative, saveable asteroid-loot lifecycle that includes
> persistent orbital cargo and collectible zero-cost loose commodities, while
> extending cargo accounting enough to preserve cost basis across storage
> transfers and normalize it after each market trade.

This is not primarily a sprite, modal, or collider feature. It changes the
product salvage rules and the authoritative economy contract. Planning it as a
visual loot addition would leave saved state and average cost incorrect.

## Confidence

- **HIGH** - direct source evidence, the previous S-08 scope boundary, and the
  owner's decisive product and accounting choices agree.

## What Changes for /10x-plan

Plan the replacement salvage capability end-to-end: revise the relevant PRD
contract, establish the state/economy invariants first, then add deterministic
loot transitions and their world/UI/audio projections. Do not retain the
old crate expiry/freeze/shoot rules as a parallel mechanism.

## References

- `context/foundation/prd.md:294-314`
- `src/game/state/cargoState.ts:1-6`
- `src/game/application/serotonMarket.ts:53-70`
- `src/game/state/gameStateSnapshot.ts:13-31`
- `src/game/application/gameStateCodec.ts:98-125,234-314`
- `src/game/mechanics/asteroid/asteroidSimulation.ts:35-65,91-114`
- `src/game/mechanics/gameSimulation.ts:240-318`
- Investigation tasks: `/root/cargo_state_audit`, `/root/cargo_world_audit`
