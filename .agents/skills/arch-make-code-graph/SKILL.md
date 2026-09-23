---
name: arch-make-code-graph
description: Build or check MilkyWayTrader's deterministic JSON dependency graph from TypeScript declarations and referenced assets. Use only when a user explicitly requests creation, refresh, or validation of context/foundation/code-graph.json.
---

Run from the repository root:

```powershell
node .agents/skills/arch-make-code-graph/scripts/build-code-graph.mjs
```

The script owns source discovery, parsing, layer classification, dependency resolution, incremental caching and JSON serialization. Do not reconstruct or patch graph nodes with the LLM. Read [the graph contract](references/graph-contract.md) only when changing the schema, layer rules, or generator.

Use `--check` for a non-writing freshness check and `--force` only when the requested output already contains JSON not owned by this generator. Optional `--root`, `--source`, `--output`, and `--cache` paths support fixtures or alternate repositories; relative paths resolve from `--root`.

Success prints the graph status plus parsed, reused and deleted file counts. Treat a nonzero exit as blocked: preserve the reported syntax or ownership error and do not edit the generated JSON manually. Completion requires a created, updated, unchanged, or current graph at the requested output path.
