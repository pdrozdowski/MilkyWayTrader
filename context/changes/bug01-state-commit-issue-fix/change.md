---
change_id: bug01-state-commit-issue-fix
title: State commit is JSON-bound: drop the per-frame serialize round-trip
status: planned
created: 2026-10-09
updated: 2026-10-09
archived_at: null
---

## Notes

### Direction as stated by the user (2026-10-09)

> "well, we don't need to keep state as json for the game to run, we only need it when dump it to
> storage which is something still in plan for game saving slice S-11 - so then we will do single
> serialize/deserialize round and we're done. we need get rid of that nonsence"

Classification: not a correctness bug. The game behaves correctly and every invariant holds; the
defect is the cost of the read path. Serialization is a persistence concern (S-11 saves and
restores), yet it currently runs on every frame read.

### Measured symptom (from `req01-performance-monitor`, single 5 s window, ~15 loops/s)

| Row | Average | Minimum | Maximum |
| --- | --- | --- | --- |
| Frame interval | 67.99 ms | - | 125.80 ms |
| Update phase | 63.56 ms | - | 110.60 ms |
| Scene render | 3.14 ms | - | 5.40 ms |
| Unaccounted | 4.47 ms | - | 56.10 ms |
| State snapshot | 4.83 ms | 3.30 ms | 8.90 ms |
| State commit | 41.28 ms | 30.10 ms | 77.00 ms |
| Sum of the eight step averages | 53.69 ms | | |
| Weapon and asteroids (largest presentation step) | 6.04 ms | 4.30 ms | 12.70 ms |

The frame is update-bound, and `state commit` alone is 61 % of the frame interval. Its minimum
(30.10 ms) is already above a 60 fps frame budget, so this is a per-frame floor, not a hitch.

### Root cause: the read path serializes the whole aggregate

`src/game/application/gameStateProvider.ts`:

- `snapshot()` is `decodeGameState(encodeGameState(this.state))`, and
  `encodeGameState` is `JSON.stringify(decodeGameState(snapshot))`
  (`src/game/application/gameStateCodec.ts:454-456`), so one read is
  `decode(JSON.stringify(decode(state)))`: a full stringify, re-parse, field-by-field validation
  (19 top-level keys, schema version check), deep clone and deep freeze of the entire world.
- `update(reducer)` validates + clones the reducer result, then `publish()` takes a snapshot and
  hands the same snapshot to every subscriber.
- The UI adapters are subscribers that re-snapshot the aggregate for their own panels:
  `runStatusAdapter.refresh` (1), `landingStatusAdapter.refresh` plus `projectFacilities`,
  `projectShipyard` and `project` (4 - none of them gated on actually being landed),
  `cargoTransferAdapter.refresh` (1). Two of them (`runStatusAdapter:29`,
  `cargoTransferAdapter:104`) also refresh on the `step` event, which fires before the scene
  update.

That is ten round-trips per active frame:

| Where | Per frame |
| --- | --- |
| explicit `stateProvider.snapshot()` before the frame (the `state-snapshot` row) | 1 |
| inside `publish()` | 1 |
| `runStatusAdapter.refresh` | 1 |
| `landingStatusAdapter.refresh` (self + facilities + shipyard + market) | 4 |
| `cargoTransferAdapter.refresh` | 1 |
| `step`-event listeners in runStatus and cargoTransfer (before the scene update) | 2 |

Ten round-trips at the measured 4.83 ms unit price is ~48 ms of pure serialize/validate/clone/freeze
plumbing per frame. Seven of them sit inside `state-commit` (hence 41.28 ms), and the two
`step`-event ones explain the 9.87 ms surplus between the summed step averages (53.69 ms) and the
update phase (63.56 ms). Static model from the previous change's research: 21 validating decodes
and 10 full serializations per active frame - the measurement matches the model operation for
operation.

### Target direction

- Keep the in-memory path free of serialization: reads hand out the already immutable
  authoritative state (or a memoized frozen view) instead of stringify/re-parse/re-clone.
- Keep exactly one serialize/deserialize round, at the persistence boundary (save/restore, S-11).
- Preserve the guarantees the round-trip currently provides: consumers (Phaser projections and UI
  adapters) must not be able to mutate authoritative state, and `restore()` must still validate
  candidate data before it becomes state.
- Keep the single owner of state (`tests/architecture.test.mjs` pins one
  `new GameStateProvider(` construction point) and the pure application layer.

### Open questions to settle while framing/planning

1. What replaces clone-and-freeze as the consumer-isolation guarantee, and how do tests keep it
   honest (frozen aggregate reused as-is, structural sharing, dev-only deep freeze)?
2. Does `snapshot()` become an identity/cheap read? If so, do consumers still need change
   detection - and note that the adapters currently dedupe with `JSON.stringify(snapshot)`, which
   is another serialize on the same hot path.
3. Should `publish()` stay per-frame for every subscriber, or should UI-only consumers refresh on
   their own reduced cadence?
4. Is `decodeGameState` still needed on the reducer output, or does validation move to the
   persistence boundary only? (The reducer is pure and typed; the codec is the only untyped entry.)
5. Persistence contract for S-11: `encodeGameState`/`decodeGameState` remain the save format and
   the schema-version check must survive unchanged.
6. Should the fix first split the `state-commit` row into reducer / publish / UI-projection
   sub-rows? The reducer was never isolated inside that row; the 30 ms minimum points at plumbing,
   but sub-rows would confirm the split before code moves.

### How to verify

- Same instrument, same gameplay spot: the `state-commit` and `state-snapshot` rows and
  loops/second before and after (`context/changes/req01-performance-monitor/verification.md` is the
  baseline record); expect the unit price of a read to collapse and the commit row to fall by the
  removed round-trips.
- `npm.cmd run test:fast` and `npm.cmd run typecheck`, plus the codec/store round-trip tests that
  prove save and restore still work, and an architecture check that the single provider owner is
  intact.

### References

- Baseline and attribution: `context/changes/req01-performance-monitor/verification.md`
- Previous change (measure-only by design, explicitly excluded this fix):
  `context/changes/req01-performance-monitor/plan.md` ("What We're NOT Doing", state cost model)
  and `context/changes/req01-performance-monitor/reviews/impl-review.md`
- Code: `src/game/application/gameStateProvider.ts`, `src/game/application/gameStateCodec.ts`
  (`:104` clone-and-freeze, `:117` validating decode, `:454` encode),
  `src/ui/adapters/runStatusAdapter.ts`, `src/ui/adapters/landingStatusAdapter.ts`,
  `src/ui/adapters/cargoTransferAdapter.ts`
- Guardrail: `tests/architecture.test.mjs` (one provider, pure layers, UI component boundaries)
