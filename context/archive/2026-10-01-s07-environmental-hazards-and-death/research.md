---
date: 2026-10-02T17:52:13+02:00
researcher: Codex
git_commit: 7a2c181112473b7cb653e5928b038e0658ef5819
branch: main
repository: MilkyWayTrader
topic: "S07 environmental hazards, death, and retained terminal results"
tags: [research, hazards, death, state, supabase]
status: complete
last_updated: 2026-10-02
last_updated_by: Codex
---

# Research: S07 environmental hazards, death, and retained terminal results

**Date**: 2026-10-02T17:52:13+02:00  
**Researcher**: Codex  
**Git Commit**: `7a2c181112473b7cb653e5928b038e0658ef5819`  
**Branch**: `main`  
**Repository**: MilkyWayTrader

## Research Question

What current contracts and gaps govern the framed S07 journey: environmental
collision damage, one-way death, end-game presentation, and retained terminal
results containing outcome, active survival time, and final liquid cash?

## Summary

The inspected collision path is deterministic and currently produces asteroid
fragmentation plus presentation feedback, while its assertion keeps ship HP
unchanged. Moolaris currently suppresses input and forces escape movement, but
does not record a discrete impact. [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:186)
[game-mechanics.test.mjs](../../../tests/game-mechanics.test.mjs:529)

The active-run snapshot, codec, and scene have no terminal outcome contract.
Consequently, S07 needs an authoritative, idempotent terminal boundary before a
scene can safely display or persist a death result. [gameStateSnapshot.ts](../../../src/game/state/gameStateSnapshot.ts:12)
[gameScene.ts](../../../src/game/scenes/gameScene.ts:369)

The inspected Supabase foundation retains telemetry, not game results. A retained
result needs a new application/storage boundary; telemetry cannot supply its
authoritative active survival time or durability guarantee. [telemetry.ts](../../../src/game/application/telemetry/telemetry.ts:40)
[20260929183000_create_game_events.sql](../../../supabase/migrations/20260929183000_create_game_events.sql:5)

## Detailed Findings

### Collision and damage contract

- When active time advances, asteroid impacts are ordered by swept-contact time,
  asteroid ID, and source ID; a ship contact removes/fragments the asteroid,
  repels the ship at configured flight speed, and writes a 500 ms control lock.
  [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:207)
  [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:186)
- In the inspected S08 boundary test, a committed ship collision preserves the
  current ship HP and records an impact timestamp for presentation. [game-mechanics.test.mjs](../../../tests/game-mechanics.test.mjs:529)
- The current tuning declares asteroid radii and asteroid durability, but no
  size-to-ship-damage values. PRD requires size-based asteroid damage; its
  numeric allocation remains unresolved. [gameplayTuning.ts](../../../src/game/definitions/gameplayTuning.ts:21)
  [prd.md](../../foundation/prd.md:278)
- For a ship inside the current Moolaris control radius, the contact helper
  forces outward velocity and suppresses control. It has no persisted impact or
  separation marker. The PRD specifies one sun hit of 80% maximum HP followed
  by separation before another hit. [contact.ts](../../../src/game/mechanics/moolaris/contact.ts:12)
  [prd.md](../../foundation/prd.md:278)

### Active-run and terminal lifecycle

- `GameStateSnapshot` is a JSON-safe active-run aggregate. At this revision, its
  root contains clock, resources, ship, world, weapon, projectile, and asteroid
  data, but no terminal outcome or final-result field. [gameStateSnapshot.ts](../../../src/game/state/gameStateSnapshot.ts:12)
- The codec enforces the aggregate's root shape and validates `currentHitPoints`
  in the inclusive 0-to-maximum range. Zero HP is representable but has no
  terminal semantics. [gameStateCodec.ts](../../../src/game/application/gameStateCodec.ts:89)
  [gameStateCodec.ts](../../../src/game/application/gameStateCodec.ts:127)
- Each active `Game` update invokes the simulation and reconciles projections.
  The active scene therefore needs a terminal guard that prevents later ticks
  from changing a resolved run or issuing duplicate persistence work. [gameScene.ts](../../../src/game/scenes/gameScene.ts:369)
- `GameOver` is registered but currently renders a literal label and transitions
  to MainMenu after pointer input; the present game exit also starts MainMenu.
  Neither route carries an immutable result payload. [game/main.ts](../../../src/game/main.ts:34)
  [gameOverScene.ts](../../../src/game/scenes/gameOverScene.ts:14)
  [gameScene.ts](../../../src/game/scenes/gameScene.ts:328)
- Architecture assigns the provider atomic state ownership, pure mechanics, and
  projection-only Phaser scenes. Terminal facts that must survive display and
  storage belong at the authoritative boundary, not in a scene-local effect.
  [architecture.md](../../foundation/architecture.md:20)

### Retained results and database boundary

- The inspected migration creates `public.game_events` for telemetry, enables
  RLS, revokes browser table access, and schedules 90-day telemetry retention.
  It defines no finished-result relation. [20260929183000_create_game_events.sql](../../../supabase/migrations/20260929183000_create_game_events.sql:5)
  [20260929183000_create_game_events.sql](../../../supabase/migrations/20260929183000_create_game_events.sql:30)
- The current authentication port can expose an access token, while the browser
  adapter obtains it from the Supabase session. This supports server-derived
  ownership for an authenticated result write; no result-specific port or
  transport currently exists. [auth.ts](../../../src/game/application/auth/auth.ts:10)
  [browserAuth.ts](../../../src/ui/adapters/browserAuth.ts:34)
- Telemetry's `session_ended` records wall-clock duration and credits with
  best-effort delivery. It is not a substitute for the authoritative
  `clock.activeElapsedMs`, terminal outcome, or durable result retention.
  [telemetry.ts](../../../src/game/application/telemetry/telemetry.ts:40)
  [telemetry.ts](../../../src/game/application/telemetry/telemetry.ts:84)
- Local UI tests reset Docker Supabase from repository migrations and can use an
  isolated authenticated test session. They can validate a future browser
  integration without using a remote project; mechanics and storage contracts
  remain lower-level test candidates. [testing.md](../../foundation/testing.md:31)
  [testSessionFixture.ts](../../../tests/ui/testSessionFixture.ts:7)

## Architecture Insights

- Preserve the state boundary: state declarations remain readonly and JSON-safe;
  mechanics determine collision and terminal transitions; scenes reconcile a
  committed result; adapters own browser and external-service access. [architecture.md](../../foundation/architecture.md:9)
- The snapshot codec is strict. Any terminal state represented in the active-run
  aggregate requires a coordinated schema/version/codec/test update. The project
  lesson prohibits adding snapshot migrations before application maturity.
  [gameStateCodec.ts](../../../src/game/application/gameStateCodec.ts:89)
  [lessons.md](../../foundation/lessons.md:15)
- Testing guidance places damage thresholds, state transitions, immutability, and
  serialization in fast Node suites. Browser coverage is appropriate only for a
  player journey that lower-level tests cannot expose. [testing.md](../../foundation/testing.md:5)

## Historical Context

- **Supported:** S08 deliberately left ship HP unchanged while establishing
  deterministic asteroid collision/fragmentation; its archived plan calls HP,
  death, and terminal consequences S07 concerns. [S08 plan](../../archive/2026-10-01-s08-asteroid-combat/plan.md:24)
- **Supported:** roadmap S14 is restricted to removing an active save after a
  retained terminal result; it does not define public ranking. [roadmap.md](../../foundation/roadmap.md:235)
- **Partial:** the current roadmap sequences S12 personal-best and S13 global
  high-score views after save/resume, while the confirmed S07 scope retains a
  result but excludes ranking/navigation. This is consistent with the split, but
  persistence availability still depends on the authentication policy below.
  [roadmap.md](../../foundation/roadmap.md:209)

## Related Research

No prior `research.md` for this change was present at the start of this research.
The framing evidence is in [frame.md](./frame.md).

## Open Questions

1. What numeric ship damage applies to BIG, MEDIUM, and SMALL asteroid contacts?
2. Does the sun's 80%-of-maximum damage trigger at its physical surface or at
   the existing control radius, and which separation boundary re-arms it?
3. When a simulation tick contains multiple ship-asteroid contacts, does S07
   apply one deterministic impact or cumulative damage before terminalization?
4. The PRD says signed-in players retain results and anonymous play has no
   persistent result, whereas the framed requirement says every terminal result
   is stored. Which policy governs anonymous death results? [prd.md](../../foundation/prd.md:344)
5. Which authorization and delivery contract should retain a result: a controlled
   function with server-derived owner, or a direct RLS policy; and how does the
   end screen disclose a failed retained-result write?
