---
name: utils-add-sound
description: Add or update sound effects and loops in MilkyWayTrader using its Phaser audio service, with asset preparation, provenance and lifecycle cleanup. Defaults to gameScene.ts.
---

Inspect the target scene, emitter and nearest sound definition. Resolve the clip/source, actual trigger or state, one-shot/loop mode, gain and owner from the request and code; ask only about consequential missing choices. Default scene: `src/game/scenes/gameScene.ts`. Definition module filenames use lower camel case even though sound IDs remain kebab-case.

Follow the repository [architecture boundaries](../../../context/foundation/architecture.md). Effects are scene/object-scoped; persistent music is game-owned and must not use a scene scope.

For a new sound with a WAV source, run from the repo root:

```powershell
node .agents/skills/utils-add-sound/scripts/scaffold.mjs <sound-id> --file <path.wav> [--category sfx|music] [--mode one-shot|loop] [--scene Game] [--dry-run]
```

Defaults: SFX, one-shot, gain 0.3, two voices (one for loops). Copies validated PCM WAV and creates an auto-loaded definition. Existing sound/playback-only change: edit its definition/behavior; skip scaffolding. Scenes are wired explicitly; the first music addition also introduces the game-owned controller described by the architecture guide.

Complete provenance/tuning and wire successful actions or authoritative loop state to an owned `AudioScope`. Read [audio contracts, preparation and resources](references/audio.md) for sourcing/playback/ownership. Original demo sounds are generated offline with a retained generator. Use [$utils-add-object-to-scene](../utils-add-object-to-scene/SKILL.md) when a visual object also needs work.

Use a persistent emitter/scene scope, never a new scope per shot. Update each scope once per frame without restarting loops; attach object-owned scope destruction to `ownCleanup`. No separate AudioContext, manager-wide cleanup or queued missed effects.

Use [$cicd-run-tests](../cicd-run-tests/SKILL.md) for the complete unit/UI suite, then run `build-nolog` and `check:pages`. Verify triggers, mute/unlock, focus loss and exit/re-entry on desktop/touch. Audition transitions/seams; report unavailable listening. Deployment is separate.
