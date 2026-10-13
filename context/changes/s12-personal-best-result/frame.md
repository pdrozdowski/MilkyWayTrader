# Frame Brief: S-12 personal best and run history

> Framing check before `/10x-plan`. This records the user's scope separately from the assumptions tested against the current project.

## Reported Observation

> "sprawdź czy mam dobrze ramy określone dla tej zmiany"

The scope question concerns the S-12 screen described in `change.md`: a signed-in player sees personal best and a paginated history of retained runs (`context/changes/s12-personal-best-result/change.md:12-25`). No runtime bug was reported.

## Initial Framing (preserved)

- **User's stated cause or approach:** No cause was proposed. The stated scope assumptions were "s-11 nie jest wymagane" and "S-15 zrobi implementacje usówania, tu dodamy tylko guzik jako placeholder." The initial screen description called `DATE` the "date of the run" (earlier user message; corrected after narrowing).
- **User's proposed direction:** Check whether S-12 is the right boundary for one screen with personal best, previous runs, a `DELETE` placeholder per row, and no public leaderboard (`context/changes/s12-personal-best-result/change.md:14-25, 47-64`).
- **Pre-dispatch narrowing:** "s-06 doda brakujące zakończenia" and "no dałem opis ekranu gdzie jest i personal best i lista poprzednich runów - to jest rezultat" (user replies). The second answer confirms one combined screen.

## Dimension Map

The framing depends on these project-specific dimensions:

1. **Outcome production and retention** — can the result source represent every PRD terminal outcome, or only the current death path?
2. **Result read versus active-save lifecycle** — does S-12 actually depend on S-11's save/resume work? This is the user's explicit challenge to the roadmap.
3. **Player-visible scope and access** — is a private best-plus-history screen coherent with the PRD and separate from public scores?
4. **Future deletion affordance** — does `DELETE` on every row promise the same operation currently assigned to S-15?
5. **Date meaning** — is the displayed date a run-completion date or the date a result was saved?

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| S-11 is a technical prerequisite for S-12's private result read. | `run_results` is a separate owner-scoped relation, and the current browser adapter inserts a terminal result directly from the signed-in session. The roadmap lists S-11 as a prerequisite but gives no coupling in this path (`supabase/migrations/20261002120000_create_run_results.sql:1-27`; `src/ui/adapters/browserResultStore.ts:38-61`; `context/foundation/roadmap.md:223-233`). | **NONE** for technical necessity. The user's correction holds. |
| Existing retained results already cover all four outcomes needed by the screen. | `TerminalResultState`, terminal reducer, codec and table constraint currently admit `death`; S-06 is still proposed. The PRD requires freedom, imprisonment, death and abandonment in personal history (`src/game/state/terminalResultState.ts:1-7`; `src/game/mechanics/hazards/terminal.ts:3-14`; `src/game/application/gameStateCodec.ts:251-258`; `supabase/migrations/20261002120000_create_run_results.sql:8`; `context/foundation/prd.md:138-139`; `context/foundation/roadmap.md:151-161`). | **NONE** for current four-outcome coverage. S-06 is the relevant upstream product work named by the user. |
| One private screen combining best and retained-run history is a coherent S-12 outcome. | The user explicitly chose that single screen. The PRD defines private personal history and highest-final-cash best; the current migration permits owner-scoped reads (`context/changes/s12-personal-best-result/change.md:12-25`; `context/foundation/prd.md:130-143, 387-398`; `supabase/migrations/20261002120000_create_run_results.sql:13-27`). | **STRONG** for the chosen product scope. The list UI extends the minimum FR-052 wording. |
| A `DELETE` placeholder on every row matches S-15's documented future behavior. | The current S-12 design has one button per result, and the user confirmed S-15 should delete any owned result. PRD and roadmap currently describe clearing the personal-best result (`context/changes/s12-personal-best-result/change.md:22, 47-50`; `context/foundation/prd.md:143, 389, 400`; `context/foundation/roadmap.md:259-269`). | **PARTIAL**. The S-12 placeholder boundary is clear; S-15's documented product scope is narrower than the user's decision. |
| `DATE` can truthfully mean the date the result was saved. | The user clarified that `DATE` means save date. The table records `created_at` with a database default, while the browser insert supplies no completion timestamp (`supabase/migrations/20261002120000_create_run_results.sql:1-10`; `src/ui/adapters/browserResultStore.ts:47-54`). | **STRONG** for save date; `change.md:22` now records the clarified meaning. |

## Narrowing Signals

- The user confirmed that S-06 adds the missing endings. Thus S-12's complete four-outcome experience depends on those result producers, while S-11's active save/resume is independent (`context/foundation/roadmap.md:151-161, 211-233`).
- The desired S-12 result is one screen with best score and previous runs, rather than separate destinations (user reply; `context/changes/s12-personal-best-result/change.md:14-25`).
- The user confirmed that S-15 should allow deletion of any owned result. This is broader than the current PRD's personal-best-only wording (`context/foundation/prd.md:143, 389, 400`).
- The user confirmed that `DATE` means when the result was saved. Current `created_at` supports that meaning; it does not guarantee run-completion time (`supabase/migrations/20261002120000_create_run_results.sql:7`; `src/ui/setupUi.ts:85-91`).

## Cross-System Convention

In this project, terminal results are stored separately from the active game snapshot, with authenticated owner-scoped access. That boundary supports a private history view without S-11's save/resume feature (`context/foundation/architecture.md:3-17`; `supabase/migrations/20261002120000_create_run_results.sql:1-27`; `src/ui/adapters/browserResultStore.ts:38-61`). The PRD also treats personal history and the public global table as distinct access domains (`context/foundation/prd.md:130-143, 390-402`).

## Reframed Problem Statement

> **The actual problem to plan around is:** Give the signed-in player one private screen for retained-run history and the highest final-cash result, using the save date, while keeping deletion in S-15 and treating four-outcome result production as S-06 work.

The central S-12 framing holds: best score and history belong together for this player, and S-11 is not a technical prerequisite. The important correction is the source of data readiness: current results are death-only, so the full PRD outcome set becomes available only after the missing terminal outcomes and their persistence are delivered. The future per-row delete promise must also be reconciled with the narrower S-15 wording in the PRD; S-12 itself contains only placeholders.

## Confidence

**HIGH** for the S-12/S-11 boundary, current death-only limitation, combined-screen scope, and save-date meaning. These are supported by current code and the user's direct answers. The remaining mismatch is documentation of S-15's later deletion scope.

## What Changes for `/10x-plan`

Treat S-12 as the private best-plus-history screen with inert `DELETE` controls; S-11 is not its prerequisite. Record that four-outcome acceptance relies on S-06's result production and that `DATE` means save date; reconcile the roadmap's S-11 entry and the PRD's S-15 deletion scope before approving affected plans.

## References

- `context/changes/s12-personal-best-result/change.md:12-64` — Current screen, save-date meaning, S-06/S-15 boundaries and placeholder description.
- `context/changes/s12-personal-best-result/research.md:25-90` — Prior source-backed research, marked partial for the expanded UI scope.
- `context/foundation/prd.md:130-143, 382-402` — Personal history, outcomes, best selection, access and deletion wording.
- `context/foundation/roadmap.md:151-161, 211-269` — Proposed S-06, S-11, S-12 and S-15 slice boundaries.
- `src/game/state/terminalResultState.ts:1-7`; `src/game/application/gameStateCodec.ts:251-258` — Current death-only state contract.
- `src/ui/adapters/browserResultStore.ts:38-61`; `supabase/migrations/20261002120000_create_run_results.sql:1-27` — Result write path, columns and owner policy.
- Investigation tasks: `frame_dependency`, `frame_outcomes`, `frame_history` (read-only audits in this session).
