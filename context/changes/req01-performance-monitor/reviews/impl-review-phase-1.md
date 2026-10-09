<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Debug-Controlled Performance Monitor

- **Plan**: context/changes/req01-performance-monitor/plan.md
- **Scope**: Phase 1 of 3
- **Reviewed phases**: 1
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Planned diff scope matched: only `src/game/application/performanceMonitor.ts` and
  `tests/domain/performanceMonitor.test.mjs` are implementation files in `f505469`; the rest is
  change bookkeeping (`plan.md` Progress, `change.md` `planned → implementing`). Nothing else in
  `src/` references the module yet, so the phase is purely additive.
- Success criteria re-run on the tree: `npm.cmd run test:domain` → 79 tests, 79 pass, 0 fail
  (9 new monitor tests); `npm.cmd run test:architecture` → 8 pass, 0 fail; `npm.cmd run typecheck`
  → clean for both tsconfigs.
- Every declared export, field list and semantic from the Phase 1 contract is present and
  implemented (`performanceStepIds` order, all eight step rows always present, disabled no-op,
  window pruning relative to the newest start, chain marking, early close, loop rate, unaccounted
  floor, unrounded summaries).
- Scope exclusions respected: no state/codec/provider/reducer change, no telemetry, no
  persistence or file export, no npm script edit, no Playwright test.
- `src/game/application/**` purity holds: the module imports nothing and reads no browser global;
  the clock is injected, matching the `TelemetryDependencies` precedent.
- All nine required test cases exist and assert real arithmetic (hand-checked: the unaccounted
  fixture's 0/15 samples averaging 7.5 with a 17.5 frame interval; the 60-frame fixture yields
  ≈60 loops/s).

## Findings

### F1 — `frameStarted()` silently discards an open step or render span

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/game/application/performanceMonitor.ts:139-141
- **Detail**: The contract defines `frameStarted()` as recording the frame start, deriving the
  interval from the previous start and dropping expired samples. The implementation also resets
  `openStepId` and `renderStartedAtMs`, so a step or render span still open at the next frame start
  is discarded rather than attributed to the closing frame. Harmless and commented, but
  unplanned; a missed marker combined with a missed `updatePhaseEnded()` would surface only as a
  lower `sampleCount` row.
- **Fix**: Add one sentence to the Phase 1 contract stating that an open step or render span still
  open at the next frame start is discarded (documenting is cheaper than attributing, which would
  change measured numbers).
- **Decision**: PENDING

### F2 — `unaccounted` omits frames that reported no render span

- **Severity**: • OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/game/application/performanceMonitor.ts:203-207
- **Detail**: The contract says `unaccounted` is
  `max(0, frameInterval - updatePhase - sceneRender)` "evaluated per frame using that frame's own
  values". The implementation contributes a remainder only for frames that reported all three
  spans. Consequence: `sceneRender` and `unaccounted` always lag the newest frame by one when the
  panel is pushed mid-`Game.update` (render happens after), while `frameInterval` and `updatePhase`
  include it. The behaviour is defensible — a frame with no render span has no truthful remainder,
  and including it would surface the in-progress frame's own interval as a bogus maximum — but the
  plan text does not say it, so a future reader comparing contract to code sees a mismatch.
- **Fix A ⭐ Recommended**: Document the rule in the plan's Phase 1 contract ("only frames that
  reported interval, update and render carry a remainder").
  - Strength: Keeps the honest reading and removes the contract/code mismatch.
  - Tradeoff: Plan text gains one sentence outside the original wording.
  - Confidence: HIGH — the arithmetic and the test fixture already agree with this rule.
  - Blind spot: None significant.
- **Fix B**: Change the code to include every frame with an interval, recording an incomplete
  frame's render span as 0.
  - Strength: Literal reading of "per frame".
  - Tradeoff: Inflates the unaccounted maximum with the in-progress frame and contradicts the
    existing test expectation.
  - Confidence: LOW — would require rewriting a passing test.
  - Blind spot: Not verified against a real session.
- **Decision**: PENDING

### F3 — Test file duplicates the eight step-id literals

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/domain/performanceMonitor.test.mjs:14-23
- **Detail**: `declaredStepIds` repeats the literal ids that the module exports. Judged a
  legitimate spec pin — asserting declared order against the module's own export would be
  tautological — but it does sit near the `lessons.md` "reuse display-label constants" rule, so it
  is worth a reviewer's eye.
- **Fix**: Leave as the documented spec pin; optionally add a one-line comment saying it pins the
  contract's order deliberately.
- **Decision**: PENDING

### F4 — No clamp for a non-monotonic clock or a repeated `updatePhaseEnded()`

- **Severity**: • OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/application/performanceMonitor.ts:172-179
- **Detail**: A clock that goes backwards yields negative durations, and a second
  `updatePhaseEnded()` in one frame overwrites `updateMs` with a larger span. Both are impossible
  with a monotonic `performance.now()` and the planned call pattern, so they cannot affect a real
  session; the module simply does not defend against them.
- **Fix**: None required; if desired, clamp negative durations to zero in `summarizeDurations`.
- **Decision**: PENDING

## Quality Check

- Hot-path cost: retention is bounded by the rolling window (≈300 frame records at 60 fps) and one
  small record is appended per frame start, so the `frames.shift()` prune cannot become a burst;
  `snapshot()` allocates its maps and arrays only when the panel refreshes (~4/second).
- Test sensitivity: changing `(frames.length - 1)` to `frames.length` in `loopsPerSecond()` is
  caught by the retention test; dropping the `renderStartedAtMs = null` reset in `renderEnded()`
  is not caught because no test exercises a render span without a start.

## Review Notes

- Phase 1 has no Manual rows; the remaining `#### Manual` rows in Phases 2 and 3 stay pending for
  the human checklist, as designed.
- The plan-drift pass was produced by a delegated review agent; the quality/pattern pass was run
  in the orchestrator context after the second delegated reviewer and its helper both failed to
  receive their task payloads in this environment (no files were touched by them).
