# Frame Brief: Mobile landscape menu buttons

> Framing step before implementation. This document keeps the reported effect
> separate from the initially assumed cause.

## Reported Observation

New Game Button and Continue Game button does not scale on mobile device and are like 3x too big.

## Initial Framing (preserved)

- **User's stated cause or approach**: The buttons do not scale on mobile.
- **User's proposed direction**: Make both buttons scale correctly on mobile.
- **Pre-dispatch narrowing**: Landscape.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Responsive breakpoint selection** — a width-only mobile rule can exclude a landscape phone whose CSS width is at least 600px.
2. **Image-button size declaration** — the specific button rule can retain its base width when a general mobile rule changes only its `min-width`.
3. **Viewport measurement** — browser viewport or safe-area sizing could supply unexpectedly large dimensions.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Breakpoint selection excludes landscape | `public/style.css:68` targets only `max-width: 599px`; landscape phones can exceed that width. | STRONG |
| Image-button width remains at the desktop value | `public/style.css:53` sets `width: min(374px, 76vw)` for these IDs; `public/style.css:71` changes only the general button `min-width`, so it does not override that width. | STRONG |
| Viewport measurement is faulty | `index.html:7` contains a standard responsive viewport declaration and `public/style.css:20` uses `100dvh`; no project evidence indicates a viewport measurement defect. | NONE |

## Narrowing Signals

- The issue is limited to mobile landscape.
- The buttons affected are the two image-backed buttons governed by the more specific width rule.

## Cross-System Convention

The project already distinguishes touch-sized landscape layouts in planning records. Responsive artwork must be constrained by the limiting viewport axis rather than only a portrait-width breakpoint.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: The image-backed main-menu buttons retain their desktop width in mobile landscape because their responsive sizing is neither selected for that orientation nor overridden at the ID rule's specificity.

The initial framing was directionally correct, but the issue is CSS rule selection and precedence rather than a general mobile scaling failure. The correction should constrain those two button dimensions in compact landscape viewports.

## Confidence

- **HIGH** — direct stylesheet evidence matches the landscape-only report; the viewport declaration does not support the competing hypothesis.

## What Changes for Implementation

Update the responsive CSS for the two image-backed main-menu buttons so compact landscape dimensions constrain their width and preserve their aspect ratio.

## References

- Source files: `public/style.css:45-56`, `public/style.css:68-72`, `index.html:7,16-19`
- Prior convention: `context/changes/s04-first-planetary-trade/plan.md:230`
