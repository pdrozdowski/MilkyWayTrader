<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S09 Asteroid Salvage Implementation Plan

- **Plan**: context/changes/s09-asteroid-salvage/plan.md
- **Scope**: Phase 4 of 4
- **Reviewed phases**: 4
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | FAIL |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Full-cargo warning is hidden outside the transfer modal

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/ui/components/cargoTransfer.ts:23,31
- **Detail**: The warning element is inside `#cargo-transfer`, and line 23 hides that modal whenever no orbital cargo is in range. A capacity-failed loose-item pickup can happen without orbital cargo nearby, so its required `WARNING - CARGO IS FULL` feedback is not visible to the player.
- **Fix**: Move the warning to an independently visible HUD/notification host (or make its host independently visible) while retaining the adapter's transient state.
- **Decision**: PENDING

### F2 — Failed pickup warning can be emitted inaccurately and indefinitely

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/game/scenes/gameScene.ts:438-441; src/ui/adapters/cargoTransferAdapter.ts:51
- **Detail**: The scene reconstructs a failed pickup from pre-simulation position, loose-item count, and capacity rather than consuming the reducer's explicit `ship-cargo-full` result. This can disagree with the interaction resolved during `advanceLooseItems`. While a full ship remains in range, it emits every frame and continually resets `warningUntilMs`, violating the required two-second expiry.
- **Fix**: Have the simulation expose the actual failed pickup result and emit it once per failed interaction; do not extend an already active warning expiry for repeated contact.
  - Strength: Makes the feedback follow the authoritative interaction result and enforces a real two-second duration.
  - Tradeoff: Requires a small result/event contract through the simulation-to-scene boundary.
  - Confidence: HIGH — `pickupLooseItem` already returns the needed `ship-cargo-full` failure.
  - Blind spot: Exact desired retry semantics after the two-second notice were not specified.
- **Decision**: PENDING

### F3 — Salvage behavior and capacity constants have two authoritative paths

- **Severity**: WARNING
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: src/game/mechanics/salvage/cargoDamage.ts:2,43-61; src/game/application/salvageInteractions.ts:44-74; src/game/definitions/cargoDefinitions.ts:2; src/game/domain/runBalance.ts:3
- **Detail**: The newly used mechanics path duplicates loose-item pickup and orbital-cargo destruction already implemented in `salvageInteractions.ts`, and imports a separate `cargoCapacityByLevel` from `cargoDefinitions.ts` while the existing market, UI, and application paths use `runBalance.ts`. The duplicate implementations can drift on capacity upgrades, weighted-cost residuals, and spill behavior; focused mechanics tests continue to cover the existing application path.
- **Fix A ⭐ Recommended**: Keep `salvageInteractions.ts` and `runBalance.ts` as the sole interaction/capacity authority, and have simulation consume their explicit results.
  - Strength: Preserves one tested set of container rules across mechanics, market, and UI.
  - Tradeoff: Simulation needs a narrow dependency on the application interaction result or an extracted pure shared primitive.
  - Confidence: HIGH — the existing module already represents all required failures and weighted-cost operations.
  - Blind spot: Whether simulation purity policy prefers extracting a lower-level shared module needs confirmation from the architecture owner.
- **Fix B**: Extract one pure salvage interaction/capacity module below both application and mechanics, then delete both duplicate implementations.
  - Strength: Keeps simulation independent of the application layer while making shared rules explicit.
  - Tradeoff: Broader refactor and test migration than the immediate correction.
  - Confidence: MEDIUM — compatible with the dependency direction, but module placement requires design review.
  - Blind spot: Existing dependency constraints for a new shared domain module were not exhaustively mapped.
- **Decision**: PENDING

## Validation

- `npm.cmd run typecheck` — PASS.
- `npm.cmd run test:fast` — PASS: 36 domain, 36 mechanics, 6 objects, 10 audio, 7 UI-presentation, and 8 architecture tests passed.
- Focused Phase 4 assertions ran within the domain and UI-presentation suites.
- No Playwright test was added; this matches the plan's lower-level testing boundary.
- Manual criterion P4-C remains unchecked in `plan.md`. P4-A and P4-B also remain unchecked despite passing command evidence, so implementation workflow state still needs its owner update.
