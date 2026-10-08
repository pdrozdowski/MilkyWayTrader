# Conventions

- All hand-maintained TypeScript filenames use lower camel case (`thisKindOfNaming.ts`); classes, interfaces and types stay PascalCase; scene modules end with `Scene.ts`. Enforced by the `TypeScript module filenames use lower camel case` test in `tests/architecture.test.mjs`.
- Formatting: 4-space indentation, single quotes, named exports (scene classes are named exports; only `src/game/main.ts` uses `export default`).
- No linter/formatter is configured — structural style, layering and naming come from `npm.cmd run test:architecture` (see `mem:architecture`).
- State declarations are readonly data with no behavior: `src/game/state/*` must not contain `Phaser`, `window`, `document`, `Date`, `Map`, `Set` or `undefined` tokens (architecture-test regex).
- Spatial state uses the JSON-safe `Vector2State` shape, never parallel `x`/`y` scalar fields. Inside Phaser scenes/objects use `Phaser.Math.Vector2` arithmetic (`set`, `copy`, `add`, `subtract`, `scale`, `normalize`); convert at the presentation boundary and never persist a Phaser instance.
- Objects: `src/game/objects/<id>/` with `<id>.ts` + `definition.ts`; assets in `public/assets/objects/<id>/`; shared contracts in `src/game/objects/_shared/`. The preloader discovers definitions automatically and demo placement lives in `src/game/scenes/gameObjects.ts`. Adding one follows `.agents/skills/utils-add-object-to-scene/SKILL.md` (default scene `gameScene.ts`).
- Audio: definitions in `src/game/audio/definitions/`, recordings in `public/assets/audio/<sound-id>/`, playback through scene/object-owned `AudioScope` instances; persistent music is game-owned. Follow `.agents/skills/utils-add-sound/SKILL.md`. Missing, locked or muted audio never blocks gameplay or queues missed playback.
- DOM UI: components receive a root element plus a typed port, render state, emit actions and return an idempotent `UiHandle`; they depend only on `src/ui/contracts.ts`. Browser/Phaser access stays in `src/ui/adapters/`. Interactive HTML sets `data-game-input="ignore"` so gameplay input never depends on control IDs.
- Lifecycle: on shutdown every owner removes listeners, colliders, cameras, scopes, timers and effects; re-entry restores resource counts to baseline without duplicate callbacks.
- Economy and pricing stay pure TypeScript in `src/game/domain/` (for example `marketPricing.ts`), independent of Phaser and DOM.
- World objects use world coordinates; viewport HUD uses `scrollFactor(0)` and the UI camera.
- Committed docs are Polish/English mixed but PRD validation (`10x-prd-en-capability`) requires `context/foundation/prd.md` to be fully English and solution-independent.
