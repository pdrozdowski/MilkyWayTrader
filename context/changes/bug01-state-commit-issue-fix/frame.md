# Frame Brief: The state read path serializes the whole aggregate every frame

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

With the debug performance monitor enabled during ordinary gameplay, the game runs at 14.7
loops/second and the update phase dominates the frame: `state commit` averages 41.28 ms
(minimum 30.10 ms, maximum 77.00 ms) inside a 63.56 ms update phase of a 67.99 ms frame
interval, while `scene render` costs 3.14 ms. Every other step is small (the largest presentation
step, `weapon and asteroids`, is 6.04 ms). The eight step averages sum to 53.69 ms, leaving
9.87 ms of the update phase outside every step row. Source:
`context/changes/req01-performance-monitor/verification.md` (single 5 s window, 2026-10-09).

## Initial Framing (preserved)

- **User's stated cause or approach**: the game keeps its state as JSON on the read path;
  serialization is only needed when state is dumped to storage.
- **User's proposed direction**: remove the in-memory JSON round trip; do a single
  serialize/deserialize round at the persistence boundary, which belongs to the planned save
  slice S-11.
- **Pre-dispatch narrowing**: the user states the scope owner is the in-memory read path (the hot
  frame path and its UI consumers), while persistence keeps serialization, and asks for the nature
  and scope of the change to be described. Not separated by the user: how much of the commit row
  is serialization versus reducer versus UI projection work. That split is what this frame
  establishes from the material, and the one remaining scope choice is recorded under "Open Scope
  Question" below.

## Dimension Map

The observation could originate at any of these dimensions:

1. **State read path (snapshot / publish)** - every read is
   `decode(JSON.stringify(decode(state)))`: full stringify, re-parse, per-field validation, deep
   clone, deep freeze of the whole aggregate. If this is the cost, one read should have a
   measurable unit price of its own. `<-` the user's framing
2. **Publish fan-out and UI projection work** - `publish()` notifies subscribers, and the three
   mounted adapters re-snapshot and re-project on every notification. If this is the cost, cost
   should scale with the number of consumers and the size of their projections.
3. **The reducer inside the commit row** - `advanceGameSimulation` runs inside the same row. If
   this is the cost, cost should scale with delta and live entity counts, and drop to near zero
   while paused.
4. **The instrument itself** - eight markers, four frame listeners and a 250 ms DOM write. If this
   is the cost, a monitor-off comparison would show a large gap.
5. **The host or environment** (dev server bundle, software rendering, VM) - if this is the cost,
   every row scales together; absolute numbers are pessimistic, but the attribution inside one
   frame cannot change.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. The read path's serialize/validate/clone round trip is the dominant cost | `snapshot()` is `decodeGameState(encodeGameState(this.state))` (`src/game/application/gameStateProvider.ts:19-22`) and `encodeGameState` is `JSON.stringify(decodeGameState(snapshot))` (`src/game/application/gameStateCodec.ts:454-456`), with validating decode at `:117` and clone-and-freeze at `:104`. The panel independently prices one read: `state-snapshot` 4.83 ms average (3.30 min, 8.90 max). Ten reads per active frame. The seven inside the commit row are 7.5 read units = 25-67 ms in the measured unit band, which contains the observed 41.28 average and 30.10 minimum. The two `step`-event reads (`src/ui/adapters/runStatusAdapter.ts:29`, `src/ui/adapters/cargoTransferAdapter.ts:104`) predict a 9.7 ms surplus, and the measured surplus is 9.87 ms. The previous change's static model (21 validating decodes, 10 serializations per frame) matches operation for operation. | STRONG |
| 2. Publish fan-out and UI projection work | The adapters do per-frame projection work: `runStatusAdapter.refresh` (1 read), `landingStatusAdapter.refresh` (itself + `projectFacilities` + `projectShipyard` + `project`, i.e. 4 reads, none of them gated on being landed - `src/ui/adapters/landingStatusAdapter.ts:73-86`), `cargoTransferAdapter.refresh` (1 read). The projections themselves walk 15-40 small records (`src/game/application/landedFacilities.ts:92`, `landedShipyard.ts:96`, `landedMarket.ts:62`), and each is preceded by its own full read. The adapters also dedupe with `JSON.stringify(...)`, but on the small projection, not the aggregate (`runStatusAdapter.ts:18-27`). Real cost, second order to the reads that feed it. | WEAK |
| 3. The reducer inside the commit row | `advanceGameSimulation` is O(entities) arithmetic with no parse or stringify; facility cycles are gated on crossed whole active seconds (`src/game/mechanics/gameSimulation.ts:84-85`) and movement is capped at 100 ms (`:107`), so most frames do no facility work. Cannot explain a 30.10 ms minimum that is already above a 60 fps budget. | WEAK |
| 4. The instrument | Markers measured at 0.01-0.04 ms (`input intent`, `removals and effects`, `cargo and commodities`), the panel writes 4 times per second, and `unaccounted` (not the markers) carries the largest remainder. Cannot account for tens of milliseconds. The monitor-off comparison required by the previous plan has not been captured, so this is ruled out by arithmetic, not by a measurement. | NONE |
| 5. Host or environment | All numbers come from one unidentified session; 14.7 loops/second is low for a desktop run and `unaccounted` peaks at 56.10 ms, which points at browser-level gaps as well. The per-read unit price (4.83 ms) does not depend on delta, so the environment explains the magnitude and not the attribution. | WEAK |

## Narrowing Signals

- The `state-snapshot` row is an in-frame measurement of exactly one read. It isolates the unit
  price with no assumption about counts, and it is large: 4.83 ms per read, compared with 1.40 ms
  for the whole per-planet presentation loop and 0.01-0.04 ms for the cheap steps.
- The prediction from the two `step`-event reads (9.7 ms) matches the measured step-row surplus
  (9.87 ms). A predictive check that lands this closely is much stronger evidence than a post-hoc
  story about the same number.
- Every presentation row is small, so the scene's own work is not the cost, and the nine-step
  arithmetic leaves no unexplained remainder.
- Decisive-evidence skip: hypothesis 1 has strong evidence and 2-5 are weak or none, so the
  narrowing-questions step is skipped deliberately. The only question that remains is a scope
  choice for the user (see "Open Scope Question").

## Cross-System Convention

- The repository treats detached, immutable snapshots as a first-class contract:
  `context/foundation/testing.md:19` requires provider and codec tests to cover "detached
  immutable snapshots, schema and shape rejection, migrations, atomic failure, duplicate IDs,
  reset, subscriptions, and JSON round trips". Removing the in-memory round trip therefore has to
  consciously redefine what "detached immutable" means on that path, not merely delete it.
- `context/foundation/architecture.md:11,22` places state ownership, the codec and immutable view
  models in the application layer, with scenes and UI consuming immutable results. That direction
  of dependency and that guarantee must survive.
- This defect has been seen before, in a different place:
  `context/archive/2026-09-26-s04-first-planetary-trade/reviews/impl-review-phase-6.md:87` (F6)
  records that "each `snapshot()` is a full encode+decode round trip for one invariant state; a
  rebuild is roughly 100+ round trips", classified as a pre-existing pattern and left unfixed.
  The frame path is the same defect at a higher frequency.
- `context/foundation/lessons.md` contains no rule that forbids this change. The one nearby lesson
  (no snapshot migrations before maturity) concerns the persisted format and stays satisfied as
  long as `schemaVersion` and the codec's save/restore contract are untouched.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the authoritative state boundary performs a full
> serialize -> re-parse -> validate -> clone -> freeze round trip on every read - ten times per
> active frame - so a per-frame-constant cost that has nothing to do with gameplay caps the frame
> rate.

The user's cause is correct in mechanism and stronger than assumed: the read path, not the
simulation, sets the ceiling (a 30.10 ms minimum inside a 67.99 ms frame, before any gameplay
work is attributed). What the initial framing does not yet carry into a plan is the thing that has
to survive: on the in-memory path that round trip *is* the detached-immutable guarantee and the
only validation applied to reducer output, both of which the test convention asserts. So the work
is not "delete serialization" but "move serialization to the persistence boundary and replace
what the in-memory round trip was guaranteeing", with the size of the aggregate as the second,
independent lever on cost per read.

## Confidence

- **HIGH** - one hypothesis has strong, independently cross-checked evidence (in-panel unit price,
  a predictive surplus match, a static model that agrees operation for operation, and a historical
  precedent for the same pattern); the alternatives are weak or absent.

The pay-off estimate is the softer half: there is no monitor-off baseline, the host is
unidentified, and the reducer's share inside the commit row is inferred from its gating logic
rather than isolated. If a plan needs a harder number before committing to a design, the cheap
next evidence is the same panel with the monitor off at the same spot, plus a temporary sub-row
split inside `Game.update`.

## What Changes for /10x-plan

Plan a read-path change: reads hand out the already immutable authoritative state (or a memoized
frozen view) with no stringify/parse/clone on the hot path; exactly one encode/decode round stays
at the persistence boundary (S-11 save/restore); validation stays where untrusted input enters
(`restore`) and wherever the new contract still requires it; the replacement for the
detached-immutable guarantee is stated explicitly and covered by tests; verification uses the
existing panel's `state-commit` and `state-snapshot` rows and loops/second against
`context/changes/req01-performance-monitor/verification.md`.

## Open Scope Question

Does this change also cover the per-frame publish fan-out (the three adapters re-projecting every
frame, four of those reads coming from the landed-market adapter even while flying, plus the
`step`-event refresh cadence), or only the serialization? Both are inside the measured frame; the
serialization is the dominant share, and the fan-out is the natural second phase.

## References

- Measurement and attribution: `context/changes/req01-performance-monitor/verification.md`
- Read path: `src/game/application/gameStateProvider.ts:19-22`, `:24-28`, `:51-55`;
  `src/game/application/gameStateCodec.ts:104`, `:117`, `:454-456`
- Per-frame consumers: `src/ui/adapters/runStatusAdapter.ts:18-29`,
  `src/ui/adapters/landingStatusAdapter.ts:73-86`, `src/ui/adapters/cargoTransferAdapter.ts:51-104`
- Reducer gating: `src/game/mechanics/gameSimulation.ts:84-85`, `:107`
- Contracts: `context/foundation/testing.md:19`, `context/foundation/architecture.md:11,22`,
  `tests/architecture.test.mjs` (single provider construction point, pure layers)
- Precedent: `context/archive/2026-09-26-s04-first-planetary-trade/reviews/impl-review-phase-6.md:87`
- Previous change (measure-only, deferred this fix):
  `context/changes/req01-performance-monitor/plan.md`, `reviews/impl-review.md`
