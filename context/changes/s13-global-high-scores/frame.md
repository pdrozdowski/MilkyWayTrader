# Frame Brief: Terminal Scores and Global High Scores

> Framing step before /10x-plan. This document captures what is actually
> at issue, separated from what was initially assumed.

## Reported Observation

User can view the globally eligible high-score results.

## Initial Framing (preserved)

- **User's stated cause or approach**: “robimy check zawsze jak jest end game, rezygnuje ze sprawdzania powodu end game... jak jest end game to po prostu patrzymy czy biezący run jest lepszy niż to co w global i jak tak to robimy updejt - proste”
- **User's proposed direction**: Show a Personal Best-like global top-100 dialog from main and end-game menus; keep one best record per player; show the signed-in player's Personal Best rank; calculate one final score for end-game display, personal result, and global record; include authoritative spending counters.
- **Pre-dispatch narrowing**: Any game-end reason can update a player's global record when the run's score is better. The rank callout always refers to their Personal Best. Cargo uses average acquisition cost (`totalCost / quantity`). Count ship upgrades, booster purchase, facility construction and upgrades; exclude repairs.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Product score and eligibility contract** — current rules might disagree with the requested outcomes, score, and ranked population.
2. **Terminal score calculation** — cash, cargo valuation, and investment counters might not describe one consistent run score. ← initial framing
3. **Authoritative state and persistence** — purchase history could be lost across snapshots or global updates could conflict with private history.
4. **Identity and leaderboard presentation** — nickname privacy, Personal Best rank, and menu access might not fit existing read boundaries.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Product contract mismatch is the main scope risk | PRD says cash-only score and global freedom-only eligibility (`context/foundation/prd.md:65,138-142,287,390-402`); user explicitly chose all game-end reasons and a composite score. Archived S-07 records the former split (`context/archive/2026-10-01-s07-environmental-hazards-and-death/frame.md:38-48`). | STRONG |
| Score inputs require a shared terminal score contract | Snapshot v18 contains credits and cargo but no spending totals (`src/game/state/gameStateSnapshot.ts:15-37`); cargo has `quantity` and `totalCost` (`src/game/state/commodityContainerState.ts:1-6`), with average cost computed as `totalCost / quantity` (`src/game/application/commodityContainers.ts:1-5`). | STRONG |
| Current result storage already supports one public best per player | The inspected `run_results` migration is per-run, owner-scoped, and has no cross-player read path (`supabase/migrations/20261002120000_create_run_results.sql:1-27`). Profile nickname reads are also owner-scoped (`supabase/migrations/20261011120000_create_player_profiles.sql:7-22`). | STRONG |
| A Personal Best-style view alone addresses the request | Existing Personal Best UI can serve as a visual reference, but it has no public global table or global read path (`src/ui/components/personalBest.ts:49-109`; `src/ui/adapters/browserResultHistoryStore.ts:53-91`). | WEAK |

## Narrowing Signals

- User chose every game-end reason as eligible for comparison, provided the score improves; this deliberately supersedes the existing PRD and archived S-07 distinction.
- The Personal Best rank callout always refers to the player's Personal Best. Under the shared score contract and one-best-per-player rule, it should match that player's global record when both saves succeed.
- Cargo value uses acquisition cost basis, already represented by per-stack `totalCost / quantity`.
- Spending totals are authoritative run state: ship upgrades and booster count; facility builds and upgrades count; repairs do not.

## Cross-System Convention

The architecture keeps game rules in the application/domain layers and external persistence in adapters (`context/foundation/architecture.md:3-17,45-47`). The current private result history is owner-scoped, and S-15 requires global results to remain independent of personal-history deletion (`context/changes/s15-clear-personal-best/plan.md:5-7,76-91`). The requested public board therefore needs a clear public-safe identity/read boundary while preserving private history. Existing product rules allow only signed-in submissions (`context/foundation/prd.md:377,392`); the user changed outcome eligibility, not authentication.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: define and persist one authoritative terminal score for every run, then use it consistently for personal results and each signed-in player's single best global record, with a public-safe ranked view.

The initial framing treated the work as a leaderboard view, but the score definition, terminal lifecycle, snapshot state, and persistence contract are equally central. This scope intentionally replaces the PRD's cash-only and freedom-only rules, so those requirements must be reconciled before implementation. The selected cargo basis and counted spending actions are now explicit; anonymous submission remains disallowed by the existing product contract.

## Confidence

- **HIGH** — repository evidence shows the score/state and public-storage gaps; user answers resolve the key scoring and eligibility ambiguities.

## What Changes for /10x-plan

Plan the shared terminal scoring and record lifecycle, including authoritative spending counters and snapshot/codec consequences, end-game breakdown, personal score consistency, one-best-per-player global updates, and the requested top-100 view and entry points. Reconcile the conflicting PRD rules through the required PRD capability validation before implementation; keep global reads independent of private history and expose only the nickname/score/date/rank needed by the board.

## References

- Source files: `context/foundation/prd.md:65,138-143,287,390-402`; `src/game/state/gameStateSnapshot.ts:15-37`; `src/game/state/commodityContainerState.ts:1-6`; `src/game/application/commodityContainers.ts:1-5`; `src/game/application/planetShipServices.ts:18`; `src/game/application/planetFacilities.ts:5`; `supabase/migrations/20261002120000_create_run_results.sql:1-27`; `supabase/migrations/20261011120000_create_player_profiles.sql:7-22`; `src/ui/components/personalBest.ts:49-109`; `src/ui/adapters/browserResultHistoryStore.ts:53-91`.
- Related research: `context/changes/s13-global-high-scores/research.md`.
- Investigation tasks: `terminal_scope`, `score_storage`, `pb_rank_scope`.
