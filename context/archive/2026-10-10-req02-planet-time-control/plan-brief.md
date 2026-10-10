# Planet Menu Time Control — Plan Brief

> Full plan: `context/changes/req02-planet-time-control/plan.md`
> Frame brief: `context/changes/req02-planet-time-control/frame.md`
> Research: `context/changes/req02-planet-time-control/research.md`

## What & Why

The actual problem to plan around is: define safe on-planet time progression across all landing menus, because the current `landed` pause reason simultaneously enforces clock pause and ship input safety, while the full active simulation also advances markets and hazards. Players need a Play/Pause control across the Planet hub, Market, Facilities, and Shipyard that starts or pauses active time without losing environmental pause behavior or landed ship protection.

## Starting Point

The clock pauses whenever any named pause reason exists, and landing requires the `landed` reason. That reason also blocks flight input; active simulation includes facility cycles, orbital hazards, and impacts. The service menus share a display-only clock header, while the hub needs its own resource/status header.

## Desired End State

Every planet menu exposes the player's persistent Play/Pause choice. Active time and planetary facilities advance while the player chooses Play, environmental blockers still pause time, and the landed ship stays attached to its planet and protected from flight actions and asteroid damage. The hub and service menus show consistent clock and resource status.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Menu scope | Planet hub, Market, Facilities, Shipyard | Player can control time from any on-planet menu. | User clarification |
| Initial landed state | Start paused; player presses Play | Prevents unrequested progression on landing. | Plan |
| Pause ownership | Add authoritative `playerPaused`; retain environmental reasons | Player intent must not clear background or other blockers. | Plan / Research |
| Effective clock | Paused if player choice is paused or any environmental blocker remains | Preserves blocker precedence and auto-resumes only when clear. | User clarification / Plan |
| Landed simulation | Active time and all-market economy advance; landed ship remains planet-relative and safe from asteroid impacts | Meets run-while-landed behavior without exposing the ship to flight hazards. | User clarification / Frame |
| Launch | Clear player-only pause; preserve environmental blockers | Flight resumes according to the player's prior run choice unless a blocker holds. | Plan |
| State version | Schema v18; reject v17 without migration | No active save backend; avoid speculative migration. | Research / Plan |
| Hub header | Clock, credits, cargo, and toggle; no Back; services below right, animated LANDED badge lower left | Defines the distinct hub composition requested during planning. | User clarification |
| Delivery sequence | First authoritative clock/safety; then shared UI and hub header | Establish valid state/simulation behavior before presenting controls. | Plan |

## Scope

**In scope:** authoritative player pause state, clock policy, landing/launch lifecycle, landed flight and impact safety, active simulation and facility progression, schema v18, PRD contract update and validation, shared time control and resource/clock header on all planet menus, tests and browser walkthrough.

**Out of scope:** flight HUD controls, new economy rules, save backend, v17 migration, unrelated pause semantics, and service interactions beyond the shared status/control and hub layout.

## Architecture / Approach

Separate player time intent (`playerPaused`) from environmental pause reasons and landed lifecycle safety. Clock advancement requires player intent to run and no environmental blockers. Landing gates flight behavior and asteroid damage independently while the existing active simulation advances; launch clears only the player pause. Update the state codec to v18, then expose the effective clock state and toggle through shared landing UI contracts, with a dedicated hub header composition.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Authoritative Clock and Safe Landed Simulation | Player/environment pause composition, v18 state, landed-safe active simulation, PRD contract and verification | A pause or hazard path remains coupled to the old `landed` clock reason. |
| 2. Shared Landing Controls and Planet Hub Header | Consistent toggle/status in hub and all three service menus | Menu projections diverge or the hub layout/control is inconsistent. |

**Prerequisites:** Existing change research and frame are complete; the current authoritative state boundary and test dependencies are available.

**Estimated effort:** Medium, likely 2 focused implementation sessions across the two phases, plus validation.

## Open Risks & Assumptions

- Active simulation systems other than facility production will continue while landed, as they do whenever active time advances; asteroid impact damage to the landed ship is explicitly suppressed.
- Environmental reasons compose with the player pause and auto-resume when cleared; the player choice is retained while a blocker is active.
- The existing timeout behavior remains authoritative when the budget expires while landed.

## Success Criteria (Summary)

- Landing begins paused, and Play/Pause works in all planet menus while independent environmental blockers retain control of effective time.
- Running while landed advances active time and planetary economy without ship steering, combat, or asteroid impact damage.
- Clock, resource status, hub layout, and toggle state remain clear and consistent across the Planet hub, Market, Facilities, and Shipyard.
