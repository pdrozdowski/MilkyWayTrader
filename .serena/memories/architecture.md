# Architecture

`context/foundation/architecture.md` owns code boundaries and dependency direction; `context/foundation/testing.md` owns test policy.

## Layers and allowed dependencies

| Layer | Location | May depend on |
| --- | --- | --- |
| State | `src/game/state/` | state only |
| Domain | `src/game/domain/` | domain only |
| Application | `src/game/application/` | state, domain, application |
| World | `src/game/world/` | world only |
| Mechanics | `src/game/mechanics/` | state, definitions, mechanics, world |
| Phaser objects | `src/game/objects/` | mechanics, world, visual, audio adapters |
| Effects / visual | `src/game/effects/`, `src/game/visual/` | Phaser, world |
| Scenes | `src/game/scenes/` | game-facing adapters, read-only state |
| Audio | `src/game/audio/` | Phaser only at the adapter edge |
| DOM UI | `src/ui/` | application view models or UI contracts; concrete game services only in adapters |

Dependencies point toward pure state: state and domain import nothing outward, application supplies Phaser/DOM/network/time/randomness as ports, and scenes wire systems rather than calculate business rules. `src/main.ts` is the composition root; `src/game/main.ts` creates Phaser and game-owned services and never imports DOM UI.

## Presentation ownership

- `GameStateSnapshot` is the versioned aggregate for the active run; `GameStateProvider` is its sole owner and atomic replacement boundary. Scenes submit reducers and render detached readonly snapshots.
- Current aggregate: authoritative clock, ship, planet, weapon cadence, projectile sequence and projectile state. Input intent, camera state, audio settings, effects and cleanup handles are transient and never persisted; static tuning stays in `src/game/definitions/`.
- Frame order is fixed: collect input intent → update pause reasons and active clock → run pure reducers with the active delta → commit once through the provider → reconcile Phaser/UI/audio projections. Phaser's raw time may animate visuals/audio but never drives restorable timers. Overlapping pauses are unique reasons; active time advances only when the collection is empty.
- Codec: validates schema version, JSON-safe finite values, IDs, collections and pause reasons before an atomic restore. Schema v2 groups spatial scalars into `Vector2State` and migrates v1 scalar coordinates. Snapshots carry no wall-clock timestamp, so background/closed time cannot advance a run.

## Enforcement

`npm.cmd run test:architecture` (`tests/architecture.test.mjs`) rejects: wrong dependency direction between pure layers, browser globals in pure modules, mutable/behavioral state declarations, parallel coordinate fields in state, more than one provider construction point, authoritative fields on Phaser projections, UI components depending on more than UI contracts/components, scene-wide effects importing object modules, shared visual/DOM modules in non-canonical locations, and non-lower-camel-case TypeScript filenames.
