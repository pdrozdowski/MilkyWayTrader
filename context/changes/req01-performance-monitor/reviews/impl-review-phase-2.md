<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Debug-Controlled Performance Monitor

- **Plan**: context/changes/req01-performance-monitor/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Planned diff scope matched in `7586ebb`: `src/game/main.ts` (registry registration next to
  `gameStateProvider`), `src/game/scenes/gameScene.ts` (eight markers, four frame listeners,
  early-return closures, 250 ms sample push, teardown), `index.html`,
  `src/ui/setupUi.ts`, `src/ui/components/displayLabels.ts`, `src/ui/contracts.ts`,
  `src/ui/adapters/performanceReadoutAdapter.ts` (new), `src/ui/components/performanceReadout.ts`
  (new), `public/style.css`, `tests/performanceReadout.test.mjs` (new) and one edited
  `test:ui-presentation` line. No unplanned file, no new npm script, no dependency change.
- Scope barriers respected: no `GameStateSnapshot`/codec/provider/reducer edit, no persistence or
  telemetry event, no file export, no Playwright spec, no rename of an existing script.
- Marker order matches the Phase 1 `performanceStepIds` order exactly and each marker is guarded
  by the private boolean, so the disabled path stays one field read per marker
  (`src/game/scenes/gameScene.ts:246-254`).
- Frame brackets use the game emitter with the four contracted event names; `poststep` closes the
  update phase, and no marker reuses the `step` event that the UI adapters already own
  (`src/game/scenes/gameScene.ts:229-241`).
- Teardown is complete: the shutdown handler removes the debug subscription, detaches all four
  frame listeners, disables the monitor and emits the hide sample
  (`src/game/scenes/gameScene.ts:186-196`); `create` forces the monitor off and pushes the hide
  sample (`:99-105`).
- The readout is a dumb component over a typed port: ids resolved once, cells updated in place on
  refresh, `hidden` driven by `snapshot.enabled`, no port call after `destroy()`
  (`src/ui/components/performanceReadout.ts:29-100`).
- Success criterion evidence re-run on the reviewed tree: `npm.cmd run test:fast` → 79 domain,
  52 mechanics, 10 objects, 11 audio, 14 ui-presentation, 8 architecture, 0 failures;
  `npm.cmd run typecheck` → clean for both tsconfigs; `npm.cmd run build-nolog` → success.
- Manual rows 2.5-2.8 remain unchecked in Progress and are left for the human checklist; no
  false completion.
- Labelled `EXTRA`, both plan-backed and harmless: `#performance-readout-note` implements the
  "document the update-phase surplus in the readout's label text" instruction from Critical
  Implementation Details, and the adapter's `PerformanceStepId` re-export in `contracts.ts` is a
  type-only addition the component needs. The blank Min column on the five frame rows also MATCHES
  the plan's "(average and max)" wording rather than omitting data the component could show.

## Findings

### F1 - The two `update` early returns were restructured, which the plan forbade in general terms

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/scenes/gameScene.ts:527-537
- **Detail**: The contract asked for `stepEnded()` "before the returns at `:461` and `:463` … and
  never reorder or move the existing statements". Satisfying the first half required editing the
  second guard: `if (this.deathTransitionStarted) return;` became
  `if (this.deathTransitionStarted) { this.endPerformanceStep(); return; }`. Behaviour is
  preserved — `beginDeathTransition` still sets the flag and the next frame still exits early —
  and this is the only statement change in the body, but the plan does not say the insertion is a
  permitted exception, so a future reader comparing contract to code sees a contradiction inside
  the plan itself.
- **Fix**: Add one clause to the Phase 2 contract stating that inserting the closing calls is the
  only permitted change to those two statements.
- **Decision**: PENDING

### F2 - An unknown step id would render the literal label `undefined`

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/ui/components/performanceReadout.ts:66
- **Detail**: `displayLabels.performanceMonitorStepLabels[step.id]` is read without a fallback, so a
  snapshot carrying a step id outside the eight declared values writes the string `undefined` into
  the row's heading. Unreachable through `createPerformanceMonitor`, which only emits declared ids,
  but the component is the boundary that renders whatever the port hands it, and the readout is a
  debug surface a developer may extend first.
- **Fix**: Fall back to `?? step.id` so an unknown id renders as its raw identifier.
- **Decision**: PENDING

### F3 - The panel stops refreshing while the death transition keeps returning early

- **Severity**: • OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/game/scenes/gameScene.ts:527-537, :601
- **Detail**: The 250 ms push lives at the end of the body
  (`this.samplePerformanceMonitor(time)`), so the two early-return frames close the open step but
  never sample. From `beginDeathTransition` onward the scene returns early every frame, so an
  enabled readout freezes on its last numbers and stays visible until the scene shuts down. The
  contract addressed the early returns only for step closing, so this is an unstated gap rather
  than a contradiction; the cost is a stale panel during a terminal sequence in which the run is
  already over and the run-status HUD is hidden.
- **Fix A ⭐ Recommended**: Sample before both early returns as well, so the panel stays live
  through the death transition.
  - Strength: Keeps one rule — every completed frame may push a sample; the 250 ms throttle already
    prevents extra DOM writes.
  - Tradeoff: Two more call sites to keep in sync with any future early return.
  - Confidence: HIGH — the throttle and `lastPerformanceSampleAtMs` reset already make repeated
    calls harmless.
  - Blind spot: None verified in a browser; the freeze is read from the control flow.
- **Fix B**: Document the freeze in the Phase 2 contract as intended (the monitor reports the
  simulation loop, and a terminal sequence is outside its scope).
  - Strength: Zero code change; keeps the monitor's sampling tied to one exit point.
  - Tradeoff: A visible panel with frozen numbers is easy to mistake for a stalled measurement.
  - Confidence: MEDIUM — defensible, but the panel is the only debug surface and it stays on
    screen.
  - Blind spot: A reviewer could still read the stale panel as a defect.
- **Decision**: PENDING

## Quality Check

- Disabled cost: no listener is attached while off, and every marker plus both new private helpers
  return on a single boolean field read; no allocation happens on the disabled path.
- Enabled cost: four emitter callbacks plus eight `now()` reads per frame, one snapshot build and
  one DOM update per 250 ms; the adapter skips the subscriber notification when the serialized
  snapshot is unchanged, so an idle window does not re-render.
- Listener hygiene: frame listeners are attached inside the enable branch and detached in both the
  disable branch and shutdown, so the enable/disable cycle cannot stack duplicates.
- Visibility: `[hidden] { display: none !important; }` exists in `public/style.css:127`, and the
  panel's `z-index: 4` stays under the debug dialog's `z-index: 5`, so the panel cannot cover the
  toggle that controls it.
- Test sensitivity: the thirteen-row assertion, the id-order assertion and the
  `replaceChildrenCalls` counter would each catch a rebuild instead of an in-place update; the
  stale-push assertion catches a missing `unsubscribe()`.

## Review Notes

- Provenance: this pass was produced by a delegated review agent (`p2_review_drift`), which also
  wrote this report and committed the phase-2 Progress bookkeeping without being asked to. The
  orchestrator independently reproduced the automated criteria (`test:fast`, `typecheck`,
  `build-nolog`) on the reviewed tree and re-verified each finding against the code. The second,
  quality-focused delegated reviewer never received its task payload in this environment, so the
  quality and pattern dimensions are covered inside this single pass instead.
- Phase 1's four observations from `reviews/impl-review-phase-1.md` are still `Decision: PENDING`;
  their triage is independent of this report.
