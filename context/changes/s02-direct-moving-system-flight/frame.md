# Frame Brief: Desktop control debugging

> Framing step before implementation. This document separates the reported
> observation from the initial explanation and proposed diagnostic surface.

## Reported Observation

Mouse drag on the visible joystick does not move the ship.

## Initial Framing (preserved)

- **User's stated cause or approach:** The canvas handler may be capturing mouse input.
- **User's proposed direction:** Add a `D`-opened debug menu with touch-control and mouse-movement toggles.
- **Pre-dispatch narrowing:** Disabling mouse movement must also disable normal desktop click-to-steer; the touch-control override defaults to off.

## Dimension Map

1. **Joystick pointer ownership** — the interactive zone must claim and retain the mouse pointer.
2. **Scene steering ownership** — desktop click-to-steer must be independently suppressible without suppressing joystick input.
3. **Control visibility** — desktop touch-control presentation must be independently togglable.
4. **Debug UI lifecycle** — the menu must dispatch only transient scene settings and clean up its listeners.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Pointer ownership fails | `gameScene.ts` claims the joystick pointer and updates it while down. | WEAK |
| Desktop steering masks joystick testing | `startSteering` accepts every primary non-touch pointer. | STRONG |
| Desktop controls need a visibility switch | `layoutScreenSpace` currently makes them always visible. | STRONG |
| Debug settings need persistence | Input and control visibility are transient scene concerns. | NONE |

## Reframed Problem

Provide a transient debugging surface that independently toggles desktop click-to-steer and touch-control visibility, so mouse joystick input can be isolated without changing snapshots or production state.

## Scope Boundary

- In scope: `D` debug menu, transient event bridge, scene input/visibility toggles.
- Out of scope: saved preferences, snapshot changes, or changing touch-device defaults.
