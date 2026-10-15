# Delete Individual Results and Clear Personal History — Plan Brief

> Full plan: `context/changes/s15-clear-personal-best/plan.md`
> Frame brief: `context/changes/s15-clear-personal-best/frame.md`
> Research: `context/changes/s15-clear-personal-best/research.md`

## What & Why

Complete the signed-in player's private result-history management: delete any selected result, or clear all history after a yes/no confirmation, while preserving active saves, profile data, other players' records, and global results. The row control already exists as a disabled placeholder, but deletion behavior, clear-all, confirmation, and a storage boundary that protects global results are missing.

## Starting Point

The Personal Best modal shows paginated private history and a personal best, with disabled per-row delete buttons. The history port and adapter are read-only, and current Supabase policies provide no delete permission; the repository research did not find an independent global-results store implementation.

## Desired End State

A signed-in player can confirm deletion of any history row or clear all personal history. The UI refreshes history and personal best, preserves a valid page, and keeps the confirmation open with an accessible error if deletion fails. Global results remain independently stored; active saves, profile and nickname remain untouched.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Individual deletion scope | Any result-history row | User clarified the delete control applies to each result, not only the current best | User clarification / Frame |
| Bulk deletion scope | Result history only | User confirmed active save, profile and nickname are excluded | User clarification |
| Confirmation | Yes/no confirmation for both single and bulk actions | Prevent accidental irreversible deletion | User request / Plan |
| Confirmation context | Show the selected result details or current history count | Make the destructive action clear before confirmation | Plan |
| Failure behavior | Keep confirmation open, preserve rows and announce an accessible error | Allow a clear retry or cancel without losing context | Plan |
| Pagination after deletion | Stay on the current page when valid; otherwise use the nearest last page | Avoid an empty invalid page after deleting its final row | Plan |
| Global-results boundary | Require S-13 first and independent persistence | Deleting private history must not remove public scores | User choice / Research |
| Product documentation | Update PRD and roadmap | Existing S-15 wording is narrower than the clarified scope | User choice |
| Clear-all availability | Keep visible but disable during loading or when history is empty | State availability clearly and prevent invalid submission | Plan |

## Scope

**In scope:** delete any owner history row; confirm single and bulk deletion; owner-scoped RLS; refresh current page, history count and personal best; accessible pending/error/focus behavior; verify separate global scores are preserved; update PRD and roadmap.

**Out of scope:** implementing S-13; deleting active saves, profile, nickname or other users' data; undo/recovery; changing global eligibility or ranking.

## Architecture / Approach

Complete S-13 with global eligible results stored independently before S-15 deletion work. Extend the existing result-history port and browser adapter with owner-scoped single and bulk deletion, backed by a forward Supabase migration and `auth.uid()` RLS. Wire the Personal Best component to yes/no confirmations, pending/error states and history/best refresh; cover data ownership in adapter and integration tests and use one authenticated browser journey for real modal stacking and keyboard focus.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Reconcile contract and confirm prerequisite | Updated PRD/roadmap and verified S-13 storage isolation | Global storage might share the private history rows |
| 2. Add owner-scoped deletion | Port, adapter and forward RLS migration for row and bulk deletes | Incorrect or incomplete owner enforcement |
| 3. Add confirmed Personal Best actions | Accessible confirmation, mutation, refresh and error behavior | Stale pages, focus loss or unclear failure feedback |
| 4. Verify ownership and data isolation | Local Supabase checks and one browser confirmation journey | Global or unrelated player data could change unexpectedly |

**Prerequisites:** S-12 is complete. S-13 must be complete and independently persist public eligible results before Phase 2. Local Supabase and the configured browser are needed for Phase 4 verification.

**Estimated effort:** About 3–5 focused sessions across four phases, with a human checkpoint after each phase.

## Open Risks & Assumptions

- S-13 is still proposed and its independent global storage is not present in the inspected implementation; Phase 2 is blocked until that prerequisite is verified.
- The existing owner filter's index may or may not be sufficient for bulk deletion; inspect the query plan before adding an index.
- The one browser test is limited to behavior that requires a real browser: stacked-dialog semantics and actual keyboard focus traversal.

## Success Criteria (Summary)

- A signed-in owner can confirm and perform deletion of any private history result or all such results, while other users and anonymous clients cannot delete them.
- Success refreshes the history and personal best; cancel leaves data unchanged; errors preserve the view and provide accessible feedback.
- Global scores, active saves, profile and nickname remain unchanged.
