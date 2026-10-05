---
change_id: s09-asteroid-salvage
title: S09 asteroid salvage
status: planned
created: 2026-10-04
updated: 2026-10-05
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

2026-10-04 owner decisions: cargo modal pauses active time; loose-item motion
linearly blends its initial vector from 100% to 0% over 10 active seconds while
the vector toward the sun blends from 0% to 100%; cargo takes projectile damage
only; the modal has a Close button; a full-cargo pickup attempt shows
`WARNING - CARGO IS FULL` for 2 seconds; S09 models snapshot/codec state only,
with durable save/load deferred to S11. Existing `cargo_32x32.png` and
`cargo2_32x32.png` are placeholder animation frames for 0.2 and 1 second.

2026-10-04 owner decisions, continued: cargo follows the same star-centered
orbit calculation as planets; its activation zone is 20px and is visibly
indicated like a planet orbit. Cargo and loose items each use a 15px collision
radius and do not need a world-boundary cull. A loose item's initial vector
uses the deterministic asteroid ship-impact fragmentation direction. Use
`sun_asteroid_low_slurp_loud_no_noise.wav` for sun consumption and
`asteroid_crash_metal_clean.wav` for cargo destruction. Generated 32px
placeholder commodity icons are in `public/assets/icons/commodity-*-placeholder_32x32.png`.
