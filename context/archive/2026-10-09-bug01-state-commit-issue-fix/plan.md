# Read-Path Serialization Removal Implementation Plan

## Overview

The authoritative state read path stringifies, re-parses, re-validates and deep-clones the whole
game-state aggregate on every read - ten times per active frame. That is the measured cause of the
frame being update-bound: `state commit` 41.28 ms inside a 67.99 ms frame at 14.7 loops/second,
against a 4.83 ms unit price per read (`context/changes/req01-performance-monitor/verification.md`).
Serialization is a persistence concern. This plan removes it from the in-memory path, keeps exactly
one validating decode per commit, and stops the per-frame UI projection work that cannot have
changed.

## Current State Analysis

- `snapshot()` is `decodeGameState(encodeGameState(this.state))`, and `encodeGameState` is
  `JSON.stringify(decodeGameState(snapshot))` (`src/game/application/gameStateProvider.ts:19-22`,
  `src/game/application/gameStateCodec.ts:454-456`). One read = stringify + re-parse + per-field
  validation + recursive `cloneAndFreeze` (`gameStateCodec.ts:104-115`).
- `update()` already avoids the stringify: it validates the reducer result with `decodeGameState`
  (`gameStateProvider.ts:26-28`), so commit validation costs one decode, not a round trip.
- The stored state is already deeply frozen: the constructor plus `update`/`restore`/`reset` only
  ever assign decode results.
- Ten reads run per active frame: the scene's pre-frame snapshot, `publish()`'s own, run status,
  four in the landed-market adapter, cargo transfer, and two `step`-event refreshes that fire
  before the scene update (`src/ui/adapters/runStatusAdapter.ts:29`,
  `src/ui/adapters/cargoTransferAdapter.ts:104`).
- No consumer compares snapshot identity; displayed values are compared by content. The provider
  test asserts frozenness at several depths, that mutation throws, and that an older snapshot keeps
  its values (`tests/domain/gameState.test.mjs:15-38`).
- `landingStatusAdapter.refresh` re-projects market, facilities and shipyard on every publish, even
  in flight; its own commands call `refresh()` directly (`landingStatusAdapter.ts:73-95`, `:126-176`).
- `cargoTransferAdapter.refresh` is proximity-driven and must stay per-frame responsive; its `step`
  listener duplicates its own `provider.subscribe`.

## Desired End State

Reads are serialization-free and allocation-free; a commit still validates and still produces a new
frozen object; the per-frame fan-out does no projection work that cannot have changed. The existing
monitor confirms it: `state-snapshot` collapses to ~0 ms, `state-commit` keeps only its decode, and
loops/second rises materially from the 14.7 baseline. Verified by `test:fast`, `typecheck`,
`build-nolog` plus a same-spot panel reading.

### Key Discoveries:

- Returning the stored state from a read already satisfies the immutability guarantee, because the
  write boundary deep-freezes (`gameStateCodec.ts:104-115`); today's copy only makes each read a
  *detached* object, which nothing consumes.
- The two `step` refreshes are pure duplication of `provider.subscribe`, so deleting them is
  behaviour-preserving.
- `landingStatusAdapter`'s three projections while flying are the only per-frame fan-out work with
  no possible change behind it.

## What We're NOT Doing

- No `schemaVersion` or persisted-format change; `encodeGameState`/`decodeGameState` semantics stay
  the save/restore contract for S-11.
- No persistence or save work; no migration.
- No reducer, economy, telemetry or gameplay-behaviour change.
- No DOM, CSS or panel change; the performance monitor stays untouched as the measuring instrument.
- No new dependency, no new npm script, no Playwright test.
- No timer- or cadence-based refresh; gating stays content-driven so nothing displayed can lag.

## Implementation Approach

Reads hand out the frozen authoritative state; the write boundary keeps validating. The redundant
`step` refreshes are deleted, and the landed adapter skips its projections unless the panel is
eligible. Verification reuses the existing panel and the documented baseline.

## Critical Implementation Details

- Mutation rejection now depends entirely on the write boundary's `cloneAndFreeze`: only decode
  results may be stored, so never assign a raw reducer result to `this.state`.
- All fan-out gating must be content-driven (bucket the run clock to whole seconds); a time-based
  gate would make displayed values lag a frame.
- The `step` listeners go away because `provider.subscribe` already refreshes in the same frame -
  not because of any new timing assumption.

## Phase 1: Free reads

### Overview

Remove serialization and copying from the read path while keeping the write boundary validating.

### Changes Required:

#### 1. Provider read path

**File**: `src/game/application/gameStateProvider.ts`

**Intent**: `snapshot()` returns the frozen authoritative state instead of an encoded, decoded and
cloned copy; the contract it offers moves from "structurally detached" to "shared and deeply
frozen".

**Contract**: `snapshot(): GameStateSnapshot` returns `this.state` - identity-stable between
commits, new on each commit. `update(reducer)` keeps its signature and still validates the reducer
result via `decodeGameState` (no stringify). `restore`/`reset` unchanged. A short doc comment states
the new read contract and that immutability is guaranteed by the write boundary's deep freeze.

#### 2. Provider contract tests

**File**: `tests/domain/gameState.test.mjs`

**Intent**: Pin the new read contract and keep the immutability evidence, so a future regression
back to copying fails loudly.

**Contract**: Reword the first test away from "detached"; assert
`provider.snapshot() === provider.snapshot()` (no copy), frozenness at several depths, that mutation
throws, that an old snapshot keeps its old values after an update, and that the object identity
changes after a commit. Add one case proving the write boundary still validates: a reducer returning
a malformed state makes `update` throw and leaves the previous state in place.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:domain` passes, including the updated provider contract test and the
  malformed-reducer validation case.
- `npm.cmd run typecheck` passes.
- `npm.cmd run test:architecture` still passes (single provider construction point, pure layers).

---

## Phase 2: Stop the wasted fan-out

### Overview

Remove the per-frame UI work that has nothing to do: two duplicated refreshes and the landed
projections that run while flying.

### Changes Required:

#### 1. Redundant `step` refreshes

**Files**: `src/ui/adapters/runStatusAdapter.ts`, `src/ui/adapters/cargoTransferAdapter.ts`

**Intent**: Each adapter currently refreshes twice per frame - once from `provider.subscribe`, once
from the `step` event. Delete the `step` registration and its teardown; nothing displayed and no
modal-open timing changes.

**Contract**: No port change. `game.events.on('step', ...)` and the matching `off` are removed while
`provider.subscribe(refresh)` stays.

#### 2. Landed adapter idle while flying

**File**: `src/ui/adapters/landingStatusAdapter.ts`

**Intent**: Market, facilities and shipyard projections are worthless when the ship is not landed,
yet they run on every publish. Skip them unless the panel is eligible, keeping instant updates for
the adapter's own commands and for the landing/liftoff transition.

**Contract**: `refresh()` returns early when
`provider.snapshot().planetLifecycle.landedPlanetId === null` and the previous state was also
ineligible. Eligibility transitions, all command paths (trade, facility build/upgrade, repair,
ship-service purchase, booster, launch) and the three listener sets keep today's semantics. No port
change.

#### 3. Adapter coverage

**File**: `tests/domain/gameState.test.mjs` (plus `tests/landing-status.test.mjs` only if it asserts
projection counts)

**Intent**: Prove the skip is real and that nothing displayed regresses.

**Contract**: With a provider that never lands, repeated updates leave `getFacilitiesSnapshot()` and
`getShipyardSnapshot()` identity-stable (a new object means a projection ran); landing still
publishes immediately, and every existing trade, facility, repair and shipyard case stays green
unchanged.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:domain` passes, including the landing-skip identity case.
- `npm.cmd run test:ui-presentation` passes unchanged.
- `npm.cmd run test:fast` passes.
- `npm.cmd run typecheck` passes.

#### Manual Verification:

- While flying, the HUD (clock, credits, cargo, HP, ship info) updates exactly as before; on
  landing, the hub, market, facilities and shipyard open and refresh instantly, and every landing
  action refreshes immediately; the cargo-transfer modal still opens by proximity and the cargo-full
  warning still appears.

---

## Phase 3: Validate and record the gain

### Overview

Confirm the instrument shows the expected collapse and record before/after numbers as evidence.

### Changes Required:

#### 1. Verification record

**File**: `context/changes/bug01-state-commit-issue-fix/verification.md` (new)

**Intent**: Capture a same-host before/after reading so the gain is evidence rather than assertion,
and record any residual fan-out cost for a possible follow-up.

**Contract**: Record browser and machine, the baseline (copy from
`context/changes/req01-performance-monitor/verification.md`: frame interval 67.99 ms, update phase
63.56 ms, state commit 41.28 ms, state snapshot 4.83 ms, 14.7 loops/second), a fresh post-change
reading, and a one-line judgement of the residual.

#### 2. Fixups if the reading disagrees

**Intent**: A non-zero `state-snapshot` row or a `state-commit` row materially above its decode cost
means a copy or serialization survived on the path; investigate before recording.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:fast` passes on the final tree.
- `npm.cmd run typecheck` passes on the final tree.
- `npm.cmd run build-nolog` succeeds.

#### Manual Verification:

- Same-spot reading with the monitor on: `state-snapshot` collapses to ~0 ms, `state-commit` keeps
  only its decode, and loops/second rises materially from the 14.7 baseline (expected ~40 on the same
  host).
- No visible regression in menu, HUD, landing, trade, cargo transfer, death/game-over or
  return-to-menu.
- No new console error while playing.

---

## Testing Strategy

### Unit Tests:

- Read contract: identity-stable reads, frozen at depth, mutation throws, old snapshot stability,
  identity change per commit.
- Write boundary: malformed reducer result rejected and previous state preserved.
- Codec: existing encode/decode round-trip tests stay unchanged as the persistence contract.
- Landing adapter: identity-stable projections while flying; immediate publish on landing; existing
  landed cases unchanged.

### Manual Testing Steps:

1. `npm.cmd run dev-nolog`, press `D`, enable the monitor, fly for about a minute and read the panel.
2. Compare with the same-spot numbers in the previous change's verification file.
3. Land, trade, build and upgrade a facility, repair, buy a service, launch, collect cargo, open the
   transfer modal - every panel must update instantly.
4. Die, return to the menu, start a new run; confirm no console error.

## Performance Considerations

Nine of the ten per-frame reads disappear (about 43.5 ms at the measured 4.83 ms unit price) and one
decode per commit is retained (about 1.6 ms), so the update phase should fall from 63.56 ms to
roughly 20 ms and the frame from 67.99 ms to roughly 23 ms on the same host. The residual is three
small content-gated refreshes; the landing projections drop to zero in flight.

## Migration Notes

Not applicable: no persisted format, schema version or saved data is touched, and
`encodeGameState`/`decodeGameState` remain the save/restore contract for S-11.

## References

- Frame brief: `context/changes/bug01-state-commit-issue-fix/frame.md`
- Baseline and attribution: `context/changes/req01-performance-monitor/verification.md`
- Provider and codec: `src/game/application/gameStateProvider.ts:19-28`, `:51-55`;
  `src/game/application/gameStateCodec.ts:104`, `:117`, `:454-456`
- Adapters: `src/ui/adapters/runStatusAdapter.ts:20-29`,
  `src/ui/adapters/landingStatusAdapter.ts:73-95`, `src/ui/adapters/cargoTransferAdapter.ts:101-105`
- Contracts and rules: `context/foundation/testing.md:19`; `context/foundation/architecture.md:11,22`;
  `tests/architecture.test.mjs`; `context/foundation/lessons.md`
- Precedent for the same defect:
  `context/archive/2026-09-26-s04-first-planetary-trade/reviews/impl-review-phase-6.md:87`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Free reads

#### Automated

- [x] 1.1 `test:domain` passes with the updated provider read contract and the malformed-reducer validation case — b4a876f
- [x] 1.2 `typecheck` passes — b4a876f
- [x] 1.3 `test:architecture` still passes with one provider construction point — b4a876f

### Phase 2: Stop the wasted fan-out

#### Automated

- [x] 2.1 `test:domain` passes with the landing-skip identity case — d6c2abc
- [x] 2.2 `test:ui-presentation` passes unchanged — d6c2abc
- [x] 2.3 `test:fast` passes — d6c2abc
- [x] 2.4 `typecheck` passes — d6c2abc

#### Manual

- [x] 2.5 HUD, landed panels and the cargo-transfer modal behave exactly as before while flying, landing and acting

### Phase 3: Validate and record the gain

#### Automated

- [x] 3.1 `test:fast` passes on the final tree
- [x] 3.2 `typecheck` passes on the final tree
- [x] 3.3 `build-nolog` succeeds

#### Manual

- [x] 3.4 Same-spot monitor reading shows the collapsed read and commit rows and a material loop-rate gain
- [x] 3.5 No visible regression across menu, HUD, landing, trade, cargo transfer, death and return-to-menu
- [x] 3.6 Baseline and post-change numbers recorded in this change's verification.md
