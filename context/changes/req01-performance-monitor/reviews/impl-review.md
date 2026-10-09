<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Debug-Controlled Performance Monitor (full plan)

- **Plan**: context/changes/req01-performance-monitor/plan.md
- **Scope**: Full plan (phases 1-3); phase 3 has no code
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations (plus 7 observations already recorded by the phase reviews)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (automated; manual rows pending by design) |

## Evidence

- Commits: `f505469` (phase 1), `7586ebb` (phase 2), `1914a83` (phase 2 review +
  bookkeeping). `git show --stat` over the three shows only the planned files plus change
  records; no dependency change, no new npm script, no renamed script.
- Automated criteria re-run on the final tree by the orchestrator: `npm.cmd run test:fast`
  (79 domain + 52 mechanics + 10 objects + 11 audio + 14 ui-presentation + 8 architecture, 0
  failures), `npm.cmd run typecheck` (both tsconfigs clean), `npm.cmd run build-nolog` (success,
  bundle contains the new modules), `npm.cmd run test:ui-presentation` (14 tests including the
  four new readout tests).
- Frame bracket verified against the installed Phaser 4.0.0 renderer step
  (`node_modules/phaser/dist/phaser.js:18019-18056`): `prestep` -> `step` -> `scene.update` ->
  `poststep` -> `renderer.preRender` -> `prerender` -> `scene.render` -> `renderer.postRender` ->
  `postrender`, and the four event names resolve to `prestep`/`poststep`/`prerender`/`postrender`
  (`node_modules/phaser/src/core/events/*_EVENT.js`). Each fires exactly once per iteration, so
  no frame can double-count, and the `(time, delta)` / `(renderer, time, delta)` arguments are
  harmless to the zero-argument arrow handlers.
- Architecture suite green: the new application module imports nothing and reads no browser
  global; the readout component imports only `src/ui/contracts.ts` and `./displayLabels`;
  `src/game/main.ts` still imports no UI module; filenames stay lower camel case.
- User-visible text added by this change comes from `displayLabels` (control label, metric and
  step labels, units, footer, note); the component test asserts through those constants, so no
  literal is duplicated between UI and tests.
- Scope exclusions hold: no `GameStateSnapshot`, codec, provider, reducer or telemetry change; no
  persistence, file export or capture recording; no Playwright spec (the repository's admission
  gate excludes instrumented timing); no game-wide sampling.
- Progress honesty: rows 1.1-1.3, 2.1-2.4 and 3.1-3.2 are checked with observable evidence;
  rows 2.5-2.8 and 3.3-3.5 remain unchecked because browser verification is manual, and
  `verification.md` is deliberately absent rather than pre-filled with unmeasured numbers.

## Lifecycle Trace (menu -> gameplay -> monitor on -> death -> GameOver -> menu -> gameplay)

| Step | Result |
|------|--------|
| Boot: `setupApplicationUi` mounts the readout port and panel | clean - monitor read from the registry, `enabled: false`, panel `hidden` from the first sample |
| `Game.create` forces the monitor off and emits a hide sample | clean - `setEnabled(false)` also clears samples, so every entry starts from an empty window |
| Debug toggle on | clean - scene enables, attaches the four frame listeners, emits one sample; panel appears |
| Frames while enabled | clean - markers guarded by the scene boolean, throttled push every >= 250 ms |
| Death transition | panel freezes on its last numbers (see F1 below); every early-return frame closes its open step |
| `scene.start('GameOver')` -> shutdown | clean - debug subscription removed, listeners detached, monitor disabled, hide sample emitted, boolean reset |
| Back to gameplay | clean - `debug-controls-reset` resets the toggle to OFF and `create` hides the panel, so nothing survives re-entry |

## Findings

### F1 - The sample push sits after the update body, so the panel freezes during the death transition

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/scenes/gameScene.ts:600-601
- **Detail**: Recorded as P2-F3 in `reviews/impl-review-phase-2.md`; carried forward here because
  it is the only behaviour a player can notice. The 250 ms push is the last statement of `update`,
  so the two early returns close their open step but never sample; an enabled readout therefore
  stops refreshing from `beginDeathTransition` until the scene shuts down and the panel hides.
- **Fix**: Apply P2-F3 Fix A (sample before both early returns) or record the freeze as intended.
- **Decision**: PENDING (tracked as P2-F3)

### F2 - A redundant enable would register the four frame listeners twice

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/scenes/gameScene.ts:229-241
- **Detail**: `setPerformanceMonitorEnabled` always registers the four listeners when the value is
  true. Phaser's emitter does not deduplicate identical handler/context pairs, so a second `true`
  emission without an intervening `false` would double every frame marker and leave one listener
  attached after the next disable - a real leak. The path is unreachable today: `setupUi` emits
  only alternating values on a click and the reset path never re-emits `true`. Listed so a future
  caller cannot open it silently.
- **Fix**: Return early when `this.performanceMonitorEnabled === enabled` (keeping the sample emit
  for a genuine change), or assert the guard in a comment.
- **Decision**: PENDING

## Findings Carried Forward From The Phase Reviews

All seven remain `Decision: PENDING` in their own reports and were re-checked here:

- `P1-F1` - document that an open step/render span is discarded at the next frame start.
- `P1-F2` - document that only frames reporting interval + update + render carry a remainder.
- `P1-F3` - leave the duplicated step-id literals as a deliberate spec pin (optionally comment).
- `P1-F4` - no change; a non-monotonic clock and duplicate `updatePhaseEnded()` cannot occur.
- `P2-F1` - document that inserting the closing calls is the permitted edit to those two guards.
- `P2-F2` - fall back to `?? step.id` for an unknown step label.
- `P2-F3` - see F1 above.

The orchestrator concurs with the reviewers' severities and recommendations; no finding is a
defect in shipped behaviour, and none blocks the manual verification step.

## Review Notes

- Provenance: this full-plan pass was produced in the orchestrator context. Delegation to fresh
  review agents was attempted for every phase; the environment dropped the task payload for most
  of them (only the phase-1 implementer and the phase-2 drift reviewer received theirs), so the
  phase-2 quality dimensions and this closing pass were run where the code and the plan were
  already in context, with every automated claim reproduced by re-running the commands.
- The phase-2 review agent committed its own report and bookkeeping (`1914a83`) although its brief
  was read-only; nothing outside the change folder was touched, and its `/tmp`-free report content
  was verified line by line against the code before this report was written.
