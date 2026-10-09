---
project: MilkyWayTrader
version: 1
status: draft
created: 2026-09-21
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
---

# MilkyWayTrader — Product Requirements Document

## Vision & Problem Statement

A casual browser player wants a focused space-trading challenge without installing a game or learning a large ruleset. The player has a thirty-minute active-time run to repay a debt of 20,000,000 credits by navigating a moving solar system, trading commodities, upgrading and repairing a ship, surviving hazards, and salvaging occasional asteroid loot.

MilkyWayTrader combines a readable economic simulation with direct ship control and the humor of a cow astronaut trying to avoid life imprisonment. Trading decisions, planetary facility investment, piloting skill, route choice, ship condition, combat, and time pressure contribute to the outcome while landing provides a safe, paused planning state.

## User & Persona

The primary persona is a casual browser player who wants a self-contained session with a clear objective, immediate controls, and meaningful decisions. The player accepts a thirty-minute active-time challenge, wants to understand the remaining time and current risks at a glance, and expects trading, planetary facility investment, navigation, upgrades, combat, and salvage to contribute to progress without requiring external analysis.

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
- **When** it flies among the planets
- **Then** the player can see each planetary orbital path, intercept a planet, enter orbit, and may land

#### Acceptance Criteria

- All configured planetary orbital paths are continuously visible as subtle dashed references.
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
- A final projectile hit on a small asteroid follows a five-destruction cycle that guarantees one orbital cargo outcome; each other destruction can yield one loose commodity.
- Nearby orbital cargo can exchange each contained commodity with the ship within ship and orbital capacity limits.
- A loose commodity is collected only when ship capacity permits.
- Each commodity holder retains its own quantity and cost basis during transfer and loss.

### US-05: Signed-in player preserves a run

- **Given** a player is signed in or signs in during an active run
- **When** the player lands, changes state on a planet, departs, or reaches a terminal outcome
- **Then** the relevant state and result are preserved without blocking gameplay

#### Acceptance Criteria

- Signing in during an anonymous run immediately attaches and saves that run.
- Landing triggers a save.
- Departure triggers another save only when trading, repairs, or upgrades changed persisted state while landed.
- Freedom, imprisonment, death, and abandonment outcomes are retained.
- After the final result is retained, its active-run save is removed and cannot be resumed.
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
- A signed-in player can clear their personal best result; the next highest retained result becomes the new personal best.

### US-07: Player receives gameplay audio feedback

- **Given** audio is available and not muted
- **When** the player pilots the ship or performs a gameplay action with sound feedback
- **Then** the player can hear the corresponding gameplay audio without interrupting control or game progression

#### Acceptance Criteria

- Engine, booster, weapon, asteroid, and collision feedback can play during the corresponding gameplay events.
- A player can mute gameplay audio or set its volume without pausing or blocking the run.
- Unavailable or locked audio leaves the game fully playable.

### US-08: Player develops a planet's facilities

- **Given** the player has landed on a planet with available facilities and resources to invest
- **When** the player reviews, constructs, or improves a local facility
- **Then** the player can understand the facility's effect on local commodity opportunities and make the chosen investment

#### Acceptance Criteria

- The player can inspect the planet's available facilities and the state of its existing facilities only while landed.
- A construction or improvement identifies the required resource investment before the player commits it.
- A completed construction or improvement immediately changes the relevant facility structure and its local economic effect.
- Facility operation changes the planet's shared commodity stock, and the resulting supply and demand change affects local market prices.
- The planet's characteristics adjust facility effectiveness, and a facility without required resources does not operate.

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
- FR-011: A player can view the orbital paths of all configured planets. Priority: must-have
- FR-012: A player can directly control their ship's flight. Priority: must-have
- FR-013: A player can use an unlocked booster for faster travel. Priority: must-have
- FR-014: The game can move planets along distinct orbits around the sun. Priority: must-have
- FR-015: A player can enter orbit around a planet. Priority: must-have
- FR-016: A player can land on an orbited planet. Priority: must-have
- FR-017: A player can launch from a planet into orbit. Priority: must-have
- FR-018: A player can leave a planet's orbit through manual flight. Priority: must-have

### Planetary services and economy

- FR-019: A landed player can access Seroton's market. Priority: must-have
- FR-020: A landed player can inspect Seroton's commodity stock and prices. Priority: must-have
- FR-021: A player can buy commodities from Seroton's market. Priority: must-have
- FR-022: A player can sell commodities to Seroton's market. Priority: must-have
- FR-023: The game can evolve Seroton's commodity market during active game time. Priority: must-have
- FR-024: A landed player can access the planet's shipyard. Priority: must-have
- FR-025: A player can repair their ship at a shipyard. Priority: must-have
- FR-026: A player can purchase ship upgrades available at the current shipyard. Priority: must-have
- FR-027: A landed player can inspect the current planet's facilities. Priority: must-have
- FR-028: A landed player can construct an available facility by investing required resources. Priority: must-have
- FR-029: A landed player can improve an existing facility by investing required resources. Priority: must-have
- FR-030: The game can apply operating facility activity to the current planet's commodity stock. Priority: must-have
- FR-031: The game can adjust facility effectiveness for the current planet's characteristics. Priority: must-have
- FR-032: The game can determine whether a facility operates from its required resource availability. Priority: must-have

### Ship state, hazards, combat, and salvage

- FR-033: A player can inspect their current credit balance. Priority: must-have
- FR-034: A player can inspect their cargo contents and remaining capacity. Priority: must-have
- FR-035: A player can inspect their ship's current HP. Priority: must-have
- FR-036: A player can inspect the levels and availability of their ship systems. Priority: must-have
- FR-037: A player can fire the ship's weapon. Priority: must-have
- FR-038: The game can apply ship damage from environmental collisions. Priority: must-have
- FR-039: A player can fragment and destroy asteroids by shooting them. Priority: must-have
- FR-040: The game can maintain scattered asteroids and an outer asteroid belt. Priority: must-have
- FR-041: The game can provide one orbital cargo outcome in each five small asteroids a player destroys with a weapon. Priority: must-have
- FR-042: A player can keep an independent commodity cost basis in each commodity holder. Priority: must-have
- FR-043: A player can transfer commodities between their ship and nearby orbital cargo. Priority: must-have
- FR-044: A player can collect loose commodities into their ship. Priority: must-have
- FR-045: The game can remove commodities and their associated cost basis when they are permanently lost. Priority: must-have

### Authentication and persistence

- FR-046: A player can sign in to access persistent features. Priority: must-have
- FR-047: A player can inspect their authentication status. Priority: must-have
- FR-048: A signed-in player can sign out. Priority: must-have
- FR-049: The game can automatically preserve progress for a signed-in player. Priority: must-have
- FR-050: A signed-in player can inspect the current save status. Priority: must-have
- FR-051: The game can remove an active save after its run reaches a terminal outcome. Priority: must-have

### High scores

- FR-052: A signed-in player can view their personal best result. Priority: must-have
- FR-053: A player can view the global high-score table. Priority: must-have
- FR-054: A signed-in player can clear their personal best result. Priority: must-have

### Gameplay audio

- FR-055: A player can hear gameplay audio feedback. Priority: must-have

## Non-Functional Requirements

- The game remains usable in currently supported desktop and mobile browser releases.
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

- BR-001: A new run starts in orbit around Seroton with full HP, cargo capacity of 40 units, a level-one engine at 100% base speed, a level-one weapon that fires one projectile per shot, and a locked booster.
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

### Solar system and flight

- BR-018: The navigable world contains a central sun and the planets Seroton, Lactozis-7C, and Maslo-Prime.
- BR-019: Each planet follows its own configured orbit around the sun at its configured speed while the clock is running.
- BR-020: Remote planetary information is limited to planet identity and position.
- BR-021: All configured planetary orbital paths remain visible as dashed world references throughout flight and landing lifecycle transitions.
- BR-030: Entering a planet's capture zone automatically places the ship into orbit.
- BR-031: While inside the orbit zone, the ship inherits the planet's displacement as the planet moves.
- BR-032: Flying beyond the orbit zone detaches the ship from the planet without moving the detached ship with it.
- BR-033: Landing is available only while the ship is in the planet's orbit zone.
- BR-034: Launching places the ship back into the planet's orbit zone.
- BR-035: Travel uses direct ship control and has no destination-selection or automated-travel sequence.
- BR-036: The booster is initially locked and can be purchased once for 75,000 credits at the Lactozis-7C shipyard, independently of the engine upgrade level.
- BR-037: An unlocked booster requires active thrust, reaches five times the level-one base speed regardless of engine upgrades, consumes no resource, and prevents firing while active; boosted speed makes collision avoidance and maneuvering more difficult.

### Damage, combat, and asteroids

- BR-038: A discrete sun impact removes 80% of maximum HP and pushes the ship clear of the sun.
- BR-039: Sun damage cannot trigger again until the ship has separated from the previous contact.
- BR-040: A collision between an asteroid and the ship or a planet fragments the asteroid according to its size; ship damage remains a separate S-07 rule and is not changed by asteroid fragmentation.
- BR-041: A large asteroid hit by a projectile, ship, or planet produces a configured deterministic number of medium fragments.
- BR-042: A medium asteroid hit by a projectile, ship, or planet produces a configured deterministic number of small fragments.
- BR-043: A small asteroid hit by a projectile, ship, or planet disappears without fragments.
- BR-043a: An asteroid that reaches Moolaris disappears without fragments.
- BR-044: Weapon level one fires one projectile per shot, and each purchased weapon level adds one simultaneous projectile, up to weapon level ten.
- BR-044a: Odd projectile counts use one forward projectile and mirrored pairs at ±2.5°, ±7.5°, ±12.5°, and each subsequent offset 5° farther out; even projectile counts use mirrored pairs at ±5°, ±10°, ±15°, and each subsequent offset 5° farther out. These specified patterns take precedence over a requirement for angular width to increase at every level.
- BR-045: Scattered asteroids follow configured drifting paths while the clock is running.
- BR-046: Asteroids in the outer belt orbit beyond Maslo-Prime's orbital path while the clock is running.
- BR-047: Scattered and belt populations replenish toward their configured targets while the clock is running.

### Asteroid salvage

- BR-048: On the first final projectile hit on a small asteroid in each five-hit cycle, the game uses the seeded run randomness to place one cargo marker in a five-entry zero table; the cycle produces exactly one orbital cargo outcome, and each non-cargo outcome independently has a 10% probability of producing one loose commodity.
- BR-049: Asteroids destroyed by any non-projectile interaction do not produce salvage.
- BR-050: Asteroid-spawned orbital cargo contains one distinct commodity 50% of the time, two distinct commodities 25% of the time, or three distinct commodities 25% of the time; each commodity quantity is from one through five with a zero cost basis.
- BR-051: An orbital cargo holds a non-empty manifest of unique commodity stacks whose combined quantity never exceeds twenty units. Each ship commodity container, orbital cargo stack, and loose-item container keeps a separate quantity and total cost.
- BR-052: A commodity container's displayed average cost equals total cost divided by quantity when quantity is positive.
- BR-053: A paid purchase adds its paid total to the receiving ship container.
- BR-054: A free pickup adds quantity but no cost to the receiving ship container.
- BR-055: A partial transfer or loss removes quantity and proportional cost from its source container.
- BR-056: A complete transfer or loss removes the source container's exact remaining total cost.
- BR-057: Destroying orbital cargo spills each remaining unit as an independent loose item, with each stack's cost allocated proportionally and the final unit of each stack receiving any residual.

### Planetary services, upgrades, and economy

- BR-069: Seroton provides the current market after landing; other planetary markets are outside the current slice.
- BR-070: Live market stock, prices, shipyard services, and facilities are unavailable remotely.
- BR-071: Repairs are purchased in player-selected increments of 10% maximum HP at a configured fixed cost per increment.
- BR-072: A repair cannot exceed missing HP or available credits.
- BR-073: Seroton sells cargo-capacity upgrades with capacities of 40 units at level one, 50 at level two, 65 at level three, 85 at level four, and 110 at level five.
- BR-074: Lactozis-7C sells engine upgrades with normal maximum speeds of 100% at level one, 110% at level two, 120% at level three, 135% at level four, and 150% at level five.
- BR-075: Maslo-Prime sells weapon upgrades from level one through level ten; each level adds one projectile to each shot.
- BR-076: Cargo, engine, and weapon upgrades are independent progression paths sold at their respective planets; buying a level in one path does not require a level in another, and each path exposes its next level only after the current level is purchased.
- BR-077: Ship upgrade prices are fixed as follows; each price is paid to reach the listed level.

| Upgrade path | Level 2 | Level 3 | Level 4 | Level 5 | Level 6 | Level 7 | Level 8 | Level 9 | Level 10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Cargo capacity | 15,000 cr | 30,000 cr | 60,000 cr | 120,000 cr | — | — | — | — | — |
| Engine speed | 20,000 cr | 40,000 cr | 80,000 cr | 160,000 cr | — | — | — | — | — |
| Weapon system | 20,000 cr | 30,000 cr | 40,000 cr | 50,000 cr | 60,000 cr | 70,000 cr | 80,000 cr | 90,000 cr | 100,000 cr |
- BR-078: Seroton maintains independent stock for supplies, alloys, and medicines; other planetary markets are outside the current slice.
- BR-079: Scheduled Seroton market updates occur every second of active game time.
- BR-080: Each scheduled update applies operating facility production, consumption, and transformation to the planet's shared commodity stock without allowing stock below zero.
- BR-081: A commodity's local price is derived from local stock, configured stock thresholds, and configured base price.
- BR-082: Below the lower threshold, the price multiplier scales linearly from 200% at zero stock to 100% at the threshold.
- BR-083: Between the lower and upper thresholds, the price multiplier remains at 100%.
- BR-084: Above the upper threshold and below the combined thresholds, the multiplier scales linearly from 100% to 50%.
- BR-085: At or above the combined thresholds, the price multiplier remains at 50%.
- BR-086: Unit price equals configured base price multiplied by the current multiplier and rounded to an integer.
- BR-087: A transaction sums the rounded marginal unit prices recalculated after each one-unit stock change in its direction.
- BR-088: Buying decreases market stock, decreases credits, and increases cargo immediately.
- BR-089: Selling increases market stock, decreases cargo, and increases credits by its gross marginal value immediately.
- BR-090: Seroton market transactions have no sales tax.
- BR-091: A transaction recalculates subsequent prices after applying its complete stock change.
- BR-092: Buying cannot exceed credits, market stock, or cargo capacity, and selling cannot exceed carried cargo.
- BR-093: Starting credits, commodity values, stock thresholds, initial stock, production, consumption, taxes, repair costs, asteroid values, and salvage values remain balance parameters; ship upgrade capacities, speeds, level limits, and prices are specified in BR-073–BR-077.
- BR-094: A planet hosts and maintains multiple facilities that can produce, consume, or transform commodities.
- BR-095: A player may inspect, construct, or improve a planet's facilities only while landed at that planet.
- BR-096: Constructing or improving a facility consumes its required resource investment and changes the planet's facility structure.
- BR-097: An operating facility changes local commodity supply or demand through its production, consumption, or transformation activity.
- BR-098: A planet's characteristics adjust the effectiveness of each local facility.
- BR-099: A facility operates only when its required resources are available.

### Authentication, persistence, and scores

- BR-100: Anonymous play does not create persistent saves, personal results, or global submissions.
- BR-101: Successful sign-in during an anonymous active run immediately attaches that run to the player and saves it.
- BR-102: A signed-in run saves when the player lands.
- BR-103: Departure saves only when trading, repairs, upgrades, facility construction, or facility improvements changed persisted state while landed since the landing save.
- BR-104: Unsaved flight progress after the last successful save boundary may be lost when the application closes.
- BR-105: Freedom, imprisonment, death, and abandonment outcomes are always persisted for a signed-in player.
- BR-106: Starting a new signed-in run while another run remains active first abandons and retains the previous run.
- BR-107: A resumed run restores the saved remaining active time and all state required to continue consistently.
- BR-108: A completed run cannot be resumed as active gameplay.
- BR-109: After a signed-in run reaches a terminal outcome and its result is retained, its active save is removed.
- BR-110: Personal history retains every signed-in result across all outcomes except results the player explicitly clears.
- BR-111: Personal best is the retained result with the highest final liquid-cash score regardless of outcome.
- BR-112: Clearing a personal best removes that result from the signed-in player's personal history; the highest remaining retained result becomes the personal best, or no personal best is shown when none remains.
- BR-113: A global result is eligible only when an authenticated player survives the complete active-time limit and receives freedom.
- BR-114: Global results are ranked by final liquid cash before debt repayment.
- BR-115: Anonymous and signed-in players can view the global high-score table, but only signed-in players can submit eligible results or view or clear a personal best.

## Access Control

The game is available anonymously without creating an account. Anonymous players can complete the full gameplay loop and view global high scores, but their active runs and results are not persisted.

Google OAuth is the only sign-in method. Sign-in may occur before a run or during an anonymous active run. A successful mid-run sign-in attaches and saves the current run immediately. Signed-in players can access only their own active save, result history, and personal best. They cannot read or modify another player's private data.

A signed-in player can sign out from the main menu without deleting their saved data. A signed-in player can clear only their own personal-best result; this operation cannot change another player's records or global results.

Global high scores are publicly readable. Only authenticated, eligible freedom outcomes can be submitted. All signed-in players have the same permissions; the MVP has no administrative or multiplayer roles.

## Non-Goals

- The MVP does not include turn-based travel, turn counters, selected destinations, or automated travel animations because navigation uses direct ship control and active time.
- The MVP does not include multiplayer or a shared market because every run has an independent economy and world state.
- The MVP does not include an endless mode because the debt outcome depends on the thirty-minute active-time limit.
- The MVP does not include planetary locations beyond markets, shipyards, and facilities.
- The MVP does not expose live prices, stock, or shipyard services before landing.
- The MVP does not include hull-capacity upgrades, ammunition resources, booster fuel, or automated ship steering.
- The MVP does not award credits directly from salvage crates; salvaged commodities must be sold through a market.
- The MVP does not include damaging or chain-reacting crate explosions.
- The MVP does not include cargo value or ship value in final score.
- The MVP does not defer personal or global high scores; both are required capabilities.

## Open Questions
