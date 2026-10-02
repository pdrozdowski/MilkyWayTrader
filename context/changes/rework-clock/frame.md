# Frame Brief: Compact HUD clock state

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

The clock state is currently displayed as text in the HUD and occupies more
visual space than desired.

## Initial Framing (preserved)

- **User's stated cause or approach**: A compact icon can communicate running
  and paused clock state more efficiently than text.
- **User's proposed direction**: Keep `MM:SS`, use the existing running-clock
  icon while active, alternate the two supplied paused-clock images every
  0.5 seconds while paused, and remove the clock background and frame.
- **Pre-dispatch narrowing**: HUD only; both footprint and immediate
  running-versus-paused recognition matter; this is a visual redesign with no
  other observed clock-display problem.

## Dimension Map

The observation could originate at any of these dimensions:

1. **HUD rendering** — the component may combine the countdown and state into
   one visible string.
2. **Presentation lifecycle and accessibility** — image state may not update
   from the existing projection, or replacing visible status text could remove
   semantic state for assistive technology.
3. **HUD clock styling** — shared card declarations may be responsible for the
   unwanted background, border, and excess footprint.  ← initial framing

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| HUD rendering combines time and state | `src/ui/components/runStatus.ts:18-21` formats `MM:SS`; :46-49 renders it with `RUNNING` or `PAUSED`. The markup already contains a clock image and separate value span at `index.html:24`. | STRONG |
| Presentation lifecycle/accessibility needs explicit handling | The projection supplies `remainingSeconds` and `runState` from authoritative clock state at `src/game/application/runStatus.ts:7-12,24-30`; deduplicated adapter updates stop while paused at `src/ui/adapters/runStatusAdapter.ts:13-23`. A comparable 500 ms DOM image interval is cleared on destroy at `src/ui/components/landingStatus.ts:50-55,166-179`. The existing icon is decorative and the removed text is the state exposure (`index.html:24`). | STRONG |
| Clock styling creates the framed footprint | Shared clock rules add border, radius, and background at `public/style.css:80`; the clock-specific padding is at :84 and mobile padding at :250. The existing 32 px image styling is at :94. | STRONG |

## Narrowing Signals

- The user scoped the work to the HUD rather than other clock-related surfaces.
- Both compactness and clear state recognition are required.
- No positioning, contrast, overlap, or clock-behavior defect was reported.
- The investigation is decisive, so no further hypothesis-narrowing questions
  were needed.

## Cross-System Convention

The earlier anonymous-run-status work defines the HUD as a semantic DOM
projection backed by authoritative, versioned game state
(`context/archive/2026-09-21-s01-anonymous-run-status/plan.md:90-118`). The
current projection already preserves the required clock facts; presentation
animation belongs in the UI lifecycle rather than the authoritative clock.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Replace the HUD clock's textual
> run-state presentation and framed card treatment with a compact, accessible
> UI projection that visually distinguishes active and paused state without
> altering authoritative clock behavior.

The initial framing was correct about the visual scope. The plan must also
preserve semantic access to the time and state after removing visible state
text, and ensure paused-image animation starts, stops, and cleans up entirely
within the DOM component.

## Confidence

- **HIGH** — direct code evidence identifies the sole text renderer, the
  existing state projection, all supplied image assets, the styling source, and
  an in-project interval cleanup precedent.

## What Changes for /10x-plan

Plan a presentation-only HUD change: markup/component behavior, focused clock
CSS, accessibility semantics, and proportionate regression coverage. Do not
change game-clock state, pause reasons, snapshots, or persistence.

## References

- Source files: `index.html:21-28`, `src/ui/components/runStatus.ts:18-49`,
  `src/game/application/runStatus.ts:24-30`,
  `src/ui/adapters/runStatusAdapter.ts:13-23`, `public/style.css:80-94,250`,
  `src/ui/components/landingStatus.ts:50-55,166-179`
- Related decision: `context/archive/2026-09-21-s01-anonymous-run-status/plan.md:90-118`
- Investigation tasks: `/root/hud_render`, `/root/hud_style`
