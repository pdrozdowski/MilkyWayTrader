---
name: utils-add-state
description: Add or change MilkyWayTrader authoritative gameplay state, clocks, timers, lifecycle fields, snapshots, or save/restore behavior through the central persistable state boundary. Do not use for presentation-only state, tuning, or user preferences.
---

Read [the architecture](../../../context/foundation/architecture.md) and classify each requested value before editing:

- authoritative simulation state belongs in the `GameStateSnapshot` aggregate;
- derived values belong in pure selectors or reducer results;
- input and presentation state remains transient in adapters;
- tuning and static data belongs in definitions;
- user preferences remain in a separate settings service.

Use lower camel case filenames and PascalCase exported types. State declarations in `src/game/state/` are readonly and JSON-safe; they contain no methods, Phaser/DOM values, callbacks, storage, randomness, `Date`, `Map`, `Set`, `undefined`, or non-finite values. Add behavior as pure reducers under mechanics. All replacement and restoration goes through `GameStateProvider`; presentation objects receive identity or readonly snapshots and only emit intent or synchronize visuals.

Model positions, velocities, offsets, and other coordinate pairs as `Vector2State` values rather than parallel scalar fields. Phaser scenes and objects convert these values to transient `Phaser.Math.Vector2` instances and use vector operations for arithmetic; snapshots never contain Phaser instances.

Update the versioned codec whenever the aggregate changes. A breaking persisted shape requires a schema-version increment and migration decision; stop for a product decision when safe migration or default semantics are unknown. Test validation, atomic restore, immutability, transitions, pause behavior, and serialization continuity appropriate to the change.

Finish by running focused tests, then refresh and validate both artifacts:

```powershell
node .agents/skills/arch-make-code-graph/scripts/build-code-graph.mjs
node .agents/skills/arch-make-data-logical-diag/scripts/build-data-logical-diag.mjs
node .agents/skills/arch-make-data-logical-diag/scripts/build-data-logical-diag.mjs --check
```

Do not hand off with `REFACTOR_REQUIRED` findings.
