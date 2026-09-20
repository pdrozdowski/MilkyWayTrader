# Audio conventions

## Assets, source and preparation

Runtime files: `public/assets/audio/<sound-id>/`. Definition: `src/game/audio/definitions/<soundId>.ts`, exporting `definition: SoundDefinition`. IDs use lowercase kebab-case; definition filenames use lower camel case; keys are exactly `audio:<sound-id>`. Paths are relative to Preloader's `assets` prefix. Vite discovers definitions automatically; no loader edits are needed. Registry rejects duplicate IDs/keys.

Definitions contain `paths` (ordered alternative encodings of the same recording), `category: 'sfx' | 'music'`, `mode`, `gain` (0–1), `maxVoices` and `credit: { source, author, license, attribution? }`. Replace scaffold provenance marked `Unspecified` before completing integration. Record the original clip URL and creator, not a search result. Include the license's required attribution text; keep it with the definition so future credits UI can consume it. Generated demo recordings are original project assets under MIT.

Scaffold accepts valid uncompressed PCM 16-bit WAV, mono/stereo. Generated demo sounds are mono 44.1 kHz. To import compressed files, prepare a WAV for scaffolding then add tested alternate encodings to `paths`; Phaser selects a supported format. Avoid loading multiple identical versions under separate keys.

Trim silence from one-shots, apply short attack/release envelopes to prevent clicks, remove DC offset, and leave mixing headroom. Engine loops need matching waveform slope/value at the wrap; audition the repeated loop at its minimum/maximum rates. Preview the full engine/laser mix at master volume 100%. Demo peaks are 0.6; current gains live in the sound definitions. Keep rate/gain tuning in definitions or behavior settings.

Original demo sounds: retain a dependency-free offline generator and truthful provenance. `node scripts/generate-demo-audio.mjs` regenerates only the three existing demo WAVs and replaces them; it does not create arbitrary sound IDs. Runtime synthesis and third-party codec dependencies are unnecessary for these generated sounds.

Resources:

- [Phaser audio guide](https://docs.phaser.io/phaser/concepts/audio): shared manager, loading, playback and browser unlocking. Local installed Phaser 4 types/source are the API authority.
- [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): gesture restrictions. Locked/muted effects are discarded; loops start from current state when eligible.
- [Kenney Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds): CC0 effects and engines; [license information](https://kenney.nl/support).
- [Freesound licensing FAQ](https://freesound.org/help/faq/): inspect each clip's license; prefer CC0 or compatible attribution licenses and record credits.
- [Audacity](https://www.audacityteam.org/): editing, envelopes, loop seams and export.

## Service and ownership

`getAudioService(scene.game)` returns the single game-lifetime service initialized in `postBoot`. It uses Phaser's sound manager/context; decoded assets stay cached between scenes. `createScope(scene)` returns playback attached to that scene's lifecycle. A persistent object/weapon may own a separate scope and attach `scope.destroy` to `ownCleanup`; never create scopes per shot. See [object contracts](../../utils-add-object-to-scene/references/objects.md) only when integrating a visual object.

These scopes are for `sfx`. Music persists across scene transitions and must use a game-owned controller that receives scene intent, owns one bounded track transition and is destroyed with the game. Add that controller with the first music track; do not attach persistent music to a scene scope. The canonical ownership rules are in the [architecture guide](../../../../context/foundation/architecture.md).

```ts
const audio = getAudioService(scene.game).createScope(scene);
audio.play('ship-laser'); // Call only after an actual shot is emitted.
audio.setLoop('engine', 'ship-engine', { rate: 1.05 });
audio.update(delta); // Once per frame after authoritative state is updated.
audio.setLoop('engine', null); // Fade to silence.
```

Each channel crossfades over 120 ms at default volume. Repeated `setLoop` calls change intent and rate without restarting the recording. Each scope has its own bounded pool per definition (`maxVoices` is not a global cap); excess one-shots are dropped rather than queued. Choose a persistent emitter owner to prevent multiplying pools. Update a scope once per frame after its owner's gameplay state changes. Do not call `scene.sound.play` each update or allocate sounds per projectile.

Scope cleanup is idempotent and removes owned instances/listeners on scene shutdown/destroy. Pause/sleep and blur/hidden silence playback and clear loop intent; the next active update supplies current state. Mute/zero volume stop playback while retaining loop intent; keep supplying current intent while muted so unmute cannot restore stale thrust. Unlock/unmute never replays past one-shots. No global `stopAll`, per-scene cache eviction or application-created AudioContext.

Service settings API: `getSettings`, `setMuted`, `setMasterVolume`, `subscribe` (returns unsubscribe). Saved preferences use `milky-way-trader.audio.v1`; default unmuted, master 0.5, storage errors fall back to memory. DOM controls must remain inside the fullscreen app and outside canvas input. New key-down actions ignore focused controls; key-up still releases held actions.

## Verification

Listen in Chrome/Edge and check touch/fullscreen layout. Test initial browser lock, gesture unlock, held firing cadence, silent blocked actions, seamless engine/boost transitions, pitch extremes, mute/volume and reload persistence. Exit/re-enter several times and confirm owned sounds/listeners return to baseline. Audio failures must not prevent gameplay. Automated state tests or analyser readings establish playback/output, not audible quality; report listening as unverified when unavailable.
