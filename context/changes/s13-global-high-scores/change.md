---
change_id: s13-global-high-scores
title: Score terminal runs and rank each player's best result
status: implemented
created: 2026-10-14
updated: 2026-10-14
archived_at: null
---

## Notes

At every game end, compare the run's final score with the signed-in player's single global record and update it only when the new score is higher. Players can view the resulting global high scores.

### UI layout

- Make GLOBAL HI-SCORE visually similar to the existing Personal Best dialog.
- Show the top 100 players by their best stored global score in columns: `#`, `NICKNAME`, `DATE`, and `SCORE`. The first column shows global places 1 through 100.
- Keep at most one global record per player. At every end game, regardless of outcome, compare the run's final score with that player's record; update it if the run is better and preserve it when the new score is lower.
- Calculate the final run score from: ending cash + cargo value (sum each cargo stack's quantity multiplied by its average acquisition cost, `totalCost / quantity`) + cumulative spending on ship upgrades and booster + cumulative spending on facility construction and upgrades.
- Keep cumulative ship-upgrade/booster and facility construction/upgrade spending counters in authoritative game state. Repairs do not count.
- On the end-game screen, show each score component separately, then `YOUR FINAL SCORE IS: xxx,xxx`. Use that same final score in both the personal result and global record.
- Do not include `DELETE`, `DELETE ALL`, `BEST`, or `OUTCOME` controls/columns.
- Show the signed-in player's Personal Best's global position (for example, `YOUR PERSONAL BEST IS GLOBALLY #X`); the same final-score contract applies to private and global records.
- Make GLOBAL HI-SCORE available from both the end-game menu and the main menu.

