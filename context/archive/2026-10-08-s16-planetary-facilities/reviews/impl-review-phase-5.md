<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S16 Planetary Facilities Implementation Plan

- **Plan**: context/changes/s16-planetary-facilities/plan.md
- **Scope**: Phase 5 of 5
- **Reviewed phases**: 5
- **Date**: 2026-10-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Reviewed scope note: Phase 5 is uncommitted in the worktree (HEAD e40594f). Its own contribution is `src/game/application/landedFacilities.ts` (new), the facilities members of `src/ui/contracts.ts`, the facilities wiring in `src/ui/adapters/landingStatusAdapter.ts`, the facility labels in `src/ui/components/displayLabels.ts`, the facilities view in `src/ui/components/landingStatus.ts`, the `#landing-status-facilities-view` markup in `index.html`, the facility styling in `public/style.css`, the new `tests/landing-status.test.mjs`, and one `package.json` script line; the tracked diffs for the shared UI files also carry Phase 1/2 edits, which were excluded. `src/game/application/landedMarket.ts` was listed under the phase's Files but was not changed by Phase 5 (its worktree diff is Phase 1's removal of the legacy market tuning) - the phase intent still holds because the facilities projection is self-contained and reuses `quoteFacilityInvestment` for the landed-only rule and price. The Facilities button is now enabled, the view union is `'hub' | 'market' | 'facilities'`, and no new Playwright spec, telemetry event type, or snapshot migration was added. All findings are low-impact; the automated gates pass.

Gate corrections (applied during verification, not findings): (a) `typecheck` initially failed with `src/game/application/landedFacilities.ts(122,62): error TS2345: Argument of type 'string' is not assignable to parameter of type 'PlanetId'` because `planetLifecycle.landedPlanetId` is typed `string | null`, so the null-narrowed `planetId` is `string`; the projection now passes the already-typed `market.planetId` (identical value, found by that same predicate), which fixes it at the root without a cast. (b) `tests/landing-status.test.mjs` is wired into `test:ui-presentation`.

## Findings

### F1 - Opening the view can leave focus on a hidden control

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/ui/components/landingStatus.ts:219
- **Detail**: `openFacilities` hides the hub, shows the facilities view, then focuses `facilityActionButtons.values().next().value`. That is the first facility's action button, which is `disabled` when its investment is unaffordable (line 119). In a real browser `focus()` on a disabled control is a no-op, and the previously focused element is now inside a hidden container, so focus falls to the document body instead of the dialog. The plan requires "opening the view focuses its first meaningful control". The fresh-landing path is fine (Seroton Dairy Farm is level 1 and affordable), so this only bites when the first card is unaffordable. Note the market view at line 211 uses the same pattern - that is pre-existing.
- **Fix**: Focus the first non-disabled control, reusing the existing `focusable()` helper scoped to `facilitiesView`, with `facilitiesBack` as the always-enabled fallback.
- **Decision**: FIXED (triage) - `openFacilities` focuses the first enabled facility action, falling back to the always-enabled `facilitiesBack`.

### F2 - The "five cards" assertion counts the fixture, not the rendered view

- **Severity**: WARNING
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (test contract)
- **Location**: tests/landing-status.test.mjs:168
- **Detail**: The phase contract requires the test to assert five cards. The dedicated assertion is `Object.keys(cards).length === 5`, which counts the test's own fixture object and therefore stays green no matter how many cards the view renders. Practical coverage is not lost - the loop at 169-174 queries each facility card through the component's own `required(...)` selector for all five ids, so a missing card throws - but the explicit count assertion is vacuous and would not detect a view that rendered extra cards.
- **Fix**: Assert against the rendered container (e.g. the length of the facilities view's card collection) rather than the fixture object.
- **Decision**: FIXED (triage) - the DOM test asserts the rendered facilities view cards instead of the fixture object.

### F3 - Focus and idempotent-destroy assertions cannot fail on the defects they target

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (test quality)
- **Location**: tests/landing-status.test.mjs:58
- **Detail**: (a) `FakeElement.focus()` unconditionally sets `documentStub.activeElement` and ignores `disabled`, so the focus assertion at 204-206 passes even when the focused button is disabled - exactly the case in F1. (b) The idempotent-destroy check at 213-217 asserts teardown booleans and empty listener maps, which are equally true after a single `destroy()`, so it does not distinguish idempotency.
- **Fix**: Make the fake's `focus()` a no-op when `disabled`, add a case with an unaffordable first facility asserting focus lands on a non-disabled control, and count unsubscribe/`port.destroy` invocations to assert exactly one each.
- **Decision**: FIXED (triage) - `FakeElement.focus()` no-ops when `disabled`, an unaffordable-first-facility case asserts focus lands on a non-disabled control, and teardown counters assert exactly one unsubscribe and one `port.destroy`.

### F4 - Five facility action buttons share one accessible name; clock/back aria-labels are unasserted

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (accessibility)
- **Location**: src/ui/components/landingStatus.ts:120
- **Detail**: All five action buttons expose only `BUILD` / `UPGRADE` / `MAX LEVEL` (or the localized equivalents), so a screen-reader user cannot tell which facility each button acts on. Separately, the component writes the required paused-clock `aria-label` (line 92) and Back to Planet `aria-label` (line 90) but the new test asserts only `textContent`, so an aria-label regression would pass.
- **Fix**: Add the row label to each action's accessible name (`${row.label}: ${actionText}`) and assert the two aria-labels in the DOM test, mirroring the existing aria-label assertions in `tests/run-status-clock.test.mjs`.
- **Decision**: FIXED (triage) - each facility action button carries a facility-specific accessible name (`${row.label}: ${actionText}`), and the DOM test asserts the clock and back aria-labels.

### F5 - A user-visible string bypasses `displayLabels`

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/ui/components/landingStatus.ts:106
- **Detail**: The `" commodity icon"` suffix is a literal in the component (and again in the market region at line 160), which contradicts the accepted team lesson "Reuse display-label constants": a label change would have to be made in more than one place, and the test cannot reference the shared constant.
- **Fix**: Add a `commodityIconSuffix` constant to `displayLabels` and reuse it (the same literal also appears in `cargoTransfer`).
- **Decision**: FIXED (triage) - added `displayLabels.commodityIconSuffix` and reused it for the market and facility icons.

### F6 - Card content has no overflow guard at short viewports

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (layout robustness)
- **Location**: public/style.css:336
- **Detail**: Cards wrap long text with `overflow-wrap: anywhere` but the card body has no `overflow` rule, so at short viewports (see the short-viewport block around style.css:344-347) long recipe/modifier text can spill vertically past the fixed card instead of being contained. The one-row/no-horizontal-scroll contract itself is met (`repeat(5, minmax(0, 1fr))`, `min-width: 0`).
- **Fix**: Add an `overflow: hidden` (or `auto`) rule on the card body so content cannot escape the fixed card bounds.
- **Decision**: FIXED (triage) - `.facility-card` now sets `overflow: auto` so card content cannot escape the fixed bounds.

### F7 - `displayLabels.facilitiesUnavailable` is now unused

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/ui/components/displayLabels.ts:32
- **Detail**: Enabling the Facilities button removed its last consumer (`index.html:77` previously carried the "Facilities unavailable" label). The constant now has no reference in product code or tests.
- **Fix**: Remove the constant, or keep it deliberately if a future non-landed facilities affordance is planned.
- **Decision**: FIXED (triage) - the unused `displayLabels.facilitiesUnavailable` constant was removed.

### F8 - Pre-existing Phase-2 defect: the market catalogue button text never shows `stock · price`

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence (out of Phase 5 scope)
- **Location**: src/ui/components/landingStatus.ts:194
- **Detail**: In the Phase-2 market catalogue region, `button.textContent` is assigned twice in a row, so the first assignment (apparently intending `stock · price`) is dead and only the carried-quantity label is ever shown. This is outside Phase 5's scope and not a Phase 5 regression, but it is visible in the same worktree and was surfaced by this review.
- **Fix**: Decide the intended button label and keep a single assignment; route the strings through `displayLabels`.
- **Decision**: ACCEPTED (pre-existing) - this is the Phase 2 F6 `textContent` duplicate; it predates this change and needs a product decision on the intended market catalogue label.

## Verified Phase 5 Contracts (evidence)

- Projection: `projectLandedFacilities` (`landedFacilities.ts:92`) is a pure function returning a frozen snapshot (107, 116, 132-154): `visible`/`eligible` (landed-only, the same rule as `landedMarket.ts:98-99`), `planetId`/`planetName`, `credits`, `cargoUsed`/`cargoCapacity`, `clock.remainingSeconds`/`runState` (mirroring `runStatus.ts:31-32`), and one frozen row per facility with `label`, `level`, `maxLevel`, the STORED `status` (137, never recomputed), `outputPerCycle`, `inputsPerCycle`, `modifier`, and `action { kind, targetLevel, price, affordable }`. Per-cycle arithmetic is identical to the mechanics reducer (`planetFacilitySimulation.ts:17-19`). MATCH.
- Port and wiring: `LandingStatusPort` gains `getFacilitiesSnapshot`, `subscribeFacilities`, `buildFacility`, `upgradeFacility` and the `LandedFacilitiesSnapshot` view model (`contracts.ts:8,11,16,69-75`); the adapter projects once and re-projects on every provider publish (65, 80, 82) and routes build/upgrade through `provider.update(state => applyFacilityBuild/Upgrade(...))` (136-143), mirroring `confirmTrade` (122). MATCH.
- Telemetry judgement: the only existing event names are `session_started | session_ended | planet_landed | planet_launched | commodity_bought | commodity_sold` (`telemetry.ts:4`), the ingest function rejects unknown names, and `commodity_bought` requires commodity/quantity/total semantics a facility build does not have. Given the plan's explicit "no new telemetry event types", emitting nothing for build/upgrade is the only consistent choice. MATCH.
- Component and markup: the view union is `'hub' | 'market' | 'facilities'` (69); the Facilities button is enabled with a handler (`index.html:77`, `landingStatus.ts:237`); `#landing-status-facilities-view` is a sibling of the hub and market views (index.html:75,79,95); nav left = Back to Planet + paused clock, right = credits + cargo (`index.html:96-99`, `style.css:317-319`); the lower 70% holds five equal-width cards in one row with no horizontal scrolling (`style.css:322`, `repeat(5, minmax(0, 1fr))`, `min-width: 0`); each card renders level, status (`data-status` + label for all three states), recipe, modifier and price with the action anchored bottom (`margin-top: auto`) and `disabled = kind !== 'max' && !affordable` (119); Build/Upgrade/Max Level derive from the projection's `kind`; focus moves into the view on open (219, subject to F1) and Launch still returns focus to the canvas (222). MATCH.
- Focus target judgement: focusing the first facility's action button mirrors the market view's `catalogue[0]?.focus()` (211) and satisfies "first meaningful control" on the primary landing path; the disabled-first-control edge case is F1. MATCH.
- Test: `tests/landing-status.test.mjs` asserts the five cards' names/levels/statuses/produces/consumes/modifiers/prices/actions, the Build/Upgrade/Max Level labels, the disabled-unaffordable state, the paused-clock text, the focused control, and teardown; `package.json` `test:ui-presentation` now runs both DOM specs so the file participates in `test:unit` -> `test:fast` -> `test:project`. MATCH (with F2/F3/F4).
- Architecture: `landedFacilities.ts` imports only domain/application/state (1-7, no `game/definitions`), and `landingStatus.ts` imports only `ui/contracts`/`ui/components`; `landingStatusAdapter.ts` is the sole `LandingStatusPort` implementer, so the added members break no other implementer. MATCH.
- Scope: no Playwright spec added or changed, no telemetry event types, no snapshot migration, no dependency changes (no jsdom). EXTRA beyond the literal contract (benign): `outputCommodityId` and `action.kind`/`targetLevel` on the row, both required by the view.

## Gate Re-runs

| Gate | Result | Evidence |
|------|--------|----------|
| DOM component test (Phase 5 automated) | PASS | `tests/landing-status.test.mjs` + `tests/run-status-clock.test.mjs`: 8/8, 0 fail, exit 0 |
| `npm.cmd run typecheck` | PASS | green after the `market.planetId` correction; `tsc --noEmit && tsc --noEmit -p tsconfig.tests.json` |
| `npm.cmd run test:fast` equivalent (unit + architecture) | PASS (2 environment-blocked) | 131 tests, 129 pass, 2 fail - the same two child-process-spawning tooling tests (`tests/object-scaffold.test.mjs`, `tests/game-audio.test.mjs`) blocked by the sandbox `EPERM`; unrelated to Phase 5. Architecture 8/8 included. |
| Break-check (affordability disable) | PASS | Setting `actionButton.disabled = false` turned `tests/landing-status.test.mjs` red (1 test); file restored byte-exactly (sha256 C8AC5CB7DA8EE118F4F27E7B81515AE4698139C5D35DC8B498EAD457A51391F1) and re-run green |
| `npm.cmd run test:project` / `npm.cmd run test:ui` | NOT RUN | Not fully runnable here: `test:ui` needs Docker Supabase + Chromium, and the default `node --test` worker spawn is denied by the sandbox. Progress row 5.2 is therefore left unchecked. |

Environment note: as in the Phase 3/4 reviews, suites were run in-process with `node --test --experimental-test-isolation=none` because the sandbox denies the default worker spawn, and escalation was unavailable (the automatic approval reviewer returned an infrastructure error). The Playwright pipeline is the outstanding release gate the user should run locally (`npm.cmd run test:project`).

## Progress (Manual) Status

- 5.3 Landing then Facilities shows five cards with the paused clock, credits, and cargo - `[ ]` pending
- 5.4 Build and Upgrade deduct credits and update the card immediately - `[ ]` pending
- 5.5 The affected commodity's market price changes after resuming flight - `[ ]` pending
- 5.6 Tab stays inside the dialog and Launch returns focus to the canvas - `[ ]` pending
- 5.7 Cards fit one row without horizontal scrolling at the target resolution - `[ ]` pending

Automated rows: 5.1 is `[x]` (verified). 5.2 "The complete local pipeline passes" is left `[ ]` because `test:ui`/`test:project` could not be executed in this environment. No Manual row is falsely marked complete.