---
change_id: catch-broken-saved-games
title: Preserve unreadable saved game state
status: implemented
created: 2026-10-25
updated: 2026-10-25
archived_at: null
---

## Notes

If reading a game state payload from `active_run_saves` fails and prevents the player from continuing, save that state to `broken_run_saves`. The table has the same schema as `active_run_saves`. Keep at most one row for each `user_id` + `run_id`; skip duplicate save attempts. Run broken-save operations in the background and silence failures.
