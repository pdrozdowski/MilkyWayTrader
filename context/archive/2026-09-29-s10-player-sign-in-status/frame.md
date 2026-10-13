# Frame Brief: S-10 telemetry scope

> Framing step before a follow-up plan. This document separates the scope
> decision from the existing implementation detail.

## Reported Observation

S-10 currently emits session, landing, launch, and trade telemetry, while its
manual verification has so far proved the OAuth and session-identity path.

## Initial Framing (preserved)

- **User's stated cause or approach**: S-10 is about OAuth integration and a telemetry foundation.
- **User's proposed direction**: Keep `session_started` and `session_ended`; defer gameplay-milestone events to later stages.
- **Pre-dispatch narrowing**: Session lifecycle events have been proven working on localhost; remaining events are intentionally deferred.

## Dimension Map

1. **Foundation identity lifecycle** — telemetry must establish anonymous/run identity and server-derived authenticated attribution.
2. **Session lifecycle measurement** — startup and deterministic exit define the minimal foundation events.
3. **Gameplay milestone instrumentation** — landing, launch, and trade are product analytics, not prerequisites for OAuth or ingestion validation.  ← initial framing
4. **Future analytics expansion** — any later catalog must explicitly define payloads, emitters, privacy bounds, and tests.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Foundation identity lifecycle is the core S-10 outcome | `plan.md` Phase 3.1; manually verified persistent anonymous IDs, fresh session IDs, and post-sign-in server attribution without backfill | STRONG |
| Session lifecycle is sufficient for foundation telemetry | `plan.md:29`; `telemetry.ts:82-86` emits the two bounded lifecycle events | STRONG |
| Gameplay emitters belong in S-10 | `plan.md:120-126` and `gameScene.ts:393` / `landingStatusAdapter.ts:97,114` add product-milestone collection beyond the validated foundation | WEAK |
| The later catalog can be safely deferred | The event name union, Function validation, scene emitters, and UI tests currently all include the gameplay events, so deferral needs one coordinated follow-up change | STRONG |

## Narrowing Signals

- The user confirmed that `session_started` and `session_ended` remain in scope.
- Localhost verification has proven the session and OAuth attribution path.
- The user explicitly deferred landing, launch, purchase, and sale events to later stages.

## Cross-System Convention

A telemetry foundation should prove ingestion, privacy boundaries, identity correlation, and bounded lifecycle delivery before it expands into gameplay analytics. The existing plan couples those concerns; the confirmed scope separates them.

## Reframed Problem Statement

> **The actual problem to plan around is**: align S-10's implementation, tests, function allowlist, and verification criteria with its minimal session-lifecycle telemetry foundation, while reserving gameplay-milestone analytics for a later change.

The initial scope was broader than the product goal now confirmed by the owner. The follow-up must remove the deferred event catalog as a coherent contract change, rather than merely omitting it from manual testing.

## Confidence

- **HIGH** — source code and plan show the expanded catalog; the owner explicitly confirmed the narrower outcome and its localhost foundation evidence.

## What Changes for /10x-plan

Plan a focused scope-alignment change: retain OAuth and `session_started`/`session_ended`; remove deferred gameplay event names, validation, emitters, and related tests; revise S-10 success criteria and manual verification accordingly. A later change can introduce gameplay milestones as its own catalog.

## Additional Product Direction (owner update)

S-10's authentication UI also needs a reusable **Player Account** modal for managing sign-in state and the player's public nickname. This adds an account-management flow to the existing authentication foundation; it does not change the narrowed telemetry event scope above.

- Open the same modal from the Sign In / Account action in the Main Menu and Game Over screen, and from a new Sign In / Account action in the in-game menu.
- Signed out: explain that saving/resuming a game and submitting scores to the high scores board require sign-in; show Google sign-in and Close; hide profile controls.
- Signed in: show signed-in status, read-only email, editable high-score nickname, Update Nickname, Sign Out, and Close.
- Initialize a missing nickname as `spaceTrader` plus a random five-digit number and persist it with the player's profile.
- Validate nickname edits, disable unchanged/invalid/in-progress updates, prevent duplicate submissions, and show operation feedback.
- Keep game progress intact while the modal is open; closing returns to the originating screen. Authentication changes update the modal and every entry-point button.
- Use the existing visual theme and support game screen sizes and orientations. Authenticated entry points may say `ACCOUNT`.

### Updated Problem Statement for the Account UI

> **The account UI must provide one consistent, state-aware place to sign in, sign out, and manage the public player nickname from the Main Menu, Game Over screen, or in-game menu without interrupting the current run.**

## References

- `context/changes/s10-player-sign-in-status/plan.md:29,120-126`
- `src/game/application/telemetry/telemetry.ts:4,20,82-86`
- `src/game/scenes/gameScene.ts:393`
- `src/ui/adapters/landingStatusAdapter.ts:97,114`
- `tests/ui/telemetryUiTest.ts:59,86,105,122,155-156`
