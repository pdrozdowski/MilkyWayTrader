<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Manual-test Feedback Batch

- **Plan**: context/changes/salvage-motion-loot-debug/plan.md
- **Scope**: Post-review manual-test feedback (engine stop, transfer non-close, red/yellow animations, spill spread, pickup/block sounds, transfer-window layout)
- **Reviewed phases**: 4 (completed) plus the manual-feedback batch
- **Date**: 2026-10-06
- **Verdict**: PASS
- **Findings**: 0 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### MF1 — Engine stop is presentation-only while the modal is open

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Safety & Quality
- **Location**: src/game/scenes/gameScene.ts:465
- **Detail**: The cargo modal pauses the authoritative clock with the `manual` reason, and the scene now silences the engine loop when that reason is present. The ship flame animation still follows authoritative `enginesOn` (true), but the 85% opaque modal overlay hides it. If the overlay ever becomes transparent, the flame should be suppressed too.
- **Decision**: ACCEPTED

### MF2 — Bottom `Transfer` button closes the modal rather than staging a batch

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: src/ui/components/cargoTransfer.ts
- **Detail**: Arrow buttons still transfer immediately and no longer close the modal; the bottom button is labeled `Transfer` and acts as the close/finish control. If the intended flow was select-then-confirm, this needs a pending-quantity state; the requested ASCII layout has no per-row pending value, so immediate transfers plus a finish button was chosen.
- **Decision**: ACCEPTED

### MF3 — Spill randomization is deterministic from the cargo ID

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: src/game/mechanics/salvage/cargoDamage.ts
- **Detail**: Each unit gets an evenly spaced radial angle around the full circle, with speed varied ±30% via a deterministic sine-based hash of the cargo ID and unit index. This keeps restored and uninterrupted runs identical and prevents the previous two-group clustering; if the design later requires persisted RNG state, this boundary is the place to consume it.
- **Decision**: ACCEPTED
