<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-05 Planet Ship Services

- **Plan**: context/changes/s05-planet-ship-services/plan.md
- **Scope**: Phase 2 of 4
- **Reviewed phases**: 2
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

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

### F1 — Plan says "odd/even volleys"; the implementation keys parity off the projectile count

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/gameSimulation.ts:184-196, src/game/mechanics/projectile/trajectory.ts:18-29
- **Detail**: Phase 2 writes "Odd volleys use a forward shot then mirrored ±2.5°, ±7.5°, ±12.5° pairs; even volleys use mirrored ±5°, ±10°, ±15° pairs". The implementation keys the pattern off the *projectile count*, which equals the weapon level (`volleyAngleOffsetsDegrees(state.shipStatus.weaponLevel)`). That is the only reading consistent with the same contract's "emits `weaponLevel` projectiles" and with BR-044a ("Odd projectile counts … even projectile counts …"); a volley *number* that alternated parity would contradict the purchased weapon level. The frame's own examples (Lv2 fires ±5°, Lv3 fires forward and ±2.5°) confirm the count-based reading.
- **Fix**: No change. Wording recorded here so a later reader does not "correct" the implementation toward volley-number parity.
- **Decision**: PENDING

### F2 — Offset ordering follows the literal "ascending angle from left to right" reading

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/game/mechanics/projectile/trajectory.ts:18-29
- **Detail**: The contract states the ordering rule first ("Offset order is deterministic: ascending angle from left to right") and then describes the odd pattern as "a forward shot then mirrored pairs". Implemented literally, ascending angle puts the forward shot of an odd count between the two members of its innermost pair: Lv3 emits `-2.5°, 0°, +2.5°`, Lv5 emits `-7.5°, -2.5°, 0°, +2.5°, +7.5°`, and Lv2/4 emit `-5°, +5°` / `-10°, -5°, +5°, +10°`. Emission order only decides which `projectile-<volley>-<n>` index owns which mirrored path; the visible spread is identical under either reading. The alternative ("forward shot first, then each mirrored pair outside-in") would satisfy the odd-count phrase but break the stated ascending-angle rule for every even count.
- **Fix**: Superseded. Manual check 2.4 found the parity patterns left uneven spacing (a 10° hole ahead for even counts, a squeezed 2.5° front pair for odd ones), so volley spacing is now one uniform 5° step centred on the heading. Superseded by the post-implementation decision recorded in `change.md`.
- **Decision**: FIXED — replaced by the uniform-step rule.

## Notes

- `TOUCHED` cross-check at staging time: src/game/definitions/gameplayTuning.ts, src/game/mechanics/gameSimulation.ts, src/game/mechanics/projectile/trajectory.ts, src/game/state/weaponState.ts, tests/game-mechanics.test.mjs, tests/object-scaffold.test.mjs, plan.md, change.md, reviews/impl-review-phase-1.md.
- `src/game/state/weaponState.ts` documents the existing `projectileSequence` field as the volley number (BR-044); the persisted field shape and `schemaVersion` are unchanged, and no migration was introduced.
- Fixed-basis evidence (engine level 5 versus level 1, asserted exactly): asteroid impact pushback and its recovery lock 240/501, Moolaris forced escape 240, Moolaris recovery coast 216 after one 100 ms tick, boost cruise 1200 (not the 1800 that an upgraded basis would produce). Normal cruise is 240/264/288/324/360 for levels 1–5 with a one-second acceleration ramp.
- `definitions/gameplayTuning.ts` now imports the level table from `src/game/domain/runBalance.ts`. `tests/object-scaffold.test.mjs` stages that one extra source file into its generated-TypeScript fixture because the fixture copies `gameplayTuning.ts` in isolation; this is a fixture-only change, not a new tooling test.
- Existing capacity-dependent mechanics assertions were updated from the retired 20-unit level-one capacity to 40 (a full ship, and the ship-side transfer boundary) — a consequence of Phase 1's balance change, not of the flight or volley work.
- Success criteria evidence: `npm.cmd run test:mechanics` 52/52, `npm.cmd run test:fast` green (domain 64, mechanics 52, objects 6, audio 11, ui-presentation 8, architecture 8), `npm.cmd run typecheck` passes. Break-check: forcing the level-one cruise cap turned the engine test red; collapsing the volley offsets to a single forward shot turned both volley tests red; both files were restored from staging and re-verified green.
- Manual rows 2.3 and 2.4 stay unchecked: manual verification is deferred to the user's end-of-run pass by explicit instruction.
