# MilkyWayTrader — Core

Browser game (space trading/salvage/flying) on Phaser 4 + TypeScript + Vite, deployed to Cloudflare Pages.
Authoritative product scope: `context/foundation/prd.md` — it outranks `context/foundation/tech-stack.md` and `context/foundation/shape-notes.md`.
Code boundaries and dependency direction: `mem:architecture`. Test levels and policy: `mem:testing_policy`. Build/deploy: `mem:tech_stack`, `mem:deployment`. Everyday commands: `mem:suggested_commands`. Editing rules and done-criteria: `mem:conventions`, `mem:task_completion`.

## Source map

- `src/main.ts` — application composition root: builds browser ports (auth, telemetry, result store, game-over return), calls `StartGame` from `src/game/main.ts`, then `setupApplicationUi` (`src/ui/setupUi.ts`).
- `src/game/main.ts` — Phaser config (1024x768, `Scale.RESIZE`, arcade physics, parent `game-container`) and scene list Boot → Preloader → MainMenu → Game → GameOver. `postBoot` initializes game audio and puts `GameStateProvider`, `resultStore` and `gameOverReturn` into the registry; exports `GameBootstrapHooks` (`onReady`, `resultStore`, `gameOverReturn`).
- `src/game/state/` — readonly JSON-safe declarations: `gameStateSnapshot.ts` (versioned run aggregate), `vector2State.ts`, per-domain state files (ship, planet, clock, market, cargo, projectiles, asteroid, terminal result).
- `src/game/domain/` — pure rules only: `marketPricing.ts` (`CommodityPriceProfile`, `commodityPriceMultiplier`, `commodityUnitPrice`, `marginalTradeTotal`), `serotonMarketCatalog.ts`, `planetCatalog.ts`, `runBalance.ts`.
- `src/game/application/` — state ownership, codec, commands, use cases, ports: `gameStateProvider.ts` (sole provider), `gameStateCodec.ts` (validate/migrate/atomic restore), `serotonMarket.ts`, `landedMarket.ts`, `commodityContainers.ts`, `salvageInteractions.ts`, `runStatus.ts`, plus `results/` and `telemetry/`.
- `src/game/world/` — `geometry.ts` (coordinates, collision geometry).
- `src/game/mechanics/` — deterministic reducers, clocks, flight: `gameSimulation.ts`, `serotonMarketSimulation.ts` (`advanceMarket` drifts stock; prices come from domain `commodityUnitPrice`), `clock/gameClock.ts`, subfolders `asteroid/`, `hazards/`, `moolaris/`, `planet/`, `projectile/`, `salvage/`, `spaceship/`, `debug/`.
- `src/game/definitions/` — static tuning: `gameplayTuning.ts`, `initialGameState.ts`, `planetDefinitions.ts`, `serotonMarketDefinitions.ts`, `moolarisDefinition.ts`.
- `src/game/objects/<id>/` — Phaser object (`<id>.ts`) + `definition.ts`; shared contracts in `objects/_shared/`; artwork in `public/assets/objects/<id>/`.
- `src/game/scenes/` — `bootScene.ts`, `preloaderScene.ts`, `mainMenuScene.ts`, `gameScene.ts` (demo world placement in `gameObjects.ts`), `gameOverScene.ts`; modules end with `Scene.ts`.
- `src/game/effects/` scene-wide effects, `src/game/visual/` shared rendering/depths/active time, `src/game/audio/` definitions + game-owned service + `audioScope.ts`.
- `src/ui/` — `contracts.ts`, `setupUi.ts`, `components/` (semantic HTML + typed ports), `adapters/` (browser/Phaser wiring only).
- `tests/` — Node test-runner suites (`domain/**`, `game-mechanics`, `object-scaffold`, `game-audio`, `run-status-clock`, `architecture`) and Playwright specs in `tests/ui/`.
- `scripts/` — npm audit, Pages asset-size check, local Supabase session/database helpers, demo audio generator. `supabase/migrations/` — local schema. `vite/` — dev/prod build configs. `.agents/skills/` — project workflows.

## Invariants

- Authoritative run state exists only in `GameStateSnapshot`, owned solely by `GameStateProvider`; scenes and objects render detached readonly snapshots and never declare authoritative gameplay fields.
- Domain, state, world and mechanics stay free of Phaser, DOM, network, wall-clock time and randomness; those capabilities enter through application ports.
- Gameplay state is JSON-safe and directly persistable; the codec validates schema version, IDs, collections and pause reasons before an atomic restore.
- Any authoritative state, clock, timer, lifecycle, snapshot, save or restore change must follow `.agents/skills/utils-add-state/SKILL.md`.
- `context/foundation/lessons.md` is append-only and is read before planning/implementation.
- Archived changes under `context/archive/` are immutable — open a new change with `/10x-new` instead.
- Generate `code-graph.json` / `data-logical-diagram.md` only when a task explicitly requests those artifacts.
- Secrets come from environment variables only: never committed, never in a committed `.mcp.json`, never pasted into chat.
