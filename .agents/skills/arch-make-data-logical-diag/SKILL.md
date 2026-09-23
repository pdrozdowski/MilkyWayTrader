---
name: arch-make-data-logical-diag
description: Generate or validate MilkyWayTrader's logical data diagram for authoritative, persistable game state from code-graph.json. Use after state-model or dependency-graph changes and when reviewing mixed state and behavior.
---

Run from the repository root with a current `context/foundation/code-graph.json` input:

```powershell
node .agents/skills/arch-make-data-logical-diag/scripts/build-data-logical-diag.mjs
```

The script traverses state declarations reachable from `GameStateSnapshot`, extracts their fields from TypeScript, and owns `context/foundation/data-logical-diagram.md`. Read [the diagram contract](references/diagram-contract.md) when changing its format or boundary rules.

Use `--check` for a non-writing validation and `--force` only when the user has authorized replacing an unowned target. Optional `--root`, `--input`, and `--output` paths support fixtures; relative paths resolve from `--root`.

Treat `STALE_GRAPH` as evidence that the supplied graph input is outdated. Treat `REFACTOR_REQUIRED` as an architecture failure: normal mode writes the partial diagram with line-specific findings, while check mode never writes. Refactor state behind `GameStateProvider`, then rerun this generator with an updated input.
