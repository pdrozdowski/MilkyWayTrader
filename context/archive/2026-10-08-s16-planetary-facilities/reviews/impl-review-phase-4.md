<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S16 Planetary Facilities Implementation Plan

- **Plan**: context/changes/s16-planetary-facilities/plan.md
- **Scope**: Phase 4 of 5
- **Reviewed phases**: 4
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Reviewed scope note: Phase 4 is uncommitted in the worktree (HEAD e40594f). Its own contribution is `src/game/mechanics/planetFacilitySimulation.ts` (new), the crossed-second wiring in `src/game/mechanics/gameSimulation.ts`, and the facility-cycle cases in `tests/game-mechanics.test.mjs`; the tracked diffs for `gameSimulation.ts` and `game-mechanics.test.mjs` also carry Phase 1's removal of the old drift, which was excluded. `src/game/mechanics/serotonMarketSimulation.ts` shows as deleted from Phase 1, not Phase 4. No Phase 5 work and no telemetry changes appear in the phase files.

Gate correction (applied during verification, not a finding): the newly added shortfall test initially failed because its `planetMarket` fixture omitted `bakery: 1` (the helper defaults to the initial levels, where Bakery is level 0), so the level-0 bakery was correctly reported `notBuilt` while the test expected `insufficientResources`. The production behaviour was correct; the fixture was fixed by adding `bakery: 1` to both `planetMarket(...)` calls in that test (`tests/game-mechanics.test.mjs:974,982`). No assertion was weakened.

## Findings

### F1 - `outputByLevel[level - 1]` is not upper-bound guarded

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/game/mechanics/planetFacilitySimulation.ts:18
- **Detail**: For a level greater than `maxLevel` the slice yields `undefined`, and `Math.round(undefined * multiplier)` is `NaN`. For input-less farms the `NaN` would propagate into stock; for consumers the `NaN` comparison silently becomes `insufficientResources` instead of failing. Today this is unreachable: the codec validates `level` in `0..3` and re-validates through `encodeGameState`, and upgrades clamp at `maxLevel` (`planetFacilities.ts:55`).
- **Fix**: Clamp to the definition - `outputByLevel[Math.min(level, definition.maxLevel) - 1] ?? 0` - so the reducer is self-consistent independent of callers.
- **Decision**: FIXED (triage) - `outputByLevel[Math.min(level, definition.maxLevel) - 1] ?? 0` bounds the index and defaults to zero, so the reducer is self-consistent regardless of the caller.

### F2 - A produced commodity absent from `commodityStocks` would be silently dropped

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/game/mechanics/planetFacilitySimulation.ts:38
- **Detail**: Output is re-emitted by mapping `economy.commodityStocks`, so a produced commodity id that is not present in the input array would sit in `stockById` but never be emitted. Unreachable today: `planetFacilityOutputCommodityIds` is a subset of `serotonCommodityIds` and every market is guaranteed one entry per commodity by the codec and initial state. Duplicate emission is impossible (the Map is seeded from a unique-keyed array).
- **Fix**: Throw (or assert) when a produced commodity id is not present in `commodityStocks`, so a future catalogue/market divergence fails loudly instead of losing output.
- **Decision**: FIXED (triage) - the reducer throws when a produced commodity id is absent from `commodityStocks`, so a catalogue/market divergence fails loudly instead of dropping output.

### F3 - Repeated input commodity ids could drive stock negative

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (reliability)
- **Location**: src/game/mechanics/planetFacilitySimulation.ts:20
- **Detail**: The all-or-nothing gate treats each `inputsPerOutput` entry independently (`every(...)`) and then subtracts each entry, so a definition listing the same `commodityId` twice would satisfy the check on one requirement and subtract twice, potentially going negative. No current definition repeats an input, and a negative stock would be rejected at encode.
- **Fix**: Aggregate the required quantity per commodity before the coverage check, or document the distinct-commodity invariant of `inputsPerOutput`.
- **Decision**: FIXED (triage) - inputs are aggregated per commodity (`requiredByCommodity`) before the coverage check, so repeated input ids can no longer drive stock negative.

### F4 - Per-cycle allocations scale with crossed seconds

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (performance)
- **Location**: src/game/mechanics/planetFacilitySimulation.ts:44
- **Detail**: The crossed-second computation is O(1) and the pass count is bounded by the 30-minute clock budget (at most 1 800 cycles per market), with no unbounded loop or within-cycle quadratic growth. However each cycle allocates a fresh stock `Map`, a status `Map` and two mapped arrays, so a resume-from-background frame can run ~1 800 × 3 markets cycles with proportional small allocations - the largest single-frame cost, still bounded.
- **Fix**: No change required. If profiling ever shows a resume hitch, hoist `stockById` out of the loop and rebuild the arrays once, or cap cycles per frame.
- **Decision**: ACCEPTED (no change) - per-cycle allocation cost is acceptable; hoisting `stockById` is only warranted if profiling ever shows a resume hitch.

### F5 - One-second and encode/restore cases have weak or misleading sub-assertions

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (test quality)
- **Location**: tests/game-mechanics.test.mjs:933
- **Detail**: (a) The boundary equivalence assertion at line 933 compares two production-code paths with no literals, so in isolation it would stay green on a no-op reducer - the concrete literal assertions at 939-944 are what make the test protective. (b) The comment at line 939 ("the dairy output feeds the same-second cheese recipe") is inaccurate: Seroton starts with enough milk that the assertion does not depend on the dairy feed; the true same-cycle dependency is proven by the lactozis case at 964-971. (c) The encode/restore case (1015-1022) ends with every facility `working`, so it would not detect a codec that dropped `insufficientResources` (that status identity is covered at the domain/codec level in Phase 3).
- **Fix**: Correct the comment at line 939 to point at the lactozis ordering case, and optionally add one literal assertion to the restore case that exercises a non-working status.
- **Decision**: FIXED (triage) - the misleading comment now points at the lactozis ordering case, and the encode/restore test asserts a stored non-`working` status survives.

## Verified Phase 4 Contracts (evidence)

- Reducer surface and behaviour: `advancePlanetFacilities(economy, cycles)` at `planetFacilitySimulation.ts:44` chains one sequential pass per cycle (46-48), iterates the five facilities in the fixed catalogue order (31), keeps level 0 at `notBuilt` (16), computes `output = Math.round(outputByLevel[level - 1] * outputMultiplier)` and inputs as `quantity * output` (17-19), applies the recipe only when every input is covered, otherwise returns `insufficientResources` with no stock mutation (20-24), and is pure (29, 36-40). MATCH.
- Input scaling judgement: the plan defines recipes as ratios ("inputs per output: cheese 2 milk") and states that "every derived input must stay a whole number" with the +20% bonus keeping `5/10/20` and `10/20/40` outputs integral; the phrase only carries force if inputs are derived from the boosted output, and the plan's own "level-1 Cheese Factory consumes 10 Milk per second" sits in the same baseline bullet as "a level-1 Dairy Farm yields 10 Milk per second", which the plan already expects to become 12 on Maslo-Prime. The implemented boosted-input reading is therefore judged faithful to intent; the deliberate effect is that Seroton's level-1 Cheese Factory consumes 12 Milk for 6 Cheese. MATCH.
- Frame wiring: `gameSimulation.ts:84` computes `Math.floor(clock.activeElapsedMs / 1000) - Math.floor(state.clock.activeElapsedMs / 1000)` and line 85 applies `advancePlanetFacilities` to every market; the `activeDeltaMs <= 0` early return (line 83) is unchanged, so every pause reason including `landed` still freezes cycles. MATCH.
- Tests: the seven contract cases exist with literal expected values - one-second boundary (926-945), multi-second equals stepped plus purity/determinism (947-962), genuine same-cycle farm-to-consumer ordering on lactozis (964-971), all-or-nothing shortfall and recovery (973-990), all five pause reasons (992-1013), encode/restore continuity (1015-1022), per-planet modifier isolation (1024-1035). MATCH.
- Scope: no `projectLandedFacilities`, no `buildFacility`/`upgradeFacility` port, no dialog/markup/CSS, no telemetry changes; `advancePlanetFacilities` is the only facility entry point and no `advanceMarket`/`serotonMarketSimulation` remnants remain. MATCH.
- Architecture: the new module imports only `../state/serotonMarketState` and `../definitions/planetFacilityDefinitions.ts`, inside `game/mechanics`' enforced allowed set (`tests/architecture.test.mjs:58`); no Phaser/DOM/application/domain imports. MATCH.
- Pattern consistency: lower-camel filename at the mechanics root, named exports, four-space indent, single quotes, `.ts` on value imports and the `advanceX(state, n) -> new state` reducer shape match the neighbouring `planet/*`, `clock/gameClock.ts` and `salvage/salvageSimulation.ts` modules. MATCH.

## Gate Re-runs

| Gate | Result | Evidence |
|------|--------|----------|
| `npm.cmd run test:mechanics` (Phase 4 automated) | PASS | 48/48, 0 fail, exit 0 after the fixture correction |
| `npm.cmd run typecheck` | PASS | `tsc --noEmit && tsc --noEmit -p tsconfig.tests.json`, no output, exit 0 |
| `npm.cmd run test:fast` equivalent (unit + architecture) | PASS (2 environment-blocked) | 130 tests, 128 pass, 2 fail - the same two child-process-spawning tooling tests (`tests/object-scaffold.test.mjs`, `tests/game-audio.test.mjs`) blocked by the sandbox `EPERM`; unrelated to Phase 4 |
| Break-check (all-or-nothing guard) | PASS | Replacing the input-coverage guard with `if (false)` turned `tests/game-mechanics.test.mjs` red (1 test: "an all-or-nothing shortfall leaves the stock untouched and flips the status until the input returns"); file restored byte-exactly (sha256 D9AD503D207145E3E61A331FE7928DE356DDF13E66EF1C1C5B73E1A098819CDC) and re-run green |
| `npm.cmd run test:ui` | NOT RUN | Phase 5 criterion; requires Docker Supabase + Chromium, unavailable here |

Environment note: as in the Phase 3 review, the sandbox denies the default `node --test` worker spawn, so every suite was run in-process with `node --test --experimental-test-isolation=none`. The two failures are the same spawn-dependent generator/tooling tests recorded in the Phase 2 review as passing outside the sandbox. Escalation was unavailable because the automatic approval reviewer returned an infrastructure error, so the full `npm.cmd run test:project` pipeline (including Playwright) could not be executed here.

## Progress (Manual) Status

- 4.6 Stock is frozen while landed and starts moving again after launch - `[ ]` pending
- 4.7 A facility's status reacts after the player sells its input and resumes flight - `[ ]` pending

No Manual row is falsely marked complete.