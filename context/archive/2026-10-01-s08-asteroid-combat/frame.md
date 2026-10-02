# Frame Brief: Asteroid combat

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

New feature: a hit must produce an understandable reaction and destruction, and
fragmentation must be part of the audiovisual experience. Maintaining asteroid
population is out of scope for this change.

## Initial Framing (preserved)

- **User's stated cause or approach**: No cause or implementation approach was supplied.
- **User's proposed direction**: Deliver S-08, “Fight and fragment asteroids,” from the roadmap.
- **Pre-dispatch narrowing**: Limit the work to hit reaction and destruction; fragmentation is an audiovisual requirement; this is a new feature, not a regression; population maintenance is excluded.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Projectile-hit resolution** — the simulation must identify a struck target rather than merely remove a projectile.
2. **Asteroid gameplay representation** — a destroyable asteroid and its fragments need an individual, authoritative lifecycle; the initial scope implicitly assumes one exists.
3. **Feedback lifecycle** — a hit and fragmentation need transient visual/audio feedback that is reconciled and cleaned up with the scene.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Projectile hit resolution discards the target and outcome. | `advanceProjectiles` removes a projectile after `some(...)` obstacle hit, while `CircleObstacle` has only geometry; the scene provides Moolaris as the sole obstacle. [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:51), [geometry.ts](../../../src/game/world/geometry.ts:1), [gameScene.ts](../../../src/game/scenes/gameScene.ts:379) | STRONG |
| Existing asteroids are individual combat entities. | The belt has static visual entries and scene images, but no snapshot state, IDs, hit tests, destruction API, or fragment lifecycle. [asteroidBelt.ts](../../../src/game/visual/asteroidBelt.ts:24), [asteroidBelt.ts](../../../src/game/effects/asteroidBelt.ts:12), [gameStateSnapshot.ts](../../../src/game/state/gameStateSnapshot.ts:11) | NONE |
| The application can host discrete audiovisual destruction feedback. | Scene-owned audio scopes clean up voices; projectiles demonstrate state-to-object reconciliation and cleanup. No asteroid impact or fragmentation hook exists yet. [audioScope.ts](../../../src/game/audio/audioScope.ts:94), [shipWeapon.ts](../../../src/game/objects/spaceship/shipWeapon.ts:18), [gameScene.ts](../../../src/game/scenes/gameScene.ts:92) | PARTIAL |

## Narrowing Signals

- The requested player-visible behavior is reaction, destruction, and audiovisual fragmentation—not population replenishment.
- This is a new capability, so there is no production symptom to attribute to an existing component.
- S-09 owns salvage; it is not an outcome of this change.

## Cross-System Convention

The project already separates authoritative gameplay state from transient Phaser projections. The earlier flight slice explicitly defined the outer belt as a decorative projection with no snapshot records, colliders, projectile targets, damage, loot, or replenishment. [S-02 plan](../../archive/2026-09-23-s02-direct-moving-system-flight/plan.md:133) This independently confirms that the combat system must not mutate or reinterpret that belt.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: establish a distinct authoritative asteroid-combat lifecycle that can identify projectile targets, resolve destruction and size-based fragmentation, and project those outcomes as clear audiovisual feedback—without turning the decorative belt into gameplay or adding replenishment or salvage.

The original outcome is valid, but the existing asteroid visuals cannot be incrementally made destructible: they were intentionally built outside gameplay state and collision. The plan must treat projectile impact semantics, asteroid/fragment lifecycle, and presentation feedback as one player-visible capability while keeping explicitly deferred concerns out of scope.

## Confidence

- **HIGH** — three independent inspections agree, and the archived S-02 contract explicitly confirms the separation between decorative belt and future asteroid gameplay.

## What Changes for /10x-plan

Plan the new authoritative combat-asteroid capability rather than a collision toggle on `AsteroidBelt`. Include only projectile destruction/fragmentation and its audiovisual signal; exclude replenishment and salvage, despite the broader roadmap-risk wording.

## References

- [Roadmap S-08](../../foundation/roadmap.md:159)
- [PRD combat rules](../../foundation/prd.md:257)
- [Archived S-02 belt contract](../../archive/2026-09-23-s02-direct-moving-system-flight/plan.md:133)
- Investigation tasks: `/root/combat_simulation`, `/root/asteroid_representation`, `/root/combat_feedback`
