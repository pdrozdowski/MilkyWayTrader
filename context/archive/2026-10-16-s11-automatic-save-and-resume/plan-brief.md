# Automatic Save, Resume, and Terminal Cleanup - Plan Brief

> Full plan: [plan.md](plan.md)
> Research: [research.md](research.md)

## What & Why

Deliver S-11 with S-14 so a profiled signed-in player can preserve, resume or abandon a run and retain its final result. Save failures must be visible and recoverable while background requests keep gameplay responsive.

## Starting Point

The game has a snapshot/codec and restore boundary, temporary OAuth handoff, profiles, personal history and global scores. Active-run storage is missing, Continue is disabled, and terminal writes use separate requests.

## Desired End State

One active run per eligible account survives reload with saved time/world state. Autosave feedback appears immediately beneath current menu controls for two seconds. Confirmation protects progress, and terminal results/cleanup succeed together before another saved run starts.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Eligibility | Non-anonymous signed-in player with created profile | Matches explicit access requirements | User / PRD |
| Autosave | Attachment, landing, changed departure, minutes, Main Menu return; initial save for a new eligible run | Preserves useful boundaries | User / Research / Plan |
| Feedback | Exact success/failure notices for two seconds below Menu or Main Menu controls | Makes completion visible in context | User / PRD |
| Conflicts | One active run; reject stale writes, offer authoritative reload | Protects newer progress | Interview 1/5 |
| Login collision | Choose saved run or confirm abandonment before keeping current run | Avoids silent replacement | Interview 2/5 |
| Invalid saves | Preserve and explain; confirmed discard without invented score | Prevents silent loss/fabricated results | Interview 3/5 / Plan |
| Abandon failure | Preserve server state, Retry, wait before a new saved run | Keeps progress/history consistent | Interview 4/5 |
| Terminal failure | Recover results/Retry; wait before new saved gameplay | Protects outcomes and new progress | Interview 5/5 |
| Atomic delivery | Personal result, global submission and cleanup in one transaction | Eliminates partial completion | Plan |
| Schema policy | Schema 20, no old-snapshot migration | Adds abandonment under project policy | Plan / Lessons |

## Scope

**In scope:** owner/profile authorization, revisions, autosave/retry, Continue, confirmation, login conflicts, terminal recovery/cleanup, accessible notices, responsive audit and automated coverage.

**Out of scope:** multiple saved slots, force overwrite, snapshot migration, multiple pending-run queues, anti-cheat, architecture artifact generation and remote deployment.

## Architecture / Approach

A root-composed application coordinator observes committed state and talks through typed ports to browser/Supabase adapters. Owner slots use monotonic revisions and transactional RPCs; empty slots retain replay metadata without progress. A validated owner-scoped local terminal intent supports same-browser reload recovery. Terminal-pending data opens results rather than gameplay. Resume reconciles environmental pauses while preserving intentional player pause.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. State and eligibility | Shared profile readiness, abandonment, schema 20 | Account races and codec consistency |
| 2. Storage and adapters | Owner slot, revisions, atomic finalization | Authorization, stale writes and replay |
| 3. Save coordinator | Triggers/retries/coalescing and terminal recovery | Pending operations across owner/scene changes |
| 4. Menu and game | Continue, confirmations, collision choice and notices | Intro ordering and restored pauses |
| 5. Audit and validation | Three viewport audits, minimal E2E journeys, full pipeline | Real boot/storage wiring and mobile usability |

**Prerequisites:** S-06/09/10/12/13/16 are recorded done; local Docker Supabase, dependencies and Chromium must be available before verification. Production authorization is separate.
**Estimated effort:** Large change, roughly 5-8 focused implementation/review sessions, excluding environment recovery and human acceptance.

## Open Risks & Assumptions

- Another device cannot know about an offline terminal transition not delivered to the server; reconnect uses revisions rather than silent overwrite.
- Clearing browser data before pending intent reaches the server can lose it; storage failure must be reported.
- Older clients cannot resume schema 20; rollback preserves user data and requires explicit assessment.
- Phase 4 has a manual checkpoint unless the user authorizes deferring it; human acceptance remains pending until confirmed.

## Success Criteria (Summary)

- Eligible players save/Continue consistent progress; anonymous players cannot persist/access it, and stale tabs cannot overwrite it.
- Abandonment and terminal completion retain results/remove progress safely; failure remains recoverable and blocks another saved run.
- Changed states pass desktop/mobile visual and interaction review; full unit, integration, typecheck, Playwright, build and Pages checks pass.
