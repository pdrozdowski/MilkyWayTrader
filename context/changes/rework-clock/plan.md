# Compact HUD Clock Presentation Implementation Plan

## Overview

Replace the HUD clock's visible `RUNNING`/`PAUSED` text with state-specific
icons while retaining the `MM:SS` countdown. The change is presentation-only:
the authoritative clock, pause reasons, snapshots, and persistence remain
unchanged.

## Current State Analysis

The HUD clock already contains a decorative running icon and value span
(`index.html:24`). `mountRunStatus` formats and displays
`MM:SS · RUNNING|PAUSED` (`src/ui/components/runStatus.ts:18-21,46-49`), while
the application projection already supplies `remainingSeconds` and `runState`
from authoritative clock state (`src/game/application/runStatus.ts:24-30`).

The clock inherits a card border, background, radius, and padding from
`public/style.css:80,84,250`. A comparable DOM animation uses a 500 ms interval
and clears it on component destruction (`src/ui/components/landingStatus.ts:50-55,166-179`).

## Desired End State

The active HUD shows the existing running-clock icon next to `MM:SS`. A paused
HUD starts on the first supplied paused-clock icon and alternates the two
paused assets every 500 ms. The clock has no separate card background, frame,
or padding, and exposes its current time and state through a non-live
accessible name.

### Key Discoveries:

- The existing run-status adapter deduplicates identical snapshots, so a paused
  animation must be UI-local rather than driven by state updates
  (`src/ui/adapters/runStatusAdapter.ts:13-23`).
- The supplied running and paused image assets already exist under
  `public/assets/icons/`.
- Existing desktop and mobile Playwright journeys exercise real pause/resume
  wiring, but assert the text being removed (`tests/ui/applicationDesktopUiTest.ts:9,17,20`; `tests/ui/applicationMobileUiTest.ts:9,18,22,30,33`).

## What We're NOT Doing

- Changing `GameClockState`, pause reasons, snapshots, codec behavior, or game
  simulation.
- Adding a live region or announcing each one-second countdown update.
- Adding Playwright coverage for timer cadence or timer cleanup.
- Changing any non-HUD clock-related UI.

## Implementation Approach

Create a small DOM-free presentation controller with an injected interval
scheduler. It owns paused-frame selection and cleanup, while `mountRunStatus`
applies its output to the existing image, visible countdown, and accessible
name. This enables exact fast tests for the 500 ms cadence and cleanup, while
the existing Playwright journeys retain browser-level pause/resume coverage.

## Critical Implementation Details

The controller must have at most one paused interval. It must immediately
restore the running icon and clear the interval on resume, hide, and destroy;
stale callbacks after cleanup must not mutate the icon. The clock remains a
noninteractive semantic timer with a dynamic, non-live accessible name rather
than exposing the icon itself as meaningful content.

## Phase 1: Implement and verify compact clock presentation

### Overview

Deliver the state-icon HUD presentation, deterministic animation lifecycle,
compact styling, and proportionate regression coverage as one coherent change.

### Changes Required:

#### 1. Clock presentation controller

**File**: `src/ui/components/runStatusClock.ts` (new)

**Intent**: Isolate icon selection, the requested 500 ms paused-frame cadence,
and lifecycle cleanup from DOM rendering so the behavior is deterministic and
does not alter authoritative clock state.

**Contract**: Accept remaining seconds and `RunState` plus an injected interval
scheduler; expose the running or paused image source, formatted `MM:SS`, and a
non-live accessible name containing both time and running/paused state. Start
with paused frame 1, alternate only while visible and paused, and make resume,
hide, and destroy idempotently cancel any scheduled interval.

#### 2. HUD clock markup and component integration

**Files**: `index.html`, `src/ui/components/runStatus.ts`

**Intent**: Render the controller output through the existing HUD clock so
players see only icon plus `MM:SS`, while assistive technology retains the
previously visible state information.

**Contract**: Address the clock image separately from the value span; keep the
image decorative (`alt=""`, `aria-hidden="true"`), render only `MM:SS` in the
visible value, and set an accessible label on the noninteractive clock
container. Wire component teardown to the presentation controller before
destroying the run-status port.

#### 3. Compact clock styling

**File**: `public/style.css`

**Intent**: Remove only the clock's visual card treatment so it consumes less
HUD space without changing other run-status panels or existing 32 px icon
rendering.

**Contract**: Exclude `#run-status-clock` from shared border/radius/background
rules and remove its desktop and mobile padding. Preserve inline icon/countdown
alignment and the existing responsive HUD grid.

#### 4. Deterministic presentation tests

**Files**: a new Node test under `tests/`, `package.json`

**Intent**: Prove exact animation cadence, state transitions, and lifecycle
cleanup with a fake scheduler rather than non-deterministic browser waits.

**Contract**: Add the focused UI-presentation Node suite to the existing fast
test pipeline. Cover running selection without an interval; paused frame-1
selection and 500 ms alternation; transition from paused to running; hide and
idempotent destroy cleanup; stale callbacks after cleanup; and accessible labels
for both states.

#### 5. Application journey regression coverage

**Files**: `tests/ui/applicationDesktopUiTest.ts`, `tests/ui/applicationMobileUiTest.ts`, `context/foundation/e2e_scenarios.md`

**Intent**: Keep the existing real-browser pause/resume journeys aligned with
the player-visible clock contract without using E2E to test timer internals.

**Contract**: Replace text-state assertions with accessible-name and image-source
assertions for running and paused states in the existing desktop and mobile
journeys. Refresh the E2E scenario inventory with
`/utils-describe-e2e-scenarios` after those tests change.

### Success Criteria:

#### Automated Verification:

- The focused presentation suite proves icon selection, 500 ms paused-frame
  alternation, cleanup, and accessible labels without real-time waits.
- `npm.cmd run test:fast` passes, including the new focused suite.
- `npm.cmd run typecheck` passes.
- `npm.cmd run test:ui` passes if the pre-existing local Chromium installation
  is available; it verifies the updated desktop and mobile pause/resume journeys.

#### Manual Verification:

- During a running HUD, the clock shows the running icon and `MM:SS` with no
  clock card background or frame.
- Opening a pause-producing UI state visibly alternates the two paused icons
  every half second while the countdown remains stable; resuming immediately
  restores the running icon.
- The compact clock remains readable and correctly positioned in desktop and
  mobile HUD layouts.

**Implementation Note**: After automated verification passes, obtain human
confirmation of the manual HUD checks before considering this phase complete.

## Testing Strategy

Use the new fast scheduler-controlled test for presentation timing and cleanup.
Retain the existing Playwright application journeys only for the browser-level
integration of HUD rendering with real game pause/resume paths. Do not install
Chromium as ordinary validation; `test:ui` is conditional on the existing local
browser setup.

## Performance Considerations

Only one 500 ms interval may run, and only while the HUD is both visible and
paused. No timer is created while running, hidden, or after destruction.

## Migration Notes

No data migration or compatibility work is required because no persisted state
or application contract changes.

## References

- Frame brief: `context/changes/rework-clock/frame.md`
- Existing HUD component: `src/ui/components/runStatus.ts:18-84`
- Existing DOM interval lifecycle: `src/ui/components/landingStatus.ts:50-55,166-179`
- Test guidance: `context/foundation/testing.md:7-8,25-27`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Implement and verify compact clock presentation

#### Automated

- [x] 1.1 The focused presentation suite proves icon selection, 500 ms paused-frame alternation, cleanup, and accessible labels without real-time waits.
- [x] 1.2 `npm.cmd run test:fast` passes, including the new focused suite.
- [x] 1.3 `npm.cmd run typecheck` passes.
- [x] 1.4 `npm.cmd run test:ui` passes if the pre-existing local Chromium installation is available; it verifies the updated desktop and mobile pause/resume journeys.

#### Manual

- [x] 1.5 During a running HUD, the clock shows the running icon and `MM:SS` with no clock card background or frame.
- [x] 1.6 Opening a pause-producing UI state visibly alternates the two paused icons every half second while the countdown remains stable; resuming immediately restores the running icon.
- [x] 1.7 The compact clock remains readable and correctly positioned in desktop and mobile HUD layouts.
