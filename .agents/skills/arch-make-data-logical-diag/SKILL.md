---
name: arch-make-data-logical-diag
description: Generate or validate MilkyWayTrader's logical data diagram for authoritative, persistable game state from code-graph.json. Use after state-model or dependency-graph changes and when reviewing mixed state and behavior.
---

Run from the repository root after refreshing the dependency graph with [$arch-make-code-graph](../arch-make-code-graph/SKILL.md):

```powershell
node .agents/skills/arch-make-data-logical-diag/scripts/build-data-logical-diag.mjs
```

The script traverses state declarations reachable from `GameStateSnapshot`, extracts their fields from TypeScript, and owns `context/foundation/data-logical-diagram.md`. Read [the diagram contract](references/diagram-contract.md) when changing its format or boundary rules.

Use `--check` for a non-writing validation and `--force` only when the user has authorized replacing an unowned target. Optional `--root`, `--input`, and `--output` paths support fixtures; relative paths resolve from `--root`.

Treat `STALE_GRAPH` as a request to refresh `code-graph.json`. Treat `REFACTOR_REQUIRED` as an architecture failure: normal mode writes the partial diagram with line-specific findings, while check mode never writes. Refactor state behind `GameStateProvider`, rerun both generators, and finish only with a current diagram and no findings.
