# S-08 follow-up: Asteroid durability and collision feedback

## Overview

Implement the confirmed durability and collision-presentation rules as one state-to-presentation vertical slice.

## Phase 1: Authoritative durability and collision mechanics

### Changes Required

- Extend `AsteroidState`, initial state, and the versioned codec with JSON-safe persisted hit points; increment schema without migration.
- Add authoritative tuning for BIG/MEDIUM/SMALL durability, planet collision penetration, and star ingestion radius.
- Update pure asteroid/game simulation: projectile hits decrement durability before fragmenting; boosted ship collisions enter the existing Moolaris control-lock path; planet collisions fragment at the deeper boundary; star collisions pull non-fragmented asteroids toward center until culling at half radius.
- Add focused domain and mechanics tests for durability, restore, all boundary/collision rules, and no HP damage.

### Automated Verification

- `npm.cmd run test:domain`, `npm.cmd run test:mechanics`, and `npm.cmd run typecheck` pass.

### Manual Verification

- Confirm health bars, boosted-ship warning, planet impact effect, and visible star ingestion.

## Phase 2: Projection and collision feedback

### Changes Required

- Extend asteroid projection with compact HP bars and star-underlay depth behavior.
- Add a bounded planet-impact visual effect and wire it from committed collision transitions without affecting the existing fragmentation or star behavior.
- Add focused object/audio/presentation tests where isolated seams permit it.

### Automated Verification

- `npm.cmd run test:objects`, `npm.cmd run test:audio`, and `npm.cmd run typecheck` pass.

### Manual Verification

- Confirm asteroid health readability and collision-specific visual behavior.

## Phase 3: Integrated validation

### Automated Verification

- `npm.cmd run test:fast`, `npm.cmd run typecheck`, and `npm.cmd run build-nolog` pass.

### Manual Verification

- Perform the player-facing acceptance pass.
