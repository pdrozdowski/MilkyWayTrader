# Direct Moving System Flight — Plan Brief

> Full plan: `context/changes/direct-moving-system-flight/plan.md`

## What & Why

S-02 turns the playable static demo into a readable moving solar system without sacrificing direct control. A player will navigate an identifiable Moolaris system on desktop or touch devices, while the UI remains safe and usable at any viewport size and portrait orientation reliably blocks play.

## Starting Point

The game already has a versioned authoritative state provider, active-time clock, direct pointer flight, ship-following camera, three static planets, a stationary visual sun, a DOM run-status toolbar, and independent floating audio/fullscreen controls. The fixed-size Phaser canvas currently uses FIT scaling and whole-canvas touch steering. Its portrait notice is Polish, sits beneath toolbars, and does not pause the active clock.

## Desired End State

MOO-2187 "Moolaris" is fixed at `(0, 0)` and visibly named. The three named planets travel on configurable circular CCW paths that pause with active time; their bodies and Moolaris have configurable dimensions. The player flies through planets, but Moolaris safely pushes the ship out without damage.

On touch devices, a 120 px left-centre translucent joystick is the sole steering control. The canvas fills the viewport through Phaser RESIZE without stretching world objects. The top toolbar has Menu/Anonymous left, clock/HP centred, and cash/load/Cargo details/Ship info right. A topmost English portrait blocker pauses the game; Menu opens a lower paused overlay for audio, mobile fullscreen exit, and existing GameOver transition.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Orbit source | Active-clock-derived projection | Restores reproduce world positions without expanding snapshot schema |
| Orbital motion | Circular, CCW, per-planet phase/radius/period | Clear, deterministic, configurable visible movement |
| Default periods | 180 s, 240 s, 300 s | Movement is visible without disorienting direct flight |
| Central body | MOO-2187 "Moolaris" at `(0, 0)` | Stable identifiable centre for all orbital paths |
| Body size | Configurable for all celestial bodies | Rendering, collision and layout use one tuneable source |
| Planet contact | Ship/projectiles pass through | Defers hazards and planetary effects to later slices |
| Moolaris contact | Pure push-out, no damage | Keeps direct flight bounded without entering S-07 hazards |
| Mobile flight | Left-centre 120/44 px joystick only | Gives predictable thumb control without accidental canvas steering |
| Canvas behavior | Phaser RESIZE across all scenes, camera zoom one | Full viewport without scaling or misplacing entry/end scenes |
| Toolbar | Menu/Anonymous left; clock/HP centre; responsive run details right | Keeps right-side details clear of the left joystick at all supported widths |
| Menu | Paused accessible full-screen modal | Safely exposes audio, mobile fullscreen exit, and End game |
| Portrait blocker | English, topmost, authoritative pause | Prevents play and odd toolbar overlap in portrait |
| Pause restore | Reconcile transient blockers after restore | No invisible menu/orientation reason can permanently pause a run |
| Menu commands | Typed GameControlPort adapter | DOM UI cannot directly couple to provider or Phaser scene lifecycle |
| Joystick camera | Existing masked UI container | Prevents double rendering or world-relative joystick movement |
| Landing affordances | Remain visible but inert | Preserves existing demo presentation without claiming S-03 behavior |

## Scope

**In scope:**

- Configurable moving solar system, body labels, Moolaris push-out, and orbit-aware bounds.
- Full-viewport unscaled canvas, resize-safe scene HUD, touch joystick, and desktop input preservation.
- Top-toolbar reorganization, topmost portrait blocker, and paused accessible menu with relocated audio, mobile fullscreen exit, and End game.
- Mechanics, UI, Playwright, architecture-graph, and logical-diagram verification.

**Out of scope:**

- Landing, orbit capture, guidance, markets, damage/death, result persistence, touch firing, and input preferences.

## Architecture / Approach

`Active clock → pure orbit projection + Moolaris resolver → GameStateProvider → Phaser planet/ship projections`

`Touch joystick / desktop pointer → existing flight intent → same pure simulation`

`Run-status port → toolbar + modal menu → pause/action contracts`

Static solar-system tuning controls radii and orbit parameters. Phaser owns rendering/input lifecycle, while typed UI adapters own toolbar/dialog/orientation commands. `orientation` and `menu` join the authoritative pause-reason contract, then reconcile from current UI/media state after restore; the joystick joins the scene's existing masked UI container.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Solar system and flight | Deterministic orbits, Moolaris push-out, labels, correct collision scope | Tick ordering must keep state and projections coherent |
| 2. Viewport, joystick, orientation, menu | RESIZE all scenes, masked touch control, topmost portrait blocker, compact responsive toolbar and typed paused overlay | Resize, pause, input, and UI-command lifecycle cannot leak or conflict |
| 3. Acceptance and artifacts | Cross-layer tests and refreshed architecture records | Catching desktop/touch regressions together |

**Prerequisites:** S-01 authoritative run state is complete; no external service setup is needed.

**Estimated effort:** Medium; three incremental implementation phases.

## Open Risks & Assumptions

- Configured orbital paths must retain safe Moolaris/body clearance and fit derived world bounds.
- The menu’s dedicated pause reason must compose with existing background/landed pause reasons.
- Portrait orientation uses the same composable active-clock pause boundary and clears held input before the blocker appears.
- A restored menu never reopens; restore clears its reason and derives orientation from current media state.
- The narrow toolbar uses fixed compact side zones below 560 CSS px and constrains details to the viewport.
- Moolaris push-out intentionally has no damage until S-07.
- Audio controls move into the menu; no separate in-game floating audio control remains.

## Success Criteria (Summary)

- Players can see and directly navigate a named moving system on desktop and touch without visual stretching.
- Touch joystick, portrait blocker, toolbar, paused menu, audio, fullscreen exit, and End game behave accessibly and do not consume unintended gameplay input.
- Deterministic mechanics, full tests, build, and state architecture artifacts validate without `REFACTOR_REQUIRED`.
