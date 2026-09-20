# Technical Architecture

This document owns code boundaries and dependency direction. Product scope remains in `prd.md`; testing policy is in `testing.md`.

## Layers

| Layer | Location | Responsibility | May depend on |
| --- | --- | --- | --- |
| Domain | `src/game/domain/` | Economy, markets, cargo, taxes, scoring and turns | Domain only |
| Application | `src/game/application/` | Commands, use cases, immutable view models and external-service ports | Domain, application |
| World | `src/game/world/` | Spatial identity, coordinates and collision geometry | World only |
| Mechanics | `src/game/mechanics/` | Deterministic flight, weapons, trajectories and proximity rules | Mechanics, world |
| Phaser objects | `src/game/objects/` | Sprites, physics, object effects and runtime lifecycle | Mechanics, world, visual, audio adapters |
| Effects/visual | `src/game/effects/`, `src/game/visual/` | Scene-wide effects and shared rendering infrastructure | Phaser, world |
| Scenes | `src/game/scenes/` | Composition, transitions, input, camera and collider wiring | Game-facing adapters and read-only state |
| Audio | `src/game/audio/` | Definitions, game-owned service and scoped playback adapters | Phaser only at the adapter edge |
| DOM UI | `src/ui/` | Semantic HTML components, ports and browser/Phaser adapters | Application view models or UI contracts; concrete game services only in adapters |

Dependencies point toward pure state. Domain code never imports Phaser, DOM, audio, storage, network, time or randomness. Application code supplies those capabilities as ports. Business entities and world visuals share stable IDs; prices, stock and tax never enter `PlanetWorldState`, while coordinates and colliders never become domain state.

`src/main.ts` is the application composition root. `src/game/main.ts` creates Phaser and game-owned services, then exposes a ready hook; it never imports DOM UI. Scenes and UI issue application commands and render immutable results once business features exist.

## Presentation ownership

Phaser objects own sprites, physics bodies, object-specific effects and cleanup. Pure calculations belong to mechanics. Scene-wide effects live in `effects`; shared depths and rendering constants live in `visual`. Scenes wire systems and update order rather than calculate business rules.

DOM components receive a root element and typed port. They render state, emit actions and return an idempotent `UiHandle`. Browser and Phaser access stays in `src/ui/adapters/`. Interactive HTML uses `data-game-input="ignore"` so gameplay input does not depend on individual control IDs.

World objects use world coordinates. Viewport HUD uses `scrollFactor(0)` and the UI camera. Artwork stays in `public/assets/objects/<object-id>/`; audio stays in `public/assets/audio/<sound-id>/`.

## Audio and lifecycle

One-shots and state-bound loops are scene/object-owned `sfx`. Persistent music will use a game-lifetime controller. Missing, locked or muted audio never blocks gameplay or queues missed playback.

On shutdown, owners remove input/window/game listeners, colliders, cameras, scopes, timers and effects. Re-entry must restore resource counts to baseline without duplicate callbacks. UI handles and service destruction are idempotent.

## Enforcement

`test:architecture` rejects dependency violations, misplaced shared modules and invalid TypeScript filenames. Business changes also follow `testing.md`. Run `npm.cmd run test:project`, `npm.cmd run typecheck`, `npm.cmd run build-nolog` and `npm.cmd run check:pages` after architecture or gameplay changes.
