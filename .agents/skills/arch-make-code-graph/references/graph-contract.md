# Code graph contract

The generator writes deterministic JSON with no timestamp:

```json
{
  "schemaVersion": 1,
  "generator": "arch-make-code-graph",
  "sourceRoot": "src",
  "nodes": [
    {
      "id": "src/game/audio/audioScope#AudioScope",
      "name": "AudioScope",
      "layer": "model",
      "module": "src/game/audio/audioScope",
      "kind": "class"
    }
  ],
  "edges": [
    {
      "from": "src/game/audio/gameAudio#getAudioService",
      "to": "src/game/audio/audioService#AudioService",
      "kind": "imports"
    }
  ]
}
```

Nodes represent top-level named classes, interfaces, type aliases, functions, enums and variables. Merged declarations in one module share a node. Asset nodes use `asset:<repository-relative-path>` IDs, the asset basename as `name`, and the repository-relative asset path as `module`. External packages are excluded.

Edges use `uses`, `extends`, `implements`, `imports`, `glob-imports`, or `asset`. Arrays are sorted by stable IDs and edge tuples.

## Layers

Rules are applied in this order:

1. `asset`: resolved static files and declarations under `src/assets/`.
2. `data`: `src/data/`, `src/game/state/`, `definitions/`, declaration files, and modules named `definition.ts`, `types.ts`, `contracts.ts`, `registry.ts`, or `gameObjects.ts`.
3. `ui`: `src/ui/`, `src/main.ts`, `src/game/main.ts`, and modules under `src/game/scenes/`, `src/game/effects/`, or `src/game/visual/`.
4. `model`: every remaining TypeScript declaration.

The ignored cache stores source hashes and extracted per-file facts. Cache contents are invalidated when the generator, schema, rules, source root, or `tsconfig.json` changes.
