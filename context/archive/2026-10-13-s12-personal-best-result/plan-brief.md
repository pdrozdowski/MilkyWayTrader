# S-12 Personal Best and Run History — Plan Brief

> Full plan: `context/changes/s12-personal-best-result/plan.md`
> Frame brief: `context/changes/s12-personal-best-result/frame.md`
> Research: `context/changes/s12-personal-best-result/research.md`

## What & Why

Give the signed-in player one private screen for saved run history and the highest final-cash result. S-11 is not a prerequisite; complete coverage of all four terminal outcomes depends on S-06 supplying writable results.

## Starting Point

The `run_results` table already stores saved timestamps and has owner-scoped read policies, but the application has no history read port or Personal Best screen. Current result production and persistence support only death; S-06 supplies the remaining outcomes.

## Desired End State

Players open Personal Best from the in-game menu or a dedicated Game Over button. The dark navy dialog shows the best score, a five-row paginated history, and explicit signed-out, loading, empty, and error states. DELETE is an inert placeholder owned by future S-15 work.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| S-11 dependency | Not required; S-06 is required for complete outcomes | History reads terminal result records separately from active run saves | Frame / Plan |
| Personal Best tie | Highest score, then oldest saved timestamp, then smallest `run_id` | Produces exactly one deterministic BEST record | Plan |
| History date | Local saved date from `created_at`, shown as `DD MON YYYY` | Matches the confirmed meaning and mockup | Frame / Plan |
| Entry points | In-game menu and a separate Game Over button | Matches the user's requested navigation | Plan |
| S-15 deletion | Any result owned by the player; no behavior in S-12 | DELETE remains a placeholder; align PRD before S-15 | Frame / Plan |

## Scope

**In scope:** Owner-scoped paginated reads, best-record selection, Personal Best dialog and states, both entry points, inert DELETE controls, S-12 roadmap dependency correction.

**Out of scope:** S-11 save/resume, actual deletion, public leaderboards, changing the PRD in S-12.

## Architecture / Approach

Add an application read port backed by a Supabase adapter using the current authenticated session and RLS. A dedicated DOM component renders pages of five records and is wired through application UI setup. A separate one-row query selects the personal best without downloading the full history.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Owner-scoped read | Typed page/best contract and Supabase queries | Preserve RLS and deterministic ranking |
| 2. Dialog and entry points | Complete states, navigation and compact responsive UI | Keep private data clear on sign-out |
| 3. Roadmap and browser verification | Remove S-11 prerequisite and validate landscape overlay | Real browser layout and Phaser layering |

**Prerequisites:** S-06 provides writable results for all four outcomes.  
**Estimated effort:** Three implementation phases; exact duration depends on the S-06 handoff and local browser setup.

## Open Risks & Assumptions

- The PRD and current S-15 roadmap wording describe clearing only Personal Best; revise them before S-15 planning or implementation to reflect deletion of any owned result.
- S-12 makes no schema change and consumes the four-outcome contract provided by S-06.

## Success Criteria (Summary)

- The signed-in owner sees their sorted five-row pages and the single correctly selected BEST record.
- Both entry points work; signed-out, empty, loading, error, retry, close, and sign-out behavior are clear.
- Unit tests, typecheck, and the focused authenticated landscape browser journey pass.
