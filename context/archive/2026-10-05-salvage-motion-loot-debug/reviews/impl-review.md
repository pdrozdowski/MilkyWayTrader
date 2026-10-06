<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Smooth Salvage Motion, Deterministic Cargo Drops, and Debug Spawn Implementation Plan

- **Plan**: context/changes/salvage-motion-loot-debug/plan.md
- **Scope**: Phase 4 of 4 (Multi-Commodity Cargo, Transfer Controls, and Distinct Spills)
- **Reviewed phases**: 4
- **Date**: 2026-10-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Pickup radius differs between mechanics and warning detection

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/scenes/gameScene.ts:441
- **Detail**: Authoritative loose-item pickup uses `asteroidTuning.salvage.looseItemInteractionRadius` (20) at `src/game/mechanics/gameSimulation.ts:246`, but the scene's failed-pickup ("cargo full") warning detection still uses `shipTuning.collisionRadius` (18). A full-ship pickup that fails in the 18-20 ring shows no warning. Pre-existing (Phase 2), not introduced by Phase 4.
- **Fix**: Use `asteroidTuning.salvage.looseItemInteractionRadius` in the `failedPickup` check so both share the same authoritative radius.
- **Decision**: FIXED

### F2 — `cargoCapacityByLevel` defined in two sources

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/game/domain/runBalance.ts:4
- **Detail**: `cargoCapacityByLevel` exists in both `src/game/domain/runBalance.ts` and `src/game/definitions/cargoDefinitions.ts`. `cargoDamage.ts` imports the definitions copy while `salvageInteractions.ts` and other application paths import the runBalance copy. A future level change in only one source would make pickup and transfer capacity disagree.
- **Fix A (Recommended)**: Keep `src/game/definitions/cargoDefinitions.ts` as the single source of truth and re-export it from `runBalance.ts` (or update the one importer), leaving exactly one table.
  - Strength: Removes the divergence class with a small, contained change.
  - Tradeoff: Touches the import in `cargoDamage.ts` and `runBalance.ts`.
  - Confidence: HIGH — both tables are currently identical.
  - Blind spot: Whether any other module depends on the runBalance copy being local.
- **Fix B**: Leave as-is and document the duplicate.
  - Strength: No code churn.
  - Tradeoff: Divergence risk remains.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (consolidated on `runBalance.ts`; `cargoDefinitions.ts` re-exports to respect the domain-only layer rule)

### F3 — Transfer modal hardcodes the commodity ID list

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/ui/components/cargoTransfer.ts:11
- **Detail**: Rows are built from a hardcoded `['supplies','alloys','medicines']` list rather than the shared commodity catalog used by `landingStatusAdapter.ts`. The snapshot already provides the union of cargo/ship commodity IDs; a future commodity would silently never render.
- **Fix**: Derive the row set from the shared commodity catalog instead of the hardcoded tuple.
- **Decision**: FIXED (row set derived from `displayLabels.commodityLabels`)

### F4 — Transfer heading/warning strings not in display labels

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/ui/adapters/cargoTransferAdapter.ts:9
- **Detail**: `CARGO TRANSFER` (index.html heading) and `WARNING - CARGO IS FULL` are hardcoded outside `src/ui/components/displayLabels.ts`. Pre-existing strings, not introduced by Phase 4; Phase 4's new strings do use shared constants.
- **Fix**: Move these two strings into `displayLabels` and render them through the component.
- **Decision**: FIXED (strings moved into `displayLabels`)

### F5 — Cargo projectile collision is not swept

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/game/mechanics/gameSimulation.ts:357
- **Detail**: Cargo projectile collision tests only the cargo's final tick position (`start` and `end` both `candidate.position`), unlike swept asteroid collisions. A large frame delta could tunnel past a moving cargo. Pre-existing pattern.
- **Fix**: Sweep the cargo path across the tick, or document the bounded-motion assumption.
- **Decision**: FIXED (documented the bounded-motion assumption)
