# Read-Path Serialization Removal — Plan Brief

> Full plan: `context/changes/bug01-state-commit-issue-fix/plan.md`
> Frame brief: `context/changes/bug01-state-commit-issue-fix/frame.md`

## What & Why

The frame is capped by the state read path, not by gameplay: every read stringifies, re-parses,
re-validates and deep-clones the whole aggregate, ten times per frame, which put 41.28 ms into a
67.99 ms frame and the game at 14.7 loops/second. Serialization belongs at the persistence boundary,
so the in-memory path stops doing it.

## Starting Point

`GameStateProvider` owns a deeply frozen aggregate and hands out an encoded-then-decoded copy per
read; three UI adapters re-read and re-project on every publish, two of them twice per frame, and the
landed adapter projects even while the ship is in flight. The debug performance monitor from the
previous change is the measuring instrument and already recorded the baseline.

## Desired End State

Reads cost nothing, a commit still validates and still yields a new frozen object, and the panels do
no per-frame projection work that cannot have changed. The panel then shows `state-snapshot` at
~0 ms and loops/second roughly 2.5-3x the baseline on the same machine.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Problem framing | Read-path serialization caps the frame rate | The panel's own unit price times the read count accounts for the update phase, and two `step` reads predict the measured surplus | Frame |
| Read contract | Return the frozen state, no copy | The state is already deeply frozen at the write boundary and no consumer compares identity | Plan |
| Commit validation | Keep one validating decode per commit | Keeps the boundary honest for about 1.6 ms instead of about 7.5 round trips | Plan |
| Fan-out scope | Included, as content-driven gating | The two `step` refreshes are redundant and the landed projections cannot change in flight | Plan |
| Refresh mechanism | No timers; content-driven gates | A time-based gate would let displayed values lag a frame | Plan (assumption) |

## Scope

**In scope:** provider read contract and its tests; deletion of the two `step` refreshes; landing
adapter idle-in-flight gating; a verification record with before/after readings.

**Out of scope:** schema or persisted-format change; save/restore work (S-11); reducer, economy,
telemetry or gameplay change; DOM/CSS/panel change; new dependency, script or Playwright coverage;
timer-based refresh cadence.

## Architecture / Approach

The application-layer provider keeps ownership of state and validation, with serialization confined
to the codec's save/restore functions. UI adapters keep their ports and dedup behaviour and simply
stop doing work that cannot have changed. Nothing new is introduced; the change is subtractive
except for the verification record.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Free reads | Serialization-free read path with the write boundary still validating | A stray copy or an unfrozen object smuggled onto the read path |
| 2. Stop the wasted fan-out | Two redundant refreshes gone, landed projections idle in flight | A displayed value or the transfer modal losing responsiveness |
| 3. Validate and record the gain | Same-host before/after evidence in the change's verification file | The measured gain not materialising, indicating a surviving copy |

**Prerequisites:** none beyond the existing toolchain; the monitor from the previous change for the
manual reading.
**Estimated effort:** roughly one session across three phases.

## Open Risks & Assumptions

- The fan-out mechanism is a recorded planning decision (content-driven gating, no timers); a capped
  HUD cadence would change Phase 2.
- Expected gain (~40 loops/second) assumes the same host and no other bottleneck; the only evidence
  is manual measurement with the panel.
- Tests that describe a snapshot as "detached" will be reworded; the codec's JSON round trips stay
  required for save and restore.

## Success Criteria (Summary)

- With the monitor on at the same spot, the read row collapses and loop rate rises materially from
  the 14.7 baseline.
- Nothing a player sees changes: HUD, landing panels, trade, cargo transfer and the death flow all
  behave as before.
- Save/restore semantics are untouched and still prove round-trip correctness in tests.
