# S07 Environmental Hazards and Death Implementation Plan

## Overview

Add deterministic environmental damage and a one-way death lifecycle. A destroyed ship freezes the active run, retains a private signed-in result, plays a two-second visual destruction sequence, and then shows the authoritative result in `GameOver`.

## Current State Analysis

Asteroid contact currently fragments the asteroid, knocks the ship back, and plays feedback without changing HP. Moolaris removes control inside its control radius but has no discrete damage/rearm state. `GameStateSnapshot` has neither run identity, random state, nor a terminal result; the strict codec accepts zero HP without terminal semantics. `GameOver` is static, and Supabase contains telemetry only.

## Desired End State

Asteroids and Moolaris deterministically reduce HP, and zero HP creates exactly one immutable death result containing final active time and credits. A signed-in player receives an idempotently stored private result; all players see the death animation and final score. The game-over screen is reached only after the two-second animation completes.

### Key Discoveries:

- `advanceGameSimulation` owns asteroid collision resolution and returns the committed active snapshot at [gameSimulation.ts](../../../src/game/mechanics/gameSimulation.ts:173).
- The strict root-schema and immutable provider boundary are at [gameStateCodec.ts](../../../src/game/application/gameStateCodec.ts:89) and [gameStateProvider.ts](../../../src/game/application/gameStateProvider.ts:7).
- Existing Moolaris control is defined by `moolarisControlRadius` in [contact.ts](../../../src/game/mechanics/moolaris/contact.ts:10).
- Browser test debug controls already route Phaser events from accessible DOM buttons, including planet teleport, in [setupUi.ts](../../../src/ui/setupUi.ts:68).

## What We're NOT Doing

- Global high-score display, public result access, or ranking eligibility.
- Active-save creation, deletion, migration, or resume behavior; S14 owns deletion after retention.
- A terminal flow for timeout, abandonment, imprisonment, or freedom.
- Anonymous result persistence or telemetry as a result store.
- Snapshot migrations for older schemas.

## Implementation Approach

Keep gameplay facts in the JSON-safe snapshot and pure simulation, then let scenes project the terminal edge once. A seeded PRNG and UUID are injected when a new run starts; the advanced seed is persisted so damage is reproducible after restore. Persistence is a separate application port backed by a private RLS table, with `runId` as the idempotency key. Phaser owns the transient death presentation; DOM UI receives an explicit run-terminal visibility event rather than owning terminal gameplay state.

## Critical Implementation Details

The terminal reducer must atomically capture time and credits in the same simulation pass as the zero-HP transition, then all later simulation calls must be no-ops. Scene effects may use a local one-shot guard, but cannot be the source of terminal idempotency. The Playwright helper must deliberately fail after ten confirmed collision attempts without reaching death; it must never loop indefinitely or use a timeout sleep.

## Phase 1: Authoritative hazard and terminal-run contracts

### Overview

Introduce persisted run identity/randomness and pure, deterministic hazard/death reducers before adding external storage or rendering.

### Changes Required:

#### 1. State, codec, and initial-run factory

**Files**: `src/game/state/`, `src/game/application/gameStateCodec.ts`, `src/game/definitions/initialGameState.ts`, `src/game/scenes/mainMenuScene.ts`

**Intent**: Make a run's random sequence and terminal result authoritative and serializable, without mixing browser randomness into mechanics.

**Contract**: Bump the snapshot schema; add an immutable run identity, PRNG state, Moolaris rearm fact, and `terminalResult: null | { runId, outcome: 'death', activeElapsedMs, finalCredits }`. Replace the static reset input with a factory supplied a browser-generated UUID and seed; fixtures pass deterministic values. Codec validation rejects malformed IDs, invalid PRNG values, and terminal-result shapes.

#### 2. Pure damage and terminal reducers

**Files**: `src/game/definitions/gameplayTuning.ts`, `src/game/mechanics/gameSimulation.ts`, `src/game/mechanics/moolaris/contact.ts`, `src/game/mechanics/`

**Intent**: Apply the agreed, reproducible damage rules at the authoritative collision boundary and resolve death once.

**Contract**: Add inclusive integer ranges SMALL 5–10, MEDIUM 10–20, BIG 15–30. Apply only the first existing time/ID-sorted asteroid impact per tick. On Moolaris control-radius entry, if HP is at least 30 set it to a seeded 5–10 value, otherwise set it to zero; rearm only after the ship exits the radius. A zero-HP transition captures the terminal result and freezes all later simulation advancement.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:mechanics` proves inclusive ranges, first-impact ordering, Moolaris entry/exit rearm, HP 30/29 thresholds, input immutability, and frozen terminal ticks.
- `npm.cmd run test:domain` proves codec round trips, invalid-shape rejection, immutable snapshots, and equal outcomes for uninterrupted versus restored seeded runs.
- `npm.cmd run typecheck` passes.

#### Manual Verification:

- A developer can observe that Moolaris deals one hit per entry, not continuous damage while the ship remains inside its control radius.

---

## Phase 2: Private retained-result boundary

### Overview

Create the isolated storage contract required to retain signed-in death results safely and retry delivery without duplication.

### Changes Required:

#### 1. Supabase result relation and RLS

**Files**: `supabase/migrations/<timestamp>_create_run_results.sql`

**Intent**: Retain terminal results separately from expiring, non-queryable telemetry.

**Contract**: Create `public.run_results` with `run_id uuid primary key`, `user_id uuid not null references auth.users(id) on delete cascade`, `outcome`, `active_elapsed_ms`, `final_credits`, and `created_at`. Restrict the supported outcome constraint to the product's terminal vocabulary while S07 inserts `death`; enable RLS allowing authenticated owners to insert and select only rows where `user_id = auth.uid()`, with no anonymous access, update, delete, or public read grants.

#### 2. Application port and browser adapter

**Files**: `src/game/application/results/`, `src/ui/adapters/`, `src/main.ts`, `src/game/main.ts`

**Intent**: Keep Supabase and delivery state outside the snapshot while exposing a typed, retryable result write to scenes.

**Contract**: Add `ResultStorePort.persist(terminalResult)` returning an explicit saved/failed status. The browser adapter uses the configured public Supabase client/session, derives the owner from that session, makes anonymous persistence a no-op, and treats a duplicate `runId` as already saved. Register the port through the composition root and Phaser registry; no access token, secret, client, or transient delivery status enters state.

### Success Criteria:

#### Automated Verification:

- Migration applies through the local Supabase test lifecycle and owner RLS allows one user to read/write only their own result.
- Focused adapter tests prove unsigned no-op, signed insert, retry idempotency, and a surfaced write failure.
- `npm.cmd run typecheck` passes.

#### Manual Verification:

- A signed-in local player can inspect that a death result appears once in their local `run_results` history and is inaccessible to another user.

---

## Phase 3: Death sequence, final result, and HUD status

### Overview

Project the immutable terminal result without advancing gameplay: animate the destruction, hide controls/UI, then render and persist the result.

### Changes Required:

#### 1. Phaser death presentation and transition

**Files**: `src/game/scenes/gameScene.ts`, `src/game/effects/`, `src/game/objects/spaceship/`, `src/game/scenes/gameOverScene.ts`

**Intent**: Give death a readable, bounded visual transition before the result screen while retaining scene cleanup ownership.

**Contract**: On the active-to-terminal edge, clear input and hide the ship; create three animated flaming ship fragments at the committed position, drive them apart while playing explosion effects, and fade the world to black over exactly 2,000 ms. Hide all Phaser controls plus DOM run controls for the sequence. After completion start `GameOver` with the immutable terminal result; dispose tweens, fragments, effects, and handlers on shutdown so re-entry cannot duplicate effects.

#### 2. Result delivery status and retry

**Files**: `src/game/scenes/gameOverScene.ts`, `src/ui/`, `src/game/application/results/`

**Intent**: Show death outcome, active survival time, final cash, and honest persistence status without recomputing facts.

**Contract**: `GameOver` reads/passively receives the canonical terminal result, initiates signed-in persistence once, and exposes an accessible retry only after a failed save. A retry reuses the same `runId`; unsigned players never see a false saved claim.

#### 3. HP-bar semantic colors

**Files**: `src/ui/adapters/runStatusAdapter.ts`, `src/ui/components/`, `public/style.css`

**Intent**: Make current ship health immediately legible throughout active play.

**Contract**: Project a health-band value and set the range presentation/token to green at HP ≥70, orange from 30 through 69, and red below 30. Preserve the native range value and accessible label; hide the status with the rest of the run UI during the death sequence.

### Success Criteria:

#### Automated Verification:

- Fast UI/component tests prove HP boundary bands (70, 69, 30, 29), terminal UI hide/show signaling, retry state, and idempotent cleanup.
- `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

#### Manual Verification:

- Death visibly produces three diverging flaming fragments, world fade, and no interactive game controls for exactly the transition period before `GameOver` appears.
- The result screen shows active time and cash captured at death and exposes a retry after a deliberately failed local write.

---

## Phase 4: Browser journey and regression verification

### Overview

Prove the player-visible cross-layer journey with the required bounded asteroid-teleport strategy; keep rule coverage at lower test levels.

### Changes Required:

#### 1. Test-only asteroid teleport control

**Files**: `src/game/mechanics/debug/`, `src/game/scenes/gameScene.ts`, `src/ui/setupUi.ts`, existing debug-menu markup/labels

**Intent**: Reuse the existing accessible debug-teleport pattern to create a deterministic browser route to a currently live asteroid.

**Contract**: Add a debug event/control that places the ship at a selected live asteroid's collision location with safe reset velocity. It is available only through the existing debug menu/test route, follows the planet-teleport lifecycle cleanup pattern, and is not authoritative gameplay logic.

#### 2. Signed-in death-to-result Playwright journey

**Files**: `tests/ui/`, `context/foundation/e2e_scenarios.md`

**Intent**: Verify real browser input, Phaser debug routing, HUD update, death transition, and authenticated local Supabase retention together.

**Contract**: Use `testSessionFixture` in authenticated mode. Repeatedly activate the accessible asteroid teleport, wait for the HP range value to decrease after each collision, and stop when `GameOver` is visible. Allow at most ten attempts: if death is not reached by the tenth confirmed collision, fail with an explicit diagnostic. Do not use CSS/XPath selectors, `page.waitForTimeout`, unbounded retries, direct session scripts, or direct state mutation. Record the player-visible risk, why lower-level tests cannot prove this browser integration, and its unique browser behavior; refresh the E2E inventory.

### Success Criteria:

#### Automated Verification:

- `npm.cmd run test:ui` passes against local Docker Supabase; the journey proves each attempted teleport reduces HP and reaches `GameOver` within ten attempts.
- `npm.cmd run test:project` passes when the existing local browser/Docker prerequisites are available.

#### Manual Verification:

- A reviewer can see the test's explicit ten-attempt failure message by temporarily preventing damage, confirming it never silently passes a non-lethal hazard loop.

## Testing Strategy

- Keep damage, PRNG, terminalization, codec, and storage contracts in Node/unit tests.
- Use Playwright solely for the signed-in browser journey, where accessible debug control, Phaser state projection, DOM HP status, timed transition, and local Supabase ownership meet.
- Run the narrow phase commands first; do not install browsers or dependencies as ordinary validation.

## Performance Considerations

The death effect allocates only three temporary fragments and bounded explosion/fade tweens. Terminal simulation no-ops eliminate post-death world updates; all transient objects must be destroyed at transition or shutdown.

## Migration Notes

The new result relation is additive. Existing active snapshots are intentionally not migrated; incompatible old snapshots are rejected under the project rule. S14 may later atomically couple retained-result writing with active-save deletion, but this plan does not delete any active save.

## References

- Frame: `context/changes/s07-environmental-hazards-and-death/frame.md`
- Research: `context/changes/s07-environmental-hazards-and-death/research.md`
- Architecture: `context/foundation/architecture.md`
- Testing: `context/foundation/testing.md`
- Existing collision boundary: `src/game/mechanics/gameSimulation.ts:173`
- Existing debug teleport route: `src/ui/setupUi.ts:68`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Authoritative hazard and terminal-run contracts

#### Automated

- [ ] 1.1 `npm.cmd run test:mechanics` proves inclusive ranges, first-impact ordering, Moolaris entry/exit rearm, HP 30/29 thresholds, input immutability, and frozen terminal ticks.
- [ ] 1.2 `npm.cmd run test:domain` proves codec round trips, invalid-shape rejection, immutable snapshots, and equal outcomes for uninterrupted versus restored seeded runs.
- [ ] 1.3 `npm.cmd run typecheck` passes.

#### Manual

- [ ] 1.4 A developer can observe that Moolaris deals one hit per entry, not continuous damage while the ship remains inside its control radius.

### Phase 2: Private retained-result boundary

#### Automated

- [ ] 2.1 Migration applies through the local Supabase test lifecycle and owner RLS allows one user to read/write only their own result.
- [ ] 2.2 Focused adapter tests prove unsigned no-op, signed insert, retry idempotency, and a surfaced write failure.
- [ ] 2.3 `npm.cmd run typecheck` passes.

#### Manual

- [ ] 2.4 A signed-in local player can inspect that a death result appears once in their local `run_results` history and is inaccessible to another user.

### Phase 3: Death sequence, final result, and HUD status

#### Automated

- [ ] 3.1 Fast UI/component tests prove HP boundary bands (70, 69, 30, 29), terminal UI hide/show signaling, retry state, and idempotent cleanup.
- [ ] 3.2 `npm.cmd run test:fast` and `npm.cmd run typecheck` pass.

#### Manual

- [ ] 3.3 Death visibly produces three diverging flaming fragments, world fade, and no interactive game controls for exactly the transition period before `GameOver` appears.
- [ ] 3.4 The result screen shows active time and cash captured at death and exposes a retry after a deliberately failed local write.

### Phase 4: Browser journey and regression verification

#### Automated

- [ ] 4.1 `npm.cmd run test:ui` passes against local Docker Supabase; the journey proves each attempted teleport reduces HP and reaches `GameOver` within ten attempts.
- [ ] 4.2 `npm.cmd run test:project` passes when the existing local browser/Docker prerequisites are available.

#### Manual

- [ ] 4.3 A reviewer can see the test's explicit ten-attempt failure message by temporarily preventing damage, confirming it never silently passes a non-lethal hazard loop.
