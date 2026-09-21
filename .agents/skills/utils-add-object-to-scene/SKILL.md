---
name: utils-add-object-to-scene
description: Add or update reusable Phaser objects, sprites, animations and colliders in MilkyWayTrader scenes. Defaults to gameScene.ts; use utils-add-sound for audio assets and playback.
---

Inspect the target scene and the closest existing object. Resolve appearance, behavior, animation, placement and collisions from the request and code; ask only about consequential missing choices. Default scene: `src/game/scenes/gameScene.ts`. TypeScript module filenames use lower camel case while exported classes use PascalCase.

Classify the object before scaffolding. Visual-only objects use this workflow directly. If the object has authoritative position, health, inventory, lifecycle, timer, or other saveable gameplay state, invoke [$utils-add-state](../utils-add-state/SKILL.md) first: define state and pure reducers before creating its Phaser projection. Do not generate speculative state stubs because persistence semantics require a domain decision.

Follow the repository [architecture boundaries](../../../context/foundation/architecture.md): object-owned visuals/effects stay with the object, scene-wide effects stay in `src/game/effects/`, and business rules never enter Phaser modules.

For a new object, run from the repo root:

```powershell
node .agents/skills/utils-add-object-to-scene/scripts/scaffold.mjs <object-id> [--scene Game] [--physics none|dynamic|static] [--shape circle|rectangle] [--dry-run]
```

Defaults: no physics; rectangle when physics is requested. Creates a class, auto-loaded definition and marked SVG. Existing object: edit its module directly; skip scaffolding.

Implement behavior, placement, create/update wiring and interactions. Read [contracts](references/objects.md) for definitions/ownership; [animation, physics and camera integration](references/animation-physics.md) when applicable. Use [$utils-add-sound](../utils-add-sound/SKILL.md) when audio is requested.

Stateful object constructors receive an identity or readonly state slice. Their methods emit intent or synchronize presentation; they never own or directly replace authoritative state. After changing authoritative state, refresh both [$arch-make-code-graph](../arch-make-code-graph/SKILL.md) and [$arch-make-data-logical-diag](../arch-make-data-logical-diag/SKILL.md), and resolve every diagram finding.

World objects scroll with the camera; the ship remains its follow target. Exclude new world sprites and overlays from Game's UI camera. Own cleanup of effects/listeners/timers/sounds; keep economy and models independent of Phaser.

Use [$cicd-run-tests](../cicd-run-tests/SKILL.md) for the complete unit/UI suite, then run `build-nolog` and `check:pages`. Verify requested behavior, camera/body alignment and exit/re-entry on desktop/touch; report unverified checks. Deployment is separate.
