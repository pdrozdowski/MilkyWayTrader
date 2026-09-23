# Technical Architecture

This document owns code boundaries and dependency direction. Product scope remains in `prd.md`; testing policy is in `testing.md`.

## Layers

| Layer | Location | Responsibility | May depend on |
| --- | --- | --- | --- |
| State | `src/game/state/` | Readonly, JSON-safe declarations reachable from `GameStateSnapshot` | State only |
| Domain | `src/game/domain/` | Economy, markets, cargo, taxes, scoring and turns | Domain only |
| Application | `src/game/application/` | State ownership/codec, commands, use cases, immutable view models and external-service ports | State, domain, application |
| World | `src/game/world/` | Spatial identity, coordinates and collision geometry | World only |
| Mechanics | `src/game/mechanics/` | Deterministic clocks, state reducers, flight, weapons, trajectories and proximity rules | State, definitions, mechanics, world |
| Phaser objects | `src/game/objects/` | Sprites, physics, object effects and runtime lifecycle | Mechanics, world, visual, audio adapters |
| Effects/visual | `src/game/effects/`, `src/game/visual/` | Scene-wide effects and shared rendering infrastructure | Phaser, world |
| Scenes | `src/game/scenes/` | Composition, transitions, input, camera and collider wiring | Game-facing adapters and read-only state |
| Audio | `src/game/audio/` | Definitions, game-owned service and scoped playback adapters | Phaser only at the adapter edge |
| DOM UI | `src/ui/` | Semantic HTML components, ports and browser/Phaser adapters | Application view models or UI contracts; concrete game services only in adapters |

Dependencies point toward pure state. Domain and state code never import Phaser, DOM, audio, storage, network, time or randomness. Application code supplies those capabilities as ports. Business entities and world visuals share stable IDs; spatial and simulation values that must survive restoration belong in the snapshot, while collision geometry and derived values remain pure projections.

`src/main.ts` is the application composition root. `src/game/main.ts` creates Phaser and game-owned services, then exposes a ready hook; it never imports DOM UI. Scenes and UI issue application commands and render immutable results once business features exist.

## Presentation ownership

`GameStateSnapshot` is the versioned aggregate for the active run. `GameStateProvider` is its sole owner and atomic replacement boundary; scenes submit reducers and render detached readonly snapshots. The current aggregate contains authoritative clock, ship, planet, weapon-cadence, projectile-sequence, and projectile state. Input intent, camera state, audio settings, effects, and cleanup handles are transient and are never persisted. Static tuning remains in definitions.

Each frame follows one order: collect input intent, update pause reasons and active clock, run pure reducers using active delta, commit once through the provider, then reconcile Phaser/UI/audio projections. Phaser's raw time may animate visuals and audio but may not drive restorable timers. Overlapping pauses are stored as unique reasons; active time advances only when the collection is empty.

Phaser objects own sprites, physics bodies, object-specific effects and cleanup, but not authoritative gameplay values. Stateful objects accept identity or readonly slices and expose presentation synchronization or intent. Pure calculations belong to mechanics. Scene-wide effects live in `effects`; shared depths and rendering constants live in `visual`. Scenes wire systems and update order rather than calculate business rules.

Spatial snapshot fields use the readonly JSON-safe `Vector2State` shape so they remain directly persistable. Inside Phaser scenes and objects, use `Phaser.Math.Vector2` and its operations (`set`, `copy`, `add`, `subtract`, `scale`, `normalize`, and related methods) for positions, velocities, offsets, and direction calculations instead of maintaining parallel `x`/`y` arithmetic. Convert between `Vector2State` and transient Phaser vectors at the presentation boundary; never store a Phaser vector instance in `GameStateSnapshot`.

The codec validates schema version, JSON-safe finite values, IDs, collections, and pause reasons before an atomic restore. Schema v2 groups spatial scalars into `Vector2State`; the codec migrates v1 scalar coordinates during restore. Snapshots contain no wall-clock timestamp, so background or closed time cannot advance the run. Future persistence adapters serialize through the codec; no storage backend is part of this boundary yet. Generate `code-graph.json` and `data-logical-diagram.md` only for work that explicitly requests those artifacts.

DOM components receive a root element and typed port. They render state, emit actions and return an idempotent `UiHandle`. Browser and Phaser access stays in `src/ui/adapters/`. Interactive HTML uses `data-game-input="ignore"` so gameplay input does not depend on individual control IDs.

World objects use world coordinates. Viewport HUD uses `scrollFactor(0)` and the UI camera. Artwork stays in `public/assets/objects/<object-id>/`; audio stays in `public/assets/audio/<sound-id>/`.

## Audio and lifecycle

One-shots and state-bound loops are scene/object-owned `sfx`. Persistent music will use a game-lifetime controller. Missing, locked or muted audio never blocks gameplay or queues missed playback.

On shutdown, owners remove input/window/game listeners, colliders, cameras, scopes, timers and effects. Re-entry must restore resource counts to baseline without duplicate callbacks. UI handles and service destruction are idempotent.

## Enforcement

`test:architecture` rejects dependency violations, mutable/behavioral state declarations, multiple provider construction points, authoritative state in Phaser projections, misplaced shared modules and invalid TypeScript filenames. Business changes also follow `testing.md`. Run `npm.cmd run test:project`, `npm.cmd run typecheck`, `npm.cmd run build-nolog` and `npm.cmd run check:pages` after architecture or gameplay changes.
