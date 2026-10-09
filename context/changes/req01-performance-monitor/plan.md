# Debug-Controlled Performance Monitor — Implementation Plan

## Overview

Add an on-demand runtime performance monitor for the gameplay loop: eight named update-step timers plus frame-level pacing (loops/second, raw frame interval, update phase, scene render, unaccounted gap), enabled and disabled from the existing debug menu, summarized over a rolling 5-second window and shown as a DOM panel that exists only while the monitor is on. The monitor is diagnostic only: no authoritative state, no persistence, nothing exported to file.

## Current State Analysis

- `Game.update` (`src/game/scenes/gameScene.ts:418-523`) is one unnamed 106-line body; exactly one line is simulation (`:435`), everything from `:465` is projection work, and two `return`s at `:461` and `:463` exit early on death-transition frames.
- The state boundary is the largest statically traceable cost: a derived 21 validating decodes and 10 full serializations per active frame, caused by `snapshot()`/`update()`/`publish()` (`src/game/application/gameStateProvider.ts:19-28`, `:51-55`) combined with three UI ports that re-snapshot every frame (`src/ui/adapters/runStatusAdapter.ts:20`, `src/ui/adapters/landingStatusAdapter.ts:65-75`, `src/ui/adapters/cargoTransferAdapter.ts:51`).
- Phaser 4.0.0 emits, once per iteration on the game event emitter, `prestep` → `step` → scene updates → `poststep` → `prerender` → scene render → `postrender` (`node_modules/phaser/src/core/events/*.js` name values; emission order verified in `node_modules/phaser/dist/phaser.js:18024-18056`). `step` fires **before** the scene update; the `delta` passed to `update` is smoothed, so raw frames come from `now()` differences, not `delta`.
- Nothing measures anything today: no `performance.now`, FPS counter or overlay exists in `src/`, `tests/`, `scripts/` or `vite/`; telemetry is allowlisted and frame-hostile (`src/game/application/telemetry/telemetry.ts:41`, `:63`).
- Reusable seams: debug dialog → `game.events` → scene handler with a reset path (`index.html:59-74`, `src/ui/setupUi.ts:79-92`, `:135-182`); non-interactive DOM overlays (`#run-status`, `#cargo-transfer-warning`, `public/style.css:83`, `:189`); fast TS tests via `ts.transpileModule` with hand-rolled fakes (`tests/run-status-clock.test.mjs:6-23`, `tests/landing-status.test.mjs:18-54`); `test:domain` globs `tests/domain/**/*.test.mjs` while `test:ui-presentation` enumerates files explicitly.
- `context/foundation/roadmap.md` has no `Change ID` equal to `req01-performance-monitor`; `dist/` is gitignored and untracked.

## Desired End State

Pressing `D` opens the debug dialog, where a "Performance monitor" toggle turns the monitor on. The panel appears immediately at the top-left of the play field and refreshes roughly four times per second while the game keeps running; closing the dialog keeps both the monitor and the panel alive. Turning the toggle off hides the panel instantly and detaches every hook, so the disabled path costs one boolean read per marker. Re-entering the gameplay scene leaves the monitor off. A developer reading the panel can tell whether cost sits in the simulation commit, in a specific presentation step, in scene rendering, or in the browser gap between frames.

### Key Discoveries

- The `stateProvider.update(...)` call at `gameScene.ts:435` already contains the reducer, the commit, the publish and that frame's UI projection listeners — isolating it as one measured row surfaces the biggest suspected cost without touching the provider boundary.
- `stepEnded()` must be called before both early returns, otherwise a dangling step would absorb the inter-frame gap on death-transition frames.
- `[hidden]` is already styled globally (`public/style.css:127`), and the debug dialog owns `z-index: 5`, so a readout at `z-index: 4` is covered by the dialog but visible during play.

## What We're NOT Doing

- No changes to `GameStateSnapshot`, the codec, the provider's copy semantics, or any reducer — this change only measures them.
- No optimization of the per-frame snapshot/publish pattern, and no new provider API for it.
- No persistence, no telemetry events, no file export or download of samples, no capture-time recording.
- No Playwright test: instrumented timing and aggregation is explicitly excluded by the repository's Playwright admission gate; browser verification stays manual.
- No new npm script; no rename of existing scripts; no changes to `test:ci`/`validate:deployment`.
- No game-wide sampling: the monitor exists only while the gameplay scene is active and enabled.

## Implementation Approach

One pure statistics module in the application layer owns the rolling window and all derived numbers; it receives an injected clock so it stays testable and free of browser globals. A single instance is created in the game composition root and shared through the game registry. The gameplay scene owns the Phaser frame hooks and the step markers, attaching them only while enabled. The UI receives samples through a typed port and a dumb DOM component, following the existing adapter/component convention; the panel's visibility is driven by the monitor's own `enabled` flag so the toggle is the single source of truth.

## Critical Implementation Details

- **Frame brackets must use the game emitter** (`this.game.events`) with the exact names `prestep`, `poststep`, `prerender`, `postrender`; `step` fires before the scene update and is therefore unusable for step attribution. `step` is already used by two UI adapters, so do not repurpose it.
- **Frame interval is measured from `now()` differences at `prestep`**, never from the `delta` argument, which Phaser smooths and accumulates.
- **Early returns**: call `stepEnded()` immediately before the `return` at `:461` and before the `return` at `:463`; `updatePhaseEnded()` must also close any open step as a safety net.
- **Disabled overhead budget**: markers check a private boolean before calling the monitor, and the four frame listeners are attached only while enabled and removed on disable and on scene shutdown.
- **The update-phase row legitimately exceeds the sum of step rows**: it brackets `prestep`→`poststep`, which includes the `step`-event UI listener work that runs before the scene update, plus marker overhead. Document this in the readout's label text; do not "fix" it by moving UI work.

## Phase 1: Pure measurement core

### Overview

Deliver the statistics module and prove it with unit tests, before any wiring exists.

### Changes Required:

#### 1. Monitor module

**File**: `src/game/application/performanceMonitor.ts` (new, pure)

**Intent**: Aggregate named per-frame durations plus frame-level pacing into a rolling snapshot the scene can feed and the UI can render. Nothing here knows about Phaser or the DOM.

**Contract**: Export `performanceStepIds` in this order — `input-intent`, `state-snapshot`, `state-commit`, `feedback-and-ship-sync`, `planets`, `weapon-asteroids`, `removals-effects`, `cargo-commodities` — and the types `PerformanceDurationSummary` (`averageMs`, `minimumMs`, `maximumMs`, `sampleCount`), `PerformanceStepSummary` (summary plus `id`), and `PerformanceSnapshot` (`enabled`, `windowMs`, `loopsPerSecond`, `frameCount`, `frameInterval`, `updatePhase`, `sceneRender`, `unaccounted`, and `steps` in declared order with all ids always present). Export `createPerformanceMonitor({ now, windowMs = 5000 })` returning: `setEnabled(enabled)`, `isEnabled()`, `frameStarted()`, `stepStarted(id)`, `stepEnded()`, `updatePhaseEnded()`, `renderStarted()`, `renderEnded()`, `snapshot()`.

Semantics to implement exactly: every recording method returns immediately when disabled; `setEnabled` clears all samples so re-enabling starts a fresh window; `frameStarted()` records the frame start, derives the interval from the previous start (first frame records none) and drops samples older than `windowMs` relative to the newest timestamp; `stepStarted(id)` closes the currently open step and opens the new one; `updatePhaseEnded()` closes any open step and records `now - frameStart`; `renderStarted()`/`renderEnded()` record the render span; `unaccounted` is `max(0, frameInterval - updatePhase - sceneRender)` evaluated per frame using that frame's own values; `loopsPerSecond` is `(frameCount - 1) / ((newest - oldest) / 1000)` with at least two samples in the window, else 0; summaries are unrounded averages/minima/maxima with counts.

#### 2. Unit tests

**File**: `tests/domain/performanceMonitor.test.mjs` (new; picked up by the existing `test:domain` glob, no script edit)

**Intent**: Prove the window, the statistics, the marker chain and the disabled path using the repository's existing `transpileModule` harness and a fake clock.

**Contract**: Cover — a fresh snapshot exposes all eight step rows zeroed with `enabled: false`; every recording call is a no-op while disabled; with a fake clock, a step's average/minimum/maximum/count match known durations; `stepStarted('a')` then `stepStarted('b')` attributes the elapsed span to `a`; `stepEnded()` closes a step so a following `updatePhaseEnded()` does not double-count it; a step left open when `updatePhaseEnded()` runs is closed rather than dropped; samples older than 5000 ms are pruned (e.g. 60 frames 16.67 ms apart yield `loopsPerSecond` ≈ 60); `unaccounted` never goes below zero; re-enabling clears earlier samples.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:domain` passes, including the new monitor suite's window, statistics, chain-mark, early-close, loop-rate and reset cases.
- `npm.cmd run typecheck` passes.
- `npm.cmd run test:architecture` still passes (the new module imports nothing external and uses no browser global).

---

## Phase 2: Debug-controlled readout

### Overview

Wire the monitor into the gameplay frame, expose it through the debug menu, and render it on demand.

### Changes Required:

#### 1. Composition root and scene wiring

**Files**: `src/game/main.ts`, `src/game/scenes/gameScene.ts`

**Intent**: Create one monitor instance for the game, then let the gameplay scene feed it and toggle it without affecting anything else.

**Contract**: In the post-boot hook next to `gameStateProvider`, register `game.registry.set('performanceMonitor', createPerformanceMonitor({ now: () => performance.now(), windowMs: 5000 }))`. In `gameScene.ts`: fetch the monitor from the registry in `create`, force it disabled, and emit a hide sample; add a private boolean mirror so each marker is a single field read; place marks at the start of each stage — `:419` `input-intent`, `:432` `state-snapshot`, `:435` `state-commit`, `:448` `feedback-and-ship-sync`, `:489` `planets`, `:494` `weapon-asteroids`, `:497` `removals-effects`, `:521` `cargo-commodities` — call `stepEnded()` before the returns at `:461` and `:463` and at the end of the body, and never reorder or move the existing statements. Subscribe to `debug-performance-monitor`; on enable: `setEnabled(true)`, attach the four frame listeners (`prestep` → `frameStarted()`, `poststep` → `updatePhaseEnded()`, `prerender` → `renderStarted()`, `postrender` → `renderEnded()`), and emit `performance-monitor-sample`; on disable: detach the listeners, `setEnabled(false)`, and emit `performance-monitor-sample` once more so the panel hides. While enabled, emit `performance-monitor-sample` at most every 250 ms using the frame `time` already passed to `update`. Remove the listeners, the debug subscription and the enabled state in the existing `shutdown` handler.

#### 2. Debug control

**Files**: `index.html`, `src/ui/setupUi.ts`, `src/ui/components/displayLabels.ts`

**Intent**: Add the on-demand toggle following the existing debug-toggle pattern exactly, including the reset path so the monitor never survives scene re-entry.

**Contract**: Add `#debug-performance-toggle` (with `aria-pressed="false"`) to the debug panel. In `setupUi.ts` query it and include it in the missing-element guard; hold local `performanceMonitorEnabled = false`; render its label and `aria-pressed` in `renderDebugToggles`; on click flip it, `game.events.emit('debug-performance-monitor', value)` and re-render; reset it to false in `resetDebugControls`; remove its listener in `destroy`. Add the control label plus the readout metric labels to `displayLabels` so tests do not duplicate literals.

#### 3. Readout port, component and styles

**Files**: `src/ui/contracts.ts`, `src/ui/adapters/performanceReadoutAdapter.ts` (new), `src/ui/components/performanceReadout.ts` (new), `public/style.css`

**Intent**: Expose the monitor as an immutable view model to a dumb DOM component that renders it and stays hidden unless enabled.

**Contract**: Re-export the snapshot types from `src/ui/contracts.ts` and declare `PerformanceReadoutPort extends UiHandle` with `getSnapshot()` and `subscribe(listener)`. The adapter reads the registry monitor, keeps the current snapshot, refreshes on `performance-monitor-sample`, and notifies subscribers only when the rendered values change (dedup key like `runStatusAdapter.ts:18-27`); `destroy()` removes the listener and clears subscribers, and `subscribe` emits immediately. The component mounts `#performance-readout`, renders one table whose rows are the five frame metrics (average and max) followed by the eight steps (average, minimum, maximum), formats milliseconds with two decimals and loops/second with one, appends a footer with the window length and frame count, sets `hidden` from `snapshot.enabled`, and returns an idempotent `UiHandle`. Add the panel to `index.html` with `data-game-input="ignore"`, `aria-live="off"`, an accessible name and `hidden`; style it top-left, monospace, `pointer-events: none`, `z-index: 4` so the debug dialog (`z-index: 5`) covers it; mount and destroy it in `setupUi.ts` next to the other ports.

#### 4. Component test

**File**: `tests/performanceReadout.test.mjs` (new) plus one line in the `test:ui-presentation` script

**Intent**: Prove rendering, visibility and teardown without a browser, using the repository's fake-element pattern.

**Contract**: With a fake port, assert that all thirteen rows render with formatted values from a snapshot, that the panel is hidden when `enabled` is false and visible when true, that a pushed snapshot re-renders, and that `destroy()` unsubscribes and is idempotent. Extend — do not rename — the `test:ui-presentation` script to include the new file.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:ui-presentation` passes, including the new readout component test.
- `npm.cmd run test:fast` passes (unit plus architecture, covering the new files, the contracts re-export and filename rules).
- `npm.cmd run typecheck` passes.
- `npm.cmd run build-nolog` succeeds with the new modules bundled.

#### Manual Verification:

- Pressing `D` and toggling "Performance monitor" ON makes the panel appear immediately and refresh about four times per second; toggling OFF hides it at once.
- Closing the debug dialog keeps the monitor running and the panel visible while gameplay continues.
- With the monitor OFF no panel is visible, gameplay is unaffected, and re-entering the gameplay scene starts with the toggle OFF.
- The numbers are plausible in flight: each step average is below the update-phase average, update phase + scene render + unaccounted is close to the frame interval, and loops/second is near the display refresh rate on a healthy desktop run.
- The panel never intercepts clicks or keyboard input.

---

## Phase 3: Overhead and correctness validation

### Overview

Confirm the instrument is cheap and the readings are trustworthy, and leave a baseline record for future comparison.

### Changes Required:

#### 1. Validation record

**File**: `context/changes/req01-performance-monitor/verification.md` (new, produced during this phase)

**Intent**: Capture what the monitor showed on a real machine so a later regression can be compared against it, and record the measured overhead of the instrument itself.

**Contract**: Record the browser and machine, the observed loops/second, frame interval, update phase, scene render and unaccounted averages, the per-step averages, and the frame-interval comparison between monitor-off and monitor-on in the same gameplay spot.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:fast` passes on the final tree.
- `npm.cmd run typecheck` passes on the final tree.

#### Manual Verification:

- A two-to-three minute normal-gameplay session with the monitor on shows no visible stutter, and the instrument's own cost is judged acceptable from the on-versus-off frame intervals.
- Baseline numbers and the overhead comparison are recorded in the verification file.
- No regression in unrelated behaviour: menu, landing, trade and return-to-menu still work, and no console error appears while toggling the monitor.

---

## Testing Strategy

### Unit Tests:

- Monitor module: window pruning, average/minimum/maximum/count, marker chaining, early-close safety, loop-rate derivation, unaccounted floor, disabled no-op, reset on enable.

### Integration Tests:

- Readout component with a fake port: row rendering, formatted values, enabled-driven visibility, re-render on push, idempotent destroy.
- Architecture suite: the new application module stays pure; the new component imports only UI contracts and labels.

### Manual Testing Steps:

1. `npm.cmd run dev-nolog`, press `D`, toggle the monitor on, and confirm the panel appears and updates.
2. Fly, fire, land and return to the menu; confirm the panel survives flight and disappears after returning.
3. Re-enter a game and confirm the toggle is off and no panel is shown.
4. Compare frame interval with the monitor on and off at the same spot.

## Performance Considerations

The disabled path adds one boolean read per marker and no listeners. The enabled path adds eight `now()` reads per frame, a handful of arithmetic operations, one snapshot build and one DOM write every 250 ms; `unaccounted` exists precisely so the readout's own cost is visible rather than hidden. No new allocation happens per frame beyond the small sample records that the window retains.

## Migration Notes

Not applicable: no snapshot schema, persistence or saved data is touched. `change.md` moves `preparing` → `planned` at save time, and `roadmap.md` is left untouched because it has no item with this Change ID.

## References

- Frame brief: `context/changes/req01-performance-monitor/frame.md`
- Research: `context/changes/req01-performance-monitor/research.md`
- Update body and early returns: `src/game/scenes/gameScene.ts:418-523`
- State cost model: `src/game/application/gameStateProvider.ts:19-28`, `:51-55`; `src/game/application/gameStateCodec.ts:117`, `:406`, `:454-456`
- Phaser frame events and pacing: `node_modules/phaser/dist/phaser.js:18024-18056`; `node_modules/phaser/src/core/events/*.js`
- Reusable patterns: `src/ui/setupUi.ts:79-92`, `:135-182`; `src/ui/adapters/runStatusAdapter.ts:18-29`; `src/ui/components/displayLabels.ts`; `public/style.css:83`, `:127`, `:158`, `:189`
- Test harness: `tests/run-status-clock.test.mjs:6-23`; `tests/landing-status.test.mjs:18-54`; `tests/architecture.test.mjs:116-130`
- Lessons: `context/foundation/lessons.md` (reuse display-label constants)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pure measurement core

#### Automated

- [x] 1.1 `test:domain` passes with the new monitor suite covering window, statistics, chain marks, early close, loop rate and reset
- [x] 1.2 `typecheck` passes
- [x] 1.3 `test:architecture` still passes with the pure module in place

### Phase 2: Debug-controlled readout

#### Automated

- [ ] 2.1 `test:ui-presentation` passes with the new readout component test
- [ ] 2.2 `test:fast` passes covering the new files, contracts re-export and filename rules
- [ ] 2.3 `typecheck` passes
- [ ] 2.4 `build-nolog` succeeds with the new modules bundled

#### Manual

- [ ] 2.5 Toggling the monitor on shows the panel immediately at ~4 updates per second; toggling off hides it at once
- [ ] 2.6 Closing the debug dialog keeps the monitor running and the panel visible during gameplay
- [ ] 2.7 With the monitor off there is no panel and no gameplay impact, and re-entering the scene starts with the toggle off
- [ ] 2.8 The numbers are plausible and the panel never intercepts clicks or keyboard input

### Phase 3: Overhead and correctness validation

#### Automated

- [ ] 3.1 `test:fast` passes on the final tree
- [ ] 3.2 `typecheck` passes on the final tree

#### Manual

- [ ] 3.3 A two-to-three minute gameplay session with the monitor on shows no visible stutter and acceptable on-versus-off overhead
- [ ] 3.4 Baseline numbers and the overhead comparison are recorded in the verification file
- [ ] 3.5 Menu, landing, trade and return-to-menu still work with no console error while toggling
