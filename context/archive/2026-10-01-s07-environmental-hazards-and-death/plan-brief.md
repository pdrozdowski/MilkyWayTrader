# S07 Environmental Hazards and Death — Plan Brief

> Full plan: `context/changes/s07-environmental-hazards-and-death/plan.md`
> Frame brief: `context/changes/s07-environmental-hazards-and-death/frame.md`
> Research: `context/changes/s07-environmental-hazards-and-death/research.md`

## What & Why

Create an authoritative environmental-hazard and death lifecycle that applies deterministic asteroid and sun damage to HP, resolves zero HP once into a frozen death result, presents that result, and retains every terminal result with its outcome, survival time, and final liquid cash—without implementing a global-score table or active-save deletion.

The player must see dangerous space as a real gameplay consequence, then receive an unambiguous ending rather than continuing with a destroyed ship.

## Starting Point

Asteroid collision currently creates fragmentation, knockback, sound, and a presentation timestamp while preserving HP. Moolaris removes control but has no damage/rearm fact. The snapshot, `GameOver`, and Supabase schema have no terminal-result contract; Supabase currently persists only expiring telemetry.

## Desired End State

Each hazard applies the agreed seeded damage, and zero HP becomes a one-time `death` result with canonical active time and cash. The scene hides all controls, plays a two-second destruction sequence of three flaming ship fragments and a black fade, then presents the final result. Signed-in players retain a private result and can retry a failed delivery safely.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Asteroid damage | SMALL 5–10, MEDIUM 10–20, BIG 15–30 inclusive | Size remains meaningful while damage stays bounded. | Plan |
| Collision aggregation | First ordered asteroid contact per tick | Matches existing collision ordering and avoids unpredictable stacking. | Plan |
| Sun rule | Control-radius entry; HP ≥30 → 5–10, HP <30 → 0; exit re-arms | Gives one clear hit per entry. | Plan |
| Randomness | Per-run seed persisted in snapshot | Runs vary while restore and tests remain reproducible. | Plan |
| Retention | Signed-in private RLS result; retry by run ID | Matches PRD identity policy without duplicate writes. | Frame / Plan |
| Death presentation | 2 s, three flaming fragments, explosions, black fade, hidden UI | Gives death a deliberate visual endpoint before the result. | Plan |
| Browser proof | Asteroid teleport, HP decrease each attempt, death within 10 attempts | Exercises the real browser/Phaser/Supabase path with a hard failure bound. | Plan |

## Scope

**In scope:**

- Seeded hazard damage, frozen terminal death state, result persistence, death animation, result screen, HP color bands, and one browser journey.

**Out of scope:**

- Global highscores, anonymous storage, active-save deletion, and non-death terminal outcomes.

## Architecture / Approach

`new run → seeded snapshot → pure hazard reducer → immutable terminal result → scene death projection → GameOver + ResultStorePort → private run_results row`

The snapshot retains gameplay facts only. Browser/Supabase delivery is behind an application port; temporary visual objects and retry status remain outside authoritative state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Contracts | Seeded damage and frozen terminal state | Codec/schema coherence |
| 2. Retention | RLS-backed private result storage | Owner isolation and retry idempotency |
| 3. Presentation | Death sequence, result screen, HP bands | Scene/UI lifecycle cleanup |
| 4. Browser proof | Bounded asteroid-teleport journey | Real cross-layer reliability |

**Prerequisites:** Existing local Supabase/Docker and Chromium are required only for the final browser journey.
**Estimated effort:** ~3–5 focused implementation sessions across four phases.

## Open Risks & Assumptions

- Integer endpoints for all random ranges are inclusive.
- The existing Moolaris control radius is the selected hazard boundary.
- Client-authored scores are appropriate for private retention at this stage; anti-cheat validation remains a later concern.

## Success Criteria (Summary)

- A hit changes HP according to the deterministic rules and death cannot advance the run or create a duplicate result.
- The player sees the exact two-second destruction transition, then canonical survival time and cash.
- The authenticated Playwright journey confirms every asteroid teleport lowers HP and reaches death within ten attempts; otherwise it fails explicitly.
