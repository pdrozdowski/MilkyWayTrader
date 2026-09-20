# Animation, physics and scene integration

## Visual states

Keep frames equally sized with a consistent centered pivot. Define animations once through the object definition; use `sprite.play(key, true)` (`ignoreIfPlaying`) when updating state so each frame does not restart playback. Stop and restore the idle texture when the state ends. Animation and rotation must not change collider geometry.

For a directional ship, prefer a single orientation rotated from actual velocity (`atan2(vy, vx) + Math.PI / 2` for upward artwork); retain heading at rest. Engines follow thrust, including engines-off coasting. See `spaceship/definition.ts` and `spaceship.ts` for the off image, animated twin exhausts and boost tuning; use `shipAudio.ts` for matching sound state rather than duplicating keyboard checks.

Planet rotation uses surface motion inside a fixed circular silhouette. Set per-instance animation timeScale for spin speed; retain a fixed circle body. Atmosphere and debug labels are owned world-space overlays, not colliders. See `planet.ts` and `planetWorldState.ts` for world-state binding.

## Physics and ownership

Use Arcade zero-gravity velocity for solid moving objects, not position tweens through colliders. The scene owns collider/overlap relationships and removes them on shutdown. Overlap callbacks detect proximity but do not separate bodies. Enable a body only when needed; effects have no physics.

Physics dimensions use unscaled texture pixels. Use wrapper `setSize`/`setPosition` to synchronize scaled dynamic/static bodies; circular bodies require uniform scale. Avoid containers around physics roots. Confirm alignment after resizing, variant/frame changes and rotation.

Fast projectiles use swept collision checks to avoid tunneling: see `projectile/trajectory.ts` and `projectile.ts`. `ShipWeapon` owns a live set, update-based TTL cleanup and an actual-spawn callback (also used for laser sound). Reuse `FireCadence` for held-fire timing; suppressed shots must not become a catch-up burst. Current rates, speed and TTL live in weapon/projectile tuning, not this guide.

Use `planetLandingRadius` and `PLANET_LANDING_SURFACE_GAP` from `planet/proximity.ts` for landing zones. The shared surface gap keeps every planet's highlight equally distant from its surface. Multiple planets may qualify; indication and prompt do not implement landing or trading.

## Camera and input

World sprites, effects, labels and starfield scroll normally, including negative world coordinates. Game's main camera follows the ship immediately without camera bounds; physics boundaries remain independent. HUD stays viewport-fixed in a separate UI camera at zoom 1 while boost changes world zoom.

Game initially excludes existing world children from its UI camera. Exclude any later-created world sprite **and its overlays** with `uiCamera.ignore(...)`; keep HUD excluded from the main camera. See Game's projectile-spawn callback for dynamic creation. Never change the camera target to an added object.

Primary-pointer steering has one owner. Convert its screen coordinates through the active camera each update even without pointermove; preserve the existing compensation for Phaser's previous-frame camera matrix. Secondary touches cannot replace/release the owner. Release controls on pointer-up/outside, cancellation, blur and scene shutdown.

Keep CSS `touch-action: none` with Phaser touch capture disabled: it avoids preventDefault errors on non-cancelable touchcancel. New flight key-down handlers ignore events from `#audio-controls`; key-up must still release held actions. Canvas interaction restores focus from those controls.

## Acceptance

Check visual switching, collisions, size/body alignment, camera centering through movement/boost/resize, overlay scrolling, relevant proximity boundaries, pointer ownership and repeated exit/re-entry. Exercise desktop and touch layouts. Build and typecheck separately; `check:pages` validates runtime asset limits. Keep large source artwork outside `public/`.
