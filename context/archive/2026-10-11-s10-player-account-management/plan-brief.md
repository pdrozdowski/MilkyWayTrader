# S-10 Player Account Management — Plan Brief

> Full plan: `context/changes/s10-player-account-management/plan.md`
> Related change: `context/changes/s10-player-sign-in-status/`

## What & Why

The account UI must provide one consistent, state-aware place to sign in, sign out, and manage the player's nickname from the Main Menu, Game Over screen, or in-game menu without interrupting the current run. This follow-up adds the profile capability missing from the existing auth foundation and preserves active gameplay through Google's full-page OAuth return.

## Starting Point

The existing S-10 change supplies Google auth status/actions, a Main Menu button reused on Game Over, an in-memory game-state provider with a validated restore boundary, and a telemetry session identity that currently lives in memory. There is no player profile table or nickname control, and the in-game menu has no account entry.

## Desired End State

One Player Account modal adapts to signed-out and signed-in state and is reachable from all three entry points. Signed-in players can persist a nickname while profiles remain owner-only until a leaderboard read path exists. After OAuth, the original run, telemetry session context, account modal, and originating surface return, including after cancellation or failure.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Existing S-10 plan | Preserve; make this a follow-up change | Existing S-10 is `impl_reviewed`; keep its execution history intact. | Plan persistence workflow |
| Telemetry | Keep the current catalog and behavior | Latest user steer supersedes the earlier frame proposal to remove gameplay events. | User update |
| Profile storage | Dedicated owner-scoped Supabase row | Keeps durable profile data separate from game state and private until leaderboard work. | Plan |
| Nickname | `spaceTrader` + random five-digit default; duplicates allowed; trimmed 3–20 ASCII letters/digits/underscores | Gives every profile a persistent usable name with explicit validation. | User choices |
| OAuth return | Restore game state and the same telemetry session context on every return | Preserves the active run and avoids splitting its telemetry session. | User choices |
| Save/score benefits | Describe as upcoming; do not implement them here | Keeps the signed-out copy truthful while keeping the feature visible. | User choice |

## Scope

**In scope:** Profile migration and owner-only access, generated persisted nickname, shared account modal, three entry points, auth/profile feedback, and one-time run plus telemetry-context restoration around OAuth.

**Out of scope:** Durable game saves, score submission, public profile reads/leaderboard, and telemetry catalog or payload changes.

## Architecture / Approach

Add a profile port and browser adapter backed by an RLS-protected Supabase table. Compose one DOM modal at the UI root. A tab-scoped OAuth return adapter stores the validated current game snapshot, telemetry session ID/start time, and modal origin; preloader startup consumes and restores that state before normal menu flow can replace it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1 | Complete account/profile management and OAuth run continuity | Correct restoration order across auth callback and Phaser startup |

**Prerequisites:** Existing `s10-player-sign-in-status` auth foundation; local Supabase and Chromium for integration/browser checks; user-managed Google OAuth configuration for manual acceptance.
**Estimated effort:** One focused implementation phase, plus real-provider verification.

## Open Risks & Assumptions

- If the temporary OAuth snapshot is invalid, discard it completely and return safely to Main Menu with a recoverable message.
- Telemetry's in-flight queue remains best effort during redirect; only the session ID and start time are restored.
- The project's `utils-add-state` workflow is required for the temporary game snapshot save/restore implementation.

## Success Criteria (Summary)

- The profile and nickname are durable and accessible only to their owner.
- The same accessible account modal works from all three entry points and returns to its originating screen.
- OAuth success, cancellation, and failure preserve a valid active run and its existing telemetry session context.
