---
date: 2026-10-14T12:53:12+02:00
researcher: Codex
git_commit: bef109d63db4b2d8f01b859efd1dd74565a84c00
branch: main
repository: MilkyWayTrader
topic: "Delete individual results and clear a signed-in player's result history"
tags: [research, results, personal-best, supabase, authorization]
status: complete
last_updated: 2026-10-14
last_updated_by: Codex
last_updated_note: "User clarified that any history row can be deleted and all result history can be cleared after confirmation; active saves and profile data are excluded."
---

# Research: Delete individual results and clear a signed-in player's result history

**Date**: 2026-10-14T12:53:12+02:00  
**Researcher**: Codex  
**Git Commit**: bef109d63db4b2d8f01b859efd1dd74565a84c00  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

How does the current result-history implementation support the user's clarified S-15 scope: deleting any individual history row and clearing all result-history rows after a yes/no confirmation, while excluding active saves/profile/nickname and preserving global results?

## Summary

The user clarified that any result-history row can be deleted, and that the Personal Best modal should offer a separate clear-all-history action with a yes/no confirmation. The clarification excludes active game saves, profile, and nickname. This is broader than the current PRD wording, which describes clearing the personal-best result and promoting the next highest remaining result (`context/foundation/prd.md:389,400`); the user decision is authoritative for this change and the product docs remain to be reconciled. The current personal-history view reads `run_results`; its store port has read operations but no delete operation (`src/game/application/results/resultHistoryStore.ts:23-27`).

The migration currently grants authenticated clients insert and select only, with owner-scoped insert/select RLS policies and no delete grant or delete policy (`supabase/migrations/20261002120000_create_run_results.sql:12-27`). Thus neither single-row nor clear-all deletion is available through the current client authorization contract. The inspected repository has no separate global-results adapter/table implementation in `src` or `supabase/migrations`; the PRD treats global results as a separate public capability and explicitly requires clearing not to affect them (`context/foundation/prd.md:390-402`). Whether a future leaderboard projection shares this source relation remains unknown, so the no-global-change guarantee needs explicit verification during planning.

## Detailed Findings

### Product contract

- US-06 says personal history retains every outcome and ranks personal best by highest final cash (`context/foundation/prd.md:130-143`). BR-112 says clearing removes that result from the signed-in player's personal history and promotes the highest remaining result, or shows no best when none remains (`context/foundation/prd.md:389`).
- Access Control says a signed-in player can clear only their own personal-best result and that the operation cannot change another player's records or global results (`context/foundation/prd.md:398-402`).
- The active change title and note align with that separation (`context/changes/s15-clear-personal-best/change.md:2,11`).

### Existing storage and permissions

- `run_results` includes `run_id` as its primary key and `user_id` referencing `auth.users`; it also stores outcome, elapsed time, final credits, and save time (`supabase/migrations/20261002120000_create_run_results.sql:1-11`).
- The inspected migration enables RLS and grants authenticated users insert/select. Its insert and select policies constrain rows to `auth.uid()` (`supabase/migrations/20261002120000_create_run_results.sql:12-27`). The current migration contains no delete grant or delete policy in that section.
- `ResultHistoryStorePort` exposes `getPage` and `getBest`, with no mutation method (`src/game/application/results/resultHistoryStore.ts:23-27`). The browser implementation selects `run_results`, sorts history by credits/date/run ID, and independently selects the highest-credit row for `getBest` (`src/ui/adapters/browserResultHistoryStore.ts:53-91`).
- `browserResultStore` inserts a signed-in player's terminal result into `run_results` (`src/ui/adapters/browserResultStore.ts:38-61`). This is a write path for result creation, not deletion.

### Existing UI and boundary

- The Personal Best component renders one disabled `DELETE` placeholder per displayed result (`src/ui/components/personalBest.ts:96-110`). No delete action is attached in the inspected component; the current store contract also cannot perform one (`src/ui/components/personalBest.ts:48-182`; `src/game/application/results/resultHistoryStore.ts:23-27`).
- The component loads the current page and best concurrently and refreshes those values through its `load` path (`src/ui/components/personalBest.ts:113-136`). After a successful deletion, reloading both is the existing mechanism to show the remaining history and recalculated best.
- Architecture places DOM components behind typed ports and browser service access in adapters (`context/foundation/architecture.md:3-17,45-47`). A deletion operation therefore belongs in the history port/browser adapter boundary, with owner enforcement in database policy.
- The inspected source and migrations contain the private history relation and its owner-only read policy, but no separate global-result implementation. The PRD requires public global reads and separate eligibility rules (`context/foundation/prd.md:390-402`); preserving any future/global projection from personal deletion is a database/data-model boundary requirement.

## Code References

- `context/foundation/prd.md:130-143,389-402` - Personal-best ranking, clear behavior, and separation from global results.
- `context/changes/s12-personal-best-result/change.md` - S-12 defines per-row delete controls as disabled placeholders and assigns deletion to S-15.
- `src/game/application/results/resultHistoryStore.ts:23-27` - Current history read port.
- `src/ui/adapters/browserResultHistoryStore.ts:53-91` - Current private history/best queries.
- `src/ui/components/personalBest.ts:96-110,113-136` - Disabled row controls and history refresh/load.
- `supabase/migrations/20261002120000_create_run_results.sql:1-27` - Result schema and current owner-scoped permissions.
- `src/ui/adapters/browserResultStore.ts:38-61` - Signed-in result insert adapter.
- `context/foundation/architecture.md:3-17,45-47` - Port/adaptor and UI boundaries.

## Architecture Insights

Personal best is derived from retained personal history rather than a separately stored best field: `getBest` sorts the history relation by final credits and picks one row (`src/ui/adapters/browserResultHistoryStore.ts:75-86`). Deleting a result from that relation and reloading the existing history/best reads naturally updates the displayed best. Database authorization must scope the mutation to the authenticated row owner (`supabase/migrations/20261002120000_create_run_results.sql:18-27`), while any global result representation must remain outside the mutation's affected data set (`context/foundation/prd.md:390-402`).

## Historical Context (from prior changes)

- Archived S-12 assigned deletion of any player-owned result, recalculation of best, list refresh, confirmation, and error handling to S-15; its row controls were explicitly nonfunctional placeholders (`context/archive/2026-10-13-s12-personal-best-result/change.md`, sections “Delete button placeholder” and “Data and scope”). This supports the current PRD's removal-and-recompute contract. Its statement that S-12 was pending is historical and is not used as a current implementation claim.
- The archived S-12 research recorded that the existing relation had owner-scoped read access while public leaderboard access belonged to a separate slice (`context/archive/2026-10-13-s12-personal-best-result/research.md`, “Existing persistence and access control”). The current migration still supports the owner-scoped-read finding; public leaderboard implementation remains absent from the inspected source/migrations.

## Related Research

- `context/archive/2026-10-13-s12-personal-best-result/research.md` - Personal history foundations and prior S-12 findings.

## Open Questions

- The user's clarification resolves the operation scope: delete any selected history result, or clear the entire result history after yes/no confirmation; active saves, profile, and nickname are excluded. The PRD and roadmap wording has not yet been updated to reflect this broader scope (`context/foundation/prd.md:389-400`; `context/foundation/roadmap.md:59,262-269`).
- The global-results storage representation is absent from the inspected current source/migrations. If a future public projection shares `run_results`, planning must verify that deleting personal-history rows cannot change global results. This remains a technical boundary to validate, not an unresolved user-scope choice.
