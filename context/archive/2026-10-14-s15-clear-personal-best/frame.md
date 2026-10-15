# Frame Brief: Private result-history deletion

> Framing step before `/10x-plan`. This brief separates the user's clarified
> product scope from existing product-document wording and implementation gaps.

## Reported Observation

> "chce doprecyzować że każdy rekord wyniku można usunąć i w UI jest przygotowany na to przycisk. Chcę także by player best modalu był przycisk do usunięcia wszystkich zapisanych wyników gracza - po potwierdzeniu w popupie (też jako modal tak/nie)."

## Initial Framing (preserved)

- **User's stated cause or approach:** The Personal Best UI already has a prepared button for deleting each result; add a separate action to remove all saved player results after yes/no confirmation.
- **User's proposed direction:** Support deletion of any result row and a confirmed clear-all action in the Personal Best modal.
- **Pre-dispatch narrowing:** "Tak, tylko historia wyników" — bulk clearing applies to result history only; active game save, profile, and nickname remain unchanged.

## Dimension Map

The scope touches these project-specific dimensions:

1. **Deletion semantics** — whether the target is only the current best or any selected history result, and whether clear-all means result history only. The user has explicitly resolved this dimension.
2. **UI affordance and confirmation** — whether the existing row control is functional, and whether a bulk action and yes/no modal exist.
3. **Ownership and storage boundary** — whether a signed-in player can delete only their rows, without affecting the active save or another player's data.
4. **Global-results independence** — whether deleting a private result can also remove a public leaderboard entry if that feature later projects from the same relation.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| The requested operation is limited to deleting only the current personal-best row. | User clarified that any result row can be deleted; archived S-12 also assigns deletion of any owned result to S-15 (`context/changes/s15-clear-personal-best/change.md:12`; `context/archive/2026-10-13-s12-personal-best-result/change.md:12,47-53`). | **NONE**; user clarification resolves it. |
| The row delete UI is already present as a control, but deletion behavior is missing. | `personalBest.ts` renders a disabled button per row with no delete handler (`src/ui/components/personalBest.ts:96-110,169-176`). The dialog table has a DELETE column (`index.html:45`). | **STRONG**; the affordance is a placeholder, not an implemented action. |
| A clear-all control and confirmation dialog already exist in the Personal Best UI. | Inspected dialog markup contains history, pagination and close controls but no clear-all or confirmation dialog (`index.html:39-49`); component queries no such controls (`src/ui/components/personalBest.ts:49-65`). | **NONE**; both are new UI scope. |
| Current database permissions already support owner-scoped deletion. | The migration grants authenticated insert/select and defines owner-scoped insert/select policies; it contains no delete grant or delete policy (`supabase/migrations/20261002120000_create_run_results.sql:12-27`). | **NONE**; authorization is an implementation gap. |
| The global-results guarantee is already enforced by a separate data store. | PRD defines distinct private/global access requirements (`context/foundation/prd.md:390-402`), but no separate global-results store/table appeared in inspected `src` or migrations; result creation writes to `run_results` (`src/ui/adapters/browserResultStore.ts:38-61`). | **WEAK**; implementation relationship is unknown and must be verified. |

## Narrowing Signals

- The user directly resolved that any history row is eligible for individual deletion and bulk clearing affects only result history.
- S-12 supplies a disabled per-row `DELETE` placeholder, while its archived scope assigns deletion of any owned row to S-15 (`context/archive/2026-10-13-s12-personal-best-result/change.md:47-53`).
- The current markup/component do not contain the bulk action or confirmation dialog (`index.html:39-49`; `src/ui/components/personalBest.ts:49-65`).
- Current RLS lacks delete permission; the public leaderboard representation was not found in the inspected source/migrations (`supabase/migrations/20261002120000_create_run_results.sql:12-27`; `src/ui/adapters/browserResultStore.ts:38-61`).

## Cross-System Convention

The architecture puts UI operations behind typed ports and browser/database access in adapters (`context/foundation/architecture.md:3-17,45-47`). Existing result reads are derived from the owner-scoped `run_results` relation (`src/ui/adapters/browserResultHistoryStore.ts:53-91`). This supports handling personal-history changes through that boundary, while database authorization and global-result isolation still need proof. No separate global-results implementation was found in the inspected paths, so the PRD's no-global-change guarantee must be verified against the eventual leaderboard data model.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is:** Complete the signed-in player's private result-history management: delete any selected result, or clear all history after a yes/no confirmation, while preserving active saves, profile data, other players' records, and global results.

The initial direction holds, with the user's clarification expanding it beyond the narrow “personal best” wording currently in the PRD and roadmap. The existing per-row control is only a disabled placeholder; the bulk control, confirmation modal, delete authorization, and post-delete refresh behavior are not implemented. The no-global-change requirement is clear, but its storage-level enforcement cannot be confirmed until the relationship between personal history and the public leaderboard is established.

## Confidence

**MEDIUM.** User intent and existing UI/database gaps are clear. Confidence is limited by the absence of a global-results implementation in the inspected paths, so the effect of source-row deletion on any future leaderboard projection remains unknown.

## What Changes for `/10x-plan`

Plan both single-row deletion and a separate confirmed clear-all operation over result history only; leave active saves, profile, and nickname untouched. Include owner enforcement, error/cancel behavior, page and best-score refresh, and an explicit verification that global results remain unchanged; reconcile the PRD/roadmap wording with the clarified scope.

## References

- `context/foundation/prd.md:138-143,389-402` — Current personal/global result contract.
- `context/foundation/roadmap.md:59,262-269` — Current S-15 title and slice scope.
- `src/ui/components/personalBest.ts:49-65,96-136,169-176` — Existing controls and history behavior.
- `index.html:39-49` — Personal Best dialog markup.
- `supabase/migrations/20261002120000_create_run_results.sql:1-27` — Result schema and current access policies.
- `src/ui/adapters/browserResultHistoryStore.ts:53-91` — History and personal-best queries.
- `context/archive/2026-10-13-s12-personal-best-result/change.md:47-53` — Prior S-12 boundary for S-15 deletion.
- `context/changes/s15-clear-personal-best/research.md` — Source-backed S-15 research, updated with the user's clarification.
- Investigation tasks: `result_data_boundary`, `result_ui_scope` (read-only).
