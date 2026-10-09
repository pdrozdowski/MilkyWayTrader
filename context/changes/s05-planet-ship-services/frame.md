# Frame Brief: S-05 Ship Services and Upgrade Progression

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

The user asked to include a detailed ship-upgrade specification in the S-05 framing and stated that the starting cargo capacity should be 40 units, requiring a PRD update. No runtime failure was reported.

## Initial Framing (preserved)

- **User's stated cause or approach**: No cause was stated. The user proposes three independent upgrade paths—Cargo Capacity, Engine Speed, and Weaponary System—sold on separate planets, with sequential level purchases. The booster belongs to engine services but is a separate purchase.
- **User's proposed direction**: Add the supplied progression, effects, weapon spread, and booster rules to this frame; update the PRD to define the 40-unit starting cargo capacity.
- **Pre-dispatch narrowing**: The earlier scope questions were unanswered. The user's follow-up now specifies the paths and baseline; subsequent answers clarify projectile angles and parity, and booster price, availability, and speed.

## User-Specified Ship Service Model

The starting ship has 40 cargo units, 100% normal base speed, and one forward projectile per shot. Cargo, engine, and weapon levels are independent; a player can specialize in any path. A level's purchase unlocks only the next level in that path.

| Level | Cargo capacity | Cargo upgrade cost | Normal engine speed | Engine upgrade cost |
| --- | ---: | ---: | ---: | ---: |
| Base / Lv1 | 40 | — | 100% | — |
| Lv2 | 50 | 15,000 cr | 110% | 20,000 cr |
| Lv3 | 65 | 30,000 cr | 120% | 40,000 cr |
| Lv4 | 85 | 60,000 cr | 135% | 80,000 cr |
| Lv5 | 110 | 120,000 cr | 150% | 160,000 cr |

Cargo upgrades increase commodity capacity per trip. Engine upgrades increase normal flight speed and the potential number of deliveries within the same economic period. The planet assignments already in the PRD are Seroton for cargo, Lactozis-7C for engine and booster services, and Maslo-Prime for weapons.

The Weaponary System starts at Lv1 with one projectile and supports levels through Lv10. Each purchased level adds one simultaneous projectile. The purchase to Lv2 costs 20,000 cr; each subsequent level costs 10,000 cr more than the previous one, ending at 100,000 cr for Lv10. Weapon upgrades improve asteroid combat and the player's opportunity to salvage asteroids.

The clarified spread rules use degrees. Odd projectile counts have one projectile travelling forward and the remainder in mirrored pairs at ±2.5°, ±7.5°, ±12.5°, continuing in 5° steps. Even projectile counts consist only of mirrored pairs at ±5°, ±10°, ±15°, continuing in 5° steps. Thus Lv2 fires at ±5°; Lv3 fires forward and at ±2.5°. These clarified parity rules supersede the initial wording that left unmatched shots in both patterns. The user confirmed that the specified angles take precedence and total angular width does not need to increase at every level.

The booster is a separate one-time purchase for 75,000 cr at Lactozis-7C, available regardless of engine level. While active under manual thrust, it reaches a fixed 5× the Lv1 base speed; engine upgrades do not change that boost speed. Boosting is intentionally harder to maneuver and increases collision risk.

## User-Specified Shipyard Layout and Repair Interaction

The Shipyard is a presentation-local landing view. Its top navigation reuses the same components, layout, styles, and behavior as the existing Market and Facilities views: Back to Planet and paused clock on the left; credit balance and cargo usage on the right. Back returns to the landing hub without launching; Launch remains the action that ends landing.

The upper area retains the planet-themed background. The lower Shipyard area identifies the landed planet and contains a repair card, three upgrade cards, and a booster row. At Seroton, Cargo Capacity is actionable while Engine System and Weapon System state their service planets and are unavailable. The booster row identifies its fixed 5x base-speed effect and Lactozis-7C availability. The corresponding planet-specific view makes its eligible purchase actionable while keeping other service paths visibly unavailable.

The repair card shows ship icon, current/max HP and health bar, a +10% control, and `REPAIR 1,000`. Each purchase costs 1,000 credits and restores 10% of maximum HP, capped at maximum HP: 75/100 becomes 85/100 after one purchase. Repair is disabled at full HP or when credits are insufficient. A completed repair immediately updates HP, health bar, and balance.

No Shipyard UI value displays a currency-unit suffix: this applies to the balance, repair price, upgrade prices, and booster price. The 1,000 repair price remains a balance parameter.

## Dimension Map

The proposed scope could be affected by these dimensions:

1. **PRD and balance definition** — the catalogue, starting values, prices, or progression may be underspecified or conflict with the requested values.
2. **Shipyard integration** — the landed service may lack access to repairs and the three purchase paths.
3. **Flight and weapon behavior** — engine progression, booster speed, and projectile geometry may not agree with existing movement and combat rules.
4. **Slice boundary** — ship services may be conflated with facility investment or the wider market simulation.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Existing PRD and code already define the requested upgrade model | Before this update, the PRD specified level-one cargo without a capacity and left upgrade values configurable (prior BR-001 and BR-077). The balance set cargo Lv1 to 20 units (`src/game/domain/runBalance.ts:4-6`); normal speed was a fixed 240 (`src/game/definitions/gameplayTuning.ts:1`); no ship-upgrade purchase operations were found. | STRONG evidence of a specification and implementation gap |
| The S-05 work should include S-16 facility investment | The roadmap assigns S-05 to ship repair/upgrades and S-16 to facilities; PRD FR-024–026 and FR-027–032 preserve that split (`context/foundation/roadmap.md:47,138-148`; `context/foundation/prd.md:202-210`). | NONE |
| The requested services are absent from the landed player flow | The Shipyard button is disabled and labelled unavailable (`index.html:77`; `src/ui/components/landingStatus.ts:183-185`). The landing adapter has trade/facility actions but no ship repair or upgrade purchases (`src/ui/adapters/landingStatusAdapter.ts:130-145`). | STRONG |
| Weapon spread must grow at every level | Lv2 spans 10° (±5°), while Lv3 spans 5° (center plus ±2.5°). The user explicitly confirmed that the provided angle patterns take precedence and need not grow monotonically; PRD BR-044a records that decision. | NONE |
| Booster behavior remains unclear after clarification | The user confirmed a fixed 5× Lv1 base speed and a one-time 75,000 cr purchase at Lactozis-7C independent of engine level; the PRD now records that rule (`context/foundation/prd.md:296-297`). | NONE |

## Narrowing Signals

- User clarification places the upgrades on independent planet-specific paths and establishes exact capacities, speeds, and prices.
- The spread rule now has degree units and a complete symmetric pairing rule. The booster has an explicit fixed speed basis and purchase gate.
- The spread's total angular width narrows from Lv2 to Lv3, but the user confirmed that the specified parity patterns take precedence over monotonic width growth; no spread question remains open.
- The PRD now records the 40-unit starting capacity and the full upgrade/booster rules. The current balance and flight/combat implementation still do not implement those values.
- S-16 remains a separate, completed facility-investment slice; weapon upgrades can affect asteroid combat and salvage opportunities without absorbing S-08/S-09's core rules.

## Cross-System Convention

S-04 created a landed service hub and deliberately left Shipyard unavailable; current application actions support trade and facilities. The ship state already records cargo, engine, and weapon levels plus booster availability (`src/game/state/shipStatusState.ts:1-7`), but the current cargo balance is 20 units at Lv1, movement uses fixed tuning, and each shot currently creates one forward projectile (`src/game/mechanics/gameSimulation.ts:183-190`). The confirmed service model fits the landed-service boundary while leaving facilities separate.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Deliver S-05's landed shipyard services for repairs and three independent planet-specific upgrade paths, with the user's exact progression, costs, projectile spreads, and separate fixed-speed booster unlock.

The previous framing identified the right S-05 boundary but did not capture the required progression details. The PRD now contains those requirements, including the 40-unit baseline, the clarified booster rule, and the user's decision that parity-specific weapon angles take precedence over monotonic spread growth. The current game still exposes an unavailable Shipyard and does not apply the requested progression.

## Confidence

- **HIGH** — the user supplied the missing product values and resolved both the projectile-pattern priority and booster basis; the roadmap, PRD, and current implementation establish the boundary and gap.

## What Changes for /10x-plan

Plan S-05 around repairs plus the exact Cargo, Engine, and Weaponary System paths and the separate 75,000 cr booster purchase. Keep facility investment in S-16; use the confirmed parity-based degree patterns even when total angular width narrows at an odd level, and integrate weapon levels with existing combat/salvage behavior without expanding those separate slices.

## References

- Requirements: `context/foundation/prd.md:266,296-309,333-350`.
- Roadmap boundary: `context/foundation/roadmap.md:47,138-148`.
- Existing values and behavior: `src/game/domain/runBalance.ts:4-6`; `src/game/definitions/gameplayTuning.ts:1-18`; `src/game/mechanics/gameSimulation.ts:96-111,183-190`; `src/ui/components/landingStatus.ts:183-185`; `src/ui/adapters/landingStatusAdapter.ts:130-145`.
- Prior landing-service boundary: `context/archive/2026-09-26-s04-first-planetary-trade/plan.md:21-24,222`.
- Investigation tasks: `upgrade_balance`, `weapon_spread`, `engine_booster`, `scope_boundary`, `service_location`, `landing_integration`.
