# Game state rules

- Use `$utils-add-state` for every authoritative state addition or modification.
- Keep declarations readonly, behavior-free and JSON-safe. State modules depend only on other state modules.
- Represent spatial pairs with `Vector2State` fields such as `position` and `velocity`; never persist a `Phaser.Math.Vector2` instance.
- Put transitions in pure mechanics reducers and replace state only through `GameStateProvider`.
- Update the versioned codec and tests with aggregate changes, then refresh the code graph and logical data diagram.
