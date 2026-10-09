---
change_id: s05-planet-ship-services
title: S05 planet ship services
status: archived
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09T17:35:21Z
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

### Post-implementation decision: uniform volley spacing (2026-10-09)

Manual inspection found the planned parity patterns produced uneven volley spacing: even counts left a
10° hole directly ahead and odd counts squeezed the front pair to 2.5° while every other gap was 5°.
The product owner decided volley spacing is uniform instead. `volleyAngleOffsetsDegrees` now places
neighbouring projectiles one 5° step apart, centred on the heading — odd counts fire the forward shot
with mirrored pairs outside it, even counts straddle the heading at ±2.5°. `BR-044a` in
`context/foundation/prd.md` was rewritten to match and passes the `10x-prd-en-capability` gate, so the
PRD remains the authority; the Phase 2 contract text in `plan.md` and the frame's angle table still
describe the superseded patterns and are left as the historical record.
