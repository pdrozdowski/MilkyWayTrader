---
change_id: s12-personal-best-result
title: Personal best result across retained outcomes for signed-in user
status: impl_reviewed
created: 2026-10-13
updated: 2026-10-13
archived_at: null
---

## Notes

Signed-in players can review their saved run history and see their personal best. S-11 is not a prerequisite; S-06 supplies the remaining terminal outcomes. S-12 displays a `DELETE` button placeholder for each result; S-15 implements deletion of any result owned by the player.

## Personal Best — Run History UI

Redesign Personal Best as a paginated list of the authenticated player's saved runs. Reuse the existing dark navy game modal style and UI conventions. Keep the table readable in landscape orientation.

### Layout

- Center the title `★ PERSONAL BEST ★`.
- Show the highest final cash score prominently above the history table; highlight it in gold.
- Show columns for `DATE` (date the result was saved), `SCORE` (final cash balance), `OUTCOME` (`FREEDOM`, `PRISON`, `DEATH`, or `ABANDONED`), `BEST` (highest-scoring run), and `DELETE` (a placeholder button for that row).
- Sort by score descending, then date descending. Show five records per page with Previous and Next controls and a page indicator.
- Keep rows compact and low in height, without borders or boxed cells. Distinguish odd and even rows with alternating accent colors from the existing palette.
- Use a centered `CLOSE` button. Do not show an X close button.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         ★ PERSONAL BEST ★                            │
│                                                                      │
│  YOUR BEST SCORE                                                     │
│  ★ 248,750 CREDITS                                                   │
│                                                                      │
│  DATE          SCORE           OUTCOME       BEST    DELETE          │
│  12 OCT 2026   ★ 248,750       FREEDOM       BEST    Delete          │
│  09 OCT 2026     182,400       DEATH                 Delete          │
│  07 OCT 2026     124,800       PRISON                Delete          │
│  04 OCT 2026      98,500       ABANDONED             Delete          │
│  01 OCT 2026      75,200       DEATH                 Delete          │
│                                                                      │
│                      [ < ]  Page 1 / 3  [ > ]                        │
│                                                                      │
│                           [  CLOSE  ]                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Delete button placeholder

- Display a `DELETE` button for each result, without enabling deletion in S-12. The placeholder does not open a confirmation modal or send a delete request.
- S-15 owns the confirmation modal, deletion of any result owned by the player, ownership enforcement for deletion, list refresh, best-score recalculation after deletion, and deletion error handling.

### Other states

- Signed out: show the sign-in prompt.
- No saved runs: show `NO SCORES YET`.
- Loading: show a loading indicator.
- Loading error: show an error message and a retry option.

### Data and scope

- Calculate personal best from the authenticated player's retained results across all four outcomes, using final cash balance. Do not limit the calculation to death outcomes.
- Preserve results for `FREEDOM`, `PRISON`, `DEATH`, and `ABANDONED`.
- Enforce user-level read access in the backend. Deletion access belongs to S-15.
- Public leaderboards are outside this change.
