# Terminal Scores and Global High Scores — Plan Brief

> Full plan: `context/changes/s13-global-high-scores/plan.md`
> Frame brief: `context/changes/s13-global-high-scores/frame.md`
> Research: `context/changes/s13-global-high-scores/research.md`

## What & Why

The current result contract records final cash, which does not represent the full value created during a run. This change defines a shared terminal score, explains its components to the player, and lets signed-in players compare their best result globally.

## Starting Point

The game has v18 authoritative state, acquisition costs on cargo, private per-run results based on final credits, and a Personal Best dialog. It has no cumulative upgrade spend counters or public global-score store, and currently emits a death result.

## Desired End State

Every terminal run produces one rounded score from ending cash, cargo acquisition cost, and eligible upgrade/facility spending. Players can view the top global ranks from main or end-game menus; each signed-in player's single global row updates only when a higher score arrives, and their private Personal Best's global rank is shown separately.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Terminal eligibility | Compare every end-game reason | The user explicitly wants the shared end-game check to ignore reason. | Plan |
| Score formula | Cash + cargo acquisition cost + ship/booster spend + facility build/upgrade spend; round total once | This measures the requested run value with cargo `totalCost` already available. | Plan / Research |
| Spending | Count successful purchases at actual paid price; exclude repairs, trades, refunds | Counters should reflect cumulative qualifying spend without undoing historical purchases. | Plan |
| Global row | One row/player; update strictly higher scores only | Lower/equal runs must preserve the existing best. | Plan |
| PB position | Rank the exact private Personal Best against other players | Private PB can differ from the current global row. | Plan |
| Rank display | Competition ranks and include ties at rank 100 | Tied players share a place and should not be silently omitted. | Plan |
| Legacy results | Leave without composite score and exclude them from PB | The user will clear old records manually; no conversion is wanted. | Plan |
| Snapshot | Move to v19 without migration | Runs are not long-term saved; stale OAuth return snapshots use current recovery. | Research / Plan |

## Scope

**In scope:**

- PRD reconciliation, authoritative spend counters, v19 codec, shared terminal score and end-game breakdown.
- Composite private PB score, one-row global best persistence, safe public leaderboard and PB-rank queries.
- Retryable private/global writes and global leaderboard access from main and end-game menus.
- Focused unit, database integration, component, and one admitted browser-flow validation.

**Out of scope:**

- Future terminal outcome producers, automatic save/resume, v18 migration, legacy result conversion/deletion, server-side simulation/anti-cheat, production deployment.

## Architecture / Approach

The authoritative aggregate tracks paid spend and the shared result application layer computes the terminal score. Private run history keeps raw cash plus a nullable composite score for legacy compatibility. A separate authenticated global store maintains one best row per player; constrained queries expose only public display fields and compute the actual private PB rank. UI components follow Personal Best patterns, and joint writes share retry/status behavior.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Score contract and terminal result | PRD, spending state, score calculator, end-game breakdown | Counter placement and schema-version boundary |
| 2. Private and global persistence | Composite PB, safe public leaderboard, strict-better update and retries | Partial writes and privacy/rank correctness |
| 3. UI and full-flow validation | Both menu entry points, board, PB rank, local browser journey | Cross-layer auth/database wiring |

**Prerequisites:** S-12 is done. S-13 proceeds independently of proposed S-11 and S-06; later outcome producers can use the shared path.
**Estimated effort:** Several focused implementation sessions across three phases.

## Open Risks & Assumptions

- MVP trusts validated client-computed scores; there is no server simulation to independently verify score claims.
- Only death currently produces a terminal result; future outcome producers are outside this slice.
- An OAuth return carrying an old v18 snapshot is discarded through existing invalid-snapshot recovery after the version change.

## Success Criteria (Summary)

- End-game displays an auditable breakdown and persists the same score in private and global records.
- Each player has at most one global record, changed only by a strictly higher score, with safe public top-rank and private PB-rank views.
- Both requested menu entry points work, and selected domain, database, type, component, and browser checks pass.
