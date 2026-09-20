---
project: MilkyWayTrader
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 1
  hard_deadline: 2026-11-04
  after_hours_only: true
created: 2026-09-16
updated: 2026-09-20
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: run objective
      decision: "A run provides 30 minutes of active game time; at timeout, at least 20,000,000 liquid credits grants freedom and less results in life imprisonment."
    - topic: clock behavior
      decision: "The clock and world simulation run during flight and pause while landed, backgrounded, or closed; remaining time and clock state stay visible."
    - topic: navigation
      decision: "Travel uses direct ship control, moving planets, orbital guidance, orbit capture, landing, launch, and an unlockable unlimited 5x booster."
    - topic: hazards and combat
      decision: "The ship has HP; sun and asteroid collisions cause damage, zero HP ends the run, and weapons fragment or destroy asteroids."
    - topic: salvage
      decision: "Projectile-destroyed asteroids may drop single-commodity crates with a live-to-frozen lifecycle, partial looting, and probabilistic reactivation."
    - topic: planetary services
      decision: "Every planet has a landed-only market and shipyard, with planet-specific upgrades and repairs."
    - topic: access and persistence
      decision: "Anonymous play is complete; Google OAuth is the sole sign-in method and enables automatic saves, resume, personal results, and eligible global submissions."
    - topic: scores
      decision: "Final score is liquid cash before debt repayment; personal best uses all signed-in outcomes, while global scores require authenticated freedom after the full time limit."
  frs_drafted: 42
  quality_check_status: accepted
---

# MilkyWayTrader — Shape Notes

## Vision & Problem Statement

A casual browser player wants a focused space-trading challenge without installing a game or learning a large ruleset. The player has a thirty-minute active-time run to repay a debt of 20,000,000 credits by navigating a moving solar system, trading commodities, upgrading and repairing a ship, surviving hazards, and salvaging occasional asteroid loot.

MilkyWayTrader combines a readable economic simulation with direct ship control and the humor of a cow astronaut trying to avoid life imprisonment. Trading decisions, piloting skill, route choice, ship condition, combat, and time pressure contribute to the outcome while landing provides a safe, paused planning state.

## User & Persona

The primary persona is a casual browser player who wants a self-contained session with a clear objective, immediate controls, and meaningful decisions. The player accepts a thirty-minute active-time challenge, wants to understand the remaining time and current risks at a glance, and expects trading, navigation, upgrades, combat, and salvage to contribute to progress without requiring external analysis.

## Success Criteria

### Primary

- A player can complete a full run from the initial orbit through flight, landing, trading, ship services, hazards, and the final freedom-or-imprisonment outcome.
- The game consistently resolves freedom when the surviving player has at least 20,000,000 liquid credits after thirty minutes of active game time, and life imprisonment otherwise.
- The remaining active time and whether the clock is running or paused remain continuously visible throughout every open active run.

### Secondary

- A signed-in player can resume an active run and retain completed results.
- A signed-in player can see a personal best, and every player can see the winners-only global high-score table.
- Orbital guidance, asteroid combat, and salvage provide useful alternatives to purely economic optimization without replacing trading as the main source of progress.

### Guardrails

- Anonymous play remains available; sign-in is not required to begin or finish a run.
- Active game time does not advance while the player is landed, the application is backgrounded, or the application is closed.
- Buying, repairs, upgrades, and salvage transfers cannot exceed available credits, stock, cargo capacity, missing HP, or crate contents.
- The player retains direct control during flight; navigation guidance never steers or locks the ship.
- A failed background save never blocks flight, landing, trading, combat, or salvage interactions.

## User Stories

### US-01: Player resolves the debt run

- **Given** a new run has started in orbit around Seroton with thirty minutes of active time remaining
- **When** the player flies, lands, trades, upgrades, repairs, and survives until the countdown reaches zero
- **Then** the game grants freedom when final liquid credits are at least 20,000,000 and imposes life imprisonment otherwise

#### Acceptance Criteria

- The run starts at 30:00 with the clock marked as running.
- Remaining time and running or paused state remain visible throughout the open run.
- Reaching 20,000,000 credits early does not end the run.
- Final score equals liquid credits immediately before debt repayment.
- Cargo and ship value do not contribute to final score.
- Zero HP ends the run immediately with a death outcome.
- Confirmed abandonment ends the run immediately with an abandonment outcome.

### US-02: Player navigates to a moving planet

- **Given** the ship is under direct control in the moving solar system
- **When** it approaches a planet's orbital path
- **Then** the player receives route guidance, chooses a direction, intercepts the planet, enters orbit, and may land

#### Acceptance Criteria

- A nearby orbital path is shown as a subtle shaded line with the planet name.
- Clockwise and counter-clockwise interception distances update as the ship and planet move.
- The shorter route is emphasized unless both routes are effectively equal.
- Prediction uses normal ship speed and accounts for planet motion.
- Guidance disappears outside the guidance band or after orbit capture.
- The ship follows the planet's displacement while captured inside its orbit zone.
- The player can leave orbit through manual flight without an automated travel sequence.

### US-03: Player trades and services the ship

- **Given** the player has landed on a planet and game time is paused
- **When** the player visits the market or shipyard
- **Then** the player can trade, repair, and buy that planet's available upgrades without consuming active game time

#### Acceptance Criteria

- Landing visibly changes the clock state to paused and stops the countdown.
- Launching visibly changes the clock state to running and resumes the countdown.
- The market shows local stock and current prices only after landing.
- Transactions immediately update stock, cargo, credits, and subsequent prices.
- Repairs are purchased in selectable increments of 10% maximum HP.
- Seroton offers cargo upgrades, Lactozis-7C offers engine upgrades and the booster unlock, and Maslo-Prime offers weapon upgrades.

### US-04: Player survives hazards and salvages cargo

- **Given** the player is flying among the sun and asteroids
- **When** the ship collides with hazards or the player shoots asteroids
- **Then** damage, fragmentation, destruction, and possible salvage are resolved consistently

#### Acceptance Criteria

- A discrete sun impact removes 80% of maximum HP and pushes the ship clear.
- Asteroid collision applies size-based damage, destroys the asteroid, and cannot produce salvage.
- Projectile destruction can fragment an asteroid and receives one low-probability salvage-crate roll.
- A live crate can be opened manually in range or automatically by direct ship contact.
- Opening reveals the commodity and quantity but does not transfer it automatically.
- The player selects a transfer quantity that fits available cargo capacity.
- A live crate freezes after sixty seconds of active game time.
- Shooting a frozen crate restores it with 20% probability or destroys it with 80% probability.

### US-05: Signed-in player preserves a run

- **Given** a player is signed in or signs in during an active run
- **When** the player lands, changes state on a planet, departs, or reaches a terminal outcome
- **Then** the relevant state and result are preserved without blocking gameplay

#### Acceptance Criteria

- Signing in during an anonymous run immediately attaches and saves that run.
- Landing triggers a save.
- Departure triggers another save only when trading, repairs, or upgrades changed persisted state while landed.
- Freedom, imprisonment, death, and abandonment outcomes are retained.
- An active saved run resumes with its saved remaining active time and world state.
- A completed run cannot be resumed as active gameplay.

### US-06: Player compares high scores

- **Given** completed signed-in results exist
- **When** a signed-in player views their personal best or any player views global high scores
- **Then** personal and global results follow their distinct eligibility rules

#### Acceptance Criteria

- Personal history retains every outcome but exposes the highest final-cash result as personal best.
- A personal best may come from freedom, imprisonment, death, or abandonment.
- The global table contains only authenticated runs that survived the full active-time limit and achieved freedom.
- Global results are ranked by final cash before debt repayment.
- Anonymous players can view global results but cannot submit a result or access a personal best.

## Functional Requirements

### Game lifecycle and objective

- FR-001: A player can start a new game. Priority: must-have
- FR-002: A player can play a complete game without signing in. Priority: must-have
- FR-003: A player can continuously see the remaining active game time. Priority: must-have
- FR-004: A player can continuously see whether game time is running or paused. Priority: must-have
- FR-005: A player can abandon an active game. Priority: must-have
- FR-006: A signed-in player can continue a saved active game. Priority: must-have
- FR-007: The game can resolve the player's debt outcome when the time limit expires. Priority: must-have
- FR-008: The game can end a run immediately when the player's ship is destroyed. Priority: must-have
- FR-009: A player can view the outcome and final cash score of a completed run. Priority: must-have

### Solar system and flight

- FR-010: A player can identify the sun and planets in the navigable world. Priority: must-have
- FR-011: A player can receive visual route guidance near a planet's orbital path. Priority: must-have
- FR-012: A player can directly control their ship's flight. Priority: must-have
- FR-013: A player can use an unlocked booster for faster travel. Priority: must-have
- FR-014: The game can move planets along distinct orbits around the sun. Priority: must-have
- FR-015: A player can enter orbit around a planet. Priority: must-have
- FR-016: A player can land on an orbited planet. Priority: must-have
- FR-017: A player can launch from a planet into orbit. Priority: must-have
- FR-018: A player can leave a planet's orbit through manual flight. Priority: must-have

### Planetary services and economy

- FR-019: A landed player can access the planet's market. Priority: must-have
- FR-020: A landed player can inspect local commodity stock and prices. Priority: must-have
- FR-021: A player can buy commodities from a planetary market. Priority: must-have
- FR-022: A player can sell commodities to a planetary market. Priority: must-have
- FR-023: The game can evolve each planet's commodity market during active game time. Priority: must-have
- FR-024: A landed player can access the planet's shipyard. Priority: must-have
- FR-025: A player can repair their ship at a shipyard. Priority: must-have
- FR-026: A player can purchase ship upgrades available at the current shipyard. Priority: must-have

### Ship state, hazards, combat, and salvage

- FR-027: A player can inspect their current credit balance. Priority: must-have
- FR-028: A player can inspect their cargo contents and remaining capacity. Priority: must-have
- FR-029: A player can inspect their ship's current HP. Priority: must-have
- FR-030: A player can inspect the levels and availability of their ship systems. Priority: must-have
- FR-031: A player can fire the ship's weapon. Priority: must-have
- FR-032: The game can apply ship damage from environmental collisions. Priority: must-have
- FR-033: A player can fragment and destroy asteroids by shooting them. Priority: must-have
- FR-034: The game can maintain scattered asteroids and an outer asteroid belt. Priority: must-have
- FR-035: The game can release salvage crates from asteroids destroyed by weapons. Priority: must-have
- FR-036: A player can recover commodities from salvage crates. Priority: must-have

### Authentication and persistence

- FR-037: A player can sign in to access persistent features. Priority: must-have
- FR-038: A player can inspect their authentication status. Priority: must-have
- FR-039: The game can automatically preserve progress for a signed-in player. Priority: must-have
- FR-040: A signed-in player can inspect the current save status. Priority: must-have

### High scores

- FR-041: A signed-in player can view their personal best result. Priority: must-have
- FR-042: A player can view the global high-score table. Priority: must-have

## Non-Functional Requirements

- The game remains usable in current Chrome and Edge releases on supported desktop and mobile layouts.
- The player sees acknowledgement of an interaction within one second.
- The displayed countdown remains accurate to active elapsed game time within one second over a complete run.
- Clock state, remaining time, credits, cargo capacity, and HP remain readable during flight without obscuring direct control.
- Landing, backgrounding, and restoration cannot advance paused time-based simulations.
- Saving occurs in the background and does not delay visible gameplay responses.
- A failed save is retried once per second up to five times.
- After five consecutive failures, the player is informed of the temporary save problem and retries continue every thirty seconds.
- After recovery from a save failure, the player is informed that progress is preserved.
- Missing, locked, or muted audio never blocks gameplay.

## Business Logic

Each run combines a shared active-time clock, independently evolving planetary markets, direct navigation through a moving hazard field, and a liquid-cash debt outcome.

### Clock and outcomes

- BR-001: A new run starts in orbit around Seroton with full HP, level-one cargo, engine, and weapon systems, and a locked booster.
- BR-002: A new run begins with 30:00 of active game time remaining and the clock state set to running.
- BR-003: Remaining active time is continuously visible whenever an active run is open.
- BR-004: The clock's running or paused state is continuously visible whenever an active run is open.
- BR-005: Active time advances during orbit, open-space flight, combat, and salvage.
- BR-006: Landing pauses the countdown, planetary motion, asteroid motion, crate motion, asteroid replenishment, crate lifetimes, and scheduled market ticks.
- BR-007: While paused, the visible countdown does not decrement and the visible clock state reads paused.
- BR-008: Launching resumes all time-based systems, resumes decrementing the visible countdown, and changes the visible clock state to running.
- BR-009: Backgrounding or closing the game pauses active-time progression.
- BR-010: The countdown and every time-based simulation use the same authoritative clock state.
- BR-011: The debt target is 20,000,000 liquid credits at the instant the countdown reaches zero.
- BR-012: Reaching the debt target before timeout does not end the run.
- BR-013: A surviving player at or above the debt target when time expires receives freedom.
- BR-014: A surviving player below the debt target when time expires receives life imprisonment.
- BR-015: Final score equals liquid credits immediately before debt repayment; cargo and ship value are excluded.
- BR-016: Reaching zero HP ends the run immediately with a death outcome.
- BR-017: Confirmed abandonment ends the run immediately with an abandonment outcome.

### Solar system, guidance, and flight

- BR-018: The navigable world contains a central sun and the planets Seroton, Lactozis-7C, and Maslo-Prime.
- BR-019: Each planet follows its own configured orbit around the sun at its configured speed while the clock is running.
- BR-020: Remote planetary information is limited to planet identity and position.
- BR-021: Each planetary orbital path has a configured navigation-guidance band.
- BR-022: Entering an eligible guidance band displays the complete orbital path as a subtle shaded line and displays the planet's name.
- BR-023: Route guidance projects the ship onto the orbital path and continuously calculates clockwise and counter-clockwise interception routes.
- BR-024: Interception prediction accounts for current planet motion and assumes the ship's configured normal, unboosted speed.
- BR-025: The guide displays both predicted route distances and emphasizes the shorter route.
- BR-026: When the predicted routes are effectively equal, neither route is emphasized.
- BR-027: When guidance bands overlap, only the closest eligible orbital path is emphasized.
- BR-028: Guidance disappears when the ship leaves the guidance band or enters the planet's orbit-capture zone.
- BR-029: Route guidance never changes ship velocity, heading, target, or control state.
- BR-030: Entering a planet's capture zone automatically places the ship into orbit.
- BR-031: While inside the orbit zone, the ship inherits the planet's displacement as the planet moves.
- BR-032: Flying beyond the orbit zone detaches the ship from the planet without moving the detached ship with it.
- BR-033: Landing is available only while the ship is in the planet's orbit zone.
- BR-034: Launching places the ship back into the planet's orbit zone.
- BR-035: Travel uses direct ship control and has no destination-selection or automated-travel sequence.
- BR-036: The booster is initially locked and can be unlocked only through the Lactozis-7C shipyard.
- BR-037: An unlocked booster requires active thrust, provides five times the current normal maximum speed, consumes no resource, and prevents firing while active.

### Damage, combat, and asteroids

- BR-038: A discrete sun impact removes 80% of maximum HP and pushes the ship clear of the sun.
- BR-039: Sun damage cannot trigger again until the ship has separated from the previous contact.
- BR-040: Asteroid collision applies configured size-based damage and destroys the asteroid without fragments or salvage.
- BR-041: A large asteroid destroyed by a projectile produces a configured random number of medium fragments.
- BR-042: A medium asteroid destroyed by a projectile produces a configured random number of small fragments.
- BR-043: A small asteroid destroyed by a projectile disappears without fragments.
- BR-044: Weapon level one fires one projectile per shot, and each additional level adds one projectile to the same configured narrow spread.
- BR-045: Scattered asteroids follow configured drifting paths while the clock is running.
- BR-046: Asteroids in the outer belt orbit beyond Maslo-Prime's orbital path while the clock is running.
- BR-047: Scattered and belt populations replenish toward their configured targets while the clock is running.

### Salvage crates

- BR-048: Every asteroid entity destroyed by a projectile receives exactly one configured low-probability salvage-crate roll, including a large or medium asteroid replaced by fragments.
- BR-049: Asteroids destroyed by ship collision cannot produce salvage crates.
- BR-050: A successful salvage roll creates one live crate containing one commodity.
- BR-051: Commodity selection uses configured weights that decrease as the commodity's configured base value increases.
- BR-052: A live crate contains a configured small quantity of its selected commodity.
- BR-053: A live crate remains collectible for sixty seconds of active game time.
- BR-054: Paused game time also pauses the crate's remaining collectible lifetime.
- BR-055: Entering configured salvage range makes a manual open action available.
- BR-056: Direct ship contact with a live crate opens it automatically but does not transfer cargo.
- BR-057: Opening reveals the commodity, remaining quantity, and currently available cargo capacity.
- BR-058: Opening a crate or transferring cargo does not pause active game time.
- BR-059: The player chooses a transfer quantity limited by the crate's remaining quantity and the ship's available cargo capacity.
- BR-060: Any uncollected quantity remains in the live crate.
- BR-061: Shooting a live crate destroys the crate and its contents in a visual fireball.
- BR-062: After sixty seconds of active game time, a live crate becomes a frozen crate with the same remaining contents.
- BR-063: A frozen crate cannot be opened or looted and behaves as a small space obstacle.
- BR-064: Ship collision destroys a frozen crate without damaging the ship.
- BR-065: Shooting a frozen crate restores it to a live crate with its remaining contents and a fresh sixty-second lifetime with 20% probability.
- BR-066: The other 80% of frozen-crate shots destroy the crate and its contents in a visual fireball.
- BR-067: Crate fireballs cause no ship, asteroid, crate, cargo, or market damage.
- BR-068: Destroyed crates cannot generate crates, fragments, commodities, credits, or other loot.

### Planetary services, upgrades, and economy

- BR-069: Every planet provides a market and a shipyard after landing.
- BR-070: Live market stock, prices, and shipyard services are unavailable remotely.
- BR-071: Repairs are purchased in player-selected increments of 10% maximum HP at a configured fixed cost per increment.
- BR-072: A repair cannot exceed missing HP or available credits.
- BR-073: Seroton sells cargo-capacity upgrades.
- BR-074: Lactozis-7C sells normal-engine speed upgrades and the one-time booster unlock.
- BR-075: Maslo-Prime sells weapon upgrades.
- BR-076: Cargo upgrades increase capacity, engine upgrades increase normal maximum speed, and weapon upgrades add projectiles to each shot.
- BR-077: Upgrade levels, effects, and costs are configured balance parameters.
- BR-078: Every planet maintains independent stock for every commodity.
- BR-079: Scheduled market updates occur every ten seconds of active game time.
- BR-080: Each scheduled update changes stock by configured production minus configured consumption without allowing stock below zero.
- BR-081: A commodity's local price is derived from local stock, configured stock thresholds, and configured base price.
- BR-082: Below the lower threshold, the price multiplier scales linearly from 200% at zero stock to 100% at the threshold.
- BR-083: Between the lower and upper thresholds, the price multiplier remains at 100%.
- BR-084: Above the upper threshold and below the combined thresholds, the multiplier scales linearly from 100% to 50%.
- BR-085: At or above the combined thresholds, the price multiplier remains at 50%.
- BR-086: Unit price equals configured base price multiplied by the current multiplier and rounded to an integer.
- BR-087: A transaction uses the unit price calculated before that transaction for every unit in the transaction.
- BR-088: Buying decreases market stock, decreases credits, and increases cargo immediately.
- BR-089: Selling increases market stock, decreases cargo, and increases credits by gross value minus sales tax immediately.
- BR-090: Sales tax is rounded once from the gross transaction value and the planet's configured tax rate.
- BR-091: A transaction recalculates subsequent prices after applying its complete stock change.
- BR-092: Buying cannot exceed credits, market stock, or cargo capacity, and selling cannot exceed carried cargo.
- BR-093: Starting credits, commodity values, stock thresholds, initial stock, production, consumption, taxes, repair costs, upgrade values, asteroid values, and salvage values are balance parameters rather than fixed PRD tables.

### Authentication, persistence, and scores

- BR-094: Anonymous play does not create persistent saves, personal results, or global submissions.
- BR-095: Successful sign-in during an anonymous active run immediately attaches that run to the player and saves it.
- BR-096: A signed-in run saves when the player lands.
- BR-097: Departure saves only when trading, repairs, or upgrades changed persisted state while landed since the landing save.
- BR-098: Unsaved flight progress after the last successful save boundary may be lost when the application closes.
- BR-099: Freedom, imprisonment, death, and abandonment outcomes are always persisted for a signed-in player.
- BR-100: Starting a new signed-in run while another run remains active first abandons and retains the previous run.
- BR-101: A resumed run restores the saved remaining active time and all state required to continue consistently.
- BR-102: A completed run cannot be resumed as active gameplay.
- BR-103: Personal history retains every signed-in result across all outcomes.
- BR-104: Personal best is the retained result with the highest final liquid-cash score regardless of outcome.
- BR-105: A global result is eligible only when an authenticated player survives the complete active-time limit and receives freedom.
- BR-106: Global results are ranked by final liquid cash before debt repayment.
- BR-107: Anonymous and signed-in players can view the global high-score table, but only signed-in players can submit eligible results or view a personal best.

## Access Control

The game is available anonymously without creating an account. Anonymous players can complete the full gameplay loop and view global high scores, but their active runs and results are not persisted.

Google OAuth is the only sign-in method. Sign-in may occur before a run or during an anonymous active run. A successful mid-run sign-in attaches and saves the current run immediately. Signed-in players can access only their own active save, result history, and personal best. They cannot read or modify another player's private data.

Global high scores are publicly readable. Only authenticated, eligible freedom outcomes can be submitted. All signed-in players have the same permissions; the MVP has no administrative or multiplayer roles.

## Non-Goals

- The MVP does not include turn-based travel, turn counters, selected destinations, or automated travel animations because navigation uses direct ship control and active time.
- The MVP does not include multiplayer or a shared market because every run has an independent economy and world state.
- The MVP does not include an endless mode because the debt outcome depends on the thirty-minute active-time limit.
- The MVP does not include planetary locations beyond markets and shipyards.
- The MVP does not expose live prices, stock, or shipyard services before landing.
- The MVP does not include hull-capacity upgrades, ammunition resources, booster fuel, or automated ship steering.
- The MVP does not award credits directly from salvage crates; salvaged commodities must be sold through a market.
- The MVP does not include damaging or chain-reacting crate explosions.
- The MVP does not include cargo value or ship value in final score.
- The MVP does not defer personal or global high scores; both are required capabilities.

## Open Questions

1. **Must the MVP provide sign-out?** — Owner: product owner. Resolve before authentication implementation.
2. **Is game audio an explicit MVP product capability or presentation polish outside the PRD?** — Owner: product owner. Resolve before the MVP scope is locked.

## Quality cross-check

- Access Control: present — anonymous play, Google OAuth for persistent features, private personal data, and publicly readable global scores are defined.
- Business Logic: present — the one-sentence rule combines the authoritative active-time clock, evolving markets, direct navigation, hazards, and the liquid-cash debt outcome.
- Project artifacts: present — this file contains the complete checkpoint contract.
- Timeline-cost acknowledgment: present — `mvp_weeks` is 1, within the three-week threshold.
- Non-Goals: present — excluded travel, economy, upgrade, scoring, multiplayer, and explosion behavior is explicit.
- Preserved behavior: n/a — greenfield.
