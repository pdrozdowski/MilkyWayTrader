# Anonymous Run Status — Plan Brief

> Full plan: `context/changes/anonymous-run-status/plan.md`

## What & Why

S-01 establishes the first coherent anonymous-run contract. The player receives a readable status for the clock and essential resources, while later slices gain a safe authoritative state foundation for trading, damage, upgrades, outcomes, and persistence.

## Starting Point

The game already starts a playable scene with a 30-minute active-time clock and a versioned in-memory state provider. It lacks credits, cargo, HP, system levels, and booster availability, exposes only a canvas clock, resets state inside scene creation, and currently allows boost despite the PRD's initial lock.

## Desired End State

`Start New Game` explicitly creates a schema-v3 run with `30:00 · RUNNING`, `100,000 cr`, `Cargo 0 / 20`, and `HP 100 / 100`. A semantic DOM panel exposes level-one systems and empty cargo on demand, the booster is visibly and mechanically locked, and v1/v2 snapshots migrate safely.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Starting values | 100,000 credits, 100 HP, 20 cargo | Clear configurable baselines for later balancing |
| Presentation | Semantic DOM panel | Accessible content and stable behavior assertions |
| Information density | Critical row always visible; details collapsed | Preserves flight readability without hiding inspectable state |
| Language | English labels | Matches the existing HUD and product document |
| Availability | Current usability | Avoids pulling planet shop offerings from S-05 into S-01 |
| Booster | Authoritatively locked | Keeps visible status and simulation behavior consistent |
| New-run reset | Explicit menu action | Leaves future resume able to enter `Game` without destructive reset |
| Panel lifecycle | Active-scene presentation gate | Avoids prematurely designing terminal lifecycle state |
| Migration | v1/v2 → v3 defaults | Preserves codec and restore continuity |

## Scope

**In scope:**

- Schema-v3 authoritative credits, cargo, HP, system levels, and booster lock.
- Configurable starting values and derived capacity/maximum display values.
- Explicit new-run reset and simulation boost gating.
- Deduplicated run-status selector, port, adapter, and responsive DOM component.
- Domain, mechanics, component, Playwright, build, typecheck, and architecture-artifact verification.

**Out of scope:**

- Trading, repairs, purchases, booster unlocking, and economy balancing.
- Damage, terminal outcomes, authentication, persistence, and resume.
- Orbit and landing mechanics.

## Architecture / Approach

`Start New Game → GameStateProvider v3 → pure RunStatus projection → Phaser adapter → RunStatusPort → DOM component`

Primary gameplay values remain in readonly JSON-safe state. Maximum HP, cargo capacity, remaining time, formatting, and visibility are derived. Components depend only on UI contracts; adapters own Phaser integration.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. State and rules | Schema v3, migrations, explicit reset, booster lock | Preserving strict restore compatibility |
| 2. DOM status | Deduplicated projection and accessible panel | Readability and control overlap on small screens |
| 3. Validation | E2E acceptance and refreshed architecture artifacts | Catching cross-layer regressions |

**Prerequisites:** Existing `GameStateProvider`, codec, UI adapter/component boundary, and Playwright harness.

**Estimated effort:** Medium; three incremental implementation phases.

## Open Risks & Assumptions

- Cargo starts empty; commodity stacks use stable non-empty IDs and positive quantities.
- “Availability” means current usability, not availability for purchase.
- Expansion state is local presentation state and is not persisted.
- DOM notifications are deduplicated because provider publication occurs at frame rate.
- Starting values are configuration and may be rebalanced during S-04/S-05.

## Success Criteria (Summary)

- A new anonymous run exposes every agreed initial value and inspectable system status.
- Locked booster behavior, pause/resume, scene visibility, and historical migration are correct.
- Full tests, build, typecheck, and architecture graph validation pass with no `REFACTOR_REQUIRED`.
