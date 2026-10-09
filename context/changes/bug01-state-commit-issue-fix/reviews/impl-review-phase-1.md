<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Read-Path Serialization Removal

- **Plan**: `context/changes/bug01-state-commit-issue-fix/plan.md`
- **Scope**: Phase 1 of 3 — "Free reads"
- **Reviewed phases**: 1
- **Date**: 2026-10-09
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

Reviewed tree = the uncommitted Phase 1 worktree diff against `bf83a7c` (no implementation commit exists yet;
the commit is deliberately deferred). Gates re-run by the coordinator on that tree:

- `GATE test:domain: PASS` — 80/80, including `provider reads hand out the frozen authoritative state and publishes valid replacements` and `the write boundary rejects a malformed reducer result and keeps the previous state`.
- `GATE typecheck: PASS` — both TS configurations clean.
- `GATE test:architecture: PASS` — 8/8, including the single-provider-construction-point guard.
- `GATE test:fast: PASS` — domain 80, mechanics 52, objects 10, audio 11, ui-presentation 14, architecture 8.
- `GATE break-check (read path): PASS` — restoring `decodeGameState(encodeGameState(this.state))` turned exactly 2 tests red (the reworded provider test and the new write-boundary test), 78 green; file restored byte-identical (`git hash-object` unchanged).
- `GATE break-check (write boundary): PASS` — dropping `decodeGameState` from `update` turned exactly 1 test red (the new write-boundary test); restored.
- Independent freeze audit over a live snapshot: 1598/1598 reachable object nodes frozen on the initial read, after a commit, and after a no-op reducer. `decodeGameState` always ends in `cloneAndFreeze({ ...fresh aggregate... })` (`src/game/application/gameStateCodec.ts:104-114`, `:407-449`), which is what makes sharing the object safe.
- Consumer audit: the three provider subscribers (`src/ui/adapters/runStatusAdapter.ts:28`, `cargoTransferAdapter.ts:101`, `landingStatusAdapter.ts:95`) project into their own snapshots; no `src/` consumer assigns into a snapshot, keys a collection by snapshot identity, or compares two reads by identity.

## Findings

### F1 — `context/foundation/architecture.md:26` contradicted the new read contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline / Plan Adherence
- **Location**: `context/foundation/architecture.md:26`
- **Detail**: The binding architecture contract that `AGENTS.md` points at still said scenes "render detached readonly snapshots", a statement Phase 1 invalidated and that `frame.md:76-80` explicitly named as needing conscious redefinition. The twin sentence in `context/foundation/testing.md:19` was already reworded, leaving the two authoritative statements inconsistent.
- **Fix**: One clause rewritten to "shared, deeply frozen readonly snapshots". Applied during Phase 1 as an accepted **Minor** adaptation.
- **Decision**: FIXED — accepted Minor adaptation, folded into the Phase 1 commit set.

### F2 — `context/foundation/testing.md:19` sits outside the plan's Phase 1 file list

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `context/foundation/testing.md:19`
- **Detail**: The plan's Phase 1 named only the provider and the provider test. The one-line clause "detached immutable snapshots" described exactly the contract being redefined and would have been left factually wrong.
- **Fix**: Reworded to "the shared frozen read contract". Applied as an accepted **Minor** adaptation; the file must stay in the Phase 1 commit set or the commit ritual will report it as an unrelated dirty path.
- **Decision**: FIXED — accepted Minor adaptation, folded into the Phase 1 commit set.

### F3 — `snapshot()` now names something other than what it returns

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: `src/game/application/gameStateProvider.ts:27`
- **Detail**: Elsewhere in the codebase `snapshot()` means "produce a fresh projection" (`src/game/application/performanceMonitor.ts:199`, `src/ui/adapters/displayAdapter.ts:20`); here it now hands back the live authoritative object. Keeping the signature is the plan's explicit call (renaming would touch ~25 call sites); the new doc comment is what keeps it honest.
- **Fix**: Record the deliberate naming tradeoff in this change's `verification.md` so a later reader does not "fix" it by re-adding the copy.
- **Decision**: FIXED - recorded in `verification.md` ("Notes for a future reader").

### F4 — The new write-boundary test does not pin why it throws

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/domain/gameState.test.mjs:43-47`
- **Detail**: The three `assert.throws` cases would also pass on an unrelated `TypeError`; `assert.equal(provider.snapshot().credits, 100_000)` hardcodes a balance constant that lives in the definitions, adding config-drift surface without adding signal beyond the identity assertion on the line above. Coverage overlaps the existing codec rejection matrix.
- **Fix**: Optionally add message patterns (`assert.throws(fn, /credits|schema|finite/i)`) and drop the literal-credits assertion.
- **Decision**: FIXED - each `assert.throws` now pins its own rule (`/state\.credits must not be negative/`, `/Unsupported game-state schema version/`, `/state\.ship\.position\.x must be a finite number/`) and the balance literal is gone, since the identity assertion above it already proves "unchanged".

### F5 — Nothing asserts that a rejected commit notifies no subscriber

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/domain/gameState.test.mjs:40-48`
- **Detail**: `restore` atomicity is covered by the existing codec test, but the `update` path's atomicity is proven only by state identity; a rejected reducer that still published would not be caught.
- **Fix**: Optionally assert inside the new test that the subscriber was not notified across the rejected commits.
- **Decision**: FIXED - the write-boundary test now subscribes, runs the three rejected commits and asserts `assert.deepEqual(notifications, [], 'a rejected commit notifies no subscriber')`.

### F6 — A per-frame `JSON.stringify` survives on the read path (projection dedupe)

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/ui/adapters/runStatusAdapter.ts:16,22`; `src/ui/adapters/performanceReadoutAdapter.ts:10,15`
- **Detail**: Both adapters dedupe with a `JSON.stringify` key. It serializes a small projection, not the aggregate, so the plan's unit-price model is unaffected — the frame brief's open question 2.
- **Fix**: Cover it in the Phase 3 residual note; no code change planned.
- **Decision**: FIXED - recorded in `verification.md` under "Residual fan-out cost" and "Notes for a future reader".

### F7 — `encodeGameState` now has zero `src/` consumers

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `src/game/application/gameStateCodec.ts:454`
- **Detail**: Retaining it is correct: it remains the save/restore format for S-11 and is still exercised by `tests/domain/gameState.test.mjs` and `tests/game-mechanics.test.mjs`. The planned ESLint introduction could make a future dead-code sweep delete it.
- **Fix**: State the retention reason in `verification.md`.
- **Decision**: FIXED - recorded in `verification.md` ("Notes for a future reader").

### F8 — Generated architecture artifact is now stale

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `context/foundation/code-graph.json:1299-1301`
- **Detail**: The graph still records the edge `GameStateProvider → gameStateCodec#encodeGameState`, which no longer exists. Architecture artifacts are generated only when a task explicitly requests them.
- **Fix**: Regenerate on the next explicitly requested architecture-artifact task; do not regenerate here.
- **Decision**: FIXED - recorded in `verification.md` as deliberate, by-design staleness; no generation was run.

## Phase 2 coordinates worth carrying forward

- The eligibility machinery the Phase 2 plan describes already exists: `src/ui/adapters/landingStatusAdapter.ts:75-83` computes `eligible` and tracks `wasEligible` at HEAD, so the in-flight skip is an early return on `!eligible && !wasEligible` rather than new state.
- The constructor still projects facilities and shipyard unconditionally (`src/ui/adapters/landingStatusAdapter.ts:70-72`); the skip must not touch that path or the initial landed snapshot breaks.
- `game.events.emit('step')` exists nowhere in `src/`; the only emitters are tests (`tests/domain/gameState.test.mjs:722,725`). Removing the two `step` registrations therefore needs those test lines re-driven through `provider.update`, without weakening the two-second expiry assertions.

> Correction (2026-10-10): the line above is wrong and was superseded by the Phase 2 review. Phaser
> itself emits `step` on `game.events` every frame (`node_modules/phaser/src/core/Game.js:474`), so
> the listener is live in production; `runStatusAdapter.refresh` is the only code that recomputes
> `runStatusIsVisible(game.scene.isActive('Game'))`. See `impl-review-phase-2.md` F1/F2 — Phase 2
> section 1 was dropped on that evidence, and the two test lines stay on `events.emit('step')`.

## Triage outcome (2026-10-10)

- **Fixed during implementation**: F1, F2 (both accepted as Minor adaptations and folded into the Phase 1 commit set).
- **Fixed during triage**: F4, F5 (test hardening - per-rule `assert.throws` patterns, the balance literal dropped, and a no-subscriber-notification assertion added).
- **Recorded**: F3, F6, F7, F8 (`verification.md`).
- **Skipped / deferred**: none from this phase.
