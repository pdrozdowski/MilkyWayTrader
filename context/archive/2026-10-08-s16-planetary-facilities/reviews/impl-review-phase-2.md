<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S16 Planetary Facilities Implementation Plan

- **Plan**: context/changes/s16-planetary-facilities/plan.md
- **Scope**: Phase 2 of 5
- **Reviewed phases**: 2
- **Date**: 2026-10-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 6 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

Reviewed scope note: Phase 2 is complete in the worktree but not committed (HEAD e40594f), so `git diff HEAD` mixes Phase 1 and Phase 2. Phase 2's own contribution was separated using the Phase-1 intent recorded by the prior review: Phase 2 created the five commodity icons (since upgraded to 48x48), deleted the three legacy icons, replaced the Phase-1 `bun`/`spaceRation` -> `milk` fallback with real per-id textures, removed the default branch from `commodityTexture`, rendered the five catalogue buttons and cargo-transfer rows, extended `displayLabels.commodityLabels` to five ids, widened the catalogue grid and CSS icon palette, and removed the dead `#landing-status-production`/`#landing-status-consumption` markup plus the `produces`/`consumes` labels (Phase 1 review F2). Unplanned-but-harmless worktree edits outside both phases' file lists: `AGENTS.md` (a "Code exploration" harness section) and `context/foundation/roadmap.md` (S-16 status `planning` -> `in-progress`); both are documentation only, no product or test impact. Progress 2.1-2.3 are `[x]` and were re-verified; 2.4-2.5 (Manual) remain `[ ]` (pending, correct). The two WARNING dimension verdicts reflect observations only: every Phase-2 severity finding is an observation, the explicit contracts are met, and all re-run gates pass.

## Findings

### F1 - Plan Phase 2.3 lists cargoTransfer.ts and runStatus.ts, but neither needed a change

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/s16-planetary-facilities/plan.md:142
- **Detail**: Phase 2.3 "Files" names `src/ui/components/cargoTransfer.ts` and `src/ui/components/runStatus.ts`, but `git status --porcelain` shows neither was modified in Phase 2 (only `displayLabels.ts`, `landingStatus.ts`, `index.html`, `public/style.css`). No change was needed: both components already resolve the commodity set and labels generically from `displayLabels` (`cargoTransfer.ts:10` `const commodityIds: readonly string[] = Object.keys(displayLabels.commodityLabels);`; `runStatus.ts:19` `commodityLabel()` indexes `displayLabels`), and per-commodity colour comes from the CSS `[data-commodity-id=...]` palette, so the five-id catalogue flows through untouched. This is the same class of over-specified file list the Phase 1 review recorded as F4.
- **Fix**: No code change required; correct the Phase 2 file list wording in the plan.
- **Decision**: ACCEPTED (no code change) - `cargoTransfer.ts`/`runStatus.ts` already resolve the commodity set and labels generically from `displayLabels`; the plan file list is over-specified.

### F2 - DOM commodity palette does not match the new placeholder tile colours

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: public/style.css:122
- **Detail**: The Phase 2 overview asks for "a consistent identity across the market, the cargo surfaces, and the in-world loose-item object", but the DOM palette and the new PNG tiles disagree for four of five commodities. I decoded every IDAT with `node:zlib`: all five are 32x32, 8-bit RGBA, exactly one flat colour, alpha 255 - milk #3B82F6, grain #A16207, cheese #EAB308, bun #DC2626, spaceRation #7C3AED. The CSS `.cargo-commodity-icon[data-commodity-id]` rules use milk #2f855a (green), grain #718096 (grey), cheese #c53030 (red), bun #d69e2e (amber), spaceRation #6b46c1; the first three are leftovers of the Phase-1 mechanical rename of supplies/alloys/medicines. The explicit contract ("catalogue grid and icon palette cover five entries") is met; the cross-surface colour identity is only partly delivered.
- **Fix**: Align the five `.cargo-commodity-icon` hex values with the placeholder tile colours, or document why the DOM tiles and world tiles intentionally differ.
- **Decision**: FIXED (triage) - the five `.cargo-commodity-icon` colours now match the placeholder tile PNGs (milk `#3b82f6`, grain `#a16207`, cheese `#eab308`, bun `#dc2626`, spaceRation `#7c3aed`), restoring cross-surface identity.

### F3 - Trade-preview icon still has no per-commodity identity (the open implementer question judged)

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: index.html:90
- **Detail**: The market view's `<span class="market-commodity-icon" role="img">` is a single generic 80x80 dashed box (`public/style.css:211`, `background:#1c4266`); `landingStatus.ts:44,97` gives it only an `aria-label` - no `data-commodity-id` and no per-commodity colour - so all five commodities render the same preview icon. Phase 2.3 asks to "give each commodity a distinct icon colour" and manual criterion 2.4 expects "distinct icons" on the market catalogue; the explicit contract names only "the catalogue grid and icon palette", so the contract passes. Judgment: acceptable as a deliberate placeholder, but it is the one market surface where the Phase-2 identity intent is not realised, and the gap should be closed or explicitly recorded rather than left implicit.
- **Fix**: Set `commodityIcon.dataset.commodityId = selected.commodityId` in `landingStatus.ts` and add `.market-commodity-icon[data-commodity-id="..."]` colours (reuse the cargo palette), or record the trade preview as an intentional post-Phase-2 placeholder.
- **Decision**: FIXED (triage) - `render` now sets `commodityIcon.dataset.commodityId`, and `public/style.css` adds `.market-commodity-icon[data-commodity-id=...]` colours so the trade preview carries per-commodity identity.

### F4 - No test asserts the five placeholder PNG files exist on disk

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/object-scaffold.test.mjs:68
- **Detail**: Criterion 2.1 is satisfied textually - the test pins the five declared asset paths, the five variant keys (`Object.keys(commodityDefinition.variants)`) and each resolved texture - but it only reads the paths declared in `definition.ts`; nothing checks the files themselves. No test uses `existsSync`/`readdir` on `public/assets/icons` (only `game-audio.test.mjs` touches `public/assets`, for audio). A typo in a path would keep 2.1 green and surface only as a Phaser missing-texture at runtime. I confirmed independently (existence + IHDR/IDAT decode) that all five files exist, are valid PNGs and are distinct; the suite would not have caught it if they were not.
- **Fix**: Add existence assertions over the five declared paths (e.g. `assert(existsSync(join('public/assets/icons', path)))` in the loop) to `tests/object-scaffold.test.mjs`.
- **Decision**: FIXED (triage) - `tests/object-scaffold.test.mjs` now asserts `existsSync(join('public/assets', asset.path))` for every declared commodity asset, so a mistyped asset path fails the suite.

### F5 - The variant map, DOM rows and test id lists are not tied to serotonCommodityIds

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/object-scaffold.test.mjs:71
- **Detail**: The Phase-1 CRITICAL was a catalogue id with no `SceneObject` variant (bun/spaceRation threw inside the frame loop). Phase 2 fixes the current five ids, but the guard against a repeat is a hard-coded five-id list, not the catalogue: `const commodityIds = ['milk','grain','cheese','bun','spaceRation']` in `tests/object-scaffold.test.mjs:71` and `tests/run-status-clock.test.mjs:221`, `definition.variants` typed `Record<string, Partial<ObjectVisual>>` (`src/game/objects/_shared/types.ts:34`), and `commodityTexture(commodityId: string)` accepting any string (`commodity.ts:103`). Adding a sixth id to `serotonCommodityIds` (which `tests/domain/serotonMarket.test.mjs` pins by literal) would compile, keep these tests green because their literals still name five, and reintroduce the same crash class: `SceneObject` throws in the constructor and `cargoTransfer.ts:41` `required()` would fail on the missing DOM row. No current defect - all five ids are covered today.
- **Fix**: Derive the test id lists from `serotonCommodityIds` (or assert `Object.keys(definition.variants)` equals the catalogue and that every catalogue id has a DOM row) so catalogue growth cannot silently break the object and cargo surfaces.
- **Decision**: FIXED (triage) - both tests derive their id list from `serotonCommodityIds` (transpiled `serotonMarketCatalog.ts`) instead of a hard-coded five-id literal; `run-status-clock` also asserts the transfer fixtures cover the catalogue.

### F6 - Pre-existing dead assignment in catalogue button rendering

- **Severity**: OBSERVATION
- **Impact**: LOW - quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/ui/components/landingStatus.ts:131
- **Detail**: Pre-existing, not introduced by Phase 2 (identical at `HEAD:135-136`). The catalogue button text is assigned twice consecutively: line 131 (`<label> . <stock> . <price>`) is always overwritten by line 132 (`<label> . <carriedQuantity>` or just `<label>`), so the market catalogue never shows stock or price. Phase 2 widened the catalogue from three to five buttons but did not touch these lines. Reported because it sits directly in the Phase-2 catalogue markup and affects what manual criterion 2.4 shows, but it is not Phase-2 work.
- **Fix**: Delete line 131 (or restore the intended stock/price text) in a follow-up; not part of this phase.
- **Decision**: ACCEPTED (pre-existing) - the duplicate `textContent` assignment predates this change and needs a product decision on the intended catalogue-button label; not touched.

## Verified Phase 2 Contracts (evidence)

- Icons: the five files `public/assets/icons/commodity-milk-48x48.png`, `commodity-grain_48x48.png`, `commodity-cheese-48x48.png`, `commodity-bun_48x48.png` and `commodity-spaceRation-48x48.png` exist; the earlier 32x32 placeholder tiles and the three legacy catalogue icons are absent. Each decodes as IHDR 48x48, bitDepth 8, colorType 6, interlace 0, and carries full-colour artwork (781-1479 distinct RGBA values). MATCH.
- Assets and variants: `definition.ts` registers five `image` assets (`object:commodity:milk|grain|cheese|bun|spaceRation` -> the matching 48x48 icon) and five variants, one per id (`milk: {}`, the other four with their own texture). MATCH.
- Phase-1 CRITICAL genuinely resolved: transpiling the real `sceneObject.ts` plus `definition.ts` with a stubbed Phaser and constructing `SceneObject` for every id yields five successes (`milk`/`grain`/`cheese`/`bun`/`spaceRation` -> `object:commodity:<id>`); no id throws, and the Phase-1 `milk` fallback for bun/spaceRation is gone. `commodityTexture` (`commodity.ts:103`) returns `object:commodity:${commodityId}` with no default branch. Every catalogue id is covered by both the variant map and the asset list, and the codec allow-list still rejects unknown ids, so no catalogue id can reach the constructor or the texture lookup without a matching texture. MATCH.
- Labels and DOM: `displayLabels.commodityLabels = { milk, grain, cheese, bun, spaceRation }` covers all five ids and the flat `displayLabels` keys mirror them; `index.html` carries five catalogue buttons and five cargo-transfer rows, each with `data-commodity-id` (plus the row icon span), and `#landing-status-catalogue` is `repeat(5, minmax(0, 1fr))`; `public/style.css:122-126` has one `.cargo-commodity-icon[data-commodity-id=...]` rule per commodity. The trade-preview icon question is judged in F3. MATCH (contract); trade-preview identity incomplete (F3).
- Dead Phase-1 leftovers: Phase 1 review F2 is fully resolved - `index.html` no longer contains `#landing-status-production`/`#landing-status-consumption`, `displayLabels` no longer contains `produces`/`consumes`, and `landingStatus.ts` no longer queries or writes them; `rg "landing-status-production|landing-status-consumption|produces|consumes"` matches no product/test/DOM file (only docs and this review). MATCH.
- Presentation tests: `tests/object-scaffold.test.mjs` now enumerates the five asset paths, asserts the variant keys equal the five ids and each id resolves to its own texture, and exercises `CommodityProjection` over all five ids (assets and textures); `tests/run-status-clock.test.mjs:221-295` enumerates five rows with per-commodity quantities and asserts per-row icon/name/control text, disabled states, hidden rows and emitted transfer intents. Assertions are real (literal expectations, per-commodity fixtures), no literal was loosened, and coverage grew from three ids to five. MATCH.
- Scope: `rg -i facilit src tests` returns only the pre-existing Facilities label/button (`landingStatus.ts:41,81`, `displayLabels.ts:22`) - no Phase 3-5 facility state, definitions or simulation. No new Playwright spec and no `tests/ui/` change (`git status` shows only the five product test files). `package.json` is unchanged (no new dependency). The only untracked files are the five PNGs and `reviews/`; no leftover scripts or tooling. MATCH.
- Architecture: `npm.cmd run test:architecture` passes 8/8, including "UI components depend only on UI contracts and components", "pure layers follow their dependency direction" and "TypeScript module filenames use lower camel case". Phase 2 added no Phaser/DOM import to domain/application/mechanics and kept object visuals inside the commodity object module (`definition.ts` assets/variants, `commodity.ts` texture mapping). MATCH.

## Gate Re-runs

| Gate | Result | Evidence |
|------|--------|----------|
| `npm.cmd run test:objects` | PASS | 6/6, 0 fail, exit 0 |
| `npm.cmd run test:unit` | PASS | domain (all pass) + mechanics 41/41, objects 6/6, audio 11/11, ui-presentation 7/7 all 0 fail, exit 0 |
| `npm.cmd run test:fast` | PASS | unit unchanged plus architecture 8/8; 0 fail, exit 0 |
| `npm.cmd run typecheck` | PASS | `tsc --noEmit && tsc --noEmit -p tsconfig.tests.json`, no output, exit 0 |
| `npm.cmd run test:ui` | NOT RUN | Docker Supabase unreachable here (`docker version` -> "permission denied ... npipe:////./pipe/dockerDesktopLinuxEngine"); this is the Phase 5 criterion and is not treated as a Phase-2 finding |

## Progress (Manual) Status

- 2.4 Market catalogue, cargo HUD, and cargo transfer show five commodities with distinct icons and labels - `[ ]` pending
- 2.5 Loose salvage items render with the matching commodity texture - `[ ]` pending

No Manual row is falsely marked complete.



