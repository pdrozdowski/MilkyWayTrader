# Frame Brief: Runtime performance diagnosis

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

"as now I'm unable to tell if something makes game slow - what it is"

## Initial Framing (preserved)

- **User's stated cause or approach**: The user suspects work in the game update loop is consuming CPU time but cannot identify which task is responsible; this is a hypothesis, not yet measured.
- **User's proposed direction**: "creating a performance monitoring that can be enabled / disabled from debug menu (with a button). That performance monitoring purpose is to collect information about the cpu time usage during game update loop, so I want to know: - how many loops per sec game does - collection of time per task in update loop per loop to report: how many steps update loop has, how much time each step in loop takes as avg, min, max"
- **Pre-dispatch narrowing**:
  - Scope: "Include rendering and browser frame time"
  - Slowdown pattern: "Across normal gameplay"
  - Timing detail: "Per-loop samples with rolling summaries"

## Dimension Map

The observation could originate at any of these dimensions:

1. **Simulation/update work** — state snapshots and `advanceGameSimulation` may consume CPU time, but available code has no per-step measurements.
2. **Scene presentation work** — reconciliation, object synchronization, effects, and audio updates also execute in `Game.update` and may be mistaken for simulation cost.
3. **Renderer/browser frame pipeline** — Phaser rendering and browser scheduling happen outside the body of `Game.update`; update-call frequency alone may not explain perceived frame smoothness.
4. **Debug-menu observability boundary** — the debug menu is DOM-driven and currently communicates with the game through events, so it is a separate control surface from the scene's update work.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Simulation/update work is a meaningful source worth measuring | `Game.update` calls `stateProvider.update(...advanceGameSimulation...)` after taking a snapshot; `src/game/scenes/gameScene.ts:423-439`. No timing instrumentation is present in this path. | WEAK |
| Scene presentation work may be a distinct source | After simulation, the same update performs object synchronization, loops over planets and destroyed/consumed entities, effects, audio, camera, and background updates; `src/game/scenes/gameScene.ts:461-517`. | STRONG |
| Renderer/browser frame time may contribute independently | User explicitly broadened scope to include it. `Game.update` is a Phaser scene method, while renderer/browser timing is not represented inside that method; architecture describes frame order as simulation then Phaser/UI/audio projection in `context/foundation/architecture.md`, Presentation ownership. | STRONG |
| A debug menu is a plausible existing control surface | `index.html:59-71` defines the debug dialog and controls; `src/ui/setupUi.ts:75-85, 110-121` binds the UI and emits game events. | STRONG |

## Narrowing Signals

- The user wants performance scope to include rendering and browser frame time, not only game update CPU time.
- Slowdowns matter across normal gameplay; no single scene or action is isolated yet.
- The desired evidence is per-loop samples summarized over a rolling window, rather than aggregate-only totals.
- No symptom reproduction has been isolated, so the measurements need to help locate the expensive area rather than assume the simulation reducer is the cause.

## Cross-System Convention

Project architecture assigns simulation/reducer work and Phaser projection/rendering to different stages and layers (`context/foundation/architecture.md`, Layers and Presentation ownership). A diagnosis that reports only one undifferentiated update duration would blur those boundaries; the leading framing should preserve update work and browser/render frame pacing as separately observable concerns. The debug menu already serves as a DOM control surface for scene actions via game events (`src/ui/setupUi.ts:110-121`).

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the developer lacks runtime evidence to distinguish expensive game-update work from renderer/browser frame-pacing problems during ordinary gameplay.

The requested update-step timings address one plausible source, but the user also confirmed rendering and browser frame time are in scope. The change should therefore be planned as diagnostic observability across these distinct boundaries; the current evidence does not identify which boundary is the bottleneck.

## Confidence

- **MEDIUM** — the code confirms several distinct update and presentation stages and a separate browser/render pipeline, but no slow frame has been reproduced or measured yet.

## What Changes for /10x-plan

Plan for a debug-controlled performance diagnosis that can attribute cost to meaningful update-loop steps and report loop/frame pacing over a rolling sample window. Keep browser/render frame timing distinct from CPU duration measured inside the scene update, so the resulting data can identify which part of the pipeline needs follow-up.

## References

- Source files: `src/game/scenes/gameScene.ts:413-518`, `src/ui/setupUi.ts:75-121`, `index.html:59-71`
- Project architecture: `context/foundation/architecture.md`, Layers and Presentation ownership
- Related research: none
- Investigation tasks: none
