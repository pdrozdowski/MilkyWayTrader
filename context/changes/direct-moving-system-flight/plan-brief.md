# Direct Moving System Flight — Plan Brief

> Full plan: `context/changes/direct-moving-system-flight/plan.md`

## What & Why

S-02 turns the static demo into a readable, moving solar system without sacrificing direct control. It establishes moving planets, a clear central body, and a visual outer asteroid band before S-07 adds hazards.

## Starting Point

The current game has static planets and a static sun. Its Arcade collision response is overwritten by authoritative synchronization, and the existing orientation presentation is DOM-only rather than an active-clock pause producer.

## Desired End State

Moolaris remains at the origin with radius 1155 and a ship-facing label. Planets of radii 96, 144, and 192 orbit at 2000, 3000, and 4000 world units; a decorative active-time asteroid annulus occupies 4650–5050. Contact with Moolaris visibly moves the ship out and stops it without damage.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Zero-time state | Derive initial planets from configured orbit phases | Prevents incompatibility between initial positions and orbit radii. |
| Planet geometry | 96 / 144 / 192 at 2000 / 3000 / 4000 | Produces distinct readable orbital bands. |
| Moolaris | Radius 1155; push-out then zero velocity | Reduces scale and makes contact perceptible. |
| Asteroids | Deterministic visual-only annulus at 4650–5050 | Defers all hazards to S-07. |
| Pause ownership | Orientation and menu both begin in Phase 2 | Their UI producers and lifecycle contracts belong there. |
| Audio controls | One menu-owned host | Prevents duplicate mounts and subscriptions. |

## Scope

**In scope:** pure orbit/contact mechanics, labels, decorative asteroids, responsive canvas, touch joystick, orientation pause, toolbar, menu, and validation artifacts.

**Out of scope:** asteroid collision/damage, landing, markets, snapshot migrations, touch firing, and input preferences.

## Architecture / Approach

`active clock → pure planet/contact projection → provider → exact game geometry + interpolated Phaser presentation`.

Planet and asteroid visuals interpolate frame-to-frame between authoritative projections, while indicators and all gameplay geometry use exact state. Asteroid presentation synchronizes from the same active-clock basis as planets but is not persisted. Phase 2 reuses existing display infrastructure for portrait presentation while the scene owns orientation state and the menu adapter owns menu state.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1. Solar system | Orbits, labels, contact, visual asteroids | Authoritative collision/projection ordering |
| 2. Controls and UI | Resize, joystick, orientation, menu | Single ownership of pause and UI lifecycle |
| 3. Acceptance | Cross-layer tests and architecture artifacts | Detecting desktop/touch regressions |

## Success Criteria

- The player can read and navigate four distinct orbital bands, while only Moolaris blocks shots and stops a contacting ship.
- Asteroids are visual-only and freeze with the same active-clock basis as planets.
- Touch, portrait, resize, menu, and audio controls are accessible and do not leak listeners or duplicate UI.
