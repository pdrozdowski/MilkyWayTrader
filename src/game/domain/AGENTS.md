# Domain rules

- Keep business state and rules in plain TypeScript with no Phaser, DOM, audio, storage, network, clock or random dependencies.
- Accept dependencies through application-layer ports. Return immutable state or explicit results instead of mutating presentation objects.
- Add focused tests under `tests/domain/` with every business rule. Cover boundaries, invalid inputs, state transitions and input immutability.
- Spatial coordinates and colliders belong to `world`; real-time movement and weapons belong to `mechanics`.
- Authoritative run state belongs in the readonly `GameStateSnapshot` aggregate, not domain objects or Phaser adapters. Use `$utils-add-state` for snapshot, clock, timer, lifecycle, save, or restore changes.
