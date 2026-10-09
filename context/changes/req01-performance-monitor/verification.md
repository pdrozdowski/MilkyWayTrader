# Verification: Debug-Controlled Performance Monitor

## Recorded observation (monitor ON)

- **Source**: screenshot of the running panel shared by the user on 2026-10-09; no file or
  browser telemetry was exported by the monitor itself, by design.
- **Browser / machine**: not captured in the screenshot - to be filled in by the operator.
- **Session**: single 5-second rolling window while the panel was live and gameplay was running.

| Row | Average | Minimum | Maximum |
| --- | --- | --- | --- |
| Loops/second | 14.7 /s | - | - |
| Frame interval | 67.99 ms | - | 125.80 ms |
| Update phase | 63.56 ms | - | 110.60 ms |
| Scene render | 3.14 ms | - | 5.40 ms |
| Unaccounted | 4.47 ms | - | 56.10 ms |
| Input intent | 0.01 ms | 0.00 ms | 0.10 ms |
| State snapshot | 4.83 ms | 3.30 ms | 8.90 ms |
| State commit | 41.28 ms | 30.10 ms | 77.00 ms |
| Feedback and ship sync | 0.06 ms | 0.00 ms | 0.20 ms |
| Planets | 1.40 ms | 0.90 ms | 2.90 ms |
| Weapon and asteroids | 6.04 ms | 4.30 ms | 12.70 ms |
| Removals and effects | 0.04 ms | 0.00 ms | 0.30 ms |
| Cargo and commodities | 0.03 ms | 0.00 ms | 0.20 ms |

- **Footer**: `Window: 5.0 s, Frames: 74` (74 frames over 5 s = 14.8 loops/second, consistent
  with the reported rate).

## Derived readings

- The frame is update-bound: the update phase is 63.56 ms of a 67.99 ms frame interval (94 %),
  while scene render is 3.14 ms.
- The dominant step is `state commit` at 41.28 ms average (65 % of the frame interval, 77 % of
  the summed step time). `state snapshot` adds 4.83 ms, and `weapon-asteroids` 6.04 ms.
- The eight step averages sum to 53.69 ms, so ~9.87 ms of the update phase is the `step`-event UI
  listener work plus marker overhead. This is the surplus the panel's note documents, and it
  matches the plan's expectation that the update phase legitimately exceeds the sum of the steps.
- Relationship checks from the plan's manual criteria: every step average is below the update
  phase average, and update + scene render + unaccounted (71.17 ms) is within ~5 % of the frame
  interval (67.99 ms). The small excess is the published window semantics: `unaccounted` and
  `sceneRender` cover only frames that reported all three spans and are clamped at zero, while
  the frame interval covers every frame in the window.
- The reading answers the question this change exists for: the measurable cost sits in the
  authoritative state boundary (the reducer + commit + publish + that frame's UI projections),
  not in Phaser scene rendering.

## Overhead comparison (monitor OFF)

Not captured yet. The plan asks for the same gameplay spot with the monitor off so the instrument's
own cost can be judged; this needs a second pass and remains open for the manual checklist.

## Findings from this session

- **Panel legibility (new)**: at the moment of capture the panel's translucent background
  overlapped the run-status HUD, so the signed-in email rendered through the table header. The
  panel is `pointer-events: none` and never intercepted input, but the header row is hard to read
  against the HUD text behind it. Fix candidates: make the panel background opaque, and/or position
  it below the status bar rather than at a fixed 72 px offset.
- **Refresh rate**: the panel updated while the debug dialog was closed, which is the behaviour
  required by the plan.

## Still pending

- Progress rows 2.5-2.8 have to be confirmed by the operator (this capture supports the "panel
  appears, updates and survives with the dialog closed" parts; "numbers near the display refresh
  rate" does not hold in this session, where the game itself runs at ~15 loops/second).
- Progress rows 3.3-3.5: the 2-3 minute stutter/overhead judgement, the on-versus-off comparison
  above, and the menu/landing/trade regression pass.
- Browser and machine identification for this record.
