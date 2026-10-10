<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Read-Path Serialization Removal

- **Plan**: `context/changes/bug01-state-commit-issue-fix/plan.md`
- **Scope**: Phase 2 of 3 — "Stop the wasted fan-out"
- **Reviewed phases**: 2
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

Reviewed tree = Phase 2's uncommitted diff on top of the Phase 1 work (no implementation commit exists yet; the
commit is deliberately deferred). Gates re-run by the coordinator on that final tree:

- `GATE test:domain: PASS` — 81/81, including the new `the landing port skips its projections while flying and still projects the landing itself`.
- `GATE test:ui-presentation: PASS` — 14/14 unchanged.
- `GATE test:fast: PASS` — domain 81, mechanics 52, objects 10, audio 11, ui-presentation 14, architecture 8.
- `GATE typecheck: PASS` — both TS configurations clean.
- `GATE break-check: PASS` — removing the new early return turned exactly the new test red (1 fail / 80 pass); the file was restored byte-identical (`git hash-object` unchanged).

Verified clean, beyond the broken/restored checks:

- The ineligible→eligible and eligible→ineligible transitions still project; the construction-time seeding of
  `facilitiesSnapshot`/`shipyardSnapshot`/`snapshot` is untouched, so a run that starts landed still gets its first
  snapshot.
- `wasEligible` cannot desynchronise: the early return only fires when the state is ineligible *and* `wasEligible` is
  already false, so every transition to eligible takes the full path. `tradeQuantity` is zeroed on the
  eligible→ineligible transition, so a run cannot display a stale quantity after liftoff by way of the skip.
- Every command path (`selectCommodity`, `setTradeQuantity`, `confirmTrade`, `buildFacility`, `upgradeFacility`,
  `repairShip`, `upgradeShipService`, `purchaseBooster`, `launch`) keeps today's semantics; the skip only suppresses
  projections while the panel's own eligibility is unchanged and false.
- The three listener sets receive no notification while flying and already ineligible; no consumer can observe a
  difference because the ineligible snapshot they already hold is the one the skip preserves.

## Findings

### F1 — Phase 2 §1 is not implemented, and the plan's premise for it is factually wrong

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence (the plan itself is defective here)
- **Location**: `context/changes/bug01-state-commit-issue-fix/plan.md` (Phase 2 §1); `src/ui/adapters/runStatusAdapter.ts:28-29,42`
- **Detail**: The plan calls both `step` refreshes "pure duplication of `provider.subscribe`" and predicts "nothing displayed and no modal-open timing changes". Three checks contradict it. (1) Phaser emits `step` on `game.events` every frame, before the scene update (`node_modules/phaser/src/core/Game.js:474`, `:543`), so the listener is live in production even though nothing in `src/` emits it. (2) `refresh` is the only code that recomputes `runStatusIsVisible(game.scene.isActive('Game'), …)`, and `stateProvider.reset` runs only on the new-game path (`src/game/scenes/mainMenuScene.ts:32-38`) — never on return-to-menu; `exitToGameOver` (`src/game/scenes/gameScene.ts:441-446`) commits while the Game scene is still active and then stops it. (3) `#run-status` is `z-index: 3` (`public/style.css:83`) against `#main-menu` at `z-index: 2` (`:44`), so a stale HUD paints over the main menu. An executed A/B (`runStatusIsVisible` after the scene stops: true with the tick, false without) predicts a visible regression, and the existing Playwright journey `tests/ui/applicationDesktopUiTest.ts:70` asserts the run status is hidden after "Return to Main Menu" — but `test:ui` is in neither this phase's nor Phase 3's gate list, so the plan's own gates would not catch it.
- **Fix A ⭐ Recommended**: Skip §1 — keep both `step` listeners, and record the corrected premise, the evidence and the measured residual in `verification.md` so a later reader does not "finish" the deletion.
  - Strength: Preserves the HUD's visibility semantics and the wall-clock warning expiry; needs no new design.
  - Tradeoff: One plan item ships unimplemented; the residual per-frame projection cost stays.
  - Confidence: HIGH — Phaser's emitter, the only visibility recomputation, the z-index evidence and the existing E2E journey all point the same way.
  - Blind spot: The A/B probe exercised the projection logic, not a browser session; the authoritative confirmation is the manual flight/D.
- **Fix B**: Delete only the cargo-transfer listener and keep the run-status one.
  - Strength: Removes one genuine duplicate refresh.
  - Tradeoff: The two-second cargo-full warning is wall-clock based (`cargoTransferAdapter.ts:60,103`), so it would keep showing until the next commit whenever the scene is not committing.
  - Confidence: LOW — the benefit is measured below the benchmark noise floor.
  - Blind spot: No browser check of the warning overlay after a scene stop.
- **Fix C**: Delete both as written, accepting that HUD hiding must be re-implemented on a scene-lifecycle hook plus a real timer for the warning.
  - Strength: Matches the plan literally.
  - Tradeoff: A visible regression ships, and the fix is new design work for a sub-noise gain.
  - Confidence: LOW — evidence says the change is unsafe as written.
  - Blind spot: Whether a lifecycle hook covers every path (game over, return to menu, restart).
- **Decision**: SKIPPED - the owner dropped Phase 2 section 1: keep both `step` listeners and record the corrected premise, the evidence and the measured residual. Implementing it as written would ship the HUD regression described above; the sound replacement (a scene-lifecycle hook plus a non-tick trigger for the wall-clock warning) is new design work for an unmeasurable gain and belongs in a follow-up.

### F2 — The cargo-transfer `step` refresh is not a pure duplicate either

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `src/ui/adapters/cargoTransferAdapter.ts:60,103-104`
- **Detail**: `warning` is computed from `Date.now()` against `warningUntilMs`, which is armed for two seconds on `salvage-pickup-cargo-full`. With the `step` tick removed, the only remaining trigger is a state commit — so a warning showing while the scene stops committing would stay on screen. Removing this listener therefore also required rewriting the two-second expiry test onto a commit trigger, which is "editing the test to fit the change" and would leave the tick-driven expiry path untested.
- **Fix**: Same decision as F1 — keep the listener, or replace the wall-clock expiry with a trigger that does not depend on a per-frame tick.
- **Decision**: SKIPPED - follows F1: the listener stays, so the tick-driven wall-clock expiry keeps working and the two-second expiry test keeps covering it.

### F3 — §1's remaining upside is below the measurement noise floor

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/ui/adapters/runStatusAdapter.ts:20-27`; `src/ui/adapters/cargoTransferAdapter.ts:51-101`
- **Detail**: After Phase 1 a read is free, so the surviving per-frame cost in these adapters is a small projection plus a `JSON.stringify` dedupe of that projection; the implementer measured the whole landing fan-out below ~0.1 ms against a ~1.44-1.50 ms commit (the retained validating decode).
- **Fix**: Record the measured residual in `verification.md` as the reason §1 is dropped rather than re-planned.
- **Decision**: FIXED - recorded in `verification.md` under "Residual fan-out cost" with the operator's own reading (~0.24 ms/frame against 9.87 ms at the baseline).

### F4 — The one automated check that would catch this regression is not in the phase gates

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `tests/ui/applicationDesktopUiTest.ts:70`
- **Detail**: The Playwright journey already asserts the run status is hidden after "Return to Main Menu". `test:ui` is absent from Phase 2's and Phase 3's automated criteria (it needs Docker Supabase and is a separate one-time setup), so a §1-style regression passes every gate the plan prescribes.
- **Fix**: Run `npm.cmd run test:ui` once at the release gate, or record why it stays out of the change's gates.
- **Decision**: DEFERRED - `test:ui` resets a local Docker Supabase stack (and needs one running), so it stays a release-gate check rather than a step in this change; `tests/ui/applicationDesktopUiTest.ts:70` remains the check that would catch a HUD-visibility regression.

### F5 — `test:ui-presentation` does not exercise the landing adapter either

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `package.json` (`test:ui-presentation` = `tests/run-status-clock.test.mjs tests/landing-status.test.mjs tests/performanceReadout.test.mjs`)
- **Detail**: Those three suites render fake ports; none constructs `createLandingStatusPort`. The phase's new coverage therefore lives entirely in `tests/domain/gameState.test.mjs`, which is what 2.1 checks.
- **Fix**: No action needed; recorded so the coverage location is unambiguous.
- **Decision**: ACCEPTED - no action; recorded so the coverage location is unambiguous.

## Manual verification still outstanding

- 2.5 — while flying the HUD (clock, credits, cargo, HP, ship info) updates exactly as before; on landing the hub, market, facilities and shipyard open and refresh instantly; every landing action refreshes immediately; the cargo-transfer modal still opens by proximity and the cargo-full warning still appears.
- Phase 3 (3.1-3.6) is untouched: `test:fast`/`typecheck`/`build-nolog` on the final tree, the same-spot performance-monitor reading, the visible-regression pass, and `verification.md`.

## Triage outcome (2026-10-10)

- **Skipped**: F1, F2 (the owner dropped Phase 2 section 1 and kept both `step` listeners).
- **Recorded**: F3 (`verification.md`, "Residual fan-out cost").
- **Deferred**: F4 (`test:ui` stays a release-gate check).
- **Accepted**: F5 (no action needed).
- The automated rows 2.1-2.4 and the operator's manual pass - heavy level-10 combat with dense
  asteroids and loot, the HUD, landing and planet-side interactions, and death / game-over /
  return-to-menu / new run - are all green, so 2.5 is confirmed.
