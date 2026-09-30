# Coverage to move below Playwright

These checks were intentionally removed from the browser suite. Add them to the existing fast Node test suites (or a DOM-level component test runner if one is introduced); do not restore the browser harnesses.

## Domain and application integration

- Telemetry: installation/session identifiers, immutable event payloads, authorization headers, queue bounds/failure handling, teardown, and trade/launch event emission. Test `createTelemetryPort` and `createLandingStatusPort` with injected fakes.
- Market and cargo: trade quotes, stock/cargo/credit updates, cost basis, invalid-trade atomicity, and launch state transitions. Extend the existing `tests/domain/serotonMarket.test.mjs` and `tests/domain/gameState.test.mjs` suites.
- Booster/debug availability: test the authoritative unlock and debug command/application port directly rather than inspecting a debug menu.

## UI component integration

- Audio controls: rendering, actions, local persistence and listener cleanup with a fake audio port/storage.
- Display controls: portrait/fullscreen state, errors and scale refresh using a fake display port.
- Authentication controls: unsigned/unavailable/error/signed-in rendering, sign-in/sign-out calls and subscriptions using a fake `AuthPort`; keep Supabase out of these tests.
- Landing/market panel: rendering, focus management, selected commodity, quantity limits, trade affordance and launch callback using a fake `LandingStatusPort`.
- Game menu and run-status panel: menu callbacks/focus restoration, orientation state, status formatting, cargo and ship-information toggles using fake ports.

## Future E2E addition only when deterministic setup exists

Add one real application journey (not a fixture harness): `open game → deterministic landed state → market → buy commodity → verify cargo/credits → sell → launch`. Keep calculations and edge cases in domain tests.
