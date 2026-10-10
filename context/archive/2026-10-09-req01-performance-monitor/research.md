---
date: 2026-10-09T19:51:06+02:00
researcher: Codex
git_commit: 6dfa4e2088f297a399ade1a8984b07b0203f4400
branch: main
repository: MilkyWayTrader
topic: "Runtime performance diagnosis: debug-controlled monitor for update-loop step timings and frame pacing"
tags: [research, performance, debug-menu, frame-pacing, state-provider]
status: complete
last_updated: 2026-10-09
last_updated_by: Codex
---

# Research: Runtime performance diagnosis of the update loop and frame pacing

**Date**: 2026-10-09T19:51:06+02:00
**Researcher**: Codex
**Git Commit**: `6dfa4e2088f297a399ade1a8984b07b0203f4400`
**Branch**: `main`
**Repository**: MilkyWayTrader

## Research Question

Seed from `frame.md` in this same change folder (verbatim, condensed):

- **Reported observation**: "as now I'm unable to tell if something makes game slow - what it is".
- **User's proposed direction**: a performance monitor that can be enabled/disabled from the debug menu (with a button), collecting CPU time usage during the game update loop — how many loops per second the game does, and per task in the update loop: how many steps the update loop has and how much time each step takes as avg, min, max.
- **Pre-dispatch narrowing**: include rendering and browser frame time; slowdowns matter across normal gameplay; per-loop samples with rolling summaries.
- **Framed problem to plan around**: "the developer lacks runtime evidence to distinguish expensive game-update work from renderer/browser frame-pacing problems during ordinary gameplay."

The questions this research had to answer before planning: (1) where in the running frame does work actually happen, and are there identifiable update steps today; (2) which primitives can sample per-step CPU time and count loops per second; (3) how to obtain renderer/browser frame pacing as a number separate from scene-update CPU time; (4) through which existing control and presentation seams a debug toggle plus readout can be added; (5) which placement, lifecycle and validation gates constrain that work.

## Summary

- The active gameplay frame has exactly one scene update override — `Game.update` ([gameScene.ts:418](../../../src/game/scenes/gameScene.ts:418)) — and its body carries no named step boundaries, so "how many steps the update loop has" is not derivable from code today; a decomposition has to be introduced. A search of the five modules in `src/game/scenes/` for `update (` returned only that line.
- Inside this inspected body, only `stateProvider.update(...advanceGameSimulation...)` ([gameScene.ts:435](../../../src/game/scenes/gameScene.ts:435)) is simulation; the steps from line 465 to the end are presentation reconciliation (objects, effects, audio, camera, backgrounds). Two `return` statements ([gameScene.ts:461](../../../src/game/scenes/gameScene.ts:461), [:463](../../../src/game/scenes/gameScene.ts:463)) exit the frame early, so a single start/end timer around the method would silently drop samples on death-transition frames.
- The state boundary is the largest *statically traceable* per-frame cost model in this path: given the call sites found below, one active-Game frame performs a derived 21 full validating `decodeGameState` passes and 10 full `JSON.stringify` passes of the whole aggregate — 5 of the decodes and 2 of the serializations are inside `Game.update` itself; the rest come from UI ports that re-snapshot inside the same publish/step.
- Phaser 4.0.0 emits, once per loop iteration on the game event emitter, `PRE_STEP → STEP → scene updates → POST_STEP → renderer.preRender → PRE_RENDER → scene.render → renderer.postRender → POST_RENDER` (`node_modules/phaser/dist/phaser.js:18024-18056`). That gives native update-vs-render brackets; the `delta` passed to `Scene.update` is smoothed and accumulated, so raw frame duration must come from `game.loop.rawDelta` or differenced raw `time`.
- No measurement code was found in the scopes inspected here: a search of `src/`, `tests/`, `scripts/` and `vite/` for `performance.now`, `requestAnimationFrame` and `actualFps` returned no hits, neither `index.html` nor `public/style.css` contains an fps/perf/frame readout, and a case-insensitive search of `context/` (see Related Research) found no performance-instrumentation artifact other than this change's own frame. The debug-menu control path (DOM button → `game.events` → scene handler) and a DOM readout port pattern both already exist and are reusable.
- The existing telemetry port is not a carrier for this data: it is session/allowlisted-event shaped with a 20-entry queue and is destroyed with the UI ([telemetry.ts](../../../src/game/application/telemetry/telemetry.ts:41), [:63](../../../src/game/application/telemetry/telemetry.ts:63)), and the accepted S-10 plan explicitly excludes frame-level telemetry (`context/changes/s10-player-sign-in-status/plan.md:20`).
- A monitor that samples every step every frame and also repaints a readout every frame risks becoming the cost it measures; the observed precedent for decoupling display cadence is the injected `IntervalScheduler` in [runStatusClock.ts:6-10](../../../src/ui/components/runStatusClock.ts:6).

## Detailed Findings

### 1. The active gameplay frame: stages, order, early exits

`Game.update` ([gameScene.ts:418-523](../../../src/game/scenes/gameScene.ts:418)) is a single method body with no internal extraction. Ordered stages inside it, with the exact line where each starts (this inspected body only):

| # | Stage | Start line | Category |
| --- | --- | --- | --- |
| 1 | Steering pointer → world point (uses the previous frame's inverse camera matrix, comment at :423), joystick update, joystick target build | `gameScene.ts:419` | input intent |
| 2 | `before = stateProvider.snapshot()`; Moolaris contact resolve; `stateProvider.update(...advanceGameSimulation...)` | `gameScene.ts:432` / `:433` / `:435` | snapshot + simulation (single commit) |
| 3 | Moolaris crash feedback; cargo-full detection (loose-item `Math.hypot` scan + cargo reduce); blocked-pickup audio throttle; death transition | `gameScene.ts:448` / `:449` / `:452` / `:459` | post-simulation feedback |
| 4 | Ship `synchronize`; `lossOfControl` visibility; sun `synchronize`; ship audio; camera zoom/roundPixels/centerOn; background tiles | `gameScene.ts:475` / `:476` / `:477` / `:479` / `:481` / `:487` | presentation |
| 5 | Per-planet loop: `synchronize`, `update`, `updateLandingIndicator` | `gameScene.ts:489` | presentation |
| 6 | Weapon `synchronize`; visible asteroid fragmentation; asteroid `synchronize` | `gameScene.ts:494` / `:495` / `:496` | presentation / effects |
| 7 | Destroyed-cargo loop (audio + `worldView`-gated explosions); sun-consumed-item loop; collected-item count + audio throttle | `gameScene.ts:497` / `:505` / `:515` | presentation / effects |
| 8 | Cargo `synchronize`; commodity `synchronize` | `gameScene.ts:521` / `:522` | presentation |

Two guards return before stages 4-8 finish, both after the simulation commit:

- `gameScene.ts:459-462` — on the frame where `terminalResult` first becomes non-null, it starts the death transition and returns at `:461`.
- `gameScene.ts:463` — once `deathTransitionStarted` is set, every subsequent frame returns there.

Consequences for instrumentation (observed, not inferred): stages 4-8 are skipped on those frames while stages 1-3 still ran, so per-step sampling cannot rely on reaching the method's end, and a monitor that treats "update returned early" as a slow or fast frame would misread the death-transition sequence.

Pause does not stop the frame: `update` and the provider `update()` run every step, while simulation work is skipped inside the reducer — `advanceGameSimulation` ([gameSimulation.ts:72](../../../src/game/mechanics/gameSimulation.ts:72)) advances the clock at `:81`, derives `activeDeltaMs` at `:82` and returns the state unchanged when `activeDeltaMs <= 0` at `:83`. Movement is additionally clamped to 100 ms per active step (`gameSimulation.ts:107`). A monitor therefore needs the pause/active distinction when labelling its samples.

Phaser's per-iteration skeleton around that method, in the installed Phaser 4.0.0 build (`node_modules/phaser/dist/phaser.js`, standard renderer game step; the same build carries an unused headless variant at `:18093-18112`, and this app configures `type: AUTO` at `src/game/main.ts:23`):

| Line | Call |
| --- | --- |
| `18015-18018` | `if (this.isPaused)` early return |
| `18024` | `emit(PRE_STEP, time, delta)` |
| `18028` | `emit(STEP, time, delta)` — before scene updates |
| `18032` | `this.scene.update(time, delta)` → `Game.update` |
| `18036` | `emit(POST_STEP, time, delta)` |
| `18042` / `18044` | `renderer.preRender()` then `emit(PRE_RENDER, renderer, time, delta)` |
| `18048` | `this.scene.render(renderer)` |
| `18052` / `18056` | `renderer.postRender()` then `emit(POST_RENDER, renderer, time, delta)` |

The same `PRE_STEP/STEP/POST_STEP/PRE_RENDER/POST_RENDER` names are declared in the public typings at `node_modules/phaser/types/phaser.d.ts:6555-6588`. Two details matter for a monitor: `STEP` fires **before** the scene update, so a listener on `step` cannot see the current frame's scene work; and `PRE_RENDER → POST_RENDER` brackets only `scene.render`, because `renderer.preRender()`/`postRender()` are invoked outside that emit pair.

### 2. Per-frame cost concentration at the state boundary

Cost model of the boundary, on this inspected path:

- `GameStateProvider.snapshot()` returns `decodeGameState(encodeGameState(this.state))` ([gameStateProvider.ts:19-21](../../../src/game/application/gameStateProvider.ts:19)).
- `encodeGameState` is `JSON.stringify(decodeGameState(snapshot))` ([gameStateCodec.ts:454-456](../../../src/game/application/gameStateCodec.ts:454)), so one `snapshot()` call is two full validating decodes plus one full serialization.
- `decodeGameState` ([gameStateCodec.ts:117](../../../src/game/application/gameStateCodec.ts:117)) requires the 19 top-level keys, enforces `schemaVersion === 17` (`:124-125`) and per-field rules, then returns `cloneAndFreeze({...})` ([gameStateCodec.ts:406](../../../src/game/application/gameStateCodec.ts:406), helper at `:104-115`), i.e. a freshly built, deeply frozen tree.
- `GameStateProvider.update()` decodes the reducer result and then publishes ([gameStateProvider.ts:24-28](../../../src/game/application/gameStateProvider.ts:24)); `publish()` calls `snapshot()` once and invokes every subscribed listener with that snapshot ([gameStateProvider.ts:51-55](../../../src/game/application/gameStateProvider.ts:51)).

Call sites that execute on one active-Game frame, verified by reading each callee:

| Call site | Per frame | Why it runs | Derived decodes | Derived stringifies |
| --- | --- | --- | --- | --- |
| `gameScene.ts:432` `stateProvider.snapshot()` | 1 | frame's "before" state | 2 | 1 |
| `gameScene.ts:435` `stateProvider.update(...)` | 1 | simulation commit + `publish()` snapshot | 3 | 1 |
| `runStatusAdapter.ts:20` inside `refresh` | 1 (publish) + 1 (`step`) | `provider.subscribe(refresh)` at `:28` and `game.events.on('step', refresh)` at `:29` | 4 | 2 |
| `landingStatusAdapter.ts:75`, plus `:65`, `:68`, `:69` reached through `refresh` | 4 | `refresh` (`:73-90`) calls `projectFacilities()`, `projectShipyard()`, `project()`; `provider.subscribe(refresh)` at `:95` | 8 | 4 |
| `cargoTransferAdapter.ts:51` inside `project` | 1 (publish) + 1 (`step`) | `provider.subscribe(refresh)` at `:101`, `project()` at `:96`, `game.events.on('step', step)` at `:104` | 4 | 2 |
| **Derived total for this inspected path** | | | **21** | **10** |

The three adapters are mounted unconditionally in the UI composition, so the total above applies whenever `Game` is active and the UI is set up: `mountRunStatus(root, createRunStatusPort(game))` at [setupUi.ts:40](../../../src/ui/setupUi.ts:40), `mountLandingStatus(...)` at [:72](../../../src/ui/setupUi.ts:72), `mountCargoTransfer(...)` at [:73](../../../src/ui/setupUi.ts:73). The `landingStatusAdapter` snapshots are not conditioned on being landed — `refresh` guards only on `destroyed`/`refreshSuppressed` ([landingStatusAdapter.ts:73-75](../../../src/ui/adapters/landingStatusAdapter.ts:73)). This arithmetic is derived from the anchored call sites and the codec/provider semantics above, not from a measurement; it is the strongest static candidate for follow-up measurement, and it sits **outside** the scene's own update stages 4-8 while occurring inside the same frame.

Two conditional additions to that model:

- `cargoTransferAdapter.refresh` calls `provider.update(...)` at `cargoTransferAdapter.ts:97-98` when cargo-transfer visibility flips, i.e. a nested publish from inside a publish listener on transition frames.
- Call sites outside the frame loop: `gameScene.ts:369`/`:373` (window blur/focus pause reasons), `gameScene.ts:398` (`hasInputBlockingPause`, called from the keydown handler) and `setupUi.ts:105` (debug-menu re-render).

### 3. Measurement primitives available

Loop rate and frame duration, from the installed Phaser 4.0.0 sources:

- `game.loop` is a `Phaser.Core.TimeStep`; `actualFps` is documented as an exponential moving average (`node_modules/phaser/types/phaser.d.ts:6727`) and is recomputed once per second as `0.25 * framesThisSecond + 0.75 * actualFps` (`node_modules/phaser/src/core/TimeStep.js:645`, recomputation triggered at `:681-684`), with `framesThisSecond` incremented per step (`:686`).
- `rawDelta` is "the actual elapsed time in ms between one update and the next" with no smoothing, capping or averaging (`phaser.d.ts:6828`); in the step it is set from consecutive timestamps as `Math.max(0, time - this.lastTime)` (`TimeStep.js:666-668`).
- The value forwarded into `Scene.update` is not `rawDelta`: the step applies `smoothDelta` when `smoothStep` is true (default `true`, `TimeStep.js:435`, `:563`, `:673-676`), accumulates it into `this.delta` (`:679`) and invokes `this.callback(time, this.delta)` (`:688-690`). Phaser's own high-resolution clock is `window.performance.now` (`TimeStep.js:470`, `:496`, `:542`, `:756`).
- No public draw-call or renderer-work counter is exposed by the typings; the only `drawCount` field found sits in an internal renderer type (`phaser.d.ts:116287`), so a renderer-side statistic would require internal API.

Update-vs-render attribution: combine `PRE_STEP`/`POST_STEP` (update phase, including the scene update at `phaser.js:18032`) with `PRE_RENDER`/`POST_RENDER` (scene render, `phaser.js:18044-18056`); the interval between `POST_RENDER` and the next `PRE_STEP` is browser/idle time. `game.loop.callback` is a public mutable property (`phaser.d.ts:6744`) if wrapping the step is ever preferred; the event route avoids that. All of these hooks are game-wide, and `src/game/main.ts:39-44` registers five scenes (Boot, Preloader, MainMenu, Game, GameOver), so scoping samples to gameplay is a decision rather than a property of the hook.

Existing measurement in the repo: none. Searches of `src/`, `tests/`, `scripts/` and `vite/` for `performance.now`, `requestAnimationFrame` and `actualFps` returned no hits; the only wall-clock reads are `Date.now()` at [browserTelemetry.ts:16](../../../src/ui/adapters/browserTelemetry.ts:16), [cargoTransferAdapter.ts:60](../../../src/ui/adapters/cargoTransferAdapter.ts:60) and [:103](../../../src/ui/adapters/cargoTransferAdapter.ts:103), and `tests/domain/gameState.test.mjs:713-728` stubs `Date.now`. `index.html` and `public/style.css` contain no fps/perf/frame readout.

Closest precedents for a low-cadence readout: `RunStatusClock` takes an injected `IntervalScheduler` and refreshes on a 500 ms `setInterval` only while paused ([runStatusClock.ts:6-10](../../../src/ui/components/runStatusClock.ts:6), `:77`), unit-tested with a fake scheduler (`tests/run-status-clock.test.mjs:41-60`); `landingStatus.ts:102` calls `window.setInterval(updateLandedBadge, 500)` directly. Frame-driven DOM refreshes already exist through the adapters' `step`/`subscribe` handlers, and an in-scene overlay precedent exists too: Phaser `Text` with `setScrollFactor(0)` and `ObjectDepth.UI` ([gameScene.ts:129-139](../../../src/game/scenes/gameScene.ts:129)).

### 4. Debug-menu control surface and readout contract

Round trip for the three existing toggles, end to end:

1. Markup: `#debug-menu` dialog at [index.html:59-74](../../../index.html:59), with `#debug-touch-controls-toggle`, `#debug-mouse-movement-toggle`, `#debug-booster-toggle` carrying `aria-pressed` (`index.html:63-65`).
2. Wiring: elements are queried at [setupUi.ts:79-91](../../../src/ui/setupUi.ts:79); the composition throws if any is missing ([setupUi.ts:92](../../../src/ui/setupUi.ts:92)). Local state and label/`aria-pressed` rendering live in `renderDebugToggles` ([setupUi.ts:135-143](../../../src/ui/setupUi.ts:135)); each toggle flips local intent, emits through the game event emitter and re-renders ([setupUi.ts:146-148](../../../src/ui/setupUi.ts:146)); listeners are attached at `setupUi.ts:168-178` and removed in `destroy` (`setupUi.ts:211-228`).
3. Behavior: the scene subscribes in `create` — `debug-touch-controls`, `debug-mouse-movement`, `debug-booster` at [gameScene.ts:150-152](../../../src/game/scenes/gameScene.ts:150) — and removes the same handlers on shutdown (`gameScene.ts:173-175`).
4. Reset: the scene emits `debug-controls-reset` in `create` ([gameScene.ts:94](../../../src/game/scenes/gameScene.ts:94)); `setupUi` handles it by restoring defaults, hiding the menu and re-rendering ([setupUi.ts:156-162](../../../src/ui/setupUi.ts:156), subscribed at `:179`). A new toggle that keeps local UI state must participate here or it will desynchronise on re-entry.
5. Guards: the menu opens/closes from the `d` key unless focus is inside `[data-game-input="ignore"]` ([setupUi.ts:163-167](../../../src/ui/setupUi.ts:163)); every debug action is suppressed while `terminalDeathTransitionActive` ([setupUi.ts:145-153](../../../src/ui/setupUi.ts:145), set at `:180-181`), which matches the archived S07 review note that the terminal transition blocks the debug menu.

Presentation contract for a readout, as used by existing ports: `UiHandle` is just `destroy(): void` ([contracts.ts:1-4](../../../src/ui/contracts.ts:1)); rich ports extend it with `getSnapshot()` and `subscribe(listener)` (e.g. `RunStatusPort` at `contracts.ts:21-25`), components receive a root element plus the typed port and return a `UiHandle` whose `destroy` is idempotent, and adapters obtain state from `game.registry.get('gameStateProvider')`. A lighter precedent for a self-contained debug control is `bindDebugCargoControl(button, events, label, canSpawn, close): () => void` ([debugCargoControl.ts:13-26](../../../src/ui/components/debugCargoControl.ts:13)), which injects only a typed `{ emit }` and returns a disposer. User-visible strings belong in `displayLabels` ([displayLabels.ts](../../../src/ui/components/displayLabels.ts:1)), which already holds `teleportToAsteroid`, `spawnDebugCargo` and the debug level labels; `lessons.md` makes that a standing rule for implement and impl-review. Interactive partials carry `data-game-input="ignore"` so gameplay input does not depend on control ids.

### 5. Placement, lifecycle and validation gates

Architecture (`context/foundation/architecture.md`, Layers and Presentation ownership) and its enforcement test (`tests/architecture.test.mjs`) constrain where this code may live:

- `game/application` may import only `game/application`, `game/domain`, `game/state` (`tests/architecture.test.mjs:56`, helper at `:37-50`) and may not use the browser globals matched by `/document|window|HTMLElement|HTMLCanvasElement|KeyboardEvent|TouchEvent/` (`tests/architecture.test.mjs:40-49`). `performance` is *not* in that pattern, so purity there rests on convention — the established convention is injection, as `TelemetryDependencies` injects `now`, `uuid`, `storage` and `fetch` ([telemetry.ts:26-38](../../../src/game/application/telemetry/telemetry.ts:26)) with the browser value supplied at the adapter edge ([browserTelemetry.ts:16](../../../src/ui/adapters/browserTelemetry.ts:16)).
- `src/ui/components` may not import `phaser`, anything under `/src/game/`, or `/src/ui/adapters/` (`tests/architecture.test.mjs:116-130`), which is why components talk to typed ports.
- `test:architecture` also pins the single `new GameStateProvider(` construction point (`tests/architecture.test.mjs:93-115`), the canonical locations of shared visual/DOM modules (`:140-151`), and lower-camel-case `.ts` filenames (`:152-159`).
- `advanceGameSimulation`'s phases for reference: clock advance and pause gate (`gameSimulation.ts:81-83`), flight/input target (`:92`, `:104-108`), projectiles (`:129`), asteroid motions (`:179`), loose items (`:246`).

Lifecycle expectation from the same document: owners remove input/window/game listeners, colliders, cameras, scopes, timers and effects on shutdown, and re-entry must restore resource counts to baseline without duplicate callbacks. A scene-owned monitor listens in `create` and unlistens in the `shutdown` handler (pattern at `gameScene.ts:162-187`); a game-level `game.events` hook outlives scene restarts and must be removed by its owner.

Validation selection (AGENTS.md "Test selection" plus `context/foundation/testing.md`): a pure sampling/aggregation module is a Node unit-test concern (`test:domain` runs `tests/domain/**/*.test.mjs`), with the `ts.transpileModule` harness in `tests/run-status-clock.test.mjs:6-13` as the precedent for loading TS without a bundler; `typecheck` and `test:fast` cover configuration and cross-cutting local changes. Instrumented timing and aggregation is explicitly on the AGENTS.md list of things not to cover with Playwright, and its Playwright admission gate requires a player-visible failure plus a unique browser behaviour — a debug perf readout does not meet that bar as described.

No build, test or deployment command was run for this research; `dev-nolog`/`build-nolog` were not needed, and the `log.js` network call in `dev`/`build` is irrelevant here.

## Code References

- `src/game/scenes/gameScene.ts:418-523` — the single scene update body: input intent, snapshot, simulation commit, projection reconciliation, two early returns.
- `src/game/scenes/gameScene.ts:150-152`, `:173-175`, `:94` — debug event subscriptions, their teardown, and the reset emit.
- `src/game/application/gameStateProvider.ts:19-21`, `:24-28`, `:51-55` — `snapshot()`, `update()`, `publish()` semantics.
- `src/game/application/gameStateCodec.ts:117-125`, `:406`, `:454-456` — validating decode, deep freeze, and `encodeGameState` as `JSON.stringify(decode(...))`.
- `src/game/mechanics/gameSimulation.ts:72-83`, `:107` — reducer entry, active-delta gate, bounded movement step.
- `node_modules/phaser/dist/phaser.js:18024-18056` — once-per-iteration `PRE_STEP/STEP/scene.update/POST_STEP/preRender/PRE_RENDER/scene.render/postRender/POST_RENDER`.
- `node_modules/phaser/src/core/TimeStep.js:435`, `:645`, `:666-690` — `smoothStep` default, `actualFps` EMA, `rawDelta` vs forwarded smoothed delta.
- `node_modules/phaser/types/phaser.d.ts:6555-6588`, `:6727`, `:6828` — public event names, `actualFps`, `rawDelta`.
- `src/ui/setupUi.ts:40`, `:72-73`, `:79-92`, `:135-182` — port mounting, debug control lookup, toggle/reset wiring.
- `src/ui/adapters/runStatusAdapter.ts:20`, `:28-29`; `src/ui/adapters/landingStatusAdapter.ts:65-75`, `:84-86`, `:95`; `src/ui/adapters/cargoTransferAdapter.ts:51`, `:93-104` — per-frame re-snapshot call sites.
- `src/ui/components/debugCargoControl.ts:13-26`, `src/ui/contracts.ts:1-4`, `:21-25`, `src/ui/components/displayLabels.ts:1`, `src/ui/components/runStatusClock.ts:6-10`, `:77` — reusable control, port and constant precedents.

## Architecture Insights

- The frame already has an architectural seam: pure simulation behind `GameStateProvider.update`, then project-driven presentation. A monitor placed at the scene boundary can time those two phases without touching the reducer or the codec, and the `PRE_STEP`/`POST_STEP` pair attributes the whole update phase independently of where inside it a step sits.
- The state aggregate is the natural unit of measurement because every consumer already re-reads it per frame; the derived 21-decode/10-serialize figure is a property of the *existing* read pattern, so a plan should treat "how expensive is the snapshot/publish pattern" as a question the monitor answers rather than a change it makes. Any optimisation of that pattern is a separate, product-affecting change.
- Debug instrumentation in this repository is transient by convention: the archived S02 frame explicitly rejected persisting debug settings, and the reset path re-establishes defaults on every scene entry. A performance monitor's enabled flag and history should follow the same non-persisted, scene-scoped treatment unless the user asks otherwise.
- Labels, ports and idempotent teardown are the three places reviews in this repo look first, and all three have named conventions here; a readout that ignores them will not pass review even if the numbers are correct.

## Historical Context (from prior changes)

- `context/archive/2026-09-23-s02-direct-moving-system-flight/frame.md:13,21,30,34,38` — the `D`-opened debug menu was introduced there with a transient event bridge and pure scene settings; the frame records the explicit "Debug settings need persistence" verdict as `NONE` (input/control visibility are transient scene concerns). A performance toggle is a new instance of that same transient class.
- `context/archive/2026-10-05-salvage-motion-loot-debug/plan.md:19,36,46-47,147` — later debug controls reused the same route (DOM control emits a dedicated scene event; the scene turns it into a provider update), and that change deliberately did not add Playwright coverage for the debug control.
- `context/archive/2026-10-01-s07-environmental-hazards-and-death/reviews/impl-review.md:27` — "Terminal transition blocks the DOM debug menu and its input handlers", the behaviour now encoded in `terminalDeathTransitionActive`.
- `context/archive/2026-09-21-s01-anonymous-run-status/plan.md:20,106,194-196` — provider publishes every simulation frame and the DOM port must therefore deduplicate and update at most once per displayed second; that constraint is still visible in `runStatusAdapter.ts:18-27`.
- `context/archive/2026-09-23-s02-direct-moving-system-flight/plan.md:259-261` and `context/archive/2026-09-25-s03-guided-orbit-and-landing/plan.md:124,147-149` — earlier frame-time concerns were settled by reasoning plus manual browser profiling ("profile normal flight and confirm ... no visible frame-time regression"), which is consistent with this change's premise that no runtime evidence exists.
- `context/archive/2026-10-08-s16-planetary-facilities/plan.md:356-358` — the most recent quantified per-frame claim in the repository ("one sequential five-facility pass per crossed active second per planet"), again asserted analytically rather than measured.
- `context/changes/s10-player-sign-in-status/plan.md:20,126` — the accepted telemetry scope excludes per-frame/input/movement/clock-tick events and forbids emitting invalid actions, previews, controls, frames, movement or ticks.

## Related Research

- `context/archive/2026-10-01-s07-environmental-hazards-and-death/research.md` — establishes that telemetry cannot supply authoritative run time; relevant only as the same negative boundary reached here (telemetry is not the carrier for observability data).
- A case-insensitive search of `context/` for `frame time|frame pacing|performance monitor|profil` returned this change's own `frame.md`/`change.md` plus matches on unrelated words only — "profile"/"profiles" in the Google-account (`context/foundation/infrastructure.md:140`) and commodity-pricing (`context/archive/2026-10-08-s16-planetary-facilities/plan-brief.md:43`) senses. The six existing `research.md` files were listed individually and none of the matches above is a performance-instrumentation artifact.

## Open Questions

These are product/plan choices that the code does not dictate, listed so the planner resolves them rather than rediscovering them:

1. **Step granularity** — the stage table in section 1 is one defensible decomposition (8-9 steps); the plan must fix the actual named step list, since the code currently exposes none.
2. **Whether publish/listener work is a reported step** — the largest derived static cost sits in the UI adapters' re-snapshots; the plan must decide whether the readout attributes it (and whether it is in scope for this change at all).
3. **Rolling-window definition** — window length and unit (frames vs active seconds), the reported statistics (avg/min/max, count, maybe p95), and whether samples reset when the monitor is toggled.
4. **Loop-rate definition** — `game.loop.actualFps` (1 s EMA) versus an own frames-per-second counter; the two answer "how many loops per sec" differently.
5. **Readout surface and cadence** — DOM overlay versus in-scene Phaser `Text`, and the repaint interval (a per-frame repaint of a rolling table would itself be a measurement artefact).
6. **Scope** — gameplay-scene-only sampling versus game-wide, given that the Phaser hooks fire for all five registered scenes.
7. **Host-visible side effects** — whether the monitor may add a file anywhere (e.g. a downloadable sample dump) or must stay purely on-screen and in-memory.
