---
date: 2026-10-13T19:29:44+02:00
researcher: Codex
git_commit: df78d32f42f1d0eef20bd88ca5d8fd6dd3a1c4df
branch: main
repository: MilkyWayTrader
topic: "S-12 personal-best result: existing foundations, contract, and readiness"
tags: [research, results, authentication, persistence, personal-best]
status: partial
last_updated: 2026-10-13
last_updated_by: Codex
last_updated_note: "User clarified that S-12 has paginated history and DELETE placeholders; S-15 owns deletion. S-11 is not a prerequisite. Original code research was not repeated for the expanded UI scope."
---

# Research: S-12 personal-best result

**Date**: 2026-10-13T19:29:44+02:00  
**Researcher**: Codex  
**Git Commit**: df78d32f42f1d0eef20bd88ca5d8fd6dd3a1c4df  
**Branch**: main  
**Repository**: MilkyWayTrader

## Research Question

For `s12-personal-best-result`, what result-persistence and UI foundations exist, and what gaps affect the user-defined personal-best history scope?

## Summary

The user expanded S-12 to a paginated history of the signed-in player's results and personal-best display, with a `DELETE` placeholder on each row and a `CLOSE` button. S-15 owns deletion and its confirmation modal (`context/changes/s12-personal-best-result/change.md`). The user removed S-11 as a prerequisite, although the roadmap still lists it (`context/foundation/roadmap.md:56, 223-233`). The PRD defines personal best as the highest final liquid-cash score among the player's retained outcomes, regardless of outcome (`context/foundation/prd.md:138-143, 387-389`).

The codebase has a private, owner-scoped `run_results` table and a browser adapter that can insert a signed-in terminal result. In the inspected implementation, the terminal-result type and database constraint support `death`; the adapter exposes persistence only. No personal-history read, best-result selection, or personal-best view surfaced in the inspected result/UI paths. This is a partial storage foundation for the expanded S-12 scope (`src/game/state/terminalResultState.ts:1-7`; `supabase/migrations/20261002120000_create_run_results.sql:1-27`; `src/ui/adapters/browserResultStore.ts:38-61`).

## Detailed Findings

### Product contract and scope

- PRD US-06 says personal history retains every outcome and exposes the highest final-cash result as best; that best may be freedom, imprisonment, death, or abandonment. Anonymous players cannot access a personal best, while a signed-in player can (`context/foundation/prd.md:130-143`).
- BR-110–112 define retention, ranking by highest final liquid cash regardless of outcome, and the effect of clearing the selected result (`context/foundation/prd.md:387-389`).
- The roadmap maps S-12 to US-06 / FR-052 and assigns deletion to S-15 / FR-054 (`context/foundation/roadmap.md:223-233, 259-269`). The user's clarified S-12 description shows a `DELETE` button as a placeholder; deletion behavior remains in S-15 (`context/changes/s12-personal-best-result/change.md`). The previous conclusion that S-12 implements per-record deletion is superseded.
- Personal records are private to the signed-in owner; the PRD's global table has distinct eligibility and access rules (`context/foundation/prd.md:390-402`). Global score viewing belongs to S-13, not S-12 (`context/foundation/roadmap.md:235-245`).

### Existing persistence and access control

- The `run_results` relation stores `run_id`, `user_id`, `outcome`, elapsed active time, final credits, and creation time. At this migration, the outcome check permits `death` (`supabase/migrations/20261002120000_create_run_results.sql:1-10`).
- RLS is enabled, and authenticated clients receive insert/select grants. Insert and select policies scope rows to `user_id = auth.uid()`; the migration grants neither anonymous access nor delete access (`supabase/migrations/20261002120000_create_run_results.sql:12-27`). Owner-enforced delete access remains a future S-15 concern.
- `TerminalResultState` carries run ID, outcome, elapsed milliseconds, and final credits, but its outcome union is currently `death` (`src/game/state/terminalResultState.ts:1-7`). The browser result adapter checks the active Supabase session and inserts those fields for the session user; duplicate run IDs are treated as already saved (`src/ui/adapters/browserResultStore.ts:38-61`).
- The application `ResultStorePort` has a `persist` operation, and game-over delivery starts that operation and permits retry after a failure (`src/game/application/results/resultStore.ts:10-13`; `src/game/application/results/resultDelivery.ts:5-22`; `src/game/scenes/gameOverScene.ts:16-43`). These contracts cover delivery of a terminal result, not reading retained results.

### UI and architecture

- The current game-over UI presents the current terminal result and its save status (`src/ui/setupUi.ts:45-75`). The account component covers identity/profile management; the inspected component does not expose result history or a best-result view (`src/ui/components/playerAccount.ts:20-51`).
- The architecture places business/domain rules in Phaser/DOM-independent layers and routes external services through application ports; DOM components use typed ports and browser integrations belong in adapters (`context/foundation/architecture.md:3-17, 19-23`). This is the relevant boundary for a future personal-result read.
- The codebase has a result submission foundation, but the expanded S-12 scope needs a retrieval path, personal-best selection, pagination, compact alternating rows, a `DELETE` placeholder, and the user-facing states described in `change.md`. No read path surfaced in the inspected results/UI files and searches.

### Readiness and related slices

- The roadmap lists S-11 (automatic save and resume) as S-12's prerequisite (`context/foundation/roadmap.md:51-56, 212-233`), but the user removed that dependency for this change (`context/changes/s12-personal-best-result/change.md`). The previous readiness conclusion based on S-11 is superseded; the roadmap needs reconciliation.
- The result table's current death-only outcome constraint and the death-only TypeScript result contract do not yet cover the four outcomes required for personal history (`supabase/migrations/20261002120000_create_run_results.sql:7`; `src/game/state/terminalResultState.ts:1-7`; `context/foundation/prd.md:138-139`).
- The global board needs a different access/eligibility contract: PRD requires public reads for global results, while this existing table's select policy exposes only the authenticated owner's rows (`context/foundation/prd.md:390-402`; `supabase/migrations/20261002120000_create_run_results.sql:22-27`). That is a related S-13 concern and should not be conflated with S-12's private best-result view.

## Code References

- `context/foundation/prd.md:130-143` — Personal and global result acceptance criteria.
- `context/foundation/prd.md:382-402` — Persistence, ranking, clearing, and access rules.
- `context/foundation/roadmap.md:212-269` — S-11 prerequisite and separate S-12/S-13/S-15 slices.
- `src/game/state/terminalResultState.ts:1-7` — Current terminal-result data contract.
- `src/game/application/results/resultStore.ts:10-13` — Current application result-store port.
- `src/ui/adapters/browserResultStore.ts:38-61` — Signed-in terminal-result insert path.
- `supabase/migrations/20261002120000_create_run_results.sql:1-27` — Result table, current outcome constraint, grants, and owner-scoped RLS policies.
- `src/ui/setupUi.ts:45-75` — Current terminal result/save-status presentation.
- `context/foundation/architecture.md:3-23` — Layering and application-port boundaries.

## Architecture Insights

The existing write path keeps Supabase in a browser adapter behind an application port, and result data is separate from the authoritative game snapshot. Personal-best selection and history operations are user-scoped result capabilities; their business rules should remain independent of Phaser and DOM dependencies (`context/foundation/architecture.md:3-17`; `context/foundation/prd.md:387-389`; `context/changes/s12-personal-best-result/change.md`).

## Historical Context (from prior changes)

- The archived S-07 plan excluded global scores and non-death terminal flows from that change (`context/archive/2026-10-01-s07-environmental-hazards-and-death/plan.md:23-29`). Its result-table contract said the outcome constraint should allow the product's terminal vocabulary while S-07 inserted `death` (`context/archive/2026-10-01-s07-environmental-hazards-and-death/plan.md:86-90`); the current migration instead permits only `death` (`supabase/migrations/20261002120000_create_run_results.sql:7`). The documented plan and persisted schema therefore differ on the supported outcome set.
- The archived S-10 account-management plan records that `run_results` already had owner-scoped RLS at that point (`context/archive/2026-10-11-s10-player-account-management/plan.md:22, 125`). Its result-related observation remains supported by the inspected migration; it does not establish that history retrieval or a personal-best view exists.

## Related Research

Not applicable; no existing research artifact was found under `context/`.

## Open Questions

- The roadmap still names S-11 as a prerequisite; that entry needs reconciliation with the user's correction before plan approval (`context/foundation/roadmap.md:56, 223-233`; `context/changes/s12-personal-best-result/change.md`).
- The existing source investigation did not assess implementation details for the newly added paginated and compact row presentation. This research remains partial for the expanded UI scope.
- S-15 owns deletion and its confirmation flow (`context/foundation/roadmap.md:259-269`; `context/changes/s12-personal-best-result/change.md`).
- S-13 public result access remains a separate roadmap slice (`context/foundation/roadmap.md:235-245`).
