# Debug-Controlled Performance Monitor — Plan Brief

> Full plan: `context/changes/req01-performance-monitor/plan.md`
> Frame brief: `context/changes/req01-performance-monitor/frame.md`
> Research: `context/changes/req01-performance-monitor/research.md`

## What & Why

"The actual problem to plan around is: the developer lacks runtime evidence to distinguish expensive game-update work from renderer/browser frame-pacing problems during ordinary gameplay." There is currently no instrument at all, so every earlier frame-time question in this repository was settled by reasoning and eyeballing rather than measurement.

## Starting Point

`Game.update` is a single unnamed 106-line body with one simulation step and two early returns, and the only statically visible hot spot is the state boundary — a derived 21 validating decodes and 10 full serializations per active frame. The debug menu, the game-event bridge, non-interactive DOM overlays and the fast TS test harness all already exist and are reused as-is.

## Desired End State

Pressing `D` and switching on "Performance monitor" shows a live panel of eight per-step timings plus loop rate, frame interval, update phase, scene render and unaccounted time; switching it off removes the panel and every hook, and the monitor never survives scene re-entry. The developer can now say which part of the frame is expensive instead of guessing.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Step decomposition | Eight named steps plus five frame-level rows | Matches the stages the code actually contains, so each row traces to code when it looks expensive | Plan (from Research stage map) |
| Rolling window | 5-second time window, avg/min/max/count, loops-per-second from the same samples | Stable to read while flying yet reacts within seconds, and one window answers both questions | Plan |
| Readout surface | DOM panel, top-left, non-interactive, ~4 repaints per second | Selectable text, no canvas coupling, and it is coverable by the repo's fast DOM test harness | Plan |
| Readout visibility | Panel exists only while the monitor is toggled on | User requirement: on-demand from the debug menu, never always-on | User |
| Toggle default | Off on every scene entry, reset through the existing debug reset path | Debug instrumentation in this repo is transient by convention, so nothing persists | Research |
| Frame hooks | Scene-owned `prestep`/`poststep`/`prerender`/`postrender`, attached only while enabled | Keeps sampling gameplay-only and makes the disabled path a single boolean read | Research |
| Frame interval source | `now()` differences at `prestep`, never the `delta` argument | Phaser smooths and accumulates `delta`, so it cannot report a real frame duration | Research |
| Testing level | Node unit and component tests only; no Playwright test | Instrumented timing is explicitly outside the repository's Playwright admission gate | Research |

## Scope

**In scope:** pure rolling-window statistics module; scene frame hooks and eight step markers; debug-menu toggle with labels, reset and teardown; typed readout port and DOM panel with styles; unit and component tests; manual browser validation with a baseline record.

**Out of scope:** changes to state, codec, provider or reducers; optimizing the per-frame snapshot/publish pattern; persistence, telemetry events, file export; Playwright coverage; game-wide sampling; new npm scripts.

## Architecture / Approach

A pure module in `src/game/application/` holds the window and all derived numbers behind an injected clock. One instance is registered in the composition root and shared through the game registry. The gameplay scene owns the Phaser frame hooks and the step markers, feeding the monitor and throttling sample pushes to 250 ms. A UI adapter converts pushes into an immutable view model, and a dumb DOM component renders the panel and hides it whenever `enabled` is false.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Pure measurement core | Statistics module plus unit tests | Window and marker semantics subtly wrong, producing plausible but false numbers |
| 2. Debug-controlled readout | Live panel toggled from the debug menu | Scene markers drifting from the real stage boundaries or leaking listeners |
| 3. Overhead and correctness validation | Evidence the instrument is cheap and the readings are trustworthy | The instrument itself perturbing the frames it measures |

**Prerequisites:** none beyond the existing toolchain; `npm.cmd run dev-nolog` for manual checks; no new dependency or browser install.
**Estimated effort:** roughly two to three sessions across three phases.

## Open Risks & Assumptions

- The update-phase row will always exceed the sum of step rows because `step`-event UI listener work sits inside that bracket; this is documented rather than attributed.
- The `state-commit` row carries reducer, commit, publish and that frame's UI projections together; splitting it would require touching the provider boundary and is deliberately deferred.
- Eight timers per frame add unmeasured overhead; phase 3 exists to bound it, and `unaccounted` keeps any error visible.
- Assumes Phaser keeps emitting `prestep`/`poststep`/`prerender`/`postrender` on the game emitter for the pinned 4.0.0 version.

## Success Criteria (Summary)

- With the monitor on, a developer can attribute frame cost to a named step, to scene rendering, or to the browser gap, and read loop rate for the same window.
- With the monitor off, nothing is rendered, no hooks are attached, and gameplay is unchanged.
- The monitor resets to off on every scene entry and leaves no persisted trace.
