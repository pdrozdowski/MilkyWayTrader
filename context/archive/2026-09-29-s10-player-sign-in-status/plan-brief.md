# S-10 Player sign-in, status, and telemetry — Plan Brief

> Full plan: `context/changes/s10-player-sign-in-status/plan.md`

## What & Why

This change adds Google sign-in, visible status, local sign-out, and bounded gameplay telemetry. It preserves fully playable Unsigned runs while providing reliable low-frequency data for gameplay progression and drop-off analysis.

## Starting Point

The frontend has no auth/telemetry integration, database migration, or Edge Function. It does have a central DOM composition root and semantic lifecycle seams for new runs, successful land/launch/trade, and explicit exit.

## Desired End State

Players can sign in, see their email, and sign out locally. Each event has a persistent browser anonymous ID and run-specific session ID; authenticated events additionally have a server-derived user ID. A controlled Edge Function stores validated events in the single `game_events` table for 90 days.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Anonymous play | Fully playable as Unsigned | Sign-in enables future persistent features, not gameplay. |
| Telemetry identity | `anonymous_id` + `session_id` + optional user ID | Correlates sessions and sign-in without fingerprinting. |
| Ingestion | Supabase Edge Function | Prevents direct unrestricted browser table access. |
| Event store | One JSONB-extensible `game_events` table | Supports new event types without schema changes. |
| Catalog | Session start/end; successful land/launch/trade | Useful funnel data without high-frequency noise. |
| Region | Deferred | No reliable/privacy-safe browser source. |
| Raw retention | 90 days | Bounds Free-tier storage. |

## Scope

**In scope:** Google OAuth/status/sign-out, telemetry migration/Edge Function/Cron cleanup, persistent anonymous ID, per-run session ID, authenticated correlation, and low-frequency session/gameplay events.

**Out of scope:** saves, score submission, geo/fingerprint data, high-frequency telemetry, direct browser table access, and delivery guarantees.

## Architecture / Approach

Auth and telemetry are application services outside gameplay state. The browser sends bounded allowlisted events to an Edge Function; it never writes the table directly. The function validates payloads and optional JWT identity, then writes with a server secret; raw rows are removed after 90 days.

## Phases at a Glance

| Phase | Deliverable | Main risk |
| --- | --- | --- |
| 1 | Auth boundary and Unsigned UI | Preserve anonymous play and OAuth lifecycle |
| 2 | Table, Edge Function, RLS denial, retention | Anonymous endpoint validation and migration safety |
| 3 | Session identity and semantic event capture | No frame-level events or gameplay blocking |
| 4 | Test-project setup and real verification | User-managed Supabase/Google access |

**Prerequisites:** Configured Supabase test project, matching Google OAuth test client, Edge Function secret/deployment access, and exact localhost/staging allowlists.
**Estimated effort:** ~5 focused sessions, plus external setup and manual verification.

## Open Risks & Assumptions

- Anonymous ingestion is public by design, so endpoint allowlists, payload/batch limits, origin checks, and monitoring are mandatory; it does not prove event truth.
- Telemetry is best effort and never blocks gameplay.
- The project owner handles applicable player-facing privacy notice/consent obligations before public collection.

## Success Criteria (Summary)

- Unsigned and authenticated players retain the intended auth/gameplay experience.
- Events are safely correlated, validated, stored only through the Edge Function, and contain no forbidden data.
- Browser access to the table is denied and raw events expire after 90 days.
