# Frame Brief: Orbit exit and lifecycle indicators

> Framing step before implementation. This document separates the observed
> behavior from the initial explanation.

## Reported Observation

After launch, the ship drifts from the planet and is later automatically orbited again. The visible leaving-orbit boundary feels too far from the ship.

## Initial Framing (preserved)

- **User's stated cause or approach:** Correct the leaving-orbit math; use the last rendered orbit circle as the boundary.
- **User's proposed direction:** Keep capture after launch until the ship centre crosses that circle, use inward landing and outward launch circles, and clarify the labels.
- **Pre-dispatch narrowing:** Capture must include the physical planet area; launch does not itself end capture; the ship centre passing the outermost rendered orbit circle ends it.

## Dimension Map

1. **Authoritative capture threshold** — state could retain or reacquire capture at a boundary unrelated to presentation.
2. **Launch lifecycle transition** — launch could remove capture before the requested exit condition.
3. **Planet presentation geometry** — drawn rings could not expose the actual state boundary.
4. **Landing centre threshold** — its fixed radius could be larger than the requested interaction region.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Capture threshold mismatch | `planetLandingRadius` is `radius + ship radius + 72`, while rendered circles use scaled unrelated radii. | STRONG |
| Launch removes capture prematurely | `launchFromPlanet` clears capture and installs the lock immediately. | STRONG |
| Rendered circle is not state boundary | The guide ends at `visualRadius * .75`; the zone is `visualRadius + 60`; neither is capture geometry. | STRONG |
| Centre threshold exceeds requested region | Landing uses a fixed 50 px radius. | STRONG |

## Reframed Problem

There is no common definition of the orbit boundary. Launch creates a gap between physical-radius lock release and the different capture radius, so the ship first drifts and then is recaptured. Define one authoritative orbit-boundary geometry value consumed by capture, detach, launch-lock release, and the rendered outer ring; retain capture during launch-lock exit. Reduce centre-entry landing to 35 px. Presentation labels and ring direction are separate adapter behavior.
