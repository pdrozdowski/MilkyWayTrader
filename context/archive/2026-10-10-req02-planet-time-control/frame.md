# Frame Brief: Safe time control from planet menus

> Framing step before /10x-plan. This document captures what is actually at issue, separated from the initial UI direction.

## Reported Observation

> "in the header next to the clock i would like to have a 'play icon button' so when clicked you resume time to run and changes into 'pause icon' - clicked again fliping back to pause and play icon"

## Initial Framing (preserved)

- **User's stated cause or approach**: No cause was claimed; the suggested interaction is a play/pause toggle next to the planet-menu clock.
- **User's proposed direction**: "make a [$10x-new](C:\Users\pdroz\source\MilkyWayTrader\\.agents\skills\10x-new\SKILL.md) change req02-planet-time-control and put there a [$10x-frame](C:\Users\pdroz\source\MilkyWayTrader\\.agents\skills\10x-frame\SKILL.md) and describe and analyse what we would need to do to be able to poperly handle time control from on planet menus time pause/reasumeing"
- **Pre-dispatch narrowing**:
  - Scope: all planet menus (Market, Facilities, Shipyard).
  - Play should advance active time and the planet economy while landed.
  - Other pause reasons, including browser backgrounding, still hold the clock paused.
  - Landing should remain safe from asteroid impacts while time runs.

## Dimension Map

The requested interaction crosses these distinct dimensions:

1. **Clock and landing invariant** — the codec currently requires a landed planet to carry the `landed` pause reason. A simple resume of that reason is rejected as invalid state.
2. **Landed safety and input lock** — the scene currently uses the `landed` pause reason to block ship input. Removing it to run time also removes that block, while simulation movement and asteroid impact processing remain active.
3. **What advances with active time** — active seconds advance facility recipes for every market, not just the planet currently open in the menu; asteroid/projectile simulation and collisions also continue unless explicitly controlled.
4. **Independent pause reasons and presentation** — time is paused while any reason remains, and the shared menu header is used by Market, Facilities, and Shipyard. The control and its displayed state must agree across all three views and preserve unrelated pause reasons.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| A header-only toggle is sufficient; the current clock contract permits a landed clock to run. | The codec rejects landed state without the `landed` reason (`gameStateCodec.ts:342`), while that reason pauses active time (`gameClock.ts:3-8`). | NONE |
| The landed pause reason also protects ship control, so using it as the only time switch would couple time to safety. | `gameScene.ts:460-464` treats `landed` as input-blocking. `gameSimulation.ts:92-98` still derives ship target movement when active and only gates boost on landed state. | STRONG |
| Running active time while landed advances only the open planet's economy. | `gameSimulation.ts:84-85` advances facility cycles over `state.markets.map(...)`; it also advances asteroid motion and resolves impacts at `gameSimulation.ts:179-180`. | NONE |
| Pause reasons already compose independently, so the planet control must change only its own reason. | `gameControlsAdapter.ts:12-18` toggles one named reason and keeps the rest; `landedFacilities.ts:108` reports PAUSED while any pause reason remains. | STRONG |
| All planet menu headers need a consistent control because they share one header component. | `landingStatus.ts:506-508` mounts the same menu header for Market, Facilities, and Shipyard. | STRONG |

## Narrowing Signals

- The user selected all planet menus.
- The user wants active time and planetary economy to advance while landed, while unrelated pause reasons continue to stop time.
- The user explicitly wants landing to remain safe from asteroid impacts during resumed time.

## Cross-System Convention

The clock uses composable named pause reasons: adding or clearing one reason should not clear background, menu, or orientation pauses. Landing currently serves two roles at once: it pauses the active clock and blocks ship control. The selected behavior separates those concerns: time/economy may advance on-planet while the landed state continues to protect the ship.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: define safe on-planet time progression across all landing menus, because the current `landed` pause reason simultaneously enforces clock pause and ship input safety, while the full active simulation also advances markets and hazards.

A play/pause icon is only the visible entry point. The existing state invariant and scene/simulation behavior do not support the requested combination of a running economy, independent pause reasons, and a landed ship protected from hazards. The plan must preserve these constraints together instead of treating the control as a display-only toggle.

## Confidence

- **HIGH** — source code directly demonstrates the codec invariant, shared pause-reason behavior, global facility ticking, and active asteroid collision processing; the user confirmed the desired safety and scope boundaries.

## What Changes for /10x-plan

Plan a cross-layer time-control capability for all planet menus that distinguishes active-clock progression from the landed ship's input and hazard protection, while retaining composable pause reasons. Include validation of which active-time effects advance while landed and verify that background/menu pauses still dominate.

## References

- `context/foundation/prd.md:24` — landing is described as a safe, paused planning state.
- `src/game/application/gameStateCodec.ts:342-343` — relationship between landed lifecycle and `landed` pause reason.
- `src/game/mechanics/gameSimulation.ts:81-98,130,179-180` — active-time boundary, facility cycles, landed movement/weapon gates, and asteroid processing.
- `src/game/scenes/gameScene.ts:460-464` — landed pause reason also blocks ship input.
- `src/game/application/landedFacilities.ts:106-108` — displayed run state follows all pause reasons.
- `src/ui/adapters/gameControlsAdapter.ts:12-18` — existing named pause reasons compose.
- `src/ui/components/landingStatus.ts:506-508` — Market, Facilities, and Shipyard share the menu-header component.
- Investigation tasks: none; local code evidence covered the bounded clock, landing, and landing-menu surface.
