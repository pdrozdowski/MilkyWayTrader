---
project: MilkyWayTrader
version: 1
status: draft
created: 2026-09-21
updated: 2026-09-21
prd_version: 1
main_goal: speed
top_blocker: time
milestone_id: playable-persistent-debt-run
milestone_seq: 1
milestone_status: open
---

# Roadmap: MilkyWayTrader

> Derived from `context/foundation/prd.md` (v1) and an auto-researched codebase baseline.
> Edit in place; archive when superseded.
> Slices are listed in dependency order. The At a glance table is the index.

## Milestone

**M-1: Playable and persistent debt run** — Status: open

- **Intent:** Deliver the complete browser-game outcome described by the PRD: an anonymous player can finish the debt run through trading, flight, hazards, and salvage, while a signed-in player can preserve progress and compare eligible results.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every S-NN below is `done` and the complete PRD-defined run is usable end to end.
- **Scope anchors:** US-01–US-06 and FR-001–FR-042.

## Vision recap

A casual browser player gets a focused thirty-minute space-trading challenge with direct ship control and no installation. Trading decisions, route choice, ship condition, combat, salvage, and a shared active-time clock determine whether the player repays the debt or receives life imprisonment, while landing provides a paused planning state.

## North star

> Here, the north star means the smallest end-to-end slice whose successful delivery proves the central product idea.

**S-04: Player completes the first planetary trade** — it is the earliest slice that connects direct flight, landing, paused time, local market information, cargo, credits, and economic progress.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| S-01 | anonymous-run-status | User can start an anonymous run and read its essential state. | — | US-01, FR-001, FR-002, FR-003, FR-004, FR-027, FR-028, FR-029, FR-030 | done |
| S-02 | direct-moving-system-flight | User can fly directly through a moving, identifiable solar system. | S-01 | US-02, FR-010, FR-012, FR-014 | proposed |
| S-03 | guided-orbit-and-landing | User can follow route guidance, enter and leave orbit, land, and launch. | S-02 | US-02, FR-011, FR-015, FR-016, FR-017, FR-018 | proposed |
| S-04 | first-planetary-trade | User can inspect a landed market and complete a commodity trade. | S-03 | US-03, FR-019, FR-020, FR-021, FR-022, FR-023 | proposed |
| S-05 | planet-ship-services | User can repair and upgrade the ship through planet-specific services. | S-04 | US-03, FR-013, FR-024, FR-025, FR-026, FR-030 | proposed |
| S-06 | timed-debt-outcome | User can abandon a run or reach timeout and see the debt outcome and final cash score. | S-01, S-04 | US-01, FR-005, FR-007, FR-009 | proposed |
| S-07 | environmental-hazards-and-death | User can encounter environmental hazards, take damage, and lose a run when the ship is destroyed. | S-01, S-02 | US-01, US-04, FR-008, FR-032, FR-034 | proposed |
| S-08 | asteroid-combat | User can fire the ship weapon and fragment or destroy asteroids. | S-07 | US-04, FR-031, FR-033, FR-034 | proposed |
| S-09 | asteroid-salvage | User can recover commodities from salvage released by weapon-destroyed asteroids. | S-04, S-08 | US-04, FR-028, FR-035, FR-036 | proposed |
| S-10 | player-sign-in-status | User can sign in for persistent features and inspect authentication status. | Selected identity-provider test projects configured | US-05, FR-037, FR-038 | blocked |
| S-11 | automatic-save-and-resume | Signed-in user can see save status, preserve progress, and resume an active run. | S-06, S-09, S-10 | US-05, FR-006, FR-039, FR-040 | proposed |
| S-12 | personal-best-result | Signed-in user can view their personal best result across retained outcomes. | S-11 | US-06, FR-041 | proposed |
| S-13 | global-high-scores | User can view the globally eligible high-score results. | S-11 | US-06, FR-042 | proposed |

## Baseline

What is already in place in the codebase as of `2026-09-21` (auto-researched and user-confirmed). The roadmap does not re-scaffold present capabilities.

- **Frontend:** partial — the browser game already has scene flow, direct flight, boost, weapon fire, a thirty-minute display, three planets, a landing prompt, and small DOM controls.
- **Backend / API:** absent — the deployed application is static and contains no routes, request handlers, or server runtime.
- **Data:** partial — a versioned in-memory game-state aggregate supports validation, serialization, and restoration; no persistent database integration exists.
- **Auth:** absent — the selected identity approach exists only in foundation and deployment documentation.
- **Deploy / infra:** present — production and preview deployment, validation, and continuous delivery are configured and verified.
- **Observability:** partial — deployment logs and test artifacts exist, while browser-runtime diagnosis remains manual and no runtime error or metric service is integrated.

## Foundations

No standalone foundations are required. Deployment is already present, the authoritative in-memory state boundary already exists, and each remaining technical element can be introduced inside the first user-visible slice that consumes it.

## Slices

### S-01: Start an anonymous run with readable status

- **Outcome:** User can start an anonymous run and read its essential state.
- **Change ID:** anonymous-run-status
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-027, FR-028, FR-029, FR-030
- **Prerequisites:** —
- **Parallel with:** S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The existing demo exposes parts of this state, but treating the full run state as one coherent user contract is necessary before later slices extend it.
- **Status:** done

### S-02: Fly through the moving solar system

- **Outcome:** User can fly directly through a moving, identifiable solar system.
- **Change ID:** direct-moving-system-flight
- **PRD refs:** US-02, FR-010, FR-012, FR-014
- **Prerequisites:** S-01
- **Parallel with:** S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Existing direct control is a useful baseline, but moving-world behavior must not detach the ship camera or compromise control clarity.
- **Status:** proposed

### S-03: Reach, orbit, and land on a planet

- **Outcome:** User can follow route guidance, enter and leave orbit, land, and launch.
- **Change ID:** guided-orbit-and-landing
- **PRD refs:** US-02, FR-011, FR-015, FR-016, FR-017, FR-018
- **Prerequisites:** S-02
- **Parallel with:** S-07, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Guidance, capture, and manual escape must remain advisory and never take direct control away from the player.
- **Status:** proposed

### S-04: Complete the first planetary trade

- **Outcome:** User can inspect a landed market and complete a commodity trade.
- **Change ID:** first-planetary-trade
- **PRD refs:** US-03, FR-019, FR-020, FR-021, FR-022, FR-023
- **Prerequisites:** S-03
- **Parallel with:** S-07, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the earliest complete product proof; clock pause, stock, price, credits, and cargo must change atomically from the player's perspective.
- **Status:** proposed

### S-05: Repair and upgrade the ship

- **Outcome:** User can repair and upgrade the ship through planet-specific services.
- **Change ID:** planet-ship-services
- **PRD refs:** US-03, FR-013, FR-024, FR-025, FR-026, FR-030
- **Prerequisites:** S-04
- **Parallel with:** S-06, S-07, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Service limits and planet-specific availability must remain consistent with credits, missing HP, and the visible ship-system state.
- **Status:** proposed

### S-06: Resolve the timed debt run

- **Outcome:** User can abandon a run or reach timeout and see the debt outcome and final cash score.
- **Change ID:** timed-debt-outcome
- **PRD refs:** US-01, FR-005, FR-007, FR-009
- **Prerequisites:** S-01, S-04
- **Parallel with:** S-05, S-07, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Every terminal path must freeze the same authoritative score and time state so early success, abandonment, and timeout cannot disagree.
- **Status:** proposed

### S-07: Survive environmental hazards

- **Outcome:** User can encounter environmental hazards, take damage, and lose a run when the ship is destroyed.
- **Change ID:** environmental-hazards-and-death
- **PRD refs:** US-01, US-04, FR-008, FR-032, FR-034
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-03, S-04, S-05, S-06, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Collision outcomes must be deterministic enough to preserve readable damage feedback without destabilizing movement or object populations.
- **Status:** proposed

### S-08: Fight and fragment asteroids

- **Outcome:** User can fire the ship weapon and fragment or destroy asteroids.
- **Change ID:** asteroid-combat
- **PRD refs:** US-04, FR-031, FR-033, FR-034
- **Prerequisites:** S-07
- **Parallel with:** S-04, S-05, S-06, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Fragmentation and replenishment must preserve stable hazard populations while making each weapon impact understandable.
- **Status:** proposed

### S-09: Recover asteroid salvage

- **Outcome:** User can recover commodities from salvage released by weapon-destroyed asteroids.
- **Change ID:** asteroid-salvage
- **PRD refs:** US-04, FR-028, FR-035, FR-036
- **Prerequisites:** S-04, S-08
- **Parallel with:** S-05, S-06, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The live-to-frozen crate lifecycle must use the shared active-time clock and never bypass cargo-capacity or transfer limits.
- **Status:** proposed

### S-10: Sign in for persistent features

- **Outcome:** User can sign in for persistent features and inspect authentication status.
- **Change ID:** player-sign-in-status
- **PRD refs:** US-05, FR-037, FR-038
- **Prerequisites:** Selected identity-provider test projects configured
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-09
- **Blockers:** Test identity projects and redirect configuration require user-managed service setup.
- **Unknowns:**
  - Must the MVP provide sign-out? — Owner: product owner. Block: yes.
- **Risk:** Identity integration must preserve complete anonymous play and must not expose one player's private state to another account.
- **Status:** blocked

### S-11: Preserve and resume a signed-in run

- **Outcome:** Signed-in user can see save status, preserve progress, and resume an active run.
- **Change ID:** automatic-save-and-resume
- **PRD refs:** US-05, FR-006, FR-039, FR-040
- **Prerequisites:** S-06, S-09, S-10
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Save boundaries, retry behavior, and restoration must preserve the full active-time world state without blocking visible gameplay.
- **Status:** proposed

### S-12: View a personal best

- **Outcome:** Signed-in user can view their personal best result across retained outcomes.
- **Change ID:** personal-best-result
- **PRD refs:** US-06, FR-041
- **Prerequisites:** S-11
- **Parallel with:** S-13
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Personal ranking includes every terminal outcome and must remain private to its owner.
- **Status:** proposed

### S-13: View global high scores

- **Outcome:** User can view the globally eligible high-score results.
- **Change ID:** global-high-scores
- **PRD refs:** US-06, FR-042
- **Prerequisites:** S-11
- **Parallel with:** S-12
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Public results must enforce the PRD's eligibility rule without exposing private run history or accepting ineligible outcomes.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
| --- | --- | --- | --- | --- |
| S-01 | anonymous-run-status | Complete the anonymous run status contract | yes | Run `/10x-plan anonymous-run-status` |
| S-02 | direct-moving-system-flight | Complete direct flight through the moving system | no | Requires S-01 |
| S-03 | guided-orbit-and-landing | Deliver guided orbit, landing, and launch | no | Requires S-02 |
| S-04 | first-planetary-trade | Deliver the first landed market transaction | no | Requires S-03 |
| S-05 | planet-ship-services | Deliver planet-specific repairs and upgrades | no | Requires S-04 |
| S-06 | timed-debt-outcome | Resolve abandonment and timed debt outcomes | no | Requires S-01 and S-04 |
| S-07 | environmental-hazards-and-death | Deliver environmental damage and death | no | Requires S-01 and S-02 |
| S-08 | asteroid-combat | Deliver asteroid weapon combat and fragmentation | no | Requires S-07 |
| S-09 | asteroid-salvage | Deliver collectible asteroid salvage | no | Requires S-04 and S-08 |
| S-10 | player-sign-in-status | Deliver player sign-in and authentication status | no | Resolve sign-out scope and complete external setup |
| S-11 | automatic-save-and-resume | Deliver automatic save and run resume | no | Requires S-06, S-09, and S-10 |
| S-12 | personal-best-result | Deliver the signed-in player's personal best | no | Requires S-11 |
| S-13 | global-high-scores | Deliver public eligible high scores | no | Requires S-11 |

## Open Roadmap Questions

1. **Must the MVP provide sign-out?** — Owner: product owner. Block: S-10.
2. **Is game audio an explicit MVP product capability or presentation polish outside the PRD?** — Owner: product owner. Block: roadmap-wide scope only; current slices can proceed.

## Parked

- **Turn-based travel, turn counters, selected destinations, and automated travel animations** — Why parked: navigation uses direct ship control and active time (`PRD §Non-Goals`).
- **Multiplayer and a shared market** — Why parked: every run has an independent economy and world state (`PRD §Non-Goals`).
- **Endless mode** — Why parked: the debt outcome depends on the active-time limit (`PRD §Non-Goals`).
- **Planetary locations beyond markets and shipyards** — Why parked: they are outside the MVP service loop (`PRD §Non-Goals`).
- **Remote live prices, stock, and shipyard services** — Why parked: local services become available only after landing (`PRD §Non-Goals`).
- **Hull-capacity upgrades, ammunition resources, booster fuel, and automated steering** — Why parked: they are excluded from the MVP ship model (`PRD §Non-Goals`).
- **Credits awarded directly from salvage** — Why parked: salvaged commodities must be sold through a market (`PRD §Non-Goals`).
- **Damaging or chain-reacting crate explosions** — Why parked: crate explosions are presentation-only (`PRD §Non-Goals`).
- **Cargo or ship value in final score** — Why parked: only liquid cash contributes to the final score (`PRD §Non-Goals`).
- **Deferring personal or global high scores** — Why parked: both are required PRD capabilities and therefore remain in this milestone (`PRD §Non-Goals`).

## Milestone History

## Done
