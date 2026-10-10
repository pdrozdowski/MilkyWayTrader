# Verification: Read-Path Serialization Removal

## Recorded observation (monitor ON, after the change)

- **Source**: screenshot of the running panel shared by the user on 2026-10-10; the monitor exports
  nothing by design, so the panel is the whole record.
- **Browser / machine**: not captured, exactly as in the baseline record
  (`context/changes/req01-performance-monitor/verification.md`); same unidentified Windows host, to
  be filled in by the operator for both records together.
- **Session**: single 5-second rolling window with the panel live and gameplay running under the
  heaviest load the game offers - level-10 weapon volleys, a dense asteroid field, and many loot
  items and containers in flight. The operator reports no issues in this session, and that landing
  and the planet-side interactions behaved as before.

| Row | Average | Minimum | Maximum |
| --- | --- | --- | --- |
| Loops/second | 59.2 /s | - | - |
| Frame interval | 16.88 ms | - | 34.80 ms |
| Update phase | 11.16 ms | - | 30.00 ms |
| Scene render | 3.00 ms | - | 6.90 ms |
| Unaccounted | 3.25 ms | - | 19.00 ms |
| Input intent | 0.01 ms | 0.00 ms | 0.10 ms |
| State snapshot | 0.00 ms | 0.00 ms | 0.10 ms |
| State commit | 3.65 ms | 2.20 ms | 12.60 ms |
| Feedback and ship sync | 0.05 ms | 0.00 ms | 0.20 ms |
| Planets | 1.27 ms | 0.80 ms | 4.20 ms |
| Weapon and asteroids | 5.78 ms | 4.20 ms | 12.30 ms |
| Removals and effects | 0.07 ms | 0.00 ms | 0.30 ms |
| Cargo and commodities | 0.09 ms | 0.00 ms | 0.40 ms |

- **Footer**: `Window: 5.0 s, Frames: 297` (297 frames over 5 s = 59.4 loops/second, consistent
  with the reported rate).

## Before / after (same instrument, same host)

Baseline column is the recorded reading in `context/changes/req01-performance-monitor/verification.md`.

| Row | Baseline | After | Change |
| --- | --- | --- | --- |
| Loops/second | 14.7 /s | 59.2 /s | 4.0x |
| Frame interval | 67.99 ms | 16.88 ms | -75 % |
| Update phase | 63.56 ms | 11.16 ms | -82 % |
| State snapshot | 4.83 ms (3.30-8.90) | 0.00 ms (0.00-0.10) | collapsed to zero |
| State commit | 41.28 ms (30.10-77.00) | 3.65 ms (2.20-12.60) | -91 % |
| Scene render | 3.14 ms | 3.00 ms | unchanged |
| Weapon and asteroids | 6.04 ms | 5.78 ms | unchanged |
| Planets | 1.40 ms | 1.27 ms | unchanged |
| Unaccounted | 4.47 ms | 3.25 ms | -27 % |

The two rows the change exists for behave as the plan predicted: `state snapshot` collapses to
~0 ms because a read no longer stringifies, re-parses, validates and deep-clones the aggregate, and
`state commit` falls by an order of magnitude while keeping its single validating decode. The frame
is no longer update-bound: the update phase is 11.16 ms of a 16.88 ms frame (66 %), and the loop
rate is 4x the baseline under a materially heavier load than the baseline session carried.

## Fixup check required by the plan's Phase 3

The plan asks for an investigation before recording when `state-snapshot` is non-zero or
`state-commit` sits materially above its decode cost.

- **`state-snapshot` is 0.00 ms (minimum 0.00, maximum 0.10)** - nothing survived on the read path.
  That matches the code: `GameStateProvider.snapshot()` returns `this.state`, and the provider no
  longer imports `encodeGameState` at all.
- **`state-commit` is 3.65 ms average against the plan's ~1.6 ms decode estimate** - investigated,
  and it is not a surviving copy or serialization. The row does not measure the decode alone: in
  `src/game/scenes/gameScene.ts:503` it spans `stateProvider.update(current => advanceGameSimulation(...))`,
  so it carries the whole pure reducer (movement, projectiles, asteroid lifecycle, salvage, facility
  cycles) plus the one validating `decodeGameState` plus `publish()` notifying the three adapters.
  This reading is the heaviest load the game can produce, while the ~1.6 ms estimate was the decode
  alone against the baseline's aggregate; the frame brief already recorded that the reducer was
  never isolated inside this row and that splitting it was out of scope. Corroborating: the
  implementation bench measured a full commit against the initial aggregate at ~1.44-1.50 ms in
  Node, and this panel's own commit minimum is 2.20 ms.

## Residual fan-out cost (recorded, not fixed)

The summed step averages are 10.92 ms against an update phase of 11.16 ms, so **~0.24 ms per frame**
sits in the `step`-event UI listeners - the same quantity the baseline attributed to them at
**9.87 ms**. That difference is the entire remaining upside of the plan's Phase 2 section 1
(deleting the two `step` refreshes): about 1.4 % of the update phase and 0.2 % of a 16.88 ms frame.

Section 1 was therefore deliberately **not** applied, and the review recorded why
(`reviews/impl-review-phase-2.md`, F1/F2): Phaser emits `step` on `game.events` every frame
(`node_modules/phaser/src/core/Game.js:474`), `runStatusAdapter.refresh` is the only code that
recomputes `runStatusIsVisible(game.scene.isActive('Game'))`, `stateProvider.reset` runs only on the
new-game path (`src/game/scenes/mainMenuScene.ts:32-38`), and `#run-status` (z-index 3) paints over
`#main-menu` (z-index 2). Deleting that listener would leave the finished run's clock, credits and
HP on screen over the main menu, and the existing Playwright journey
`tests/ui/applicationDesktopUiTest.ts:70` asserts the opposite. Removing the ~0.24 ms would need a
scene-lifecycle hook plus a non-tick trigger for the wall-clock cargo-full warning - new design work
for an unmeasurable gain, so it belongs in a follow-up rather than here.

## Notes for a future reader

- `encodeGameState` now has no production consumer. It is retained on purpose as the save/restore
  format for S-11 and is still exercised by the codec tests - do not treat it as dead code.
- `GameStateProvider.snapshot()` now returns the shared, deeply frozen authoritative object rather
  than a fresh copy. That naming tradeoff is deliberate (the plan kept the signature); the doc
  comment on the method and the reworded contract clauses in `context/foundation/testing.md` and
  `context/foundation/architecture.md` are the record of it.
- `src/ui/adapters/runStatusAdapter.ts` and `performanceReadoutAdapter.ts` still dedupe with a
  `JSON.stringify` of their own small projection. That is a projection, not the aggregate, and it is
  inside the measured numbers above.
- `context/foundation/code-graph.json` still records the `GameStateProvider -> gameStateCodec#encodeGameState`
  edge, which no longer exists. Architecture artifacts are generated only when a task explicitly asks
  for them, so the graph picks this up at its next generation; do not hand-edit it here.

## Still pending

- Browser and machine identity for this record and for the baseline.
- The monitor-off overhead comparison left open by `req01-performance-monitor` remains open; it is
  not part of this change's criteria.

The operator's manual pass (2026-10-10) covered flight under level-10 combat with dense asteroids and
many loot items in flight, the HUD, landing and the planet-side interactions, and the death,
game-over, return-to-menu and new-run paths - no issues reported in any of them. Progress row 3.5 is
ticked on that report.
