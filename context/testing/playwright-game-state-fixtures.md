# Playwright game-state fixtures

`tests/ui/gameStateFixture.ts` composes a fresh run from `initialGameState`, applies selected player and market values, and prepares the browser before a business test starts.

Authentication remains separate: import `test` from `tests/ui/testSessionFixture.ts` and set `test.use({ testSessionMode: 'authenticated' })` in the relevant describe block. The session fixture creates a unique local user and removes it after each test.

Call `prepareGameState(page, planetId, options)` before the business operation. It supports:

- `planetId`: `seroton`, `lactozis-7c`, or `maslo-prime`; preparation lands through the existing Debug Menu teleport control.
- `credits`: initial cash, defaulting to `100_000`.
- `cargo`: stacks of `{ commodityId, quantity, totalCost? }`; omit or pass `[]` for empty cargo.
- `marketCommodity` and `marketStock`: selected commodity's deterministic initial stock, defaulting to grain and 40. Facilities are disabled in the fixture markets to keep stock stable during the test.

Example:

```ts
await prepareGameState(page, 'lactozis-7c', {
    credits: 25_000,
    cargo: [{ commodityId: 'grain', quantity: 3, totalCost: 3_000 }],
    marketCommodity: 'grain',
    marketStock: 40
});
```

The test-mode app consumes this fixture once when starting the new run. It only overrides credits, cargo, and market state; the rest of the state comes from the standard initial state. Keep setup here and execute the behavior under test through normal UI controls.
