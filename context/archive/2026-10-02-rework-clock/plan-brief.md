# Compact HUD Clock Presentation — Plan Brief

> Full plan: `context/changes/rework-clock/plan.md`
> Frame brief: `context/changes/rework-clock/frame.md`

## What & Why

Replace the HUD clock's textual run-state presentation and framed card treatment
with a compact, accessible UI projection that visually distinguishes active and
paused state without altering authoritative clock behavior. The HUD will retain
`MM:SS`, show the running icon while active, and animate the supplied paused
icons every 500 ms while paused.

## Starting Point

The current HUD already has the running icon, but the component renders
`MM:SS · RUNNING|PAUSED` into its value span. The clock inherits shared card
border, background, radius, and padding styles; the application projection
already supplies all needed time and state data.

## Desired End State

The clock is an icon plus readable `MM:SS` with no clock-specific card chrome.
Paused state starts with its first paused icon and visibly alternates every half
second; running, hidden, and destroyed states have no active animation timer.
The noninteractive clock's accessible name retains both time and state without
announcing countdown ticks.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | HUD presentation only | No clock behavior or state defect was reported. | Frame |
| State source | Keep existing run-status projection | It already derives time and `RUNNING`/`PAUSED` from authoritative state. | Frame |
| Paused animation | UI-local 500 ms controller | Paused snapshots are deduplicated and cannot drive frame changes. | Plan |
| Accessibility | Dynamic non-live clock label | It preserves state semantics without noisy per-second announcements. | Plan |
| Timing tests | Fast fake-scheduler suite | Exact cadence and cleanup are deterministic without browser waits. | Plan |
| Browser coverage | Update existing journeys only | They already prove real desktop/mobile pause-resume wiring. | Plan |

## Scope

**In scope:** HUD clock image selection, paused animation lifecycle, accessible
name, clock-specific style removal, fast presentation tests, and updated
desktop/mobile application journeys.

**Out of scope:** authoritative state, pause rules, snapshots, persistence,
other UI clock surfaces, live announcements, and new Playwright journeys.

## Architecture / Approach

A DOM-free helper owns icon selection, `MM:SS` formatting, and one injected
paused-frame interval. `mountRunStatus` projects this output into the existing
clock image, visible countdown, and accessible name; CSS removes only the
clock's card treatment. The game/application state layer is untouched.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Implement and verify compact clock presentation | Controller, HUD integration, styling, fast tests, and updated browser journeys | Leaking or duplicating a paused interval |

**Prerequisites:** The three supplied clock assets and existing local project dependencies.
**Estimated effort:** One focused implementation session.

## Open Risks & Assumptions

- The supplied paused images are final and alternate only while the HUD is both visible and paused.
- Existing local Chromium is optional for validation; do not install it during ordinary verification.
- Changing Playwright tests requires refreshing `context/foundation/e2e_scenarios.md`.

## Success Criteria (Summary)

- Fast tests prove frame timing, state transitions, cleanup, and accessible labels deterministically.
- Existing browser journeys prove the running and paused HUD contracts through real pause/resume paths.
- Manual desktop and mobile checks confirm compact, readable, frameless clock presentation.
