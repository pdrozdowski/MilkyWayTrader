<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-05 Planet Ship Services

- **Plan**: context/changes/s05-planet-ship-services/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 5 observations

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

### F1 — The Shipyard health bar has no accessible name

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: index.html:172-173, src/ui/components/landingStatus.ts:195-197
- **Detail**: `<progress class="shipyard-repair-bar">` receives `value`/`max` but no accessible name, while the run-status HP bar in the same application pairs its progress element with `#run-status-hp-label`. The adjacent `.shipyard-repair-hp` text does carry "Hull: 75 / 100", so the information is reachable, just not associated with the bar itself.
- **Fix**: The health bar now takes its accessible name from the readout: `#landing-status-shipyard-repair-hp` on the Hull paragraph and `aria-labelledby` on the `<progress>`, mirroring the run-status HP bar's label association. Asserted by the Shipyard DOM test, which checks the static association in `index.html`.
- **Decision**: FIXED — applied as described.

### F2 — Volley emission order for odd counts is an interpretation, not a literal shift

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/projectile/trajectory.ts:18-29
- **Detail**: The plan states "Offset order is deterministic: ascending angle from left to right" and then describes odd counts as "a forward shot then mirrored ±2.5°, ±7.5° … pairs". The implementation applies the stated ordering rule literally, so a level-three volley emits `-2.5°, 0°, +2.5°` (forward shot between the innermost pair) and level five emits `-7.5°, -2.5°, 0°, +2.5°, +7.5°`. Emission order only decides which `projectile-<volley>-<n>` index owns which mirrored path; the visible spread is identical under the alternative reading. The angle *sets* and the parity rule match BR-044a exactly (level two `±5°`, level three forward plus `±2.5°`).
- **Fix**: Superseded. The manual volley check found the parity patterns produced uneven spacing, so volleys now use one uniform 5° step centred on the heading (odd counts keep the forward shot, even counts straddle it at ±2.5°). `BR-044a` was rewritten and passes the `10x-prd-en-capability` gate; the decision is recorded in `change.md`.
- **Decision**: FIXED — replaced by the uniform-step rule.

### F3 — Shipyard cards are static markup bound to the catalogue by data attributes

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: index.html:167-196, src/ui/components/landingStatus.ts:88-90
- **Detail**: The three service cards and the booster row are static DOM, and `renderShipyard` throws `Missing ship-service row` if the projection ever returns an id without a matching card. This mirrors the accepted facilities view (five static cards, same throw), so it is consistent with the codebase; it does mean a fourth ship-service path needs markup, styles and a card entry together.
- **Fix**: No change. Recorded so a future catalogue extension is not silently half-applied.
- **Decision**: PENDING

### F4 — `failure` is projected but the Shipyard view only reads the boolean flags

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/game/application/landedShipyard.ts:36,55,66
- **Detail**: `available`, `affordable`, `maximum`, `owned` drive the view; the raw quote rejection code travels alongside them unused by the DOM. It is useful as the diagnostic reason in projection tests, so it is not harmful, but two sources now describe the same availability.
- **Fix**: Keep `failure` and annotate it as the diagnostic reason code, or drop it and let tests read the quotes directly.
- **Decision**: PENDING

### F5 — One tooling fixture had to follow the new definitions-to-domain import

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: tests/object-scaffold.test.mjs:157-158
- **Detail**: `src/game/definitions/gameplayTuning.ts` now imports the engine-level table from `src/game/domain/runBalance.ts` (the domain may not import the state layer, so the level table has to reach mechanics through definitions). The object-scaffold fixture typechecks a copy of `gameplayTuning.ts` in isolation, so it gained the one extra `cp` of `runBalance.ts`. Test-only, no product behaviour.
- **Fix**: No change.
- **Decision**: PENDING

## Notes

- Every planned file was touched, except `src/game/application/gameStateProvider.ts` in Phase 1: `GameStateProvider.update` already decodes, validates and publishes one snapshot, which is the atomic boundary the services use — the sibling S-16 facility change (`7bbd253`) also left that file untouched.
- Snapshot contract unchanged: `schemaVersion` stays 17, no migration was added (team lesson), and the Phase 4 test proves purchased levels, hit points and booster ownership round-trip through `encodeGameState`/`decodeGameState`.
- Scope boundaries from "What We're NOT Doing" held: no facility-investment change, no asteroid-combat or salvage change, no booster fuel, no collision/recovery/Moolaris retuning, and no new Playwright test (`tests/ui/*` untouched, so the Playwright admission gate never applied).
- Two behaviour changes outside the new code were required and are intentional: the level-one cargo capacity moved from 20 to 40 (BR-001/BR-073), which updated one market quote test, one run-status expectation and two mechanics capacity assertions; and projectile ids moved from `projectile-<n>` to `projectile-<volley>-<index>`, which no consumer parses.
- The Phase 2 work turned up a real defect during verification: the boosted cruise cap had to stay the fixed level-one 5× speed (1,200) rather than `engineLevel × 5 × base`; the new tests caught it (an upgraded ship reached 1,680) and it was fixed before the phase commit.
- Review coverage for `/10x-archive`: phase reports `reviews/impl-review-phase-1.md` (phase 1), `impl-review-phase-2.md` (phase 2), `impl-review-phase-3.md` (phase 3) and this full report (phases 1-4).
- Success criteria evidence across the change: `npm.cmd run test:fast` green — domain 67, mechanics 52, objects 6, audio 11, ui-presentation 9, architecture 8; `npm.cmd run typecheck` passes. Break-checks were run in every phase (wrong-planet guard, codec level bound, engine cruise cap, volley offsets, projection availability, Shipyard action enablement, engine/volley integration) and each turned the covering test red before being restored.
- Manual rows remain unchecked by design: 1.3, 2.3, 2.4, 3.4, 3.5 and 4.3 are the user's end-of-run verification pass.
