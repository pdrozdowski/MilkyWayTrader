# S-02 Direct Moving-System Flight — Plan Brief

> Full plan: `context/changes/s02-direct-moving-system-flight/plan.md`

## What & Why

This change turns the current static flight demo into direct flight through a moving, identifiable solar system. It adds deterministic orbital motion, safe Moolaris contact, mobile controls, and pause behavior so later guidance, landing, hazards, and trading can build on a stable flight foundation.

## Starting Point

The snapshot already owns the shared active-time clock, ship state, and three planet positions, but simulation does not move planets. The scene relies on a broad Phaser celestial collider, fixed HUD coordinates, pointer-target touch input, and a visual-only portrait notice.

## Desired End State

Players see named planets orbit MOO-2187 “Moolaris” only while active time runs, can fly safely on desktop or touch, and see a decorative outer asteroid belt. Menu, portrait, and background states pause the same clock independently; fullscreen remains a display action, not a gameplay pause.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Orbital model | Configured CCW circles at 180/240/300 seconds with 50px radial surface gaps | Deterministic active-time projection is restore-safe, keeps neighbouring orbital bands close without overlap, and is ready for S-03. |
| Moolaris safety | Forced outward full speed until radius + ship radius + 50px clearance | Prevents trapping without introducing S-07 damage/HP scope. |
| Projectile policy | Moolaris absorbs; planets and belt pass through | Preserves the central obstacle while making planets non-blocking. |
| Labels | Centered planet names; Moolaris label faces the ship | Removes debug noise while retaining visible identity. |
| Asteroid belt | Deterministic, decorative, active-time rotation | Establishes world presentation without future hazard/combat systems. |
| Touch controls | Left relative full-thrust joystick plus right fire/boost controls | Provides complete mobile flight while keeping input transient. |
| Pause UX | DOM modal via Escape/pause button; portrait blocking overlay | Supports accessibility and composable authoritative pauses. |
| Audio controls | Relocated into the pause modal | Keeps always-visible flight UI focused. |
| Fullscreen | Independent from pause state | Matches browser display behavior and current adapter design. |

## Scope

**In scope:**

- Deterministic planet motion and readable celestial presentation.
- Moolaris-only safety response and planet/belt pass-through.
- Responsive HUD, touch joystick/action controls, pause modal, orientation pause, and fullscreen acceptance tests.

**Out of scope:**

- Guidance, orbit capture, landing, launch, damage, asteroid gameplay, salvage, terminal outcomes, and persistence migration.

## Architecture / Approach

Static definitions plus pure mechanics derive celestial state from `activeElapsedMs`; `GameStateProvider` remains the only authoritative replacement boundary. Phaser and DOM reconcile readonly state while retaining only visuals and input intent, with `menu` and `orientation` added as codec-validated pause reasons.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Moving system | ID-safe deterministic planetary orbits | Restore and pause continuity |
| 2. Flight safety | Pure Moolaris repulsion and pass-through planets | Avoiding physics/snapshot divergence |
| 3. Presentation | Labels and decorative belt | Keeping visuals out of game state |
| 4. Controls | Resize-safe HUD and complete touch flight | Pointer ownership and cleanup |
| 5. Pause UX | Orientation pause, modal, audio relocation, E2E | Overlapping lifecycle reasons |

**Prerequisites:** S-01 anonymous run status is complete.
**Estimated effort:** ~3–5 implementation sessions across five phases.

## Open Risks & Assumptions

- Concrete orbital radii and initial phases are static implementation tuning, constrained by a 50px surface gap between Moolaris and neighbouring orbital bands.
- The existing v3 snapshot stores derived planet positions; retaining that shape avoids a migration before persistence is mature.
- Decorative belt asteroids are intentionally not a substitute for the S-07/S-08 authoritative asteroid systems.

## Success Criteria (Summary)

- Celestial motion, belt animation, and time-based safety behavior stop for every active pause reason and survive a snapshot round trip.
- Flight works without control traps or planet collisions on desktop and touch layouts.
- Portrait, modal, fullscreen, and audio-control lifecycles are covered by automated and human verification.
